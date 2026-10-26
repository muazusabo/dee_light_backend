export function assertEnv() {
  const missing = ['DATABASE_URL', 'AUTH_SECRET', 'SESSION_SECRET', 'CLIENT_URL'].filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  if ((process.env.AUTH_SECRET as string).length < 32 || (process.env.SESSION_SECRET as string).length < 32) {
    throw new Error('AUTH_SECRET and SESSION_SECRET must each be at least 32 characters.');
  }
  if (process.env.AUTH_SECRET === process.env.SESSION_SECRET) throw new Error('AUTH_SECRET and SESSION_SECRET must differ.');
  if (process.env.NODE_ENV === 'production' && process.env.COOKIE_SAMESITE === 'none' && !/^https:/.test(process.env.CLIENT_URL!.split(',')[0].trim())) {
    throw new Error('COOKIE_SAMESITE=none requires an https CLIENT_URL.');
  }
}
export const isProd = () => process.env.NODE_ENV === 'production';
export const clientOrigins = () => (process.env.CLIENT_URL ?? '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
