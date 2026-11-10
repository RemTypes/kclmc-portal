# 0001. Stateless AES-256-GCM 2FA Challenges across Cloudflare Workers Isolates

## Context

Committee Member accounts (Role ≥ 1) enforce mandatory two-factor authentication (2FA/TOTP). When a committee member submits credentials, their primary password is validated against Cloudflare D1 (`"account"` / `users`), but the session must await a second factor before granting administrative access.

Cloudflare Workers isolates are stateless, short-lived, and distributed across global edge regions. Storing ephemeral pending 2FA challenges in isolate-local memory fails whenever the subsequent `/api/auth/verify-2fa` request lands on a different Worker isolate, and storing pending challenges in the database introduces unnecessary write amplification and orphan challenge rows.

## Decision

We seal the pending authentication payload (including user ID, email, role, TOTP secret, and expiration timestamp) inside an **AES-256-GCM** encrypted challenge token stored in an `httpOnly`, `SameSite=Lax`, `Secure` cookie (`kclmc_2fa_pending`) with a 5-minute time-to-live.

To guarantee that challenges sealed on Isolate A can always be unsealed on Isolate B even if optional environment variables are absent, key resolution uses a deterministic candidate hierarchy (`TWO_FACTOR_ENCRYPTION_KEY`, `BETTER_AUTH_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and a deterministic SHA-256 edge fallback key). Furthermore, primary password validation clears the IP login failure counter and isolates 2FA verification attempts into a dedicated `2fa:${ip}` rate-limit bucket with a $\pm 2$ step ($\pm 60\text{s}$) RFC 6238 TOTP window.

All challenge encryption, validation, and cookie emission are encapsulated strictly within the `AuthSession` and `lib/security/two-factor.ts` modules.

## Consequences

- 2FA verification executes seamlessly across any Cloudflare Workers isolate without isolate-memory state loss or database round-trips for challenge state.
- Enrolled TOTP secrets and hashed backup codes are persisted in Cloudflare D1 (`"twoFactor"` and `users` tables) with `"user"."twoFactorEnabled" = 1`.
- Committee officers are protected against accidental account lockouts caused by clock drift or isolate bouncing during 2FA entry.
