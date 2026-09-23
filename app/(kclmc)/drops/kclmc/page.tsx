'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { ShopItem } from '@/types/database';

const SEED_SHOP_ITEMS: ShopItem[] = [
  {
    id: '1',
    name: 'KCLMC Alpine Tee 2026',
    brand: 'KCL',
    price_pence: 1800,
    garment_types: 'T-Shirt',
    current_moq: 12,
    target_moq: 30,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'KCLMC Summit Hoodie',
    brand: 'KCL',
    price_pence: 3500,
    garment_types: 'Hoodie',
    current_moq: 8,
    target_moq: 25,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'KCLMC Expedition Sweater',
    brand: 'KCL',
    price_pence: 2800,
    garment_types: 'Sweater',
    current_moq: 5,
    target_moq: 20,
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

export default function DropsKclmc() {
  const [size, setSize] = useState('M');
  const [garment, setGarment] = useState('');
  const [customText, setCustomText] = useState('');
  const [email, setEmail] = useState('');
  const [orderCode, setOrderCode] = useState('');
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!isSupabaseConfigured()) {
        setShopItems(SEED_SHOP_ITEMS);
        setGarment(SEED_SHOP_ITEMS[0].name);
        setLoading(false);
        return;
      }
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('shop_items')
          .select('*')
          .eq('brand', 'KCL')
          .eq('is_active', true);

        if (!error && data && data.length > 0) {
          setShopItems(data);
          setGarment(data[0].name);
        } else {
          setShopItems(SEED_SHOP_ITEMS);
          setGarment(SEED_SHOP_ITEMS[0].name);
        }
      } catch {
        setShopItems(SEED_SHOP_ITEMS);
        setGarment(SEED_SHOP_ITEMS[0].name);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleOrder = async () => {
    if (!email) {
      alert('Please enter your email to proceed.');
      return;
    }
    setSubmitting(true);
    try {
      const selected = shopItems.find(i => i.name === garment);
      const res = await fetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          brand: 'KCL',
          size,
          garment,
          customText,
          customerName: email,
          total: selected ? selected.price_pence : 2000,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data && data.orderCode) {
        setOrderCode(data.orderCode);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedItem = shopItems.find(i => i.name === garment);
  const targetMoq = selectedItem?.target_moq || 30;
  const currentMoq = selectedItem?.current_moq || 0;
  const moqPercentage = targetMoq > 0
    ? Math.min(100, Math.round((currentMoq / targetMoq) * 100))
    : 0;

  return (
    <div className="bg-[#052322] text-[#F7F7F7] min-h-screen p-6 md:p-12 relative overflow-hidden font-sans topo-pattern">
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#084746] border border-[#FFBD59]/40 text-[#FFBD59] text-xs font-mono uppercase tracking-widest mb-4">
          Official Apparel &amp; Pre-Orders
        </div>
        <h1 className="text-4xl md:text-5xl font-black font-serif text-[#FFBD59] mb-3">
          Club Merch Drops
        </h1>
        <p className="text-zinc-300 text-sm md:text-base mb-8 max-w-xl">
          Group-buy pre-orders for official 2026 Gold &amp; Green KCLMC stash with custom embroidery options.
        </p>
        
        {loading ? (
          <div className="animate-pulse mb-8 p-6 border border-[#FFBD59]/20 rounded-2xl bg-[#084746]/40 text-center text-zinc-400 font-mono">
            Loading live drop data...
          </div>
        ) : shopItems.length === 0 ? (
          <div className="mb-8 p-8 border border-[#FFBD59]/20 rounded-2xl bg-[#084746]/40 text-center text-zinc-300">
            <p className="text-lg font-bold mb-1 text-white">No active club drops right now</p>
            <p className="text-xs text-zinc-400">New garment batches will be published here when the pre-order window opens.</p>
          </div>
        ) : (
          <>
            {/* Live MOQ Progress */}
            <div className="mb-8 p-6 border border-[#FFBD59]/25 rounded-2xl bg-[#084746]/70 backdrop-blur-md shadow-lg">
              <h2 className="text-xl font-bold mb-2 text-white font-serif">
                Live MOQ Progress: <span className="text-[#FFBD59]">{selectedItem?.name}</span>
              </h2>
              <div className="w-full bg-[#041F1E] h-4 rounded-full overflow-hidden border border-[#FFBD59]/20">
                <div
                  className="bg-[#FFBD59] h-full transition-all duration-500 rounded-full"
                  style={{ width: `${moqPercentage}%` }}
                ></div>
              </div>
              <div className="flex justify-between items-center mt-2 text-xs font-mono">
                <span className="text-zinc-300">
                  {currentMoq} / {targetMoq} orders reached
                </span>
                <span className="text-[#FFBD59] font-bold">{moqPercentage}%</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Garment Customizer Form */}
              <div className="p-6 bg-[#084746]/70 border border-[#FFBD59]/25 rounded-2xl backdrop-blur-md shadow-lg">
                <h2 className="text-2xl font-black mb-4 text-white font-serif">Customize Garment</h2>
                
                <label className="block mb-2 text-xs font-mono uppercase tracking-wider text-zinc-300">Garment Type</label>
                <select
                  value={garment}
                  onChange={e => setGarment(e.target.value)}
                  className="w-full p-3 mb-4 bg-[#041F1E] rounded-lg text-white border border-[#FFBD59]/30 focus:outline-none focus:border-[#FFBD59] text-sm"
                >
                  {shopItems.map(item => (
                    <option key={item.id} value={item.name}>
                      {item.name} (£{(item.price_pence / 100).toFixed(2)})
                    </option>
                  ))}
                </select>

                <label className="block mb-2 text-xs font-mono uppercase tracking-wider text-zinc-300">Size</label>
                <select
                  value={size}
                  onChange={e => setSize(e.target.value)}
                  className="w-full p-3 mb-4 bg-[#041F1E] rounded-lg text-white border border-[#FFBD59]/30 focus:outline-none focus:border-[#FFBD59] text-sm"
                >
                  <option>XS</option>
                  <option>S</option>
                  <option>M</option>
                  <option>L</option>
                  <option>XL</option>
                  <option>XXL</option>
                </select>

                <label className="block mb-2 text-xs font-mono uppercase tracking-wider text-zinc-300">Custom Text / Initials (Optional)</label>
                <input
                  type="text"
                  value={customText}
                  onChange={e => setCustomText(e.target.value)}
                  className="w-full p-3 mb-4 bg-[#041F1E] rounded-lg text-white border border-[#FFBD59]/30 focus:outline-none focus:border-[#FFBD59] text-sm"
                  placeholder="e.g. Alex"
                />

                <label className="block mb-2 text-xs font-mono uppercase tracking-wider text-zinc-300">Customer Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full p-3 mb-6 bg-[#041F1E] rounded-lg text-white border border-[#FFBD59]/30 focus:outline-none focus:border-[#FFBD59] text-sm"
                  placeholder="your.name@kcl.ac.uk"
                />

                <button
                  onClick={handleOrder}
                  disabled={submitting}
                  className="w-full py-3.5 bg-[#FFBD59] text-[#052322] font-black rounded-lg hover:bg-[#FFE0A3] hover:shadow-[0_0_20px_rgba(255,189,89,0.4)] transition-all font-mono uppercase text-xs tracking-wider disabled:opacity-50"
                >
                  {submitting ? 'Generating...' : 'Generate Order Code & Checkout'}
                </button>
              </div>

              {/* Order Confirmation */}
              {orderCode && (
                <div className="p-6 bg-[#084746] border border-[#FFBD59]/50 rounded-2xl flex flex-col items-center justify-center text-center shadow-xl">
                  <span className="text-4xl mb-3">🎉</span>
                  <h2 className="text-2xl font-black mb-2 text-white font-serif">Order Created!</h2>
                  <p className="text-xs mb-3 text-zinc-300 font-mono">Your Unique Order Code:</p>
                  <div className="text-3xl font-mono font-black bg-[#041F1E] text-[#FFBD59] border border-[#FFBD59]/40 py-2.5 px-6 rounded-xl mb-4 tracking-widest">
                    {orderCode}
                  </div>
                  <p className="text-center text-xs mb-6 text-zinc-300 max-w-xs leading-relaxed">
                    Provide this reference code when completing payment at KCLSU checkout.
                  </p>
                  <Link
                    href={`/pass/${orderCode}`}
                    className="bg-[#FFBD59] text-[#052322] py-2.5 px-6 rounded-lg font-bold font-mono text-xs hover:bg-[#FFE0A3] transition-colors uppercase tracking-wider"
                  >
                    View Digital Pass →
                  </Link>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}