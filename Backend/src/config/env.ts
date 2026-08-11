// Enforce HTTPS-only cookies in production
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 12 * 60 * 60 * 1000 // 12 hours
};