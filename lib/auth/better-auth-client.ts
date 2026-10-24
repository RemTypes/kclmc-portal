/**
 * Better Auth Client SDK Instance
 * 
 * Provides type-safe React client hooks and authentication methods for:
 * - Email & Password authentication
 * - 1-Click Magic Link sign-in
 * - Two-Factor Authentication (TOTP verification & setup)
 * - Password resets
 */

import { createAuthClient } from "better-auth/client";
import { twoFactorClient, magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL:
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined"
      ? window.location.origin
      : "https://kclmc-portal.remy-preston.workers.dev"),
  plugins: [
    twoFactorClient(),
    magicLinkClient(),
  ],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  magicLink,
  twoFactor,
  resetPassword,
  requestPasswordReset,
} = authClient;
