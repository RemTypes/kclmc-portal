import { NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { getUserRole, getAuthenticatedUserRole } from '@/lib/auth';

let fallbackTelemetry: any[] = [];

export async function GET() {
  try {
    if (isSupabaseConfigured()) {
      const userClient = await createClient();
      const { data: { user } } = await userClient.auth.getUser();
      const role = await getAuthenticatedUserRole(userClient, user);

      if (role < 1) {
        return NextResponse.json({ error: 'Unauthorized: Committee access required' }, { status: 403 });
      }

      const { data, error } = await userClient
        .from('telemetry_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        return NextResponse.json(data);
      }
      return NextResponse.json(fallbackTelemetry);
    }
    return NextResponse.json(fallbackTelemetry);
  } catch {
    return NextResponse.json(fallbackTelemetry);
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (rawBody.length > 32768) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }
    const body = JSON.parse(rawBody);

    const rawType = typeof body.type === 'string' ? body.type : typeof body.event_type === 'string' ? body.event_type : 'generic_event';
    const cleanType = rawType.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'generic_event';

    const event = {
      id: Math.random().toString(36).substring(7),
      event_type: cleanType,
      payload: body.payload !== undefined ? body.payload : body,
      session_id: typeof body.sessionId === 'string' ? body.sessionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) : null,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      const supabase = await createClient();
      const { error } = await supabase.from('telemetry_events').insert({
        event_type: event.event_type,
        payload: event.payload,
        session_id: event.session_id,
      });

      if (error) {
        fallbackTelemetry.push(event);
      }
    } else {
      fallbackTelemetry.push(event);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid telemetry payload' }, { status: 400 });
  }
}

