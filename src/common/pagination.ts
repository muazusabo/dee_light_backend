import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(48) pageSize: number = 12;
}
export const pageMeta = (total: number, page: number, pageSize: number) => ({ total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
