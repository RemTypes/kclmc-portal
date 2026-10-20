# 0001. Stateless AES-256-GCM 2FA Challenges across Cloudflare Workers Isolates

## Context

Committee Member accounts (Role ≥ 1) enforce mandatory two-factor authentication (2FA/TOTP). When a committee member submits credentials, their session is partially validated, but must await a second factor before granting access.

Cloudflare Workers isolates are stateless, short-lived, and distributed across global edge regions. Storing ephemeral pending 2FA states in a database or Redis requires cross-region network round-trips and introduces potential orphan challenge rows.

## Decision

We seal the pending authentication payload (including temporary Supabase access tokens, user metadata, and expiration timestamps) inside an AES-256-GCM encrypted challenge token stored in an `httpOnly`, `SameSite=Strict`, `Secure` cookie (`kclmc_2fa_pending`) with a 5-minute time-to-live.

All challenge encryption, validation, and cookie emission are encapsulated strictly within the `AuthSession` module. Route handlers and client UI components never parse or handle raw challenge internals.

## Consequences

- 2FA verification executes seamlessly across any Cloudflare Workers isolate without requiring persistent database session tables or external cache infrastructure.
- Zero edge latency penalty for multi-region authentication.
- Payload size must remain compact enough to fit comfortably within HTTP cookie limits (< 4KB).
