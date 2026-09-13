import { NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function POST(request: Request) {
  try {
    const data = await request.json(); // Array of parsed CSV rows
    const results = { matched: [] as any[], partial: [] as any[], orphan: [] as any[] };
    
    // Simplistic mock 3-tier matching engine for KCLSU payments
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
  } catch (err) {
    return NextResponse.json({ error: 'Failed to reconcile' }, { status: 500 });
  }
}
