import { NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { store } from '@/lib/store';

export async function POST(request: Request) {
  try {
    const data = await request.json(); // Array of parsed CSV rows
    const results = { matched: [] as any[], partial: [] as any[], orphan: [] as any[] };

    if (isSupabaseConfigured()) {
      const admin = createAdminClient();

      for (const row of data) {
        const orderCode = row.orderCode || row['Order ID'] || row.reference || row['Transaction ID'] || row['order_code'];
        const amount = parseFloat(row.Amount || row.amount || '0');

        if (orderCode) {
          const { data: order } = await admin
            .from('merch_orders')
            .select('*')
            .eq('order_code', orderCode)
            .maybeSingle();

          if (order) {
            const expectedPence = order.total_pence || 2000;
            const amountPence = Math.round(amount * 100);

            if (amountPence < expectedPence) {
              results.partial.push({
                orderCode,
                status: 'Partial Payment',
                amount,
                expected: expectedPence / 100,
              });
            } else {
              await admin
                .from('merch_orders')
                .update({ status: 'paid', updated_at: new Date().toISOString() })
                .eq('order_code', orderCode);

              results.matched.push({
                orderCode,
                status: 'Matched & Paid',
                amount,
              });
            }
          } else {
            results.orphan.push({
              orderCode,
              status: 'Orphan Payment',
              amount,
              note: row.Note || row.note || '',
            });
          }
        }
      }

      return NextResponse.json({ success: true, results });
    }

    // Local in-memory mock fallback when Supabase is not configured
    for (const row of data) {
      const orderCode = row.orderCode || row['Order ID'] || row.reference;
      const amount = parseFloat(row.Amount || row.amount || '0');

      if (orderCode) {
        const order = store.getOrder(orderCode);
        if (order) {
          if (order.total && amount < order.total) {
            results.partial.push({ orderCode, status: 'Partial Payment', amount, expected: order.total });
          } else {
            store.updateOrderStatus(orderCode, 'PAID');
            results.matched.push({ orderCode, status: 'Matched & Paid', amount });
          }
        } else {
          results.orphan.push({ orderCode, status: 'Orphan Payment', amount, note: row.Note || '' });
        }
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to reconcile' }, { status: 500 });
  }
}
