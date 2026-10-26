import { Prisma } from '@prisma/client';
import { D, money } from '../common/money';

export type PricingProduct = {
  id: string; name: string; slug: string; basePrice: Prisma.Decimal; isActive: boolean; categoryActive: boolean; trackStock: boolean; stockQuantity: number; unit?: string | null;
  image?: string | null;
  variants: { id: string; name: string; sku: string | null; priceOverride: Prisma.Decimal | null; stockQuantity: number; isActive: boolean; size?: string | null; color?: string | null; volume?: string | null }[];
};
export type LineInput = { productId: string; variantId?: string | null; quantity: number };
export const MAX_QTY = 99;

/** Pure pricing/validation of one cart line. The server is the only authority for price and availability. */
export function computeLine(input: LineInput, product: PricingProduct | undefined) {
  const base = { productId: input.productId, variantId: input.variantId ?? null, quantity: input.quantity };
  const fail = (issue: string) => ({ ...base, name: product?.name ?? 'Unavailable product', slug: product?.slug ?? null, image: product?.image ?? null, variantName: null as string | null, unit: null as string | null,
    unitPrice: D(0), lineTotal: D(0), available: 0 as number | null, issue, ok: false as const });
  if (!product || !product.isActive || !product.categoryActive) return fail('This product is no longer available');
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > MAX_QTY) return fail(`Quantity must be between 1 and ${MAX_QTY}`);
  const activeVariants = product.variants.filter((v) => v.isActive);
  let unitPrice = product.basePrice; let available: number | null; let variantName: string | null = null;
  if (activeVariants.length) {
    if (!input.variantId) return fail('Please choose an option');
    const v = activeVariants.find((x) => x.id === input.variantId);
    if (!v) return fail('The selected option is no longer available');
    unitPrice = v.priceOverride ?? product.basePrice; available = v.stockQuantity; variantName = v.name;
  } else {
    if (input.variantId) return fail('The selected option is not valid for this product');
    available = product.trackStock ? product.stockQuantity : null;
  }
  const price = money(unitPrice);
  const out = { ...base, name: product.name, slug: product.slug, image: product.image ?? null, variantName, unit: product.unit ?? null, unitPrice: price, lineTotal: money(price.mul(input.quantity)), available };
  if (available !== null && available <= 0) return { ...out, issue: 'Out of stock', ok: false as const };
  if (available !== null && input.quantity > available) return { ...out, issue: `Only ${available} left in stock`, ok: false as const };
  return { ...out, issue: null as string | null, ok: true as const };
}

export function sumLines(lines: { lineTotal: Prisma.Decimal; ok: boolean }[]) {
  return money(lines.filter((l) => l.ok).reduce((a, l) => a.add(l.lineTotal), D(0)));
}
