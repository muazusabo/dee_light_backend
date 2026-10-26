import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { money } from '../common/money';
import { CartLineDto } from './cart.dto';
import { computeLine, LineInput, MAX_QTY, PricingProduct, sumLines } from './pricing';

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService, private settings: SettingsService) {}

  /** Price lines from current database state. Never trusts client-supplied prices. */
  async priceLines(inputs: LineInput[], db: Db = this.prisma) {
    const ids = [...new Set(inputs.map((i) => i.productId))];
    const products = await db.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, slug: true, basePrice: true, isActive: true, trackStock: true, stockQuantity: true, unit: true, category: { select: { isActive: true } },
        images: { orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }], take: 1, select: { url: true } },
        variants: { select: { id: true, name: true, sku: true, priceOverride: true, stockQuantity: true, isActive: true, size: true, color: true, volume: true } } },
    });
    const map = new Map<string, PricingProduct>(products.map((p) => [p.id, { ...p, categoryActive: p.category.isActive, image: p.images[0]?.url ?? null }]));
    const lines = inputs.map((i) => computeLine(i, map.get(i.productId)));
    return { lines, subtotal: sumLines(lines), valid: lines.every((l) => l.ok) };
  }

  private async view(inputs: (LineInput & { id?: string })[]) {
    const priced = await this.priceLines(inputs);
    const s = await this.settings.get();
    const deliveryFee = s.deliveryEnabled ? money(s.deliveryFee) : money(0);
    return {
      lines: priced.lines.map((l, idx) => ({ ...l, id: inputs[idx].id ?? null })),
      subtotal: priced.subtotal, deliveryFee, deliveryEnabled: s.deliveryEnabled, collectionEnabled: s.collectionEnabled, valid: priced.valid,
      itemCount: inputs.reduce((a, i) => a + i.quantity, 0),
    };
  }

  quote(items: CartLineDto[]) { return this.view(items.map((i) => ({ productId: i.productId, variantId: i.variantId ?? null, quantity: i.quantity }))); }

  private async getOrCreate(userId: string) {
    return this.prisma.cart.upsert({ where: { userId }, update: {}, create: { userId } });
  }
  async get(userId: string) {
    const cart = await this.getOrCreate(userId);
    const items = await this.prisma.cartItem.findMany({ where: { cartId: cart.id }, orderBy: { createdAt: 'asc' }, take: 100 });
    return this.view(items.map((i) => ({ id: i.id, productId: i.productId, variantId: i.variantId, quantity: i.quantity })));
  }

  async add(userId: string, dto: CartLineDto) {
    const cart = await this.getOrCreate(userId);
    const variantKey = dto.variantId ?? 'none';
    const existing = await this.prisma.cartItem.findUnique({ where: { cartId_productId_variantKey: { cartId: cart.id, productId: dto.productId, variantKey } } });
    const quantity = Math.min(MAX_QTY, (existing?.quantity ?? 0) + dto.quantity);
    const { lines } = await this.priceLines([{ productId: dto.productId, variantId: dto.variantId ?? null, quantity }]);
    if (!lines[0].ok) throw new BadRequestException(lines[0].issue);
    await this.prisma.cartItem.upsert({
      where: { cartId_productId_variantKey: { cartId: cart.id, productId: dto.productId, variantKey } },
      update: { quantity }, create: { cartId: cart.id, productId: dto.productId, variantId: dto.variantId ?? null, variantKey, quantity },
    });
    return this.get(userId);
  }

  private async owned(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cart: { userId } } });
    if (!item) throw new NotFoundException('Cart item not found');
    return item;
  }
  async setQuantity(userId: string, itemId: string, quantity: number) {
    const item = await this.owned(userId, itemId);
    const { lines } = await this.priceLines([{ productId: item.productId, variantId: item.variantId, quantity }]);
    if (!lines[0].ok) throw new BadRequestException(lines[0].issue);
    await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
    return this.get(userId);
  }
  async remove(userId: string, itemId: string) {
    await this.owned(userId, itemId);
    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return this.get(userId);
  }

  /** Merge a guest's local cart after login. Invalid lines are skipped and quantities are capped to available stock. */
  async merge(userId: string, items: CartLineDto[]) {
    const cart = await this.getOrCreate(userId);
    for (const it of items) {
      const variantKey = it.variantId ?? 'none';
      const existing = await this.prisma.cartItem.findUnique({ where: { cartId_productId_variantKey: { cartId: cart.id, productId: it.productId, variantKey } } });
      let quantity = Math.min(MAX_QTY, (existing?.quantity ?? 0) + it.quantity);
      let { lines } = await this.priceLines([{ productId: it.productId, variantId: it.variantId ?? null, quantity }]);
      if (!lines[0].ok && lines[0].available && lines[0].available > 0 && lines[0].issue?.startsWith('Only')) {
        quantity = lines[0].available;
        ({ lines } = await this.priceLines([{ productId: it.productId, variantId: it.variantId ?? null, quantity }]));
      }
      if (!lines[0].ok) continue;
      await this.prisma.cartItem.upsert({
        where: { cartId_productId_variantKey: { cartId: cart.id, productId: it.productId, variantKey } },
        update: { quantity }, create: { cartId: cart.id, productId: it.productId, variantId: it.variantId ?? null, variantKey, quantity },
      });
    }
    return this.get(userId);
  }
}
