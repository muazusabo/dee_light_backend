import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { CurrentUser, AuthUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards';
import { isProd } from '../config/env';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './auth.dto';
import { AuthService } from './auth.service';

function cookieBase() {
  const sameSite = (process.env.COOKIE_SAMESITE ?? 'lax') as 'lax' | 'strict' | 'none';
  return { httpOnly: true, secure: isProd() || sameSite === 'none', sameSite, domain: process.env.COOKIE_DOMAIN || undefined };
}
function setCookies(res: Response, access: string, refresh: string) {
  res.cookie('access_token', access, { ...cookieBase(), path: '/', maxAge: 15 * 60 * 1000 });
  res.cookie('refresh_token', refresh, { ...cookieBase(), path: '/api/v1/auth', maxAge: 30 * 864e5 });
}
function clearCookies(res: Response) {
  res.clearCookie('access_token', { ...cookieBase(), path: '/' });
  res.clearCookie('refresh_token', { ...cookieBase(), path: '/api/v1/auth' });
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private jwt: JwtService) {}

  @Post('register') @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { user, accessToken, refreshToken } = await this.auth.register(dto);
    setCookies(res, accessToken, refreshToken);
    return { user };
  }

  @Post('login') @HttpCode(200) @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, accessToken, refreshToken } = await this.auth.login(dto);
    setCookies(res, accessToken, refreshToken);
    return { user };
  }

  @Post('refresh') @HttpCode(200) @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const { user, accessToken, refreshToken } = await this.auth.refresh(req.cookies?.refresh_token);
      setCookies(res, accessToken, refreshToken);
      return { user };
    } catch (e) { clearCookies(res); throw e; }
  }

  @Post('logout') @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.refresh_token);
    clearCookies(res);
    return { loggedOut: true };
  }

  /** Returns { user: null } for anonymous visitors (no 401 noise). */
  @Get('me')
  async me(@Req() req: Request) {
    const token = req.cookies?.access_token;
    if (!token) return { user: null };
    try {
      const { sub } = await this.jwt.verifyAsync(token);
      return { user: await this.auth.me(sub) };
    } catch { return { user: null }; }
  }

  @Get('session') @UseGuards(JwtAuthGuard)
  session(@CurrentUser() user: AuthUser) { return { user }; }

  @Post('forgot-password') @HttpCode(200) @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async forgot(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
    return { message: 'If an account exists for that email, a reset link has been sent.' };
  }

  @Post('reset-password') @HttpCode(200) @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async reset(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.password);
    return { message: 'Password updated. You can now log in.' };
  }
}
