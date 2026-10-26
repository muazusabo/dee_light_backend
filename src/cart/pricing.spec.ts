import { Prisma } from '@prisma/client';
import { computeLine, PricingProduct, sumLines } from './pricing';

const D = (v: string) => new Prisma.Decimal(v);
const product = (over: Partial<PricingProduct> = {}): PricingProduct => ({
  id: 'p1', name: 'Perfume', slug: 'perfume', basePrice: D('10000.00'), isActive: true, categoryActive: true, trackStock: true, stockQuantity: 5, variants: [], ...over,
});
const variant = (id: string, price: string | null, stock: number, isActive = true) => ({ id, name: id, sku: null, priceOverride: price ? D(price) : null, stockQuantity: stock, isActive });

describe('computeLine', () => {
  it('prices a simple product from the database price and computes the line total', () => {
    const l = computeLine({ productId: 'p1', quantity: 3 }, product());
    expect(l.ok).toBe(true);
    expect(l.unitPrice.toString()).toBe('10000');
    expect(l.lineTotal.toString()).toBe('30000');
  });
  it('uses the variant price override', () => {
    const l = computeLine({ productId: 'p1', variantId: 'v50', quantity: 2 }, product({ variants: [variant('v50', '15000.50', 9)] }));
    expect(l.ok).toBe(true);
    expect(l.lineTotal.toString()).toBe('30001');
  });
  it('requires a variant when the product has active variants', () => {
    const l = computeLine({ productId: 'p1', quantity: 1 }, product({ variants: [variant('v30', null, 3)] }));
    expect(l.ok).toBe(false);
    expect(l.issue).toMatch(/choose/i);
  });
  it('rejects a variant that does not belong to the product', () => {
    const l = computeLine({ productId: 'p1', variantId: 'other', quantity: 1 }, product({ variants: [variant('v30', null, 3)] }));
    expect(l.ok).toBe(false);
  });
  it('rejects quantity above stock and out-of-stock items', () => {
    expect(computeLine({ productId: 'p1', quantity: 6 }, product()).issue).toMatch(/Only 5/);
    expect(computeLine({ productId: 'p1', quantity: 1 }, product({ stockQuantity: 0 })).issue).toBe('Out of stock');
  });
  it('rejects inactive products and invalid quantities', () => {
    expect(computeLine({ productId: 'p1', quantity: 1 }, product({ isActive: false })).ok).toBe(false);
    expect(computeLine({ productId: 'p1', quantity: 0 }, product()).ok).toBe(false);
    expect(computeLine({ productId: 'p1', quantity: 1 }, undefined).ok).toBe(false);
  });
  it('does not limit quantity when stock is not tracked', () => {
    expect(computeLine({ productId: 'p1', quantity: 50 }, product({ trackStock: false, stockQuantity: 0 })).ok).toBe(true);
  });
  it('sums only valid lines with exact decimal arithmetic', () => {
    const a = computeLine({ productId: 'p1', quantity: 1 }, product({ basePrice: D('0.10') }));
    const b = computeLine({ productId: 'p1', quantity: 2 }, product({ basePrice: D('0.20') }));
    expect(sumLines([a, b]).toString()).toBe('0.5');
  });
});
