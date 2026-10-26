import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  { name: 'Menu', slug: 'menu', description: 'Main meals prepared fresh.' },
  { name: 'Snacks', slug: 'snacks', description: 'Pies, small chops, cakes and more.' },
  { name: 'Drinks', slug: 'drinks', description: 'Water, juices, soft drinks and smoothies.' },
  { name: 'Materials', slug: 'materials', description: 'Quality fabrics for every occasion.' },
  { name: 'Shoes', slug: 'shoes', description: 'Footwear for every style.' },
  { name: 'Perfumes', slug: 'perfumes', description: 'Fragrances for men, women and everyone.' },
  { name: 'Jewelry', slug: 'jewelry', description: 'Necklaces, rings, bracelets and accessories.' },
];

async function main() {
  for (const [i, c] of categories.entries()) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...c, sortOrder: i },
    });
  }
  await prisma.siteSetting.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
  console.log('Seeded categories and default settings (idempotent).');
}

main().finally(() => prisma.$disconnect());
