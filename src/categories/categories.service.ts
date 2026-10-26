import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RESERVED_SLUGS, slugify } from '../common/slug';
import { CategoryDto, UpdateCategoryDto } from './categories.dto';
import { assertTrustedImageUrl } from '../uploads/image.util';

/** Which filters make sense per category. Unknown/custom categories get the default set. */
export const CATEGORY_FILTERS: Record<string, string[]> = {
  menu: ['type', 'price', 'availability'],
  snacks: ['type', 'price'],
  drinks: ['type', 'brand', 'volume', 'price'],
  materials: ['type', 'color', 'unit', 'price'],
  shoes: ['size', 'color', 'brand', 'price'],
  perfumes: ['brand', 'type', 'volume', 'price'],
  jewelry: ['type', 'material', 'color', 'price'],
};
export const DEFAULT_FILTERS = ['type', 'brand', 'price'];

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}
  list(includeInactive = false) {
    return this.prisma.category.findMany({ where: includeInactive ? {} : { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], take: 100,
      select: { id: true, name: true, slug: true, description: true, imageUrl: true, sortOrder: true, isActive: true, ...(includeInactive ? { _count: { select: { products: true } } } : {}) } });
  }
  async bySlug(slug: string) {
    const c = await this.prisma.category.findFirst({ where: { slug, isActive: true }, select: { id: true, name: true, slug: true, description: true, imageUrl: true } });
    if (!c) throw new NotFoundException('Category not found');
    return c;
  }

  /** Filter options for a category, restricted to the filters relevant to it and built from real products. */
  async filters(slug: string) {
    const cat = await this.bySlug(slug);
    const wanted = CATEGORY_FILTERS[slug] ?? DEFAULT_FILTERS;
    const base = { isActive: true, categoryId: cat.id };
    const out: Record<string, unknown> = { filters: wanted };
    const distinct = (vals: (string | null)[]) => [...new Set(vals.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));
    if (wanted.includes('brand')) out.brands = distinct((await this.prisma.product.groupBy({ by: ['brand'], where: base })).map((r) => r.brand));
    if (wanted.includes('type')) out.types = distinct((await this.prisma.product.groupBy({ by: ['productType'], where: base })).map((r) => r.productType));
    if (wanted.includes('unit')) out.units = distinct((await this.prisma.product.groupBy({ by: ['unit'], where: base })).map((r) => r.unit));
    const vWhere = { isActive: true, product: base };
    if (wanted.includes('color')) out.colors = distinct((await this.prisma.productVariant.groupBy({ by: ['color'], where: vWhere })).map((r) => r.color));
    if (wanted.includes('size')) out.sizes = distinct((await this.prisma.productVariant.groupBy({ by: ['size'], where: vWhere })).map((r) => r.size));
    if (wanted.includes('volume')) out.volumes = distinct((await this.prisma.productVariant.groupBy({ by: ['volume'], where: vWhere })).map((r) => r.volume));
    if (wanted.includes('material')) {
      const rows = await this.prisma.product.findMany({ where: base, select: { attributes: true }, take: 500 });
      out.materials = distinct(rows.map((r) => ((r.attributes as any)?.material as string) ?? null));
    }
    if (wanted.includes('price')) {
      const agg = await this.prisma.product.aggregate({ where: base, _min: { basePrice: true }, _max: { basePrice: true } });
      out.price = { min: agg._min.basePrice, max: agg._max.basePrice };
    }
    return out;
  }

  async create(dto: CategoryDto) {
    const slug = dto.slug ?? slugify(dto.name);
    if (RESERVED_SLUGS.includes(slug)) throw new BadRequestException('That slug is reserved');
    assertTrustedImageUrl(dto.imageUrl);
    if (await this.prisma.category.findFirst({ where: { OR: [{ slug }, { name: dto.name }] } })) throw new ConflictException('A category with that name or slug already exists');
    return this.prisma.category.create({ data: { ...dto, slug } });
  }
  async update(id: string, dto: UpdateCategoryDto) {
    assertTrustedImageUrl(dto.imageUrl);
    const exists = await this.prisma.category.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Category not found');
    return this.prisma.category.update({ where: { id }, data: dto }); // slug is intentionally immutable (stable URLs)
  }
  async remove(id: string) {
    const n = await this.prisma.product.count({ where: { categoryId: id } });
    if (n > 0) throw new ConflictException(`This category has ${n} product(s). Move or delete them first, or deactivate the category instead.`);
    await this.prisma.category.delete({ where: { id } });
    return { deleted: true };
  }
}
