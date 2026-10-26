import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { PaginationDto } from '../common/pagination';
import { imageInterceptor } from '../uploads/uploads.controller';
import { AdminOrderQueryDto, CreateOrderDto, UpdateOrderStatusDto, UpdatePaymentStatusDto } from './orders.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders') @Controller('orders') @UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private orders: OrdersService) {}
  @Post() @Throttle({ default: { limit: 10, ttl: 60_000 } }) create(@CurrentUser() u: AuthUser, @Body() dto: CreateOrderDto) { return this.orders.create(u.id, dto); }
  @Get() list(@CurrentUser() u: AuthUser, @Query() q: PaginationDto) { return this.orders.listMine(u.id, q.page, q.pageSize); }
  @Get(':id') one(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.orders.getMine(u.id, id); }
  @Post(':id/cancel') cancel(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.orders.cancelMine(u.id, id); }
  @Post(':id/payment-proof') @ApiConsumes('multipart/form-data') @Throttle({ default: { limit: 10, ttl: 60_000 } }) @UseInterceptors(imageInterceptor())
  proof(@CurrentUser() u: AuthUser, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) { return this.orders.uploadProof(u.id, id, file); }
}

@ApiTags('admin') @Controller('admin/orders') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
export class AdminOrdersController {
  constructor(private orders: OrdersService) {}
  @Get() list(@Query() q: AdminOrderQueryDto) { return this.orders.adminList(q); }
  @Get(':id') one(@Param('id') id: string) { return this.orders.adminGet(id); }
  @Patch(':id/status') status(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateOrderStatusDto) { return this.orders.changeStatus(id, dto.status, u.id); }
  @Patch(':id/payment') payment(@Param('id') id: string, @Body() dto: UpdatePaymentStatusDto) { return this.orders.setPaymentStatus(id, dto.paymentStatus); }
}
