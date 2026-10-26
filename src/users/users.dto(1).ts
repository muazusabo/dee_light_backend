import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
export const PHONE_RE = /^\+?[0-9][0-9\s-]{6,17}$/;
export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @Matches(PHONE_RE, { message: 'Enter a valid phone number' }) phone?: string;
}
export class AddressDto {
  @IsOptional() @IsString() @MaxLength(40) label?: string;
  @IsString() @MinLength(3) @MaxLength(200) line1: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @IsString() @MinLength(2) @MaxLength(80) city: string;
  @IsString() @MinLength(2) @MaxLength(80) state: string;
  @IsOptional() @IsString() @MaxLength(300) notes?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
