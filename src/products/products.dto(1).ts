import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested, Max } from 'class-validator';
import { PaginationDto } from '../common/pagination';
import { VariantDto } from '../product-variants/variants.dto';

const bool = () => Transform(({ value }) => (value === 'true' || value === true ? true : value === 'false' || value === false ? false : undefined));
export enum ProductSort { featured = 'featured', newest = 'newest', price_asc = 'price_asc', price_desc = 'price_desc' }

export class ProductQueryDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsString() @MaxLength(300) category?: string; // one or more category slugs, comma separated
  @IsOptional() @IsString() @MaxLength(80) type?: string;
  @IsOptional() @IsString() @MaxLength(80) brand?: string;
  @IsOptional() @IsString() @MaxLength(40) color?: string;
  @IsOptional() @IsString() @MaxLength(40) size?: string;
  @IsOptional() @IsString() @MaxLength(40) volume?: string;
  @IsOptional() @IsString() @MaxLength(80) material?: string;
  @IsOptional() @IsString() @MaxLength(40) unit?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxPrice?: number;
  @IsOptional() @bool() @IsBoolean() inStock?: boolean;
  @IsOptional() @bool() @IsBoolean() featured?: boolean;
  @IsOptional() @IsEnum(ProductSort) sort: ProductSort = ProductSort.featured;
}

export class AdminProductQueryDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @bool() @IsBoolean() active?: boolean;
}

export class ProductImageDto {
  @IsString() @MaxLength(500) url: string;
  @IsOptional() @IsString() @MaxLength(300) storageKey?: string;
  @IsOptional() @IsString() @MaxLength(200) alt?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class ProductWriteDto {
  @IsString() @MinLength(2) @MaxLength(140) name: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsString() categoryId: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100_000_000) basePrice: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100_000_000) comparePrice?: number | null;
  @IsOptional() @IsString() @MaxLength(80) brand?: string;
  @IsOptional() @IsString() @MaxLength(80) productType?: string;
  @IsOptional() @IsString() @MaxLength(40) unit?: string;
  @IsOptional() @IsObject() attributes?: Record<string, unknown>;
  @IsOptional() @IsBoolean() trackStock?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000) stockQuantity?: number;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => ProductImageDto) images?: ProductImageDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => VariantDto) variants?: VariantDto[];
}
export class SetActiveDto { @IsBoolean() isActive: boolean; }
