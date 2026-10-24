import { getCloudflareEnv, getD1Database } from "@/lib/db/d1";
import { createBetterAuth } from "@/lib/auth/better-auth";

async function handler(request: Request) {
  const env = await getCloudflareEnv();
  const db = (await getD1Database()) || env?.DB;

  if (!db) {
    return new Response(
      JSON.stringify({ error: "Database connection unavailable" }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const origin = new URL(request.url).origin;
  const auth = createBetterAuth({ ...env, DB: db, BETTER_AUTH_URL: origin });
  return auth.handler(request);
}

export const GET = handler;
export const POST = handler;
