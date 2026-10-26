import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ROLES_KEY } from './decorators';

/** Verifies the access-token cookie and loads the user from the database, so role and status are always authoritative. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private prisma: PrismaService) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const token = req.cookies?.access_token;
    if (!token) throw new UnauthorizedException('Authentication required');
    let payload: { sub: string };
    try { payload = await this.jwt.verifyAsync(token); } catch { throw new UnauthorizedException('Session expired'); }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, email: true, name: true, status: true } });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Account unavailable');
    req.user = { id: user.id, role: user.role, email: user.email, name: user.name };
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;
    const user = ctx.switchToHttp().getRequest().user;
    if (!user || !roles.includes(user.role)) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}

/** CSRF defence for cookie auth: unsafe methods must carry a custom header, which browsers only send cross-origin after a CORS preflight that we restrict to CLIENT_URL. */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    if (req.headers['x-requested-with'] !== 'dee-light') throw new ForbiddenException('Missing CSRF header');
    return true;
  }
}
