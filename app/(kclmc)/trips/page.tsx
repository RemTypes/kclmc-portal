'use client';
import { useState, useEffect } from 'react';
import { supabaseMock, Trip } from '@/lib/supabase';

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabaseMock.from('trips').select<Trip>();
      setTrips(data || []);
      setLoading(false);
    }
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-[#052322] text-[#F7F7F7] p-6 md:p-12 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#FFBD59_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#084746] border border-[#FFBD59]/40 text-[#FFBD59] text-xs font-mono uppercase tracking-widest mb-4">
          Outdoor Expeditions
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-[#FFBD59] mb-3">Trips Calendar</h1>
        <p className="text-zinc-300 text-sm md:text-base mb-8 max-w-xl">
          Official weekend meets, trad excursions, winter tours, and international bouldering trips.
        </p>
        
        <div className="grid gap-5">
          {loading ? (
            <div className="text-center animate-pulse py-12 text-zinc-400">Loading upcoming trips...</div>
          ) : trips.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#084746]/40 border border-[#FFBD59]/20 text-center text-zinc-300">
              <p className="text-lg font-bold mb-1 text-white">No trips scheduled right now</p>
              <p className="text-xs text-zinc-400">Committee members can add new meets via the Admin CMS Content Manager.</p>
            </div>
          ) : trips.map((trip) => (
            <div key={trip.id} className="bg-[#084746]/70 backdrop-blur-md p-6 rounded-2xl border border-[#FFBD59]/25 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-[#FFBD59]/60 transition-all">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-[#052322] text-[#FFBD59] border border-[#FFBD59]/30">
                    {trip.type}
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-white">{trip.title}</h3>
                <p className="text-[#FFBD59]/90 text-sm mt-1">🗓️ {trip.date}</p>
              </div>
              <button className="bg-[#FFBD59] text-[#052322] px-5 py-2.5 rounded-lg font-bold hover:bg-[#FFE0A3] transition-colors self-start sm:self-auto">
                Trip Details
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
