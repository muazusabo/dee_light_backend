import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthUser, CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards';
import { CartLineDto, CartLinesDto, UpdateQtyDto } from './cart.dto';
import { CartService } from './cart.service';

@ApiTags('cart') @Controller('cart')
export class CartController {
  constructor(private cart: CartService) {}
  /** Public: prices a guest's local cart from current database data. */
  @Post('quote') @Throttle({ default: { limit: 60, ttl: 60_000 } })
  quote(@Body() dto: CartLinesDto) { return this.cart.quote(dto.items); }

  @Get() @UseGuards(JwtAuthGuard) get(@CurrentUser() u: AuthUser) { return this.cart.get(u.id); }
  @Post('items') @UseGuards(JwtAuthGuard) add(@CurrentUser() u: AuthUser, @Body() dto: CartLineDto) { return this.cart.add(u.id, dto); }
  @Patch('items/:id') @UseGuards(JwtAuthGuard) setQty(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateQtyDto) { return this.cart.setQuantity(u.id, id, dto.quantity); }
  @Delete('items/:id') @UseGuards(JwtAuthGuard) remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.cart.remove(u.id, id); }
  @Post('merge') @UseGuards(JwtAuthGuard) merge(@CurrentUser() u: AuthUser, @Body() dto: CartLinesDto) { return this.cart.merge(u.id, dto.items); }
}
