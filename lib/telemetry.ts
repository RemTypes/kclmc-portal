/**
 * KCLMC Platform - Client-Safe Telemetry Event Tracker
 * Safe to import in 'use client' components.
 */

export interface TelemetryPayload {
  [key: string]: any;
}

/**
 * Tracks an event from client-side code (React components).
 */
export function trackClientEvent(
  eventType: string,
  payload: TelemetryPayload = {}
): void {
  if (typeof window === 'undefined') return;

  const cleanType = eventType.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);

  try {
    fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: cleanType,
        payload: {
          ...payload,
          path: window.location.pathname,
          timestamp: new Date().toISOString(),
        },
      }),
    }).catch(() => {});
  } catch {
    // Fire-and-forget
  }
}
