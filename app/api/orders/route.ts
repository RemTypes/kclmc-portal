import { NextResponse } from 'next/server';
import { createClient, createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { getUserRole, getAuthenticatedUserRole } from '@/lib/auth';
import type { MerchOrder } from '@/types/database';

// In-memory fallback cache for development when Supabase is not configured
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
    if (isSupabaseConfigured()) {
      const adminClient = createAdminClient();

      if (code) {
        const cleanCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
        if (!cleanCode || cleanCode.length > 32 || !/^[A-Z0-9_-]{3,32}$/.test(cleanCode)) {
          return NextResponse.json({ error: 'Invalid order code format' }, { status: 400 });
        }

        const { data, error } = await adminClient
          .from('merch_orders')
          .select('*')
          .eq('order_code', cleanCode)
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

        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      // Restrict unauthenticated listing of customer PII: require committee role
      const userClient = await createClient();
      const { data: { user } } = await userClient.auth.getUser();
      const role = await getAuthenticatedUserRole(userClient, user);
      if (role < 1) {
        return NextResponse.json(
          { error: 'Unauthorized: Committee access required to list all orders' },
          { status: 403 }
        );
      }

      const { data, error } = await adminClient
        .from('merch_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        return NextResponse.json(data.map((d: any) => ({
          id: d.id,
          orderCode: d.order_code,
          customerName: d.customer_name,
          customerEmail: d.customer_email,
          items: d.items,
          status: d.status.toUpperCase(),
          total: d.total_pence / 100,
        })));
      }

      return NextResponse.json([]);
    }

    // Supabase not configured: fallback cache
    if (code) {
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

    return NextResponse.json(fallbackOrders.map(d => ({
      id: d.id,
      orderCode: d.order_code,
      customerName: d.customer_name,
      customerEmail: d.customer_email,
      items: d.items,
      status: d.status.toUpperCase(),
      total: d.total_pence / 100,
    })));
  } catch (err: any) {
    if (code) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const brand = body.brand === 'LUBE' ? 'LUBE' : 'KCL';
    const orderCode = `${brand}-${Math.floor(Math.random() * 9000 + 1000).toString()}`;

    // Validate amount to prevent price tampering
    let totalPence = 2000;
    if (body.total !== undefined) {
      if (typeof body.total !== 'number' || !Number.isFinite(body.total) || body.total < 0 || body.total > 5000) {
        return NextResponse.json({ error: 'Invalid total amount' }, { status: 400 });
      }
      totalPence = Math.round(body.total * 100);
    }

    const rawName = typeof body.customerName === 'string' ? body.customerName : (typeof body.customText === 'string' ? body.customText : 'Member');
    const rawEmail = typeof body.customerEmail === 'string' ? body.customerEmail : 'member@kcl.ac.uk';

    const customerName = rawName.replace(/[<>\0\r\n]/g, '').trim().slice(0, 100) || 'Member';
    const customerEmail = rawEmail.replace(/[<>\0\r\n]/g, '').trim().slice(0, 150) || 'member@kcl.ac.uk';

    const items = Array.isArray(body.items) && body.items.length > 0
      ? body.items.slice(0, 20).map((it: any) => ({
          name: String(it?.name || 'KCLMC Stash').replace(/[<>\0\r\n]/g, '').trim().slice(0, 100),
          size: String(it?.size || 'M').replace(/[<>\0\r\n]/g, '').trim().slice(0, 10),
        }))
      : [{ name: String(body.garment || 'KCLMC Stash').replace(/[<>\0\r\n]/g, '').trim().slice(0, 100), size: String(body.size || 'M').replace(/[<>\0\r\n]/g, '').trim().slice(0, 10) }];

    const newOrder: MerchOrder = {
      id: Date.now().toString(),
      user_id: null,
      order_code: orderCode,
      customer_name: customerName,
      customer_email: customerEmail,
      items,
      status: 'pending',
      total_pence: totalPence,
      brand,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      const admin = createAdminClient();
      const { error } = await admin.from('merch_orders').insert({
        order_code: newOrder.order_code,
        customer_name: newOrder.customer_name,
        customer_email: newOrder.customer_email,
        items: newOrder.items,
        status: newOrder.status,
        total_pence: newOrder.total_pence,
        brand: newOrder.brand,
      });

      if (error) {
        console.warn('Order insert error:', error.message);
        fallbackOrders.push(newOrder);
      }
    } else {
      fallbackOrders.push(newOrder);
    }

    return NextResponse.json({ success: true, orderCode: newOrder.order_code });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to process order' }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { code, status } = body;

    if (!code || !status) {
      return NextResponse.json({ error: 'Missing code or status' }, { status: 400 });
    }

    const cleanCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
    if (!cleanCode || cleanCode.length > 32 || !/^[A-Z0-9_-]{3,32}$/.test(cleanCode)) {
      return NextResponse.json({ error: 'Invalid order code format' }, { status: 400 });
    }

    const normalizedStatus = String(status).toLowerCase().trim();
    const allowedStatuses = ['pending', 'paid', 'fulfilled', 'cancelled'];
    if (!allowedStatuses.includes(normalizedStatus)) {
      return NextResponse.json({ error: 'Invalid order status' }, { status: 400 });
    }

    if (isSupabaseConfigured()) {
      // Require committee privileges to modify order statuses
      const userClient = await createClient();
      const { data: { user } } = await userClient.auth.getUser();
      const role = await getAuthenticatedUserRole(userClient, user);
      if (role < 1) {
        return NextResponse.json(
          { error: 'Unauthorized: Committee privileges required to modify orders' },
          { status: 403 }
        );
      }

      const admin = createAdminClient();
      await admin
        .from('merch_orders')
        .update({ status: normalizedStatus, updated_at: new Date().toISOString() })
        .eq('order_code', cleanCode);
    }

    // Update in fallback cache
    const idx = fallbackOrders.findIndex(o => o.order_code === cleanCode);
    if (idx > -1) {
      fallbackOrders[idx].status = normalizedStatus as any;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Update failed' }, { status: 500 });
  }
}
