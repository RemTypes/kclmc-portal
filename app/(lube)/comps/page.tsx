'use client';
import { useState, useEffect } from 'react';
import { supabaseMock, LubeRound } from '@/lib/supabase';

export default function CompsPage() {
  const [rounds, setRounds] = useState<LubeRound[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabaseMock.from('lube_rounds').select<LubeRound>();
      setRounds(data || []);
      setLoading(false);
    }
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F0] p-8 font-mono relative">
      <div className="relative z-10 max-w-4xl mx-auto">
        <h1 className="text-5xl font-black uppercase mb-8">Competition Schedule</h1>
        
        <div className="space-y-6">
          {loading ? (
            <div className="animate-pulse">Loading schedule...</div>
          ) : rounds.length === 0 ? (
            <div className="text-gray-500">No rounds scheduled.</div>
          ) : rounds.map((comp) => (
            <div key={comp.id} className="border border-[#F5F5F0]/30 p-6 flex flex-col md:flex-row justify-between items-center hover:border-[#F5F5F0] transition-colors">
              <div>
                <h3 className="text-2xl font-bold uppercase">{comp.round}: {comp.venue}</h3>
                <p className="text-[#E8E8E3]">{comp.date}</p>
              </div>
              <div className={`mt-4 md:mt-0 px-4 py-2 border-2 ${comp.status === 'Completed' ? 'border-gray-600 text-gray-500' : 'border-[#F5F5F0] text-[#F5F5F0]'}`}>
                {comp.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
