import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const start = Date.now();

    // Fast, lightweight query to reset the 7-day Supabase inactivity pause timer
    const { data, error } = await supabase
      .from('shop_items')
      .select('id')
      .limit(1);

    const latencyMs = Date.now() - start;

    if (error) {
      return NextResponse.json(
        {
          status: 'error',
          database: 'error',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      sampleRecordFound: (data?.length ?? 0) > 0,
      latencyMs,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: 'error',
        message: err.message || 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
