import { PrismaService } from '../prisma/prisma.service';

export const RESERVED_SLUGS = ['admin', 'account', 'api', 'login', 'register', 'forgot-password', 'reset-password', 'cart', 'checkout', 'search', 'products', 'about', '_next', 'sitemap.xml', 'robots.txt'];

export function slugify(input: string): string {
  return input.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'item';
}

export async function uniqueProductSlug(prisma: PrismaService, base: string, excludeId?: string): Promise<string> {
  const root = ['featured'].includes(slugify(base)) ? slugify(base) + '-item' : slugify(base);
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`;
    const found = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!found || found.id === excludeId) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}
