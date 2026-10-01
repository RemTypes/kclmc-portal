import { NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { store } from '@/lib/store';

export async function POST(request: Request) {
  try {
    const data = await request.json(); // Array of parsed CSV rows
    if (!Array.isArray(data)) {
      return NextResponse.json({ error: 'Payload must be an array of transaction records' }, { status: 400 });
    }

    const results = { matched: [] as any[], partial: [] as any[], orphan: [] as any[] };

    if (isSupabaseConfigured()) {
      const admin = createAdminClient();

      for (const row of data) {
        if (!row || typeof row !== 'object') continue;
        const rawCode = row.orderCode || row['Order ID'] || row.reference || row['Transaction ID'] || row['order_code'];
        const orderCode = typeof rawCode === 'string' ? rawCode.trim().toUpperCase().slice(0, 32) : '';
        if (!orderCode || !/^[A-Z0-9_-]{3,32}$/.test(orderCode)) continue;

        const rawAmount = row.Amount || row.amount || '0';
        const parsedAmount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).replace(/[^0-9.-]/g, ''));
        const amount = Number.isFinite(parsedAmount) && parsedAmount >= 0 ? parsedAmount : 0;

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
            note: String(row.Note || row.note || '').slice(0, 200),
          });
        }
      }

      return NextResponse.json({ success: true, results });
    }

    // Local in-memory mock fallback when Supabase is not configured
    for (const row of data) {
      if (!row || typeof row !== 'object') continue;
      const rawCode = row.orderCode || row['Order ID'] || row.reference;
      const orderCode = typeof rawCode === 'string' ? rawCode.trim().toUpperCase().slice(0, 32) : '';
      if (!orderCode || !/^[A-Z0-9_-]{3,32}$/.test(orderCode)) continue;

      const rawAmount = row.Amount || row.amount || '0';
      const parsedAmount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).replace(/[^0-9.-]/g, ''));
      const amount = Number.isFinite(parsedAmount) && parsedAmount >= 0 ? parsedAmount : 0;

      const order = store.getOrder(orderCode);
      if (order) {
        if (order.total && amount < order.total) {
          results.partial.push({ orderCode, status: 'Partial Payment', amount, expected: order.total });
        } else {
          store.updateOrderStatus(orderCode, 'PAID');
          results.matched.push({ orderCode, status: 'Matched & Paid', amount });
        }
      } else {
        results.orphan.push({ orderCode, status: 'Orphan Payment', amount, note: String(row.Note || '').slice(0, 200) });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to reconcile' }, { status: 500 });
  }
}
