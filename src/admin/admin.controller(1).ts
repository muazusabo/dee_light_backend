import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Roles } from '../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { PaginationDto, pageMeta } from '../common/pagination';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

class CustomerQuery extends PaginationDto { @IsOptional() @IsString() @MaxLength(100) q?: string; }

@ApiTags('admin') @Controller('admin') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
export class AdminController {
  constructor(private prisma: PrismaService, private inventory: InventoryService, private users: UsersService) {}

  /** All figures are computed from the database. Revenue = total of orders whose payment was verified by an admin and that are not cancelled. */
  @Get('dashboard')
  async dashboard() {
    const pendingProofWhere = { paymentStatus: 'PROOF_SUBMITTED' as const, status: { not: 'CANCELLED' as const } };
    const [totalProducts, activeProducts, totalOrders, pendingOrders, processingOrders, completedOrders, revenue, pendingProofCount, pendingProofAmount, customers, lowStock] = await Promise.all([
      this.prisma.product.count(), this.prisma.product.count({ where: { isActive: true } }), this.prisma.order.count(),
      this.prisma.order.count({ where: { status: 'PENDING' } }),
      this.prisma.order.count({ where: { status: { in: ['CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] } } }),
      this.prisma.order.count({ where: { status: 'COMPLETED' } }),
      this.prisma.order.aggregate({ where: { paymentStatus: 'VERIFIED', status: { not: 'CANCELLED' } }, _sum: { total: true } }),
      this.prisma.order.count({ where: pendingProofWhere }),
      this.prisma.order.aggregate({ where: pendingProofWhere, _sum: { total: true } }),
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }), this.inventory.lowStock(),
    ]);
    return {
      totalProducts, activeProducts, totalOrders, pendingOrders, processingOrders, completedOrders, customers,
      revenue: revenue._sum.total ?? 0, pendingProofCount, pendingProofAmount: pendingProofAmount._sum.total ?? 0, lowStock,
    };
  }

  @Get('summary')
  async summary() {
    const pendingOrders = await this.prisma.order.count({ where: { status: 'PENDING' } });
    return { pendingOrders };
  }

  @Get('customers')
  async customers(@Query() q: CustomerQuery) {
    const { items, total } = await this.users.list(q.q, q.page, q.pageSize);
    return { items, ...pageMeta(total, q.page, q.pageSize) };
  }
}
