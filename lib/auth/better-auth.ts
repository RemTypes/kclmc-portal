/**
 * Better Auth Configuration for Cloudflare D1 & Cloudflare Workers
 * 
 * Features:
 * - Native Cloudflare D1 integration via Kysely D1 Dialect
 * - Two-Factor Authentication (TOTP / Authenticator Apps & single-use backup codes)
 * - 1-Click Passwordless Magic Links
 * - Outbound Transactional Emails via Cloudflare Email Service (send_email binding)
 * - JIT (Just-In-Time) Supabase Password Auto-Bumping for migrated accounts
 */

import crypto from "crypto";
import { betterAuth } from "better-auth";
import { twoFactor, magicLink } from "better-auth/plugins";
import { createAuthMiddleware } from "better-auth/api";
import { hashPassword } from "better-auth/crypto";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import type { D1Database } from "@/lib/db/d1";
import { sendEmail } from "@/lib/email/service";
import { renderPasswordResetEmail, renderMagicLinkEmail } from "@/lib/email/templates/auth-emails";
import { verifySupabaseLegacyPassword } from "@/lib/auth/legacy-bridge";

export interface BetterAuthEnv {
  DB: D1Database;
  EMAIL?: any;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  [key: string]: any;
}

let ephemeralDevSecret: string | null = null;
function getEphemeralDevSecret(): string {
  if (!ephemeralDevSecret) {
    ephemeralDevSecret = crypto.randomBytes(32).toString("hex");
  }
  return ephemeralDevSecret;
}

export function createBetterAuth(env: BetterAuthEnv) {
  if (!env?.DB) {
    throw new Error("[BetterAuth] D1 database handle is required to initialize Better Auth.");
  }

  const kyselyDb = new Kysely<any>({
    dialect: new D1Dialect({ database: env.DB }),
  });

  const rawSecret = env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET;
  const BANNED_SECRETS = new Set([
    "kclmc-secret-production-auth-key-2026-edge",
    "1ee648c7f7b07ffcce236264aad790a17d390b39ba5f2c9df02a7d5919925278",
    "kclmc-d1-auth-edge-seal:25583bc2-683b-49ac-a5c0-2419a66f651a",
  ]);
  if (!rawSecret || BANNED_SECRETS.has(rawSecret)) {
    if ((process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") && process.env.NEXT_PHASE !== "phase-production-build") {
      throw new Error("[BetterAuth] Missing or insecure BETTER_AUTH_SECRET environment secret.");
    }
  }
  const secret = rawSecret || getEphemeralDevSecret();

  const baseURL =
    env.BETTER_AUTH_URL ||
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://kclmc.org";

  return betterAuth({
    database: {
      db: kyselyDb,
      type: "sqlite",
    },
    secret,
    baseURL,
    trustedOrigins: [
      "https://kclmc.org",
      "https://*.kclmc.org",
      "https://kclmc-portal.remy-preston.workers.dev",
      "https://*.remy-preston.workers.dev",
      ...(process.env.NODE_ENV !== "production"
        ? ["http://localhost:3000", "http://127.0.0.1:3000"]
        : []),
    ],
    user: {
      additionalFields: {
        role: {
          type: "number",
          required: false,
          defaultValue: 0,
          input: false,
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      sendResetPassword: async ({ user, url }) => {
        const recipientName = user.name || user.email.split("@")[0] || "Climber";
        const { html, text } = renderPasswordResetEmail(recipientName, url);
        await sendEmail(env, {
          to: user.email,
          name: recipientName,
          subject: "Reset your KCLMC password",
          html,
          text,
        });
      },
    },
    advanced: {
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
      },
      defaultCookieAttributes: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      },
    },
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          const recipientName = email.split("@")[0] || "Climber";
          const { html, text } = renderMagicLinkEmail(url);
          await sendEmail(env, {
            to: email,
            name: recipientName,
            subject: "Your 1-click KCLMC sign-in link",
            html,
            text,
          });
        },
      }),
      twoFactor({
        issuer: "KCLMC Portal",
      }),
    ],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // JIT Password Auto-Bump Hook: Catches migrated Supabase users on sign-in
        if (ctx.path === "/sign-in/email") {
          const { email, password } = (ctx.body || {}) as { email?: string; password?: string };
          if (email && password) {
            const cleanEmail = email.trim().toLowerCase();
            try {
              const existingUser = await kyselyDb
                .selectFrom("user")
                .where("email", "=", cleanEmail)
                .select(["id"])
                .executeTakeFirst();

              if (existingUser) {
                const account = await kyselyDb
                  .selectFrom("account")
                  .where("userId", "=", existingUser.id)
                  .where("providerId", "=", "credential")
                  .select(["password"])
                  .executeTakeFirst();

                if (account?.password === "MIGRATED_ACCOUNT") {
                  console.log(`[BetterAuth JIT] Checking Supabase credentials for ${cleanEmail}...`);
                  const isValid = await verifySupabaseLegacyPassword(cleanEmail, password);
                  if (isValid) {
                    console.log(`[BetterAuth JIT] Supabase credentials verified! Upgrading password in D1 for ${cleanEmail}...`);
                    const newHash = await hashPassword(password);
                    await kyselyDb
                      .updateTable("account")
                      .set({ password: newHash })
                      .where("userId", "=", existingUser.id)
                      .where("providerId", "=", "credential")
                      .execute();
                  }
                }
              }
            } catch (err) {
              console.warn("[BetterAuth JIT] Hook non-fatal error:", err);
            }
          }
        }
      }),
    },
  });
}

export type BetterAuthInstance = ReturnType<typeof createBetterAuth>;
