import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsNumber, IsObject, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional() @IsString() @MaxLength(80) storeName?: string;
  @IsOptional() @IsString() @MaxLength(1000) storeDescription?: string;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(40) contactPhone?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsString() @MaxLength(300) businessAddress?: string;
  @IsOptional() @IsObject() socialLinks?: Record<string, string>;
  @IsOptional() @IsBoolean() deliveryEnabled?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1_000_000) deliveryFee?: number;
  @IsOptional() @IsBoolean() collectionEnabled?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) paymentInstructions?: string;
}
