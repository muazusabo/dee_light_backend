import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { CategoryDto, UpdateCategoryDto } from './categories.dto';
import { CategoriesService } from './categories.service';

@ApiTags('categories') @Controller('categories')
export class CategoriesController {
  constructor(private c: CategoriesService) {}
  @Get() list() { return this.c.list(); }
  @Get(':slug') one(@Param('slug') slug: string) { return this.c.bySlug(slug); }
  @Get(':slug/filters') filters(@Param('slug') slug: string) { return this.c.filters(slug); }
}

@ApiTags('admin') @Controller('admin/categories') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
export class AdminCategoriesController {
  constructor(private c: CategoriesService) {}
  @Get() list() { return this.c.list(true); }
  @Post() create(@Body() dto: CategoryDto) { return this.c.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) { return this.c.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.c.remove(id); }
}
