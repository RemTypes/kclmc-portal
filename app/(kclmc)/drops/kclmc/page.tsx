'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabaseMock, ShopItem } from '@/lib/supabase';

export default function DropsKclmc() {
  const [size, setSize] = useState('M');
  const [garment, setGarment] = useState('');
  const [customText, setCustomText] = useState('');
  const [email, setEmail] = useState('');
  const [orderCode, setOrderCode] = useState('');
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabaseMock.from('shop_items').select<ShopItem>();
      const kclItems = (data || []).filter(item => item.brand === 'KCL');
      setShopItems(kclItems);
      if (kclItems.length > 0) setGarment(kclItems[0].name);
      setLoading(false);
    }
    fetchData();
  }, []);

  const handleOrder = async () => {
    const res = await fetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ brand: 'KCL', size, garment, customText, customerName: email }),
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    setOrderCode(data.orderCode);
  };

  const selectedItem = shopItems.find(i => i.name === garment);
  const moqPercentage = selectedItem && selectedItem.targetMoq > 0 
    ? Math.min(100, Math.round((selectedItem.currentMoq / selectedItem.targetMoq) * 100))
    : 0;

  return (
    <div className="bg-[#052322] text-[#F7F7F7] min-h-screen p-6 md:p-12 relative overflow-hidden font-sans">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#FFBD59_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#084746] border border-[#FFBD59]/40 text-[#FFBD59] text-xs font-mono uppercase tracking-widest mb-4">
          Official Apparel &amp; Pre-Orders
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-[#FFBD59] mb-3">Club Merch Drops</h1>
        <p className="text-zinc-300 text-sm md:text-base mb-8 max-w-xl">
          Group-buy pre-orders for official 2026 Gold &amp; Green KCLMC stash with custom embroidery options.
        </p>
        
        {loading ? (
          <div className="animate-pulse mb-8 p-6 border border-[#FFBD59]/20 rounded-2xl bg-[#084746]/40 text-center text-zinc-400">Loading live drop data...</div>
        ) : shopItems.length === 0 ? (
          <div className="mb-8 p-8 border border-[#FFBD59]/20 rounded-2xl bg-[#084746]/40 text-center text-zinc-300">
            <p className="text-lg font-bold mb-1 text-white">No active club drops right now</p>
            <p className="text-xs text-zinc-400">New garment batches will be published here when the pre-order window opens.</p>
          </div>
        ) : (
        <>
        <div className="mb-8 p-6 border border-[#FFBD59]/25 rounded-2xl bg-[#084746]/70 backdrop-blur-md">
          <h2 className="text-xl font-bold mb-2 text-white">Live MOQ Progress: <span className="text-[#FFBD59]">{selectedItem?.name}</span></h2>
          <div className="w-full bg-[#041F1E] h-4 rounded-full overflow-hidden border border-[#FFBD59]/20">
            <div className="bg-[#FFBD59] h-full transition-all duration-500 rounded-full" style={{ width: `${moqPercentage}%` }}></div>
          </div>
          <div className="flex justify-between items-center mt-2 text-xs font-mono">
            <span className="text-zinc-300">{selectedItem?.currentMoq || 0} / {selectedItem?.targetMoq || 0} orders reached</span>
            <span className="text-[#FFBD59] font-bold">{moqPercentage}%</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-6 bg-[#084746]/70 border border-[#FFBD59]/25 rounded-2xl backdrop-blur-md">
            <h2 className="text-2xl font-black mb-4 text-white">Customize Garment</h2>
            
            <label className="block mb-2 text-xs font-mono uppercase tracking-wider text-zinc-300">Garment Type</label>
            <select value={garment} onChange={e => setGarment(e.target.value)} className="w-full p-3 mb-4 bg-[#052322] rounded-lg text-white border border-[#FFBD59]/30 focus:outline-none focus:border-[#FFBD59]">
              {shopItems.map(item => (
                <option key={item.id} value={item.name}>{item.name} (£{item.price})</option>
              ))}
            </select>

            <label className="block mb-2 text-xs font-mono uppercase tracking-wider text-zinc-300">Size</label>
            <select value={size} onChange={e => setSize(e.target.value)} className="w-full p-3 mb-4 bg-[#052322] rounded-lg text-white border border-[#FFBD59]/30 focus:outline-none focus:border-[#FFBD59]">
              <option>XS</option>
              <option>S</option>
              <option>M</option>
              <option>L</option>
              <option>XL</option>
              <option>XXL</option>
            </select>

            <label className="block mb-2 text-xs font-mono uppercase tracking-wider text-zinc-300">Custom Text / Initials (Optional)</label>
            <input type="text" value={customText} onChange={e => setCustomText(e.target.value)} className="w-full p-3 mb-4 bg-[#052322] rounded-lg text-white border border-[#FFBD59]/30 focus:outline-none focus:border-[#FFBD59]" placeholder="e.g. Alex" />

            <label className="block mb-2 text-xs font-mono uppercase tracking-wider text-zinc-300">Customer Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 mb-6 bg-[#052322] rounded-lg text-white border border-[#FFBD59]/30 focus:outline-none focus:border-[#FFBD59]" placeholder="your.name@kcl.ac.uk" />

            <button onClick={handleOrder} className="w-full py-3.5 bg-[#FFBD59] text-[#052322] font-black rounded-lg hover:bg-[#FFE0A3] hover:shadow-[0_0_20px_rgba(255,189,89,0.4)] transition-all">
              Generate Order Code &amp; Checkout
            </button>
          </div>

          {orderCode && (
            <div className="p-6 bg-[#084746] border border-[#FFBD59]/50 rounded-2xl flex flex-col items-center justify-center text-center">
              <span className="text-3xl mb-2">🎉</span>
              <h2 className="text-2xl font-black mb-2 text-white">Order Created!</h2>
              <p className="text-sm mb-4 text-zinc-300">Your Unique Order Code:</p>
              <div className="text-3xl font-mono font-black bg-[#052322] text-[#FFBD59] border border-[#FFBD59]/40 py-2.5 px-6 rounded-lg mb-4 tracking-widest">{orderCode}</div>
              <p className="text-center text-xs mb-6 text-zinc-300 max-w-xs">
                Provide this reference code when completing payment at KCLSU checkout.
              </p>
              <Link href={`/pass/${orderCode}`} className="bg-[#FFBD59] text-[#052322] py-2.5 px-6 rounded-lg font-bold hover:bg-[#FFE0A3] transition-colors">
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