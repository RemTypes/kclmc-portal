/**
 * KCLMC Platform - Error Monitoring & Crash Reporting Gateway
 * Compliant with UK GDPR (anonymized error reporting, no PII leakage).
 */

export interface ErrorContext {
  componentStack?: string;
  digest?: string;
  userId?: string;
  route?: string;
  extra?: Record<string, any>;
}

export interface CapturedErrorInfo {
  eventId: string;
  message: string;
  name: string;
  stack?: string;
  digest?: string;
  route?: string;
  timestamp: string;
  context?: Record<string, any>;
}

/**
 * Strips potential sensitive data like bearer tokens, auth cookies, or passwords from error strings.
 */
function sanitizeErrorMessage(msg: string): string {
  if (!msg) return 'Unknown error';
  return msg
    .replace(/(password|secret|key|token|auth)=[^&\\s]+/gi, '$1=[REDACTED]')
    .replace(/bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .slice(0, 1000);
}

/**
 * Capture an exception in client or server environment and forward to telemetry / error sink.
 */
export async function captureException(
  error: unknown,
  context?: ErrorContext
): Promise<string> {
  const eventId = Math.random().toString(36).substring(2, 12);
  const timestamp = new Date().toISOString();

  let message = 'Unknown error';
  let name = 'Error';
  let stack: string | undefined;

  if (error instanceof Error) {
    message = sanitizeErrorMessage(error.message);
    name = error.name || 'Error';
    stack = error.stack?.slice(0, 2000);
  } else if (typeof error === 'string') {
    message = sanitizeErrorMessage(error);
  } else if (typeof error === 'object' && error !== null) {
    message = sanitizeErrorMessage(JSON.stringify(error));
  }

  const payload: CapturedErrorInfo = {
    eventId,
    message,
    name,
    stack,
    digest: context?.digest,
    route: context?.route,
    timestamp,
    context: context?.extra,
  };

  // Always log to console.error so production logs (and Cloudflare Workers logs) capture it
  console.error(`[KCLMC-MONITORING] [Event: ${eventId}] [${name}] ${message}`, {
    digest: context?.digest,
    route: context?.route,
  });

  // Client-side: dispatch to /api/telemetry
  if (typeof window !== 'undefined') {
    try {
      fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'runtime_error',
          payload: {
            ...payload,
            url: window.location.href,
            userAgent: navigator.userAgent,
          },
        }),
      }).catch(() => {
        // Fire-and-forget; never crash the user experience if telemetry fails
      });
    } catch {
      // Ignored
    }
  } else {
    // Server-side: check if external webhook or Sentry endpoint is configured
    const webhookUrl = process.env.ERROR_ALERT_WEBHOOK_URL;
    if (webhookUrl && webhookUrl.startsWith('https://')) {
      try {
        fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 [KCLMC Production Error] ${name}: ${message} (Event: ${eventId})`,
            error: payload,
          }),
        }).catch(() => {});
      } catch {
        // Ignored
      }
    }
  }

  return eventId;
}

/**
 * Capture an operational warning or system diagnostic message.
 */
export async function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, any>
): Promise<string> {
  const eventId = Math.random().toString(36).substring(2, 12);
  const cleanMessage = sanitizeErrorMessage(message);

  if (level === 'error') {
    console.error(`[KCLMC-MONITORING] [${level.toUpperCase()}] ${cleanMessage}`, context);
  } else if (level === 'warning') {
    console.warn(`[KCLMC-MONITORING] [${level.toUpperCase()}] ${cleanMessage}`, context);
  }

  if (typeof window !== 'undefined') {
    try {
      fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: `system_${level}`,
          payload: {
            eventId,
            message: cleanMessage,
            level,
            context,
            url: window.location.href,
            timestamp: new Date().toISOString(),
          },
        }),
      }).catch(() => {});
    } catch {
      // Ignored
    }
  }

  return eventId;
}
