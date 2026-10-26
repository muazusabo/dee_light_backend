import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Roles } from '../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { InventoryService } from './inventory.service';

class SetStockDto {
  @IsOptional() @IsString() variantId?: string;
  @IsOptional() @IsString() productId?: string;
  @IsInt() @Min(0) quantity: number;
}
@ApiTags('admin') @Controller('admin/inventory') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
export class InventoryController {
  constructor(private inv: InventoryService) {}
  @Get('low-stock') low() { return this.inv.lowStock(); }
  @Patch('stock') set(@Body() dto: SetStockDto) { return this.inv.setStock(dto, dto.quantity); }
}
