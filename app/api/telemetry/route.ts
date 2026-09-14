import { NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function GET() {
  return NextResponse.json(store.getTelemetry());
}

export async function POST(request: Request) {
  const body = await request.json();
  store.logEvent({
    id: Math.random().toString(36).substring(7),
    timestamp: Date.now(),
    ...body
  });
  return NextResponse.json({ success: true });
}
