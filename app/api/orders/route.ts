import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { MerchOrder } from '@/types/database';

// In-memory fallback cache for development before live Supabase is provisioned
let fallbackOrders: MerchOrder[] = [
  {
    id: '1',
    user_id: null,
    order_code: 'KCL-1234',
    customer_name: 'Alice Climber',
    customer_email: 'alice@kcl.ac.uk',
    items: [{ name: 'KCLMC Alpine Tee', size: 'M' }],
    total_pence: 1800,
    brand: 'KCL',
    status: 'paid',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    user_id: null,
    order_code: 'KCL-5678',
    customer_name: 'Bob Boulderer',
    customer_email: 'bob@kcl.ac.uk',
    items: [{ name: 'KCLMC Summit Hoodie', size: 'L' }],
    total_pence: 3500,
    brand: 'KCL',
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  try {
    const supabase = await createClient();
    if (code) {
      const { data, error } = await supabase
        .from('merch_orders')
        .select('*')
        .eq('order_code', code)
        .maybeSingle();

      if (!error && data) {
        return NextResponse.json({
          id: data.id,
          orderCode: data.order_code,
          customerName: data.customer_name,
          customerEmail: data.customer_email,
          items: data.items,
          status: data.status.toUpperCase(),
          total: data.total_pence / 100,
        });
      }

      // Fallback
      const fallback = fallbackOrders.find(o => o.order_code === code);
      if (fallback) {
        return NextResponse.json({
          id: fallback.id,
          orderCode: fallback.order_code,
          customerName: fallback.customer_name,
          customerEmail: fallback.customer_email,
          items: fallback.items,
          status: fallback.status.toUpperCase(),
          total: fallback.total_pence / 100,
        });
      }

      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const { data } = await supabase
      .from('merch_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (data && data.length > 0) {
      return NextResponse.json(data.map(d => ({
        id: d.id,
        orderCode: d.order_code,
        customerName: d.customer_name,
        customerEmail: d.customer_email,
        items: d.items,
        status: d.status.toUpperCase(),
        total: d.total_pence / 100,
      })));
    }

    return NextResponse.json(fallbackOrders.map(d => ({
      id: d.id,
      orderCode: d.order_code,
      customerName: d.customer_name,
      customerEmail: d.customer_email,
      items: d.items,
      status: d.status.toUpperCase(),
      total: d.total_pence / 100,
    })));
  } catch {
    if (code) {
      const fallback = fallbackOrders.find(o => o.order_code === code);
      return fallback
        ? NextResponse.json({
            id: fallback.id,
            orderCode: fallback.order_code,
            customerName: fallback.customer_name,
            customerEmail: fallback.customer_email,
            items: fallback.items,
            status: fallback.status.toUpperCase(),
            total: fallback.total_pence / 100,
          })
        : NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    return NextResponse.json(fallbackOrders);
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const brand = body.brand === 'LUBE' ? 'LUBE' : 'KCL';
  const orderCode = `${brand}-${Math.floor(Math.random() * 9000 + 1000).toString()}`;

  const newOrder: MerchOrder = {
    id: Date.now().toString(),
    user_id: null,
    order_code: orderCode,
    customer_name: body.customerName || body.customText || 'Member',
    customer_email: body.customerEmail || body.customerName || 'member@kcl.ac.uk',
    items: body.items || [{ name: body.garment || 'KCLMC Stash', size: body.size || 'M' }],
    status: 'pending',
    total_pence: body.total ? body.total * 100 : 2000,
    brand,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const supabase = await createClient();
    const { error } = await supabase.from('merch_orders').insert({
      order_code: newOrder.order_code,
      customer_name: newOrder.customer_name,
      customer_email: newOrder.customer_email,
      items: newOrder.items,
      status: newOrder.status,
      total_pence: newOrder.total_pence,
      brand: newOrder.brand,
    });

    if (error) {
      fallbackOrders.push(newOrder);
    }
  } catch {
    fallbackOrders.push(newOrder);
  }

  return NextResponse.json({ success: true, orderCode: newOrder.order_code });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { code, status } = body;

  if (!code || !status) {
    return NextResponse.json({ error: 'Missing code or status' }, { status: 400 });
  }

  const normalizedStatus = status.toLowerCase();

  try {
    const supabase = await createClient();
    await supabase
      .from('merch_orders')
      .update({ status: normalizedStatus, updated_at: new Date().toISOString() })
      .eq('order_code', code);

    // Update in fallback
    const idx = fallbackOrders.findIndex(o => o.order_code === code);
    if (idx > -1) {
      fallbackOrders[idx].status = normalizedStatus as any;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Update failed' }, { status: 500 });
  }
}
