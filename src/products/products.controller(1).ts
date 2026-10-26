import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { AdminProductQueryDto, ProductQueryDto, ProductWriteDto, SetActiveDto } from './products.dto';
import { ProductsService } from './products.service';

@ApiTags('products') @Controller('products')
export class ProductsController {
  constructor(private p: ProductsService) {}
  @Get() list(@Query() q: ProductQueryDto) { return this.p.list(q); }
  @Get('featured') featured(@Query('limit') limit?: string) { return this.p.featured(Math.max(1, Math.min(24, Number(limit) || 8))); }
  @Get(':slug') one(@Param('slug') slug: string) { return this.p.bySlug(slug); }
}

@ApiTags('admin') @Controller('admin/products') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
export class AdminProductsController {
  constructor(private p: ProductsService) {}
  @Get() list(@Query() q: AdminProductQueryDto) { return this.p.adminList(q); }
  @Get(':id') one(@Param('id') id: string) { return this.p.adminGet(id); }
  @Post() create(@Body() dto: ProductWriteDto) { return this.p.create(dto); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: ProductWriteDto) { return this.p.update(id, dto); }
  @Patch(':id/active') active(@Param('id') id: string, @Body() dto: SetActiveDto) { return this.p.setActive(id, dto.isActive); }
  @Delete(':id') remove(@Param('id') id: string) { return this.p.remove(id); }
}
