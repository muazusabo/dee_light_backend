import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { InventoryService } from '../inventory/inventory.service';
import { SettingsService } from '../settings/settings.service';
import { UploadsService } from '../uploads/uploads.service';
import { money } from '../common/money';
import { pageMeta } from '../common/pagination';
import { AdminOrderQueryDto, CreateOrderDto } from './orders.dto';
import { canTransition, newOrderNumber } from './order-status';

const orderInclude = { items: { orderBy: { id: 'asc' as const } }, history: { orderBy: { createdAt: 'asc' as const } } } satisfies Prisma.OrderInclude;
const stripProof = <T extends { paymentProofKey: string | null }>(o: T) => { const { paymentProofKey, ...rest } = o; return { ...rest, hasPaymentProof: !!paymentProofKey }; };

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService, private cart: CartService, private inventory: InventoryService, private settings: SettingsService, private uploads: UploadsService) {}

  async create(userId: string, dto: CreateOrderDto) {
    const prior = await this.prisma.order.findUnique({ where: { idempotencyKey: dto.idempotencyKey }, include: orderInclude });
    if (prior) { if (prior.userId !== userId) throw new ConflictException('Duplicate submission'); return stripProof(prior); }

    const s = await this.settings.get();
    if (dto.fulfilmentType === 'DELIVERY' && !s.deliveryEnabled) throw new BadRequestException('Delivery is not currently available');
    if (dto.fulfilmentType === 'COLLECTION' && !s.collectionEnabled) throw new BadRequestException('Collection is not currently available');
    if (dto.fulfilmentType === 'DELIVERY' && !dto.deliveryAddress) throw new BadRequestException('A delivery address is required');
    if (dto.paymentMethod === 'CASH_ON_DELIVERY' && dto.fulfilmentType !== 'DELIVERY') throw new BadRequestException('Cash on delivery requires delivery');
    if (dto.paymentMethod === 'CASH_ON_COLLECTION' && dto.fulfilmentType !== 'COLLECTION') throw new BadRequestException('Cash on collection requires collection');

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const order = await this.prisma.$transaction(async (tx) => {
          const cart = await tx.cart.findUnique({ where: { userId }, include: { items: { orderBy: { createdAt: 'asc' } } } });
          if (!cart?.items.length) throw new BadRequestException('Your cart is empty');
          const priced = await this.cart.priceLines(cart.items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })), tx);
          const bad = priced.lines.find((l) => !l.ok);
          if (bad) throw new ConflictException(`${bad.name}: ${bad.issue}`);
          await this.inventory.reserve(tx, priced.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity, label: l.name })));
          const deliveryFee = dto.fulfilmentType === 'DELIVERY' ? money(s.deliveryFee) : money(0);
          const variantRows = await tx.productVariant.findMany({ where: { id: { in: priced.lines.map((l) => l.variantId).filter((x): x is string => !!x) } } });
          const vmap = new Map(variantRows.map((v) => [v.id, v]));
          const created = await tx.order.create({
            data: {
              orderNumber: newOrderNumber(), idempotencyKey: dto.idempotencyKey, userId, fulfilmentType: dto.fulfilmentType, paymentMethod: dto.paymentMethod,
              subtotal: priced.subtotal, deliveryFee, total: money(priced.subtotal.add(deliveryFee)),
              customerName: dto.customerName.trim(), customerEmail: dto.customerEmail, customerPhone: dto.customerPhone.trim(),
              deliveryAddress: dto.fulfilmentType === 'DELIVERY' ? (dto.deliveryAddress as any) : undefined, notes: dto.notes?.trim() || null,
              items: { create: priced.lines.map((l) => {
                const v = l.variantId ? vmap.get(l.variantId) : undefined;
                return { productId: l.productId, variantId: l.variantId, productName: l.name, variantName: l.variantName, sku: v?.sku ?? null,
                  variantSnapshot: v ? { size: v.size, color: v.color, volume: v.volume } : undefined, quantity: l.quantity, unitPrice: l.unitPrice, lineTotal: l.lineTotal };
              }) },
              history: { create: { toStatus: 'PENDING', changedBy: userId } },
            },
            include: orderInclude,
          });
          await tx.cartItem.deleteMany({ where: { cartId: cart.id } }); // cleared only inside the same transaction that created the order
          return created;
        }, { timeout: 15000 });
        return stripProof(order);
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          const dup = await this.prisma.order.findUnique({ where: { idempotencyKey: dto.idempotencyKey }, include: orderInclude });
          if (dup && dup.userId === userId) return stripProof(dup); // concurrent double-submit
          continue; // order-number collision: retry with a new number
        }
        throw e;
      }
    }
    throw new ConflictException('Could not create the order, please try again');
  }

  async listMine(userId: string, page: number, pageSize: number) {
    const where = { userId };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, orderNumber: true, status: true, paymentStatus: true, total: true, createdAt: true, _count: { select: { items: true } } } }),
    ]);
    return { items, ...pageMeta(total, page, pageSize) };
  }
  async getMine(userId: string, id: string) {
    const o = await this.prisma.order.findFirst({ where: { id, userId }, include: orderInclude });
    if (!o) throw new NotFoundException('Order not found');
    return stripProof(o);
  }
  async cancelMine(userId: string, id: string) {
    const o = await this.getMine(userId, id);
    if (o.status !== 'PENDING' || o.paymentStatus === 'VERIFIED') throw new ForbiddenException('This order can no longer be cancelled online. Please contact the store.');
    return this.changeStatus(id, 'CANCELLED', userId);
  }
  async uploadProof(userId: string, id: string, file: Express.Multer.File) {
    const o = await this.getMine(userId, id);
    if (o.paymentMethod !== 'BANK_TRANSFER') throw new BadRequestException('Proof of payment is only needed for bank transfers');
    if (o.status === 'CANCELLED') throw new BadRequestException('This order was cancelled');
    if (o.paymentStatus === 'VERIFIED') throw new BadRequestException('Payment is already verified');
    const key = await this.uploads.putPrivate(file);
    // Payment is NOT verified by an upload; it only moves to PROOF_SUBMITTED for an admin to review.
    await this.prisma.order.update({ where: { id }, data: { paymentProofKey: key, paymentStatus: 'PROOF_SUBMITTED' } });
    return this.getMine(userId, id);
  }

  // ----- admin -----
  async adminList(q: AdminOrderQueryDto) {
    const where: Prisma.OrderWhereInput = {
      ...(q.status ? { status: q.status } : {}), ...(q.paymentStatus ? { paymentStatus: q.paymentStatus } : {}),
      ...(q.q ? { OR: [{ orderNumber: { contains: q.q, mode: 'insensitive' } }, { customerName: { contains: q.q, mode: 'insensitive' } }, { customerEmail: { contains: q.q, mode: 'insensitive' } }, { customerPhone: { contains: q.q } }] } : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, select: { id: true, orderNumber: true, customerName: true, status: true, paymentStatus: true, fulfilmentType: true, total: true, createdAt: true } }),
    ]);
    return { items, ...pageMeta(total, q.page, q.pageSize) };
  }
  async adminGet(id: string) {
    const o = await this.prisma.order.findUnique({ where: { id }, include: { ...orderInclude, user: { select: { id: true, name: true, email: true } } } });
    if (!o) throw new NotFoundException('Order not found');
    const proofUrl = o.paymentProofKey ? await this.uploads.signedUrl(o.paymentProofKey).catch(() => null) : null;
    return { ...stripProof(o), paymentProofUrl: proofUrl };
  }
  async changeStatus(id: string, to: OrderStatus, actorId: string) {
    await this.prisma.$transaction(async (tx) => {
      const o = await tx.order.findUnique({ where: { id }, select: { status: true, paymentStatus: true } });
      if (!o) throw new NotFoundException('Order not found');
      if (!canTransition(o.status, to)) throw new BadRequestException(`Cannot change an order from ${o.status} to ${to}`);
      const claimed = await tx.order.updateMany({ where: { id, status: o.status }, data: { status: to } }); // optimistic guard against concurrent updates
      if (claimed.count !== 1) throw new ConflictException('The order was changed by someone else. Reload and try again.');
      if (to === 'CANCELLED') await this.inventory.restoreForOrder(tx, id);
      await tx.orderStatusHistory.create({ data: { orderId: id, fromStatus: o.status, toStatus: to, changedBy: actorId } });
    });
    return this.adminGet(id);
  }
  async setPaymentStatus(id: string, paymentStatus: PaymentStatus) {
    const o = await this.prisma.order.findUnique({ where: { id }, select: { status: true } });
    if (!o) throw new NotFoundException('Order not found');
    if (paymentStatus === 'VERIFIED' && o.status === 'CANCELLED') throw new BadRequestException('Cannot verify payment on a cancelled order');
    await this.prisma.order.update({ where: { id }, data: { paymentStatus } });
    return this.adminGet(id);
  }
}
