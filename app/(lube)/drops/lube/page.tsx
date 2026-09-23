'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabaseMock, ShopItem } from '@/lib/supabase';

export default function LubeDropsPage() {
  const [garment, setGarment] = useState('');
  const [size, setSize] = useState('M');
  const [category, setCategory] = useState('');
  const [email, setEmail] = useState('');
  const [orderCode, setOrderCode] = useState('');
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetchData() {
      const { data } = await supabaseMock.from('shop_items').select<ShopItem>();
      const lubeItems = (data || []).filter(item => item.brand === 'LUBE');
      setShopItems(lubeItems);
      if (lubeItems.length > 0) setGarment(lubeItems[0].name);
      setLoading(false);
    }
    fetchData();
  }, []);
  
  const selectedItem = shopItems.find(i => i.name === garment);
  const progress = selectedItem && selectedItem.targetMoq > 0 
    ? Math.min(100, Math.round((selectedItem.currentMoq / selectedItem.targetMoq) * 100))
    : 0;

  const handleOrder = async () => {
    const res = await fetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ 
        brand: 'LUBE',
        garment,
        size,
        customText: category,
        customerName: email,
        total: selectedItem?.price || 0,
        items: [{ name: garment, size }]
      }),
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    setOrderCode(data.orderCode);
  };
  
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F0] p-8 font-mono">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-black uppercase mb-4">LUBE Merch Drop</h1>
        <p className="text-xl mb-8 text-[#E8E8E3]">Group-buy for the official 2026 Series.</p>
        
        {loading ? (
          <div className="border-2 border-[#F5F5F0] p-8 mb-8 text-center animate-pulse">Loading live drops...</div>
        ) : shopItems.length === 0 ? (
          <div className="border-2 border-[#F5F5F0] p-8 mb-8 text-center text-[#A1A1AA]">No active LUBE drops at the moment.</div>
        ) : (
        <div className="border-2 border-[#F5F5F0] p-8 mb-8 relative">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1 bg-[#121212] aspect-square flex items-center justify-center border border-[#F5F5F0]/30 text-6xl">
              ⚪
            </div>
            <div className="flex-1 flex flex-col justify-center">
              
              <label className="block mb-2 font-bold uppercase text-xs tracking-widest text-[#E8E8E3]">Garment</label>
              <select value={garment} onChange={e => setGarment(e.target.value)} className="w-full p-3 mb-4 bg-[#121212] text-[#F5F5F0] border border-[#F5F5F0]/30 focus:outline-none focus:border-[#F5F5F0]">
                {shopItems.map(g => <option key={g.id} value={g.name}>{g.name} (£{g.price})</option>)}
              </select>
              
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <label className="block mb-2 font-bold uppercase text-xs tracking-widest text-[#E8E8E3]">Size</label>
                  <select value={size} onChange={e => setSize(e.target.value)} className="w-full p-3 bg-[#121212] text-[#F5F5F0] border border-[#F5F5F0]/30 focus:outline-none focus:border-[#F5F5F0]">
                    {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block mb-2 font-bold uppercase text-xs tracking-widest text-[#E8E8E3]">Uni/Category</label>
                  <input type="text" value={category} onChange={e => setCategory(e.target.value)} className="w-full p-3 bg-[#121212] text-[#F5F5F0] border border-[#F5F5F0]/30 focus:outline-none focus:border-[#F5F5F0]" placeholder="e.g. KCL" />
                </div>
              </div>
              
              <label className="block mb-2 font-bold uppercase text-xs tracking-widest text-[#E8E8E3]">Customer Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 mb-6 bg-[#121212] text-[#F5F5F0] border border-[#F5F5F0]/30 focus:outline-none focus:border-[#F5F5F0]" placeholder="Email" />
              
              <div className="mb-6">
                <div className="flex justify-between mb-2 uppercase text-xs tracking-widest">
                  <span>MOQ Progress ({selectedItem?.currentMoq}/{selectedItem?.targetMoq})</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-[#121212] h-2 border border-[#F5F5F0]/30">
                  <div className="bg-[#F5F5F0] h-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
              
              {!orderCode ? (
                <button onClick={handleOrder} className="w-full bg-[#F5F5F0] text-[#0A0A0A] font-bold py-4 uppercase tracking-widest hover:bg-white transition-colors">
                  Pre-order Now
                </button>
              ) : (
                <div className="bg-[#121212] border border-[#F5F5F0] p-4 text-center">
                  <p className="mb-2 uppercase text-xs tracking-widest text-[#E8E8E3]">Order Created</p>
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <span className="text-2xl font-black">{orderCode}</span>
                    <button onClick={() => navigator.clipboard.writeText(orderCode)} className="px-3 py-1 border border-[#F5F5F0]/30 hover:bg-[#F5F5F0] hover:text-[#0A0A0A] text-xs uppercase tracking-widest transition-colors">Copy</button>
                  </div>
                  <Link href={`/pass/${orderCode}`} className="block w-full py-2 bg-[#F5F5F0] text-[#0A0A0A] font-bold uppercase tracking-widest text-sm hover:bg-white transition-colors">
                    View Digital Pass
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
