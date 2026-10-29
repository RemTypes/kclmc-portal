/**
 * Supabase Legacy Auth Bridge
 * 
 * Verifies credentials against Supabase GoTrue for accounts marked as 'MIGRATED_ACCOUNT'.
 * Once Better Auth confirms credentials, it auto-upgrades the account's password in D1
 * to Better Auth's native format, after which this bridge is never touched again.
 */

export async function verifySupabaseLegacyPassword(email: string, password: string): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bsvnyibipcwrcyzqilge.supabase.co";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_IZmrUzhCzPpLG5ZuWVxY_A_QxQJl5Hg";

  if (!email || !password) {
    return false;
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
      }),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return Boolean(data?.access_token && data?.user?.id);
    }
    return false;
  } catch (err) {
    console.warn("[LegacyBridge] Supabase verification error:", err);
    return false;
  }
}
