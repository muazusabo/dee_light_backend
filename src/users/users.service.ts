import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddressDto, UpdateProfileDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}
  updateProfile(id: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({ where: { id }, data: dto, select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true } });
  }
  addresses(userId: string) { return this.prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }], take: 20 }); }
  async addAddress(userId: string, dto: AddressDto) {
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.address.count({ where: { userId } });
      if (count >= 10) throw new NotFoundException('Address limit reached');
      const isDefault = dto.isDefault || count === 0;
      if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.create({ data: { ...dto, userId, isDefault } });
    });
  }
  async removeAddress(userId: string, id: string) {
    const r = await this.prisma.address.deleteMany({ where: { id, userId } });
    if (!r.count) throw new NotFoundException('Address not found');
    return { deleted: true };
  }
  async list(search: string | undefined, page: number, pageSize: number) {
    const where = { role: 'CUSTOMER' as const, ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { email: { contains: search, mode: 'insensitive' as const } }] } : {}) };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, name: true, email: true, phone: true, status: true, createdAt: true, _count: { select: { orders: true } } } }),
    ]);
    return { items, total };
  }
}
