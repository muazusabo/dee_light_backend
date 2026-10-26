import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CartModule } from './cart/cart.module';
import { CategoriesModule } from './categories/categories.module';
import { CommonModule } from './common/common.module';
import { AllExceptionsFilter, RequestIdMiddleware, ResponseInterceptor } from './common/filters';
import { CsrfGuard } from './common/guards';
import { HealthController } from './health/health.controller';
import { InventoryModule } from './inventory/inventory.module';
import { MailModule } from './mail/mail.module';
import { OrdersModule } from './orders/orders.module';
import { VariantsModule } from './product-variants/variants.module';
import { ProductsModule } from './products/products.module';
import { PrismaModule } from './prisma/prisma.module';
import { SettingsModule } from './settings/settings.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule, CommonModule, MailModule, SettingsModule, UploadsModule, InventoryModule, VariantsModule,
    AuthModule, UsersModule, CategoriesModule, ProductsModule, CartModule, OrdersModule, AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) { consumer.apply(RequestIdMiddleware).forRoutes('*'); }
}
