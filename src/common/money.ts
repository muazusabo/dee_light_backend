import { Prisma } from '@prisma/client';
export const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
export const money = (v: Prisma.Decimal.Value) => D(v).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
