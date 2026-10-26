import { ForbiddenException } from '@nestjs/common';
import { CsrfGuard, RolesGuard } from './guards';

const ctx = (req: any) => ({ switchToHttp: () => ({ getRequest: () => req }), getHandler: () => null, getClass: () => null }) as any;

describe('CsrfGuard', () => {
  const g = new CsrfGuard();
  it('lets safe methods through', () => expect(g.canActivate(ctx({ method: 'GET', headers: {} }))).toBe(true));
  it('blocks unsafe methods without the custom header', () => expect(() => g.canActivate(ctx({ method: 'POST', headers: {} }))).toThrow(ForbiddenException));
  it('allows unsafe methods with the custom header', () => expect(g.canActivate(ctx({ method: 'POST', headers: { 'x-requested-with': 'dee-light' } }))).toBe(true));
});
describe('RolesGuard', () => {
  const mk = (roles: any) => new RolesGuard({ getAllAndOverride: () => roles } as any);
  it('denies customers on admin routes', () => expect(() => mk(['ADMIN']).canActivate(ctx({ user: { role: 'CUSTOMER' } }))).toThrow(ForbiddenException));
  it('allows admins', () => expect(mk(['ADMIN']).canActivate(ctx({ user: { role: 'ADMIN' } }))).toBe(true));
  it('denies when no user is attached', () => expect(() => mk(['ADMIN']).canActivate(ctx({}))).toThrow(ForbiddenException));
});
