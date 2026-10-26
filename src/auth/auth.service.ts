import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHmac, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { LoginDto, RegisterDto } from './auth.dto';

const REFRESH_DAYS = 30;
const RESET_MINUTES = 60;
export const ARGON_OPTS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
const publicUser = { id: true, name: true, email: true, phone: true, role: true, createdAt: true } as const;

@Injectable()
export class AuthService {
  private dummyHash: Promise<string>;
  constructor(private prisma: PrismaService, private jwt: JwtService, private config: ConfigService, private mail: MailService) {
    this.dummyHash = argon2.hash('dummy-password-for-timing', ARGON_OPTS);
  }

  hashToken(token: string) { return createHmac('sha256', this.config.getOrThrow<string>('SESSION_SECRET')).update(token).digest('hex'); }
  private newToken() { return randomBytes(48).toString('base64url'); }

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } });
    if (exists) throw new ConflictException('An account with this email already exists');
    const passwordHash = await argon2.hash(dto.password, ARGON_OPTS);
    const user = await this.prisma.user.create({ data: { name: dto.name.trim(), email: dto.email, passwordHash }, select: publicUser });
    return { user, ...(await this.issueTokens(user.id)) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const ok = await argon2.verify(user?.passwordHash ?? (await this.dummyHash), dto.password).catch(() => false);
    if (!user || !ok || user.status !== 'ACTIVE') throw new UnauthorizedException('Invalid email or password');
    const { passwordHash: _p, status: _s, updatedAt: _u, ...safe } = user;
    return { user: safe, ...(await this.issueTokens(user.id)) };
  }

  async issueTokens(userId: string, familyId?: string) {
    const accessToken = await this.jwt.signAsync({ sub: userId });
    const refreshToken = this.newToken();
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: this.hashToken(refreshToken), familyId: familyId ?? randomBytes(12).toString('hex'), expiresAt: new Date(Date.now() + REFRESH_DAYS * 864e5) },
    });
    return { accessToken, refreshToken };
  }

  /** Rotation: every refresh token is single-use. Re-use of a revoked token revokes the whole family (theft signal). */
  async refresh(raw?: string) {
    if (!raw) throw new UnauthorizedException('No session');
    const rec = await this.prisma.refreshToken.findUnique({ where: { tokenHash: this.hashToken(raw) } });
    if (!rec) throw new UnauthorizedException('Invalid session');
    if (rec.revokedAt) {
      await this.prisma.refreshToken.updateMany({ where: { familyId: rec.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw new UnauthorizedException('Session revoked');
    }
    if (rec.expiresAt < new Date()) throw new UnauthorizedException('Session expired');
    const claimed = await this.prisma.refreshToken.updateMany({ where: { id: rec.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (claimed.count !== 1) throw new UnauthorizedException('Invalid session');
    const user = await this.prisma.user.findUnique({ where: { id: rec.userId }, select: { ...publicUser, status: true } });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Account unavailable');
    const { status: _s, ...safe } = user;
    return { user: safe, ...(await this.issueTokens(rec.userId, rec.familyId)) };
  }

  async logout(raw?: string) {
    if (!raw) return;
    const rec = await this.prisma.refreshToken.findUnique({ where: { tokenHash: this.hashToken(raw) } });
    if (rec) await this.prisma.refreshToken.updateMany({ where: { familyId: rec.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async me(userId: string) { return this.prisma.user.findUnique({ where: { id: userId }, select: publicUser }); }

  /** Always resolves identically so account existence is not revealed. */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'ACTIVE') return;
    await this.prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    const token = this.newToken();
    await this.prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: this.hashToken(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60000) } });
    const link = `${(process.env.CLIENT_URL ?? '').split(',')[0].trim().replace(/\/$/, '')}/reset-password?token=${token}`;
    await this.mail.send(user.email, 'Reset your DEE-LIGHT password', `Use this link within ${RESET_MINUTES} minutes to choose a new password:\n\n${link}\n\nIf you did not request this, ignore this email.`, link);
  }

  async resetPassword(token: string, password: string) {
    const rec = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: this.hashToken(token) } });
    if (!rec || rec.usedAt || rec.expiresAt < new Date()) throw new BadRequestException('This reset link is invalid or has expired');
    const passwordHash = await argon2.hash(password, ARGON_OPTS);
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({ where: { id: rec.id, usedAt: null }, data: { usedAt: new Date() } });
      if (claimed.count !== 1) throw new BadRequestException('This reset link is invalid or has expired');
      await tx.user.update({ where: { id: rec.userId }, data: { passwordHash } });
      await tx.refreshToken.updateMany({ where: { userId: rec.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    });
  }
}
