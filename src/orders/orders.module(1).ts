import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { AdminOrdersController, OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
@Module({ imports: [CartModule], controllers: [OrdersController, AdminOrdersController], providers: [OrdersService], exports: [OrdersService] })
export class OrdersModule {}
