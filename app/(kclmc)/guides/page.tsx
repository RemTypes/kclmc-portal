'use client';
import { useState, useEffect } from 'react';
import { supabaseMock, Guide } from '@/lib/supabase';

export default function GuidesPage() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabaseMock.from('guides').select<Guide>();
      setGuides(data || []);
      setLoading(false);
    }
    fetchData();
  }, []);

  const indoor = guides.filter(g => g.category === 'indoor');
  const outdoor = guides.filter(g => g.category === 'crag');

  return (
    <div className="min-h-screen bg-[#052322] text-[#F7F7F7] p-6 md:p-12 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#FFBD59_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#084746] border border-[#FFBD59]/40 text-[#FFBD59] text-xs font-mono uppercase tracking-widest mb-4">
          Local Beta &amp; Discounts
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-[#FFBD59] mb-3">Crag &amp; Gym Guides</h1>
        <p className="text-zinc-300 text-sm md:text-base mb-8 max-w-xl">
          London indoor wall discounts for KCL students and nearby Southern Sandstone crag beta.
        </p>
        
        {loading ? (
          <div className="text-center animate-pulse py-12 text-zinc-400">Loading guides...</div>
        ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-[#084746]/70 backdrop-blur-md p-6 rounded-2xl border border-[#FFBD59]/25">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🧗‍♂️</span>
              <h2 className="text-2xl font-bold text-white">Indoor Walls</h2>
            </div>
            <ul className="space-y-4">
              {indoor.length === 0 ? <li className="text-zinc-400 text-sm">No indoor guides added yet.</li> : indoor.map((g, i) => (
                <li key={g.id} className={i !== indoor.length - 1 ? "border-b border-white/10 pb-4" : ""}>
                  <h3 className="font-bold text-lg text-[#FFBD59]">{g.title}</h3>
                  <p className="text-sm text-[#F7F7F7]/80 mt-1">{g.description}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-[#084746]/70 backdrop-blur-md p-6 rounded-2xl border border-[#FFBD59]/25">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🪨</span>
              <h2 className="text-2xl font-bold text-white">Outdoor Local Crags</h2>
            </div>
            <ul className="space-y-4">
              {outdoor.length === 0 ? <li className="text-zinc-400 text-sm">No outdoor guides added yet.</li> : outdoor.map((g, i) => (
                <li key={g.id} className={i !== outdoor.length - 1 ? "border-b border-white/10 pb-4" : ""}>
                  <h3 className="font-bold text-lg text-[#FFBD59]">{g.title}</h3>
                  <p className="text-sm text-[#F7F7F7]/80 mt-1">{g.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
