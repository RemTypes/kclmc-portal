'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const QRCodePattern = ({ value }: { value: string }) => {
  const hash = Array.from(value).reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0);
  
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full text-black bg-white p-2">
      <rect width="100" height="100" fill="white" />
      {[...Array(10)].map((_, i) => 
        [...Array(10)].map((_, j) => {
          const isFilled = Math.abs(Math.sin(hash * (i + 1) * (j + 1))) > 0.5;
          return isFilled ? (
            <rect key={`${i}-${j}`} x={i * 10} y={j * 10} width="10" height="10" fill="currentColor" />
          ) : null;
        })
      )}
      {/* Corner markers */}
      <rect x="0" y="0" width="30" height="30" fill="currentColor" />
      <rect x="5" y="5" width="20" height="20" fill="white" />
      <rect x="10" y="10" width="10" height="10" fill="currentColor" />
      
      <rect x="70" y="0" width="30" height="30" fill="currentColor" />
      <rect x="75" y="5" width="20" height="20" fill="white" />
      <rect x="80" y="10" width="10" height="10" fill="currentColor" />
      
      <rect x="0" y="70" width="30" height="30" fill="currentColor" />
      <rect x="5" y="75" width="20" height="20" fill="white" />
      <rect x="10" y="80" width="10" height="10" fill="currentColor" />
    </svg>
  );
};

export default function DigitalPass() {
  const params = useParams();
  const orderCode = typeof params.orderCode === 'string' ? params.orderCode : Array.isArray(params.orderCode) ? params.orderCode[0] : '';
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!orderCode) return;
    setLoading(true);
    fetch(`/api/orders?code=${encodeURIComponent(orderCode)}`)
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) setOrder(data);
        else setOrder({ orderCode, status: 'NOT FOUND', items: [] });
      })
      .catch(() => setOrder({ orderCode, status: 'ERROR', items: [] }))
      .finally(() => setLoading(false));
  }, [orderCode]);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center font-mono">
        <div className="animate-pulse">Loading verified pass...</div>
      </div>
    );
  }
  
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    'PENDING': { bg: 'bg-amber-500', text: 'text-amber-950', label: 'Payment Pending at KCLSU Shop' },
    'PAID': { bg: 'bg-emerald-500', text: 'text-emerald-950', label: 'Payment Verified — Ready to Fulfill' },
    'COLLECTED': { bg: 'bg-blue-500', text: 'text-blue-950', label: 'Merch Collected' },
    'NOT FOUND': { bg: 'bg-red-500', text: 'text-red-950', label: 'Order Not Found' },
    'ERROR': { bg: 'bg-red-500', text: 'text-red-950', label: 'Lookup Error' },
  };

  const currentStatus = order?.status || 'PENDING';
  const statusInfo = statusConfig[currentStatus] || statusConfig['PENDING'];
  
  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 font-mono">
      <div className="bg-[#121212] max-w-md w-full rounded-2xl shadow-2xl overflow-hidden border border-[#F5F5F0]/20 text-[#F5F5F0]">
        {/* Status banner */}
        <div className={`p-6 text-center ${statusInfo.bg} ${statusInfo.text}`}>
          <h2 className="text-xs uppercase tracking-widest font-bold">Verification Status</h2>
          <h1 className="text-3xl font-black tracking-tight">{currentStatus}</h1>
          <p className="text-xs mt-1 font-sans opacity-90">{statusInfo.label}</p>
        </div>

        <div className="p-8 text-center">
          <p className="text-xs uppercase tracking-widest text-zinc-400 mb-1">Your Order Code</p>
          <p className="text-4xl font-black tracking-wider mb-6 text-white">{order?.orderCode}</p>
          
          <div className="mx-auto w-48 h-48 mb-6 flex items-center justify-center border-4 border-dashed border-zinc-700 rounded-xl overflow-hidden bg-white p-2">
            {order?.status !== 'NOT FOUND' && order?.status !== 'ERROR' ? (
              <QRCodePattern value={order?.orderCode || 'LUBE-0000'} />
            ) : (
              <span className="text-zinc-500 font-mono text-xs">[QR NOT AVAILABLE]</span>
            )}
          </div>
          <p className="text-[11px] text-zinc-400 mb-6">
            Show this QR code or 4-digit code to committee leads at VauxWall / Mile End during collection.
          </p>
          
          <div className="text-left border-t border-zinc-800 pt-6">
            <h3 className="text-xs uppercase tracking-wider font-bold text-zinc-400 mb-3">Order Details:</h3>
            {order?.items && order.items.length > 0 ? (
              <ul className="space-y-2">
                {order.items.map((item: any, i: number) => (
                  <li key={i} className="flex justify-between bg-zinc-900 border border-zinc-800 p-3 rounded text-sm">
                    <span className="text-zinc-200">{item.name}</span>
                    <span className="font-bold text-white border border-zinc-700 px-2 py-0.5 rounded text-xs">
                      Size: {item.size}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-zinc-500 text-xs">No specific line items recorded.</p>
            )}
            
            {order?.customerName && (
              <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-between text-xs text-zinc-400">
                <span>Customer Email:</span>
                <span className="font-bold text-zinc-200">{order.customerName}</span>
              </div>
            )}
          </div>

          <div className="mt-8 pt-4 border-t border-zinc-800/60 flex justify-between items-center text-xs">
            <Link href="/" className="text-zinc-400 hover:text-white underline">
              ← Return Home
            </Link>
            <Link href="/drops/lube" className="text-zinc-400 hover:text-white underline">
              Browse Drops
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
