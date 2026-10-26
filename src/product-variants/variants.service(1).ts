import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { VariantDto } from './variants.dto';

@Injectable()
export class VariantsService {
  /** Reconcile a product's variants with the submitted list. Variants with order history are deactivated rather than deleted. */
  async sync(tx: Prisma.TransactionClient, productId: string, incoming: VariantDto[]) {
    const names = new Set<string>();
    for (const v of incoming) {
      const k = v.name.trim().toLowerCase();
      if (names.has(k)) throw new BadRequestException(`Duplicate variant name "${v.name}"`);
      names.add(k);
    }
    const existing = await tx.productVariant.findMany({ where: { productId }, select: { id: true } });
    const existingIds = new Set(existing.map((e) => e.id));
    const keep = new Set<string>();
    for (const v of incoming) {
      const data = {
        name: v.name.trim(), sku: v.sku?.trim() || null, priceOverride: v.priceOverride == null ? null : new Prisma.Decimal(v.priceOverride.toFixed(2)),
        stockQuantity: v.stockQuantity, size: v.size?.trim() || null, color: v.color?.trim() || null, volume: v.volume?.trim() || null,
        attributes: (v.attributes ?? undefined) as Prisma.InputJsonValue | undefined, isActive: v.isActive ?? true,
      };
      if (v.id) {
        if (!existingIds.has(v.id)) throw new BadRequestException('A variant does not belong to this product');
        await tx.productVariant.update({ where: { id: v.id }, data });
        keep.add(v.id);
      } else {
        const created = await tx.productVariant.create({ data: { ...data, productId } });
        keep.add(created.id);
      }
    }
    for (const e of existing) {
      if (keep.has(e.id)) continue;
      const used = await tx.orderItem.count({ where: { variantId: e.id } });
      if (used > 0) await tx.productVariant.update({ where: { id: e.id }, data: { isActive: false } });
      else await tx.productVariant.delete({ where: { id: e.id } });
    }
  }
}
