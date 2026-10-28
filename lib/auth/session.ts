/**
 * AuthSession Module
 * 
 * Deep module encapsulating credential authentication, two-factor authentication (2FA) challenges,
 * role authorization, rate-limiting lockout policies, and session cookie issuance.
 * 
 * Deep Interface:
 * - authenticateCredentials(requestOrParams): Promise<AuthOutcome>
 * - verifyTwoFactor(requestOrParams): Promise<AuthOutcome>
 * - toApiResponse(outcome): NextResponse
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { checkRateLimit, recordFailedAttempt, recordSuccessfulAttempt, verifyCaptchaToken } from '@/lib/security/rate-limiter';
import {
  requiresMandatory2FA,
  create2FAChallenge,
  create2FAEnrollmentChallenge,
  isUser2FAEnrolled,
  getUserTOTPSecret,
  setUserTOTPSecret,
  getUserHashedBackupCodes,
  setUserHashedBackupCodes,
  verify2FAChallenge,
  seal2FAAttestation,
} from '@/lib/security/two-factor';
import { setSessionCookies, applySessionCookies } from '@/lib/security/cookies';
import { getAuthenticatedUserRole, getUserRole, sanitizeEmail, getSafeRedirectUrl, Role } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { autoBumpUserPasswordInD1 } from '@/lib/security/password-hasher';

export interface ClimberSessionUser {
  id: string;
  email: string;
  role: Role;
  fullName?: string;
  user_metadata?: any;
}

export type AuthOutcome =
  | {
      status: 'authenticated';
      user: ClimberSessionUser;
      destination: string;
      sessionData: any;
      cookiesToSet?: Array<{ name: string; value: string; options?: any }>;
      usedBackupCode?: boolean;
    }
  | {
      status: 'requires_2fa_setup';
      challengeToken: string;
      secret: string;
      totpUri: string;
      backupCodes: string[];
      expiresAt: number;
      message: string;
      destination: string;
    }
  | {
      status: 'requires_2fa_verify';
      challengeToken: string;
      expiresAt: number;
      message: string;
      destination: string;
      otpCode?: string;
    }
  | {
      status: 'locked';
      error: string;
      retryAfterSeconds: number;
      requiresCaptcha: boolean;
    }
  | {
      status: 'requires_captcha';
      error: string;
    }
  | {
      status: 'invalid_credentials';
      error: string;
      remainingAttempts: number;
      requiresCaptcha: boolean;
      isLocked: boolean;
      backoffSeconds?: number;
    }
  | {
      status: 'invalid_code';
      error: string;
    }
  | {
      status: 'error';
      error: string;
      statusCode: number;
    };

export interface LoginParams {
  email?: string | null;
  password?: string | null;
  captchaToken?: string | null;
  next?: string | null;
  ip?: string;
  cookieHeader?: string;
}

export interface VerifyTwoFactorParams {
  challengeToken?: string | null;
  code?: string | null;
  next?: string | null;
  ip?: string;
  cookieHeader?: string;
}

export function extractClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

/**
 * Encapsulated Authentication & Session Manager
 */
export class AuthSessionService {
  /**
   * Authenticates user credentials with integrated rate limiting, CAPTCHA, and 2FA gating.
   */
  async authenticateCredentials(input: Request | LoginParams, secretKeyOverride?: string): Promise<AuthOutcome> {
    let email: string = '';
    let password = '';
    let captchaToken: string | undefined;
    let nextParam: string | undefined;
    let ip = '127.0.0.1';
    let cookieHeader = '';

    if (input instanceof Request) {
      ip = extractClientIp(input);
      cookieHeader = input.headers.get('cookie') || '';
      try {
        const body = await input.json().catch(() => ({}));
        email = body.email || '';
        password = body.password || '';
        captchaToken = body.captchaToken;
        nextParam = body.next;
      } catch {
        return { status: 'error', error: 'Malformed JSON payload', statusCode: 400 };
      }
    } else {
      ip = input.ip || '127.0.0.1';
      email = input.email || '';
      password = input.password || '';
      captchaToken = input.captchaToken || undefined;
      nextParam = input.next || undefined;
      cookieHeader = input.cookieHeader || '';
    }

    const cleanEmail = sanitizeEmail(email);
    const requestedNext = typeof nextParam === 'string' && nextParam.trim() ? getSafeRedirectUrl(nextParam, '') : '';

    if (!cleanEmail || !password) {
      return {
        status: 'error',
        error: 'Email and password are required',
        statusCode: 400,
      };
    }

    // 1. Enforce Rate Limit & Account Lockout
    const rateCheck = checkRateLimit(ip, cleanEmail);
    if (!rateCheck.allowed) {
      return {
        status: 'locked',
        error: rateCheck.reason || 'Too many login attempts. Account temporarily locked.',
        retryAfterSeconds: rateCheck.retryAfterSeconds || 900,
        requiresCaptcha: Boolean(rateCheck.requiresCaptcha),
      };
    }

    // 2. Enforce CAPTCHA if failure threshold was triggered
    if (rateCheck.requiresCaptcha) {
      if (!captchaToken || !verifyCaptchaToken(captchaToken)) {
        return {
          status: 'requires_captcha',
          error: 'Security verification required. Please complete the CAPTCHA challenge.',
        };
      }
    }

    // 3. Authenticate with Better Auth Engine on Cloudflare D1 first
    let cookiesToSet: { name: string; value: string; options: any }[] = [];
    let authenticatedUser: ClimberSessionUser | null = null;
    let authenticatedSessionPayload: any = null;
    let d1Database: any = null;
    let cfSecret = secretKeyOverride;

    try {
      const { getCloudflareEnv, getD1Database } = await import('@/lib/db/d1');
      const env = await getCloudflareEnv();
      if (!cfSecret) {
        cfSecret = env?.BETTER_AUTH_SECRET || env?.SUPABASE_SERVICE_ROLE_KEY;
      }
      const db = (await getD1Database()) || env?.DB;
      if (db) d1Database = db;

      if (db) {
        const { createBetterAuth } = await import('@/lib/auth/better-auth');
        const reqOrigin = input instanceof Request ? new URL(input.url).origin : undefined;
        const auth = createBetterAuth({ ...env, DB: db, ...(reqOrigin ? { BETTER_AUTH_URL: reqOrigin } : {}) });
        const baRes = await auth.api.signInEmail({
          body: { email: cleanEmail, password },
          asResponse: true,
        });

        if (baRes.ok) {
          const baData = await baRes.json().catch(() => ({}));
          const u = baData.user;
          if (u) {
            let role = (u as any).role ?? getUserRole(cleanEmail);
            try {
              const prof = (await db.prepare('SELECT role FROM profiles WHERE id = ?').bind(u.id).first()) as any;
              if (prof?.role !== undefined) role = prof.role;
            } catch {}

            const rawCookies = typeof (baRes.headers as any).getSetCookie === 'function'
              ? (baRes.headers as any).getSetCookie()
              : [baRes.headers.get('set-cookie')].filter(Boolean);

            for (const headerStr of rawCookies) {
              if (!headerStr) continue;
              const [nv] = headerStr.split(';');
              const eqIdx = nv.indexOf('=');
              if (eqIdx !== -1) {
                const cName = nv.slice(0, eqIdx).trim();
                const cVal = nv.slice(eqIdx + 1).trim();
                cookiesToSet.push({
                  name: cName,
                  value: cVal,
                  options: {
                    path: '/',
                    httpOnly: true,
                    secure: process.env.NODE_ENV !== 'development',
                    sameSite: 'lax',
                    maxAge: 60 * 60 * 24 * 7,
                  },
                });
              }
            }

            authenticatedUser = {
              id: u.id,
              email: u.email,
              role,
              fullName: u.name,
            };
            authenticatedSessionPayload = baData;
          }
        }
      }
    } catch (baErr) {
      console.warn('[Session] Better Auth login check non-fatal notice:', baErr);
    }

    // 3.5. Fallback to Supabase Auth Engine if not authenticated via Better Auth
    if (!authenticatedUser) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bsvnyibipcwrcyzqilge.supabase.co';
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_IZmrUzhCzPpLG5ZuWVxY_A_QxQJl5Hg';

      const serverSupabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
          getAll() {
            return cookieHeader.split(';').map(c => {
              const [name, ...rest] = c.trim().split('=');
              return { name, value: rest.join('=') };
            });
          },
          setAll(toSet) {
            cookiesToSet = toSet;
          },
        },
      });

      const { data: authData, error: authError } = await serverSupabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (authError || !authData?.user || !authData?.session) {
        const failRecord = recordFailedAttempt(ip, cleanEmail, authError?.message || 'Invalid credentials');
        return {
          status: 'invalid_credentials',
          error: authError?.message || 'Invalid email or password',
          remainingAttempts: Math.max(0, 5 - failRecord.attemptCount),
          requiresCaptcha: failRecord.requiresCaptcha,
          isLocked: failRecord.isLocked,
          backoffSeconds: failRecord.backoffSeconds,
        };
      }

      const user = authData.user;
      const session = authData.session;
      const userRole = await getAuthenticatedUserRole(serverSupabase, user);

      // JIT Password Auto-Bump to Cloudflare D1 (Zero Risk, Non-blocking)
      try {
        await autoBumpUserPasswordInD1(user.id, cleanEmail, password, userRole);
      } catch (bumpErr) {
        console.warn('[Session] JIT password auto-bump non-fatal error:', bumpErr);
      }

      authenticatedUser = {
        id: user.id,
        email: user.email || cleanEmail,
        role: userRole,
        user_metadata: user.user_metadata,
      };
      authenticatedSessionPayload = session;
    }

    const user = authenticatedUser;
    const session = authenticatedSessionPayload;
    const userRole = authenticatedUser.role;

    const safeDestination = (requestedNext && requestedNext !== '/login' && !requestedNext.startsWith('/login?') && !requestedNext.startsWith('/auth'))
      ? requestedNext
      : (userRole >= 1 ? '/admin' : '/membership');

    // 4. Evaluate Mandatory 2FA Gate (Committee Members)
    // During migration window: bypass mandatory 2FA gate during login so committee members
    // can authenticate immediately with credentials and re-enroll clean 2FA in D1.
    // Can be re-enabled anytime via ENFORCE_MANDATORY_2FA=true.
    const enforce2FAGate = process.env.ENFORCE_MANDATORY_2FA === 'true';
    if (enforce2FAGate && requiresMandatory2FA(cleanEmail, userRole)) {
      let isEnrolled = isUser2FAEnrolled(user.id, user.user_metadata);
      let userTotpSecret = user.user_metadata?.totp_secret || getUserTOTPSecret(user.id);
      let userBackupCodesList = user.user_metadata?.backup_codes || getUserHashedBackupCodes(user.id);

      // Check Cloudflare D1 twoFactor table for persistent cross-isolate 2FA credentials
      if (!isEnrolled && d1Database) {
        try {
          // Self-heal D1 twoFactor schema if table does not exist
          await d1Database.exec(`CREATE TABLE IF NOT EXISTS "twoFactor" (
            id TEXT PRIMARY KEY,
            secret TEXT NOT NULL,
            backupCodes TEXT,
            userId TEXT NOT NULL UNIQUE,
            verified INTEGER DEFAULT 1
          );`).catch(() => {});

          const d1Row = (await d1Database
            .prepare('SELECT secret, backupCodes FROM "twoFactor" WHERE userId = ?')
            .bind(user.id)
            .first()) as { secret?: string; backupCodes?: string } | null;

          if (d1Row?.secret) {
            isEnrolled = true;
            userTotpSecret = d1Row.secret;
            setUserTOTPSecret(user.id, d1Row.secret);
            if (d1Row.backupCodes) {
              try {
                const parsed = JSON.parse(d1Row.backupCodes);
                if (Array.isArray(parsed)) {
                  userBackupCodesList = parsed;
                  setUserHashedBackupCodes(user.id, parsed);
                }
              } catch {}
            }
          }
        } catch (d1TwoFactorErr) {
          console.warn('[Session] D1 twoFactor lookup warning:', d1TwoFactorErr);
        }
      }

      const sessionPayload = {
        session,
        cookiesToSet: cookiesToSet.length > 0 ? cookiesToSet : undefined,
      };

      if (!isEnrolled) {
        const setup = create2FAEnrollmentChallenge(
          user.id,
          cleanEmail,
          userRole,
          sessionPayload,
          cfSecret
        );

        return {
          status: 'requires_2fa_setup',
          challengeToken: setup.challengeToken,
          secret: setup.secret,
          totpUri: setup.totpUri,
          backupCodes: setup.backupCodes,
          expiresAt: setup.expiresAt,
          destination: safeDestination,
          message: 'Two-factor authentication is required for committee accounts. Please scan the QR code into your authenticator app to complete activation.',
        };
      }

      // Existing 2FA enrollment: generate verification challenge
      const challenge = create2FAChallenge(
        user.id,
        cleanEmail,
        userRole,
        sessionPayload,
        userTotpSecret,
        userBackupCodesList,
        cfSecret
      );

      return {
        status: 'requires_2fa_verify',
        challengeToken: challenge.challengeToken,
        expiresAt: challenge.expiresAt,
        destination: safeDestination,
        message: 'Please enter the 6-digit code from your authenticator app or an emergency backup code.',
        otpCode: challenge.otpCode,
      };
    }

    // 5. Successful login without 2FA
    recordSuccessfulAttempt(ip, cleanEmail);

    return {
      status: 'authenticated',
      user: {
        id: user.id,
        email: user.email || cleanEmail,
        role: userRole,
      },
      destination: safeDestination,
      sessionData: session,
      cookiesToSet: cookiesToSet.length > 0 ? cookiesToSet : undefined,
    };
  }

  /**
   * Verifies second-factor challenge code (TOTP or single-use backup code).
   */
  async verifyTwoFactor(input: Request | VerifyTwoFactorParams, secretKeyOverride?: string): Promise<AuthOutcome> {
    let challengeToken: string = '';
    let code: string = '';
    let nextParam: string | undefined;
    let ip = '127.0.0.1';
    let cookieHeader = '';

    if (input instanceof Request) {
      ip = extractClientIp(input);
      cookieHeader = input.headers.get('cookie') || '';
      try {
        const body = await input.json().catch(() => ({}));
        challengeToken = body.challengeToken || '';
        code = body.code || '';
        nextParam = body.next;
      } catch {
        return { status: 'error', error: 'Malformed JSON payload', statusCode: 400 };
      }
    } else {
      ip = input.ip || '127.0.0.1';
      challengeToken = input.challengeToken || '';
      code = input.code || '';
      nextParam = input.next || undefined;
      cookieHeader = input.cookieHeader || '';
    }

    const requestedNext = typeof nextParam === 'string' && nextParam.trim() ? getSafeRedirectUrl(nextParam, '') : '';

    // Cookie fallback for challengeToken
    const cookieMatch = cookieHeader.match(/kclmc_2fa_pending=([^;]+)/);
    const cookieToken = cookieMatch ? decodeURIComponent(cookieMatch[1].trim()) : null;
    const effectiveToken = (challengeToken && challengeToken.trim()) ? challengeToken.trim() : cookieToken;

    if (!effectiveToken || !code) {
      return {
        status: 'error',
        error: 'Challenge token and verification code are required',
        statusCode: 400,
      };
    }

    // Rate limit verification attempts by IP
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return {
        status: 'locked',
        error: 'Too many verification attempts. Please wait before retrying.',
        retryAfterSeconds: rateCheck.retryAfterSeconds || 900,
        requiresCaptcha: false,
      };
    }

    let cfSecret = secretKeyOverride;
    try {
      const { getCloudflareEnv } = await import('@/lib/db/d1');
      const env = await getCloudflareEnv();
      if (!cfSecret) {
        cfSecret = env?.BETTER_AUTH_SECRET || env?.SUPABASE_SERVICE_ROLE_KEY;
      }
    } catch {}

    const result = verify2FAChallenge(effectiveToken, code, cfSecret);

    if (!result.success || !result.sessionData) {
      recordFailedAttempt(ip, undefined, 'Invalid 2FA code');
      return {
        status: 'invalid_code',
        error: result.error || 'Invalid or expired verification code',
      };
    }

    recordSuccessfulAttempt(ip, result.email);

    // 1. Persist 2FA enrollment directly to Cloudflare D1
    if (result.enrolledSecret && result.userId) {
      try {
        const { getCloudflareEnv, getD1Database } = await import('@/lib/db/d1');
        const env = await getCloudflareEnv();
        const db = (await getD1Database()) || env?.DB;
        if (db) {
          // Self-heal D1 twoFactor schema if table does not exist
          await db.exec(`CREATE TABLE IF NOT EXISTS "twoFactor" (
            id TEXT PRIMARY KEY,
            secret TEXT NOT NULL,
            backupCodes TEXT,
            userId TEXT NOT NULL UNIQUE,
            verified INTEGER DEFAULT 1
          );`).catch(() => {});

          const backupJson = JSON.stringify(result.hashedBackupCodes || []);
          const existing = (await db
            .prepare('SELECT id FROM "twoFactor" WHERE userId = ?')
            .bind(result.userId)
            .first()) as { id?: string } | null;

          if (existing?.id) {
            await db
              .prepare('UPDATE "twoFactor" SET secret = ?, backupCodes = ?, verified = 1 WHERE userId = ?')
              .bind(result.enrolledSecret, backupJson, result.userId)
              .run();
          } else {
            const tfId = `tf_${crypto.randomUUID()}`;
            await db
              .prepare('INSERT INTO "twoFactor" (id, secret, backupCodes, userId, verified) VALUES (?, ?, ?, ?, 1)')
              .bind(tfId, result.enrolledSecret, backupJson, result.userId)
              .run();
          }

          await db
            .prepare('UPDATE "user" SET "twoFactorEnabled" = 1 WHERE id = ?')
            .bind(result.userId)
            .run()
            .catch(() => {});
        }
      } catch (d1Err) {
        console.warn('[2FA] D1 twoFactor persistence error:', d1Err);
      }

      // Legacy fallback: Persist 2FA enrollment metadata to Supabase if configured
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || (globalThis as any)?.__CF_ENV__?.SUPABASE_SERVICE_ROLE_KEY;
      if (serviceKey) {
        try {
          const adminSupabase = createAdminClient();
          if (adminSupabase?.auth?.admin?.updateUserById) {
            await Promise.race([
              adminSupabase.auth.admin.updateUserById(result.userId, {
                user_metadata: {
                  is_2fa_enrolled: true,
                  totp_secret: result.enrolledSecret,
                  backup_codes: result.hashedBackupCodes || [],
                },
              }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000)),
            ]).catch(adminErr => {
              console.warn('[2FA] Admin persistence timeout/warning:', adminErr);
            });
          }
        } catch (adminErr) {
          console.warn('[2FA] Admin persistence warning:', adminErr);
        }
      }

      const accessToken = result.sessionData?.session?.access_token;
      if (accessToken) {
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bsvnyibipcwrcyzqilge.supabase.co';
          const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_IZmrUzhCzPpLG5ZuWVxY_A_QxQJl5Hg';
          const userSupabase = createServerClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${accessToken}` } },
            cookies: { getAll() { return []; }, setAll() {} },
          });
          await Promise.race([
            userSupabase.auth.updateUser({
              data: {
                is_2fa_enrolled: true,
                totp_secret: result.enrolledSecret,
                backup_codes: result.hashedBackupCodes || [],
              },
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000)),
          ]).catch(userErr => {
            console.warn('[2FA] User metadata update timeout/warning:', userErr);
          });
        } catch (userErr) {
          console.warn('[2FA] User metadata update warning:', userErr);
        }
      }
    }

    // Persist remaining backup codes if a code was burned (D1 + Supabase)
    if (result.usedBackupCode && result.userId && result.remainingBackupCodes) {
      try {
        const { getCloudflareEnv, getD1Database } = await import('@/lib/db/d1');
        const env = await getCloudflareEnv();
        const db = (await getD1Database()) || env?.DB;
        if (db) {
          const backupJson = JSON.stringify(result.remainingBackupCodes);
          await db
            .prepare('UPDATE "twoFactor" SET backupCodes = ? WHERE userId = ?')
            .bind(backupJson, result.userId)
            .run();
        }
      } catch (d1BurnErr) {
        console.warn('[2FA] D1 backup code burn error:', d1BurnErr);
      }

      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
          const adminSupabase = createAdminClient();
          if (adminSupabase?.auth?.admin?.updateUserById) {
            await Promise.race([
              adminSupabase.auth.admin.updateUserById(result.userId, {
                user_metadata: { backup_codes: result.remainingBackupCodes },
              }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000)),
            ]).catch(() => {});
          }
        } catch {
          // non-fatal
        }
      }
    }

    const resolvedRole = (result.role ?? 0) as Role;
    let safeDestination = (requestedNext && requestedNext !== '/login' && !requestedNext.startsWith('/login?') && !requestedNext.startsWith('/auth'))
      ? requestedNext
      : (resolvedRole >= 1 ? '/admin' : '/membership');

    if (!safeDestination || safeDestination === '/login' || safeDestination.startsWith('/login?')) {
      safeDestination = resolvedRole >= 1 ? '/admin' : '/membership';
    }

    return {
      status: 'authenticated',
      user: {
        id: result.userId || 'climber',
        email: result.email || '',
        role: resolvedRole,
      },
      destination: safeDestination,
      sessionData: result.sessionData,
      cookiesToSet: result.sessionData?.cookiesToSet,
      usedBackupCode: result.usedBackupCode,
    };
  }

  /**
   * Adapts an AuthOutcome into an RFC-compliant HTTP NextResponse.
   */
  toApiResponse(outcome: AuthOutcome, secretKeyOverride?: string): NextResponse {
    switch (outcome.status) {
      case 'authenticated': {
        const response = NextResponse.json({
          success: true,
          message: outcome.usedBackupCode
            ? 'Successfully authenticated with single-use backup code.'
            : 'Authentication verified successfully.',
          user: outcome.user,
          destination: outcome.destination,
        });

        if (outcome.cookiesToSet && outcome.cookiesToSet.length > 0) {
          applySessionCookies(response, outcome.cookiesToSet);
        } else {
          setSessionCookies(response, outcome.sessionData);
        }

        if (outcome.user && outcome.user.role >= 1) {
          const userIdentifier = outcome.user.email || outcome.user.id;
          const attestationToken = seal2FAAttestation(userIdentifier, secretKeyOverride);
          response.cookies.set('kclmc_2fa_verified', attestationToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24, // 24-hour attestation
          });
        }

        // Clear temporary challenge cookie
        response.cookies.set('kclmc_2fa_pending', '', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 0,
        });

        return response;
      }

      case 'requires_2fa_setup': {
        const response = NextResponse.json({
          requires2FASetup: true,
          challengeToken: outcome.challengeToken,
          secret: outcome.secret,
          totpUri: outcome.totpUri,
          backupCodes: outcome.backupCodes,
          expiresAt: outcome.expiresAt,
          destination: outcome.destination,
          message: outcome.message,
        });

        response.cookies.set('kclmc_2fa_pending', outcome.challengeToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/',
          maxAge: 10 * 60, // 10 minutes
        });

        return response;
      }

      case 'requires_2fa_verify': {
        const response = NextResponse.json({
          requires2FA: true,
          challengeToken: outcome.challengeToken,
          expiresAt: outcome.expiresAt,
          destination: outcome.destination,
          message: outcome.message,
        });

        response.cookies.set('kclmc_2fa_pending', outcome.challengeToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/',
          maxAge: 5 * 60, // 5 minutes
        });

        return response;
      }

      case 'locked': {
        return NextResponse.json(
          {
            error: outcome.error,
            isLocked: true,
            retryAfterSeconds: outcome.retryAfterSeconds,
            requiresCaptcha: outcome.requiresCaptcha,
          },
          {
            status: 429,
            headers: { 'Retry-After': String(outcome.retryAfterSeconds) },
          }
        );
      }

      case 'requires_captcha': {
        return NextResponse.json(
          {
            error: outcome.error,
            requiresCaptcha: true,
          },
          { status: 403 }
        );
      }

      case 'invalid_credentials': {
        return NextResponse.json(
          {
            error: outcome.error,
            remainingAttempts: outcome.remainingAttempts,
            requiresCaptcha: outcome.requiresCaptcha,
            isLocked: outcome.isLocked,
            backoffSeconds: outcome.backoffSeconds,
          },
          { status: 401 }
        );
      }

      case 'invalid_code': {
        return NextResponse.json(
          { error: outcome.error },
          { status: 400 }
        );
      }

      case 'error': {
        return NextResponse.json(
          { error: outcome.error },
          { status: outcome.statusCode }
        );
      }
    }
  }
}

export const authSession = new AuthSessionService();
