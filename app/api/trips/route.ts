import { NextResponse } from 'next/server';
import { getTrips } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const trips = await getTrips();
    return NextResponse.json({
      status: 'ok',
      count: trips.length,
      trips,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: 'error',
        message: err.message || 'Failed to fetch trips',
      },
      { status: 500 }
    );
  }
}
