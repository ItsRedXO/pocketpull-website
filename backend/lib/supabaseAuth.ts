import { createRemoteJWKSet, jwtVerify, type JWTVerifyResult } from 'jose';

/**
 * Verifies Supabase Auth JWTs. Runs entirely alongside the existing Blink
 * auth path; nothing here is wired into requireAuth() yet.
 *
 * Supabase projects sign session JWTs one of two ways depending on project
 * age/settings:
 *   1. Newer "JWT Signing Keys" (asymmetric, e.g. ES256) — verifiable via the
 *      project's public JWKS endpoint, no secret needed.
 *   2. Legacy shared-secret JWTs (HS256) — verifiable only with the
 *      project's JWT secret (Settings -> API -> JWT Settings), a real
 *      secret that must be set as SUPABASE_JWT_SECRET.
 *
 * This project's anon key is in the legacy HS256 format, so path 2 is the
 * one that's actually needed here — but this tries JWKS first and falls
 * back cleanly, so it keeps working if the project is ever migrated to the
 * newer signing-keys system without code changes.
 *
 * SUPABASE_URL is required either way (public, safe to expose). Only set
 * SUPABASE_JWT_SECRET if JWKS verification doesn't work for this project —
 * see README_WIRING.md.
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
