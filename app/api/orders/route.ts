import { NextResponse } from 'next/server';
import { store, Order } from '@/lib/store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  if (code) {
    const order = store.getOrder(code);
    return order ? NextResponse.json(order) : NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(store.getOrders());
}

export async function POST(request: Request) {
  const body = await request.json();
  const brand = body.brand === 'LUBE' ? 'LUBE' : 'KCL';
  const orderCode = `${brand}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  
  const newOrder: Order = {
    id: Date.now().toString(),
    orderCode: orderCode,
    customerName: body.customerName || body.customText || 'Unknown',
    items: body.items || [{ name: body.garment, size: body.size }],
    status: 'PENDING',
    total: body.total || 0,
    ...body
  };
  
  store.addOrder(newOrder);
  return NextResponse.json({ success: true, orderCode: newOrder.orderCode });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { code, status } = body;
  
  if (code && status) {
    store.updateOrderStatus(code, status);
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: 'Missing code or status' }, { status: 400 });
}
