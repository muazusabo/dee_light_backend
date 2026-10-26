import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class VariantDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @MinLength(1) @MaxLength(80) name: string;
  @IsOptional() @IsString() @MaxLength(60) sku?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100_000_000) priceOverride?: number | null;
  @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000) stockQuantity: number;
  @IsOptional() @IsString() @MaxLength(40) size?: string;
  @IsOptional() @IsString() @MaxLength(40) color?: string;
  @IsOptional() @IsString() @MaxLength(40) volume?: string;
  @IsOptional() @IsObject() attributes?: Record<string, unknown>;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
