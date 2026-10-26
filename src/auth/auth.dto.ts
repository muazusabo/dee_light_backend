import { IsEmail, IsString, MaxLength, MinLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

const email = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));
export class RegisterDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @email() @IsEmail() @MaxLength(254) email: string;
  @IsString() @MinLength(8) @MaxLength(128) @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'Password must contain letters and numbers' }) password: string;
}
export class LoginDto {
  @email() @IsEmail() email: string;
  @IsString() @MaxLength(128) password: string;
}
export class ForgotPasswordDto { @email() @IsEmail() email: string; }
export class ResetPasswordDto {
  @IsString() @MinLength(20) @MaxLength(200) token: string;
  @IsString() @MinLength(8) @MaxLength(128) @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'Password must contain letters and numbers' }) password: string;
}
