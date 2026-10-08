/**
 * KCLMC Platform - Server-Side Telemetry Event Tracker
 * Strictly for Next.js Route Handlers and Server Components.
 */

import { isSupabaseConfigured, createAdminClient } from '@/lib/supabase/server';
import type { TelemetryPayload } from './telemetry';

export async function trackServerEvent(
  eventType: string,
  payload: TelemetryPayload = {},
  sessionId?: string | null
): Promise<void> {
  const cleanType = eventType.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);

  const isUuid =
    typeof payload?.userId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.userId);

  const event = {
    event_type: cleanType,
    payload,
    session_id: sessionId || null,
    user_id: isUuid ? payload.userId : null,
    created_at: new Date().toISOString(),
  };

  try {
    if (isSupabaseConfigured()) {
      const admin = createAdminClient();
      await admin.from('telemetry_events').insert({
        event_type: event.event_type,
        payload: event.payload,
        session_id: event.session_id,
        user_id: event.user_id,
      });
    }
  } catch (err) {
    // Non-blocking telemetry
    console.warn(`[TELEMETRY] Server event recording note: ${cleanType}`);
  }
}
