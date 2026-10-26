import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

export class CartLineDto {
  @IsString() productId: string;
  @IsOptional() @IsString() variantId?: string | null;
  @Type(() => Number) @IsInt() @Min(1) @Max(99) quantity: number;
}
export class UpdateQtyDto { @Type(() => Number) @IsInt() @Min(1) @Max(99) quantity: number; }
export class CartLinesDto {
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => CartLineDto) items: CartLineDto[];
}
