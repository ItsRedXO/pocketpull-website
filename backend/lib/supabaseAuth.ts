import { createRemoteJWKSet, jwtVerify, type JWTVerifyResult } from 'jose';

/**
 * Verifies Supabase Auth JWTs. Accepted as an additional path inside
 * requireAuth() (see ./auth.ts resolveUserId) alongside the existing Blink
 * verification — not a replacement.
 *
 * Confirmed live against this project (2026-09-06): it uses modern
 * JWKS-based (asymmetric) signing, so JWKS verification succeeds with no
 * SUPABASE_JWT_SECRET set. The HS256 fallback below is unused defensive
 * code, kept only in case the project's signing method ever changes.
 *
 * SUPABASE_URL is required (public, safe to expose).
 */

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function getJwks() {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) throw new Error('SUPABASE_URL is required to verify Supabase JWTs');
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`));
  }
  return jwks;
}

function getIssuer() {
  return `${(process.env.SUPABASE_URL || '').replace(/\/$/, '')}/auth/v1`;
}

export interface SupabaseTokenClaims {
  authUserId: string;
  email: string | null;
  raw: Record<string, unknown>;
}

function toClaims(payload: JWTVerifyResult['payload']): SupabaseTokenClaims {
  const authUserId = String(payload.sub || '');
  if (!authUserId) throw new Error('SUPABASE_TOKEN_NO_SUB');
  return {
    authUserId,
    email: typeof payload.email === 'string' ? payload.email : null,
    raw: payload as Record<string, unknown>,
  };
}

/**
 * Verifies a raw Supabase access token (the JWT from supabase.auth.getSession()).
 * Throws on any invalid/expired/malformed token.
 */
export async function verifySupabaseToken(token: string): Promise<SupabaseTokenClaims> {
  if (!token) throw new Error('SUPABASE_TOKEN_MISSING');
  if (!process.env.SUPABASE_URL) throw new Error('SUPABASE_URL is required to verify Supabase JWTs');

  try {
    const { payload } = await jwtVerify(token, getJwks(), { issuer: getIssuer() });
    return toClaims(payload);
  } catch (jwksError: any) {
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;
    if (!jwtSecret) {
      throw new Error(
        `JWKS verification failed (${jwksError.message}) and no SUPABASE_JWT_SECRET fallback is configured. ` +
        `This project likely uses legacy HS256-signed tokens — set SUPABASE_JWT_SECRET from Supabase Settings -> API -> JWT Settings.`
      );
    }
    const { payload } = await jwtVerify(token, new TextEncoder().encode(jwtSecret), { issuer: getIssuer() });
    return toClaims(payload);
  }
}

/** Extracts a bearer token from a Supabase-specific header so this never collides with the existing Blink Authorization header during the parallel-run period. */
export function extractSupabaseBearer(headerValue: string | undefined | null): string {
  if (!headerValue) throw new Error('SUPABASE_TOKEN_MISSING');
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error('SUPABASE_TOKEN_MALFORMED');
  return match[1].trim();
}
