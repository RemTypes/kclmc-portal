import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

let fallbackTelemetry: any[] = [];

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('telemetry_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      return NextResponse.json(data);
    }
    return NextResponse.json(fallbackTelemetry);
  } catch {
    return NextResponse.json(fallbackTelemetry);
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const event = {
    id: Math.random().toString(36).substring(7),
    event_type: body.type || body.event_type || 'generic_event',
    payload: body.payload || body,
    session_id: body.sessionId || null,
    created_at: new Date().toISOString(),
  };

  try {
    const supabase = await createClient();
    const { error } = await supabase.from('telemetry_events').insert({
      event_type: event.event_type,
      payload: event.payload,
      session_id: event.session_id,
    });

    if (error) {
      fallbackTelemetry.push(event);
    }
  } catch {
    fallbackTelemetry.push(event);
  }

  return NextResponse.json({ success: true });
}
