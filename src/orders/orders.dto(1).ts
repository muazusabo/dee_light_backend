import { Transform, Type } from 'class-transformer';
import { IsEmail, IsEnum, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { FulfilmentType, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { PaginationDto } from '../common/pagination';
import { PHONE_RE } from '../users/users.dto';

export class DeliveryAddressDto {
  @IsString() @MinLength(3) @MaxLength(200) line1: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @IsString() @MinLength(2) @MaxLength(80) city: string;
  @IsString() @MinLength(2) @MaxLength(80) state: string;
  @IsOptional() @IsString() @MaxLength(300) notes?: string;
}
export class CreateOrderDto {
  @IsEnum(FulfilmentType) fulfilmentType: FulfilmentType;
  @IsString() @MinLength(2) @MaxLength(80) customerName: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)) @IsEmail() customerEmail: string;
  @IsString() @Matches(PHONE_RE, { message: 'Enter a valid phone number' }) customerPhone: string;
  @IsOptional() @ValidateNested() @Type(() => DeliveryAddressDto) deliveryAddress?: DeliveryAddressDto;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsEnum(PaymentMethod) paymentMethod: PaymentMethod;
  @IsString() @MinLength(16) @MaxLength(64) idempotencyKey: string;
}
export class AdminOrderQueryDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsEnum(OrderStatus) status?: OrderStatus;
  @IsOptional() @IsEnum(PaymentStatus) paymentStatus?: PaymentStatus;
}
export class UpdateOrderStatusDto { @IsEnum(OrderStatus) status: OrderStatus; }
export class UpdatePaymentStatusDto { @IsIn(['UNPAID', 'VERIFIED', 'REJECTED', 'REFUNDED']) paymentStatus: PaymentStatus; }
