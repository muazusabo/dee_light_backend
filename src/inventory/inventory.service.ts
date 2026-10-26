import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type StockLine = { productId: string; variantId: string | null; quantity: number; label?: string };

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  /** Atomic conditional decrement: the UPDATE only matches when enough stock remains, so concurrent orders cannot oversell. */
  async reserve(tx: Prisma.TransactionClient, lines: StockLine[]) {
    for (const l of lines) {
      if (l.variantId) {
        const r = await tx.productVariant.updateMany({ where: { id: l.variantId, productId: l.productId, isActive: true, stockQuantity: { gte: l.quantity } }, data: { stockQuantity: { decrement: l.quantity } } });
        if (r.count !== 1) throw new ConflictException(`Not enough stock for ${l.label ?? 'an item'}`);
      } else {
        const p = await tx.product.findUnique({ where: { id: l.productId }, select: { trackStock: true } });
        if (!p) throw new ConflictException(`${l.label ?? 'An item'} is no longer available`);
        if (!p.trackStock) continue;
        const r = await tx.product.updateMany({ where: { id: l.productId, isActive: true, stockQuantity: { gte: l.quantity } }, data: { stockQuantity: { decrement: l.quantity } } });
        if (r.count !== 1) throw new ConflictException(`Not enough stock for ${l.label ?? 'an item'}`);
      }
    }
  }

  /** Restore stock for an order exactly once (guarded by Order.stockRestored). */
  async restoreForOrder(tx: Prisma.TransactionClient, orderId: string) {
    const claimed = await tx.order.updateMany({ where: { id: orderId, stockRestored: false }, data: { stockRestored: true } });
    if (claimed.count !== 1) return false;
    const items = await tx.orderItem.findMany({ where: { orderId } });
    for (const it of items) {
      if (it.variantId) await tx.productVariant.updateMany({ where: { id: it.variantId }, data: { stockQuantity: { increment: it.quantity } } });
      else if (it.productId) await tx.product.updateMany({ where: { id: it.productId, trackStock: true }, data: { stockQuantity: { increment: it.quantity } } });
    }
    return true;
  }

  async lowStock(threshold = 5) {
    const [products, variants] = await Promise.all([
      this.prisma.product.findMany({ where: { isActive: true, trackStock: true, variants: { none: { isActive: true } }, stockQuantity: { lte: threshold } }, select: { id: true, name: true, stockQuantity: true }, orderBy: { stockQuantity: 'asc' }, take: 20 }),
      this.prisma.productVariant.findMany({ where: { isActive: true, stockQuantity: { lte: threshold }, product: { isActive: true, trackStock: true } }, select: { id: true, name: true, stockQuantity: true, product: { select: { id: true, name: true } } }, orderBy: { stockQuantity: 'asc' }, take: 20 }),
    ]);
    return [
      ...products.map((p) => ({ productId: p.id, name: p.name, stock: p.stockQuantity })),
      ...variants.map((v) => ({ productId: v.product.id, name: `${v.product.name} — ${v.name}`, stock: v.stockQuantity })),
    ].sort((a, b) => a.stock - b.stock).slice(0, 20);
  }

  async setStock(target: { variantId?: string; productId?: string }, quantity: number) {
    if (target.variantId) {
      const r = await this.prisma.productVariant.updateMany({ where: { id: target.variantId }, data: { stockQuantity: quantity } });
      if (!r.count) throw new NotFoundException('Variant not found');
    } else if (target.productId) {
      const r = await this.prisma.product.updateMany({ where: { id: target.productId }, data: { stockQuantity: quantity } });
      if (!r.count) throw new NotFoundException('Product not found');
    }
    return { updated: true };
  }
}
