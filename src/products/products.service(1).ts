import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { uniqueProductSlug } from '../common/slug';
import { D } from '../common/money';
import { pageMeta } from '../common/pagination';
import { VariantsService } from '../product-variants/variants.service';
import { assertTrustedImageUrl } from '../uploads/image.util';
import { AdminProductQueryDto, ProductQueryDto, ProductSort, ProductWriteDto } from './products.dto';

const listSelect = {
  id: true, name: true, slug: true, basePrice: true, comparePrice: true, brand: true, productType: true, isFeatured: true, trackStock: true, stockQuantity: true, unit: true,
  category: { select: { name: true, slug: true } },
  images: { orderBy: [{ isPrimary: 'desc' as const }, { displayOrder: 'asc' as const }], take: 1, select: { url: true, alt: true } },
  variants: { where: { isActive: true }, select: { priceOverride: true, stockQuantity: true } },
} satisfies Prisma.ProductSelect;

type ListRow = Prisma.ProductGetPayload<{ select: typeof listSelect }>;

export function summarize(p: ListRow) {
  const hasVariants = p.variants.length > 0;
  const prices = hasVariants ? p.variants.map((v) => v.priceOverride ?? p.basePrice) : [p.basePrice];
  const fromPrice = prices.reduce((a, b) => (D(b).lt(a) ? b : a));
  const inStock = hasVariants ? p.variants.some((v) => v.stockQuantity > 0) : !p.trackStock || p.stockQuantity > 0;
  const { variants: _v, trackStock: _t, stockQuantity: _s, images, ...rest } = p;
  return { ...rest, image: images[0] ?? null, hasVariants, fromPrice, inStock };
}

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService, private variants: VariantsService) {}

  buildWhere(q: ProductQueryDto): Prisma.ProductWhereInput {
    const and: Prisma.ProductWhereInput[] = [{ isActive: true }];
    const slugs = q.category?.split(',').map((s) => s.trim()).filter(Boolean);
    and.push({ category: { isActive: true, ...(slugs?.length ? { slug: { in: slugs } } : {}) } });
    if (q.q) and.push({ OR: ['name', 'description', 'brand', 'productType'].map((f) => ({ [f]: { contains: q.q, mode: 'insensitive' } })) as Prisma.ProductWhereInput[] });
    if (q.type) and.push({ productType: { equals: q.type, mode: 'insensitive' } });
    if (q.brand) and.push({ brand: { equals: q.brand, mode: 'insensitive' } });
    if (q.unit) and.push({ unit: { equals: q.unit, mode: 'insensitive' } });
    if (q.material) and.push({ attributes: { path: ['material'], string_contains: q.material, mode: 'insensitive' } as any });
    for (const f of ['color', 'size', 'volume'] as const) {
      if (q[f]) and.push({ variants: { some: { isActive: true, [f]: { equals: q[f], mode: 'insensitive' } } } });
    }
    if (q.minPrice !== undefined || q.maxPrice !== undefined) {
      const range = { ...(q.minPrice !== undefined ? { gte: q.minPrice } : {}), ...(q.maxPrice !== undefined ? { lte: q.maxPrice } : {}) };
      and.push({ OR: [{ variants: { none: { isActive: true } }, basePrice: range }, { variants: { some: { isActive: true, OR: [{ priceOverride: range }, { priceOverride: null, product: { basePrice: range } }] } } }] });
    }
    if (q.inStock) and.push({ OR: [{ variants: { none: { isActive: true } }, OR: [{ trackStock: false }, { stockQuantity: { gt: 0 } }] }, { variants: { some: { isActive: true, stockQuantity: { gt: 0 } } } }] });
    if (q.featured) and.push({ isFeatured: true });
    return { AND: and };
  }

  async list(q: ProductQueryDto) {
    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      q.sort === ProductSort.newest ? [{ createdAt: 'desc' }]
      : q.sort === ProductSort.price_asc ? [{ basePrice: 'asc' }, { id: 'asc' }]
      : q.sort === ProductSort.price_desc ? [{ basePrice: 'desc' }, { id: 'asc' }]
      : [{ isFeatured: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }];
    const where = this.buildWhere(q);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({ where, orderBy, skip: (q.page - 1) * q.pageSize, take: q.pageSize, select: listSelect }),
    ]);
    return { items: rows.map(summarize), ...pageMeta(total, q.page, q.pageSize) };
  }

  async featured(limit = 8) {
    const rows = await this.prisma.product.findMany({ where: { isActive: true, isFeatured: true, category: { isActive: true } }, orderBy: { updatedAt: 'desc' }, take: Math.min(limit, 24), select: listSelect });
    return rows.map(summarize);
  }

  async bySlug(slug: string) {
    const p = await this.prisma.product.findFirst({
      where: { slug, isActive: true, category: { isActive: true } },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }], select: { id: true, url: true, alt: true } },
        variants: { where: { isActive: true }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, sku: true, priceOverride: true, stockQuantity: true, size: true, color: true, volume: true, attributes: true } },
      },
    });
    if (!p) throw new NotFoundException('Product not found');
    const related = await this.prisma.product.findMany({ where: { isActive: true, categoryId: p.categoryId, id: { not: p.id } }, orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }], take: 4, select: listSelect });
    const hasVariants = p.variants.length > 0;
    const { stockQuantity, trackStock, ...rest } = p;
    return { ...rest, hasVariants, inStock: hasVariants ? p.variants.some((v) => v.stockQuantity > 0) : !trackStock || stockQuantity > 0, stockQuantity: hasVariants ? undefined : trackStock ? stockQuantity : null, related: related.map(summarize) };
  }

  // ----- admin -----
  async adminList(q: AdminProductQueryDto) {
    const where: Prisma.ProductWhereInput = {
      ...(q.categoryId ? { categoryId: q.categoryId } : {}), ...(q.active !== undefined ? { isActive: q.active } : {}),
      ...(q.q ? { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { brand: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize,
        select: { id: true, name: true, slug: true, basePrice: true, isActive: true, isFeatured: true, stockQuantity: true, trackStock: true, category: { select: { name: true } }, images: { take: 1, orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }], select: { url: true } }, _count: { select: { variants: true } } } }),
    ]);
    return { items, ...pageMeta(total, q.page, q.pageSize) };
  }
  async adminGet(id: string) {
    const p = await this.prisma.product.findUnique({ where: { id }, include: { images: { orderBy: { displayOrder: 'asc' } }, variants: { orderBy: { createdAt: 'asc' } } } });
    if (!p) throw new NotFoundException('Product not found');
    return p;
  }

  private validate(dto: ProductWriteDto) {
    if (dto.comparePrice != null && dto.comparePrice <= dto.basePrice) throw new BadRequestException('Comparison price must be higher than the price');
    dto.images?.forEach((i) => assertTrustedImageUrl(i.url));
  }
  private scalar(dto: ProductWriteDto) {
    return {
      name: dto.name.trim(), description: dto.description?.trim() || null, categoryId: dto.categoryId,
      basePrice: new Prisma.Decimal(dto.basePrice.toFixed(2)), comparePrice: dto.comparePrice == null ? null : new Prisma.Decimal(dto.comparePrice.toFixed(2)),
      brand: dto.brand?.trim() || null, productType: dto.productType?.trim() || null, unit: dto.unit?.trim() || null,
      attributes: (dto.attributes ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      trackStock: dto.trackStock ?? true, stockQuantity: dto.stockQuantity ?? 0, isFeatured: dto.isFeatured ?? false, isActive: dto.isActive ?? true,
    };
  }
  private imageRows(dto: ProductWriteDto) {
    const imgs = dto.images ?? [];
    const primary = imgs.findIndex((i) => i.isPrimary);
    return imgs.map((i, idx) => ({ url: i.url, storageKey: i.storageKey ?? null, alt: i.alt ?? dto.name, displayOrder: idx, isPrimary: primary === -1 ? idx === 0 : idx === primary }));
  }
  private async ensureCategory(id: string) {
    if (!(await this.prisma.category.findUnique({ where: { id }, select: { id: true } }))) throw new BadRequestException('Unknown category');
  }

  async create(dto: ProductWriteDto) {
    this.validate(dto); await this.ensureCategory(dto.categoryId);
    const slug = await uniqueProductSlug(this.prisma, dto.name);
    return this.prisma.$transaction(async (tx) => {
      const p = await tx.product.create({ data: { ...this.scalar(dto), slug, images: { create: this.imageRows(dto) } } });
      if (dto.variants?.length) await this.variants.sync(tx, p.id, dto.variants);
      return p;
    }, { timeout: 15000 });
  }
  async update(id: string, dto: ProductWriteDto) {
    this.validate(dto); await this.ensureCategory(dto.categoryId);
    const current = await this.prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!current) throw new NotFoundException('Product not found');
    return this.prisma.$transaction(async (tx) => {
      const p = await tx.product.update({ where: { id }, data: this.scalar(dto) }); // slug stays stable so shared links keep working
      if (dto.images) { await tx.productImage.deleteMany({ where: { productId: id } }); await tx.productImage.createMany({ data: this.imageRows(dto).map((r) => ({ ...r, productId: id })) }); }
      if (dto.variants) await this.variants.sync(tx, id, dto.variants);
      return p;
    }, { timeout: 15000 });
  }
  async setActive(id: string, isActive: boolean) {
    const r = await this.prisma.product.updateMany({ where: { id }, data: { isActive } });
    if (!r.count) throw new NotFoundException('Product not found');
    return { isActive };
  }
  /** Hard-delete only when no order references the product; otherwise deactivate so order history stays intact. */
  async remove(id: string) {
    const used = await this.prisma.orderItem.count({ where: { productId: id } });
    if (used > 0) { await this.setActive(id, false); return { deleted: false, deactivated: true }; }
    const r = await this.prisma.product.deleteMany({ where: { id } });
    if (!r.count) throw new NotFoundException('Product not found');
    return { deleted: true, deactivated: false };
  }
}
