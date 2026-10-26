import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';

function make(prismaOver: any = {}) {
  const prisma: any = {
    user: { findUnique: jest.fn(), create: jest.fn(async ({ data }: any) => ({ id: 'u1', name: data.name, email: data.email, phone: null, role: 'CUSTOMER', createdAt: new Date() })) },
    refreshToken: { create: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn(async () => ({ count: 1 })) },
    ...prismaOver,
  };
  const jwt: any = { signAsync: jest.fn(async () => 'access') };
  const config: any = { getOrThrow: () => 'x'.repeat(40) };
  return { svc: new AuthService(prisma, jwt, config, { send: jest.fn() } as any), prisma };
}

describe('AuthService', () => {
  it('registers with an Argon2id hash and never stores the plaintext password', async () => {
    const { svc, prisma } = make();
    prisma.user.findUnique.mockResolvedValue(null);
    await svc.register({ name: 'Ada', email: 'ada@example.com', password: 'Password123' });
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.passwordHash).toMatch(/^\$argon2id\$/);
    expect(data.passwordHash).not.toContain('Password123');
    expect(await argon2.verify(data.passwordHash, 'Password123')).toBe(true);
  });
  it('rejects duplicate emails', async () => {
    const { svc, prisma } = make();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    await expect(svc.register({ name: 'Ada', email: 'ada@example.com', password: 'Password123' })).rejects.toBeInstanceOf(ConflictException);
  });
  it('uses the same error for unknown email and wrong password', async () => {
    const { svc, prisma } = make();
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(svc.login({ email: 'no@example.com', password: 'whatever1' })).rejects.toThrow('Invalid email or password');
    const hash = await argon2.hash('Correct123');
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1', passwordHash: hash, status: 'ACTIVE' });
    await expect(svc.login({ email: 'a@example.com', password: 'Wrong12345' })).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('revokes the whole token family when a revoked refresh token is reused', async () => {
    const { svc, prisma } = make();
    prisma.refreshToken.findUnique.mockResolvedValue({ id: 'r1', familyId: 'fam', revokedAt: new Date(), expiresAt: new Date(Date.now() + 1e6), userId: 'u1' });
    await expect(svc.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { familyId: 'fam', revokedAt: null } }));
  });
  it('hashes tokens deterministically without exposing them', () => {
    const { svc } = make();
    expect(svc.hashToken('abc')).toBe(svc.hashToken('abc'));
    expect(svc.hashToken('abc')).not.toContain('abc');
  });
});
