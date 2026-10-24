import { getCloudflareEnv, getD1Database } from "@/lib/db/d1";
import { createBetterAuth } from "@/lib/auth/better-auth";
import { checkRateLimit } from "@/lib/security/rate-limiter";
import { getUserRole } from "@/lib/auth";

export const dynamic = 'force-dynamic';

async function handler(request: Request) {
  const url = new URL(request.url);
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "127.0.0.1";

  const env = await getCloudflareEnv();
  const db = (await getD1Database()) || env?.DB;

  if (request.method === "POST") {
    const rate = checkRateLimit(ip);
    if (!rate.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    // Block direct password sign-in bypass (force flow through /api/auth/login for 2FA, lockout, and CAPTCHA)
    if (url.pathname.endsWith("/sign-in/email") || url.pathname.endsWith("/sign-in/email/")) {
      return new Response(
        JSON.stringify({ error: "Direct sign-in disabled. Use /api/auth/login for 2FA enforcement." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Block magic link 2FA bypass for committee accounts (static list + database profiles)
    if (url.pathname.endsWith("/sign-in/magic-link") || url.pathname.endsWith("/sign-in/magic-link/")) {
      try {
        const cloned = request.clone();
        const body = await cloned.json();
        const email = String(body?.email || '').trim().toLowerCase();
        let isCommittee = getUserRole(email) >= 1;

        if (!isCommittee && db && email) {
          try {
            const row = (await db
              .prepare(`
                SELECT COALESCE(p.role, u.role, 0) AS role
                FROM users u
                LEFT JOIN profiles p ON p.id = u.id
                WHERE LOWER(u.email) = LOWER(?)
                UNION ALL
                SELECT COALESCE(p.role, ba.role, 0) AS role
                FROM "user" ba
                LEFT JOIN profiles p ON p.id = ba.id
                WHERE LOWER(ba.email) = LOWER(?)
                LIMIT 1
              `)
              .bind(email, email)
              .first()) as { role: number } | null;
            if (row && Number(row.role) >= 1) {
              isCommittee = true;
            }
          } catch {}
        }

        if (isCommittee) {
          return new Response(
            JSON.stringify({ error: "Magic link sign-in is disabled for Committee members. Please sign in with password and mandatory 2FA at /login." }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }
      } catch {}
    }
  }

  if (!db) {
    return new Response(
      JSON.stringify({ error: "Database connection unavailable" }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const origin = new URL(request.url).origin;
    const auth = createBetterAuth({ ...env, DB: db, BETTER_AUTH_URL: origin });
    return await auth.handler(request);
  } catch (authErr: any) {
    console.error("[BetterAuth] Handler unhandled exception:", authErr);
    return new Response(
      JSON.stringify({
        error: "Authentication service temporarily unavailable",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export const GET = handler;
export const POST = handler;
