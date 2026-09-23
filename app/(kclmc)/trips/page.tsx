'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { Trip } from '@/types/database';

const SEED_TRIPS: (Trip & { itinerary: string[]; leader: string; mapUrl: string })[] = [
  {
    id: '1',
    title: 'Weekly Social Wall — Mile End',
    description: 'Drop-in Tuesday evening session. No booking required. Meet at reception 6:30pm for bouldering and top-roping.',
    trip_type: 'social',
    location: 'Mile End Climbing Wall, Haverfield Rd, London E3 5BE',
    mapUrl: 'https://maps.google.com/?q=Mile+End+Climbing+Wall',
    date_start: '2026-10-01',
    date_end: null,
    difficulty_grade: 'All levels welcome',
    trip_leader_id: null,
    leader: 'Social Sec (Alex H.)',
    max_capacity: 30,
    gear_requirements: ['Climbing shoes (rentals available at wall)', 'Chalk bag'],
    status: 'open',
    price_pence: 0,
    itinerary: [
      '18:30 — Meet in Mile End reception foyer',
      '18:45 — Group warm-up & boulder circuits',
      '20:30 — Pub social at The Morgan Arms'
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Harrison\'s Rocks Day Trip',
    description: 'Southern Sandstone top-roping classic. Perfect intro to outdoor rock climbing just 50 minutes from London Bridge.',
    trip_type: 'trad',
    location: 'Harrison\'s Rocks, Groombridge, Kent',
    mapUrl: 'https://maps.google.com/?q=Harrisons+Rocks+Groombridge',
    date_start: '2026-10-12',
    date_end: '2026-10-12',
    difficulty_grade: 'VDiff to HVS',
    trip_leader_id: null,
    leader: 'Expeditions Officer (Sarah P.)',
    max_capacity: 16,
    gear_requirements: ['Helmet (Club provided)', 'Harness (Club provided)', 'Static rope / carpet for sandstone top protection', 'Packed lunch & warm layers'],
    status: 'open',
    price_pence: 1500,
    itinerary: [
      '08:30 — Meet at London Bridge train station',
      '09:30 — Arrive Groombridge & 15m walk to crag',
      '10:00 — Sandstone ethics briefing & rope rigging',
      '16:30 — Pack down and debrief at The Junction Inn',
      '18:00 — Return train to London'
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    title: 'Peak District Weekend Trad',
    description: 'Two full days on world-famous gritstone: Stanage Edge and Burbage. Wild camping and bunkhouse options.',
    trip_type: 'trad',
    location: 'Stanage Edge, Hathersage, Hope Valley',
    mapUrl: 'https://maps.google.com/?q=Stanage+Edge+Hathersage',
    date_start: '2026-10-25',
    date_end: '2026-10-26',
    difficulty_grade: 'Severe to E1',
    trip_leader_id: null,
    leader: 'President (Marcus T.)',
    max_capacity: 12,
    gear_requirements: ['Helmet', 'Harness', 'Belay device & locking carabiners', 'Trad rack (cams, nuts, hexes)', 'Warm sleeping bag & bivy/tent'],
    status: 'open',
    price_pence: 4500,
    itinerary: [
      'Friday 18:00 — Minibus departs Guy\'s Campus',
      'Friday 22:00 — Arrive Peak District campsite',
      'Saturday 08:30 — Stanage Popular End trad pairs',
      'Saturday 19:00 — Pub dinner in Hathersage',
      'Sunday 09:00 — Burbage South bouldering & routes',
      'Sunday 17:00 — Minibus return to London'
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '4',
    title: 'Scottish Winter Mountaineering',
    description: 'Grade I-III winter gullies and ridge traverses in Glencoe. Crampon and ice axe technique required.',
    trip_type: 'winter',
    location: 'Glencoe Valley, Scottish Highlands',
    mapUrl: 'https://maps.google.com/?q=Glencoe+Scotland',
    date_start: '2026-12-14',
    date_end: '2026-12-17',
    difficulty_grade: 'Grade I to III Winter',
    trip_leader_id: null,
    leader: 'Alpine Sec (Elena R.)',
    max_capacity: 8,
    gear_requirements: ['B2/B3 Winter Mountaineering Boots', 'C2 Crampons', 'Walking or Technical Ice Axe', 'Winter Gore-Tex hardshell & mountaineering gloves', 'Avalanche transceiver, shovel & probe'],
    status: 'draft',
    price_pence: 15000,
    itinerary: [
      'Day 1: Sleeper train from Euston to Fort William',
      'Day 2: Winter skills refresher on Aonach Mòr',
      'Day 3: Aonach Eagach or Curved Ridge attempt (weather dependent)',
      'Day 4: Stob Coire nan Lochan gullies & return travel'
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export default function TripsPage() {
  const [trips, setTrips] = useState<any[]>(SEED_TRIPS);
  const [loading, setLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState<any | null>(null);
  const [registeredTrips, setRegisteredTrips] = useState<string[]>([]);
  const [registrationMsg, setRegistrationMsg] = useState('');

  useEffect(() => {
    async function fetchTrips() {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .order('date_start', { ascending: true });

        if (!error && data && data.length > 0) {
          // Merge database data with rich metadata
          const merged = data.map(d => {
            const seed = SEED_TRIPS.find(s => s.id === d.id || s.title === d.title);
            return {
              ...seed,
              ...d,
              itinerary: seed?.itinerary || ['Meet details will be emailed 48 hours prior to meet.'],
              leader: seed?.leader || 'Trip Leader',
              mapUrl: seed?.mapUrl || `https://maps.google.com/?q=${encodeURIComponent(d.location)}`,
            };
          });
          setTrips(merged);
        }
      } catch {
        // Fallback already in place
      } finally {
        setLoading(false);
      }
    }
    fetchTrips();
  }, []);

  const handleRegister = (tripId: string) => {
    if (registeredTrips.includes(tripId)) return;
    setRegisteredTrips([...registeredTrips, tripId]);
    setRegistrationMsg('✔ Meet RSVP confirmed! Details added to your member schedule.');
    setTimeout(() => setRegistrationMsg(''), 4000);
  };

  return (
    <div className="min-h-screen bg-[#041F1E] text-[#F7F7F7] p-6 md:p-12 relative overflow-hidden font-sans topo-pattern">
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#084746] border border-[#FFBD59]/40 text-[#FFBD59] text-xs font-mono uppercase tracking-widest mb-4">
          Outdoor Expeditions &amp; Social Meets
        </div>
        <h1 className="text-4xl md:text-5xl font-black font-serif text-[#FFBD59] mb-3">
          Trips Calendar
        </h1>
        <p className="text-zinc-300 text-sm md:text-base mb-8 max-w-xl leading-relaxed">
          Official weekend meets, trad excursions, winter tours, and social wall sessions. Click any trip to view the full expedition dossier.
        </p>

        {registrationMsg && (
          <div className="mb-6 p-4 bg-emerald-950/80 border border-emerald-500/60 rounded-xl text-emerald-300 text-xs font-mono flex items-center justify-between shadow-lg">
            <span>{registrationMsg}</span>
            <Link href="/membership" className="text-[#FFBD59] underline hover:text-[#FFE0A3] font-bold">
              View Member Pass →
            </Link>
          </div>
        )}
        
        <div className="grid gap-5">
          {loading ? (
            <div className="text-center animate-pulse py-12 text-zinc-400 font-mono">
              Loading upcoming expeditions...
            </div>
          ) : trips.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#084746]/40 border border-[#FFBD59]/20 text-center text-zinc-300 font-mono">
              <p className="text-lg font-bold mb-1 text-white">No trips scheduled right now</p>
              <p className="text-xs text-zinc-400">Committee members can add new meets via the Admin CMS Content Manager.</p>
            </div>
          ) : trips.map((trip) => {
            const isRegistered = registeredTrips.includes(trip.id);
            return (
              <div
                key={trip.id}
                onClick={() => setSelectedTrip(trip)}
                className="cursor-pointer bg-[#084746]/70 backdrop-blur-md p-6 rounded-2xl border border-[#FFBD59]/25 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-[#FFBD59] hover:bg-[#084746]/90 transition-all shadow-lg group"
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs uppercase font-mono px-2.5 py-0.5 rounded bg-[#041F1E] text-[#FFBD59] border border-[#FFBD59]/30">
                      {trip.trip_type}
                    </span>
                    {trip.difficulty_grade && (
                      <span className="text-xs font-mono text-zinc-300">
                        • {trip.difficulty_grade}
                      </span>
                    )}
                    {trip.price_pence === 0 ? (
                      <span className="text-xs font-mono text-emerald-400 font-bold">
                        FREE
                      </span>
                    ) : (
                      <span className="text-xs font-mono text-[#FFBD59] font-bold">
                        £{(trip.price_pence / 100).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <h3 className="text-2xl font-bold font-serif text-white group-hover:text-[#FFBD59] transition-colors">
                    {trip.title}
                  </h3>
                  <p className="text-zinc-300 text-xs mt-1 font-sans">{trip.description}</p>
                  <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-mono text-zinc-400">
                    <span>🗓️ {trip.date_start}{trip.date_end ? ` → ${trip.date_end}` : ''}</span>
                    <span>📍 {trip.location.split(',')[0]}</span>
                    {isRegistered && (
                      <span className="text-emerald-400 font-bold">✔ RSVP'd</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:items-end gap-2 shrink-0">
                  <span className={`text-[10px] font-mono uppercase px-2.5 py-1 rounded font-bold ${
                    trip.status === 'open'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}>
                    {trip.status}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTrip(trip);
                    }}
                    className="bg-[#FFBD59] text-[#052322] px-4 py-2 rounded-lg font-mono font-bold text-xs hover:bg-[#FFE0A3] transition-colors self-start sm:self-auto uppercase tracking-wider flex items-center gap-1 shadow"
                  >
                    <span>View Dossier</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trip Details Modal / Dossier */}
      {selectedTrip && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#052322] border-2 border-[#FFBD59]/60 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 shadow-2xl relative topo-pattern">
            {/* Close button */}
            <button
              onClick={() => setSelectedTrip(null)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white text-xl font-bold bg-[#041F1E] w-8 h-8 rounded-full border border-[#FFBD59]/30 flex items-center justify-center"
            >
              ✕
            </button>

            {/* Modal Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs uppercase font-mono px-2.5 py-0.5 rounded bg-[#084746] text-[#FFBD59] border border-[#FFBD59]/30">
                  {selectedTrip.trip_type}
                </span>
                <span className="text-xs font-mono text-zinc-300">
                  Leader: {selectedTrip.leader}
                </span>
              </div>
              <h2 className="text-3xl font-black font-serif text-white mb-2">
                {selectedTrip.title}
              </h2>
              <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                {selectedTrip.description}
              </p>
            </div>

            {/* Key Information Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6 font-mono text-xs">
              <div className="bg-[#041F1E] p-3 rounded-xl border border-[#FFBD59]/20">
                <span className="text-zinc-500 block text-[10px] uppercase">Dates</span>
                <span className="text-[#FFBD59] font-bold">{selectedTrip.date_start}</span>
              </div>
              <div className="bg-[#041F1E] p-3 rounded-xl border border-[#FFBD59]/20">
                <span className="text-zinc-500 block text-[10px] uppercase">Difficulty</span>
                <span className="text-white font-bold">{selectedTrip.difficulty_grade || 'All levels'}</span>
              </div>
              <div className="bg-[#041F1E] p-3 rounded-xl border border-[#FFBD59]/20">
                <span className="text-zinc-500 block text-[10px] uppercase">Cost</span>
                <span className="text-emerald-400 font-bold">
                  {selectedTrip.price_pence === 0 ? 'FREE' : `£${(selectedTrip.price_pence / 100).toFixed(2)}`}
                </span>
              </div>
            </div>

            {/* Location & Directions */}
            <div className="mb-6 bg-[#041F1E] p-4 rounded-xl border border-[#FFBD59]/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase font-mono">Location</span>
                <span className="text-sm font-sans text-white">{selectedTrip.location}</span>
              </div>
              <a
                href={selectedTrip.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-[#FFBD59] hover:underline flex items-center gap-1 shrink-0"
              >
                <span>Open in Google Maps</span>
                <span>↗</span>
              </a>
            </div>

            {/* Expedition Itinerary */}
            <div className="mb-6">
              <h3 className="text-sm font-mono uppercase font-bold text-[#FFBD59] mb-3">
                Expedition Itinerary
              </h3>
              <ul className="space-y-2 text-xs font-mono">
                {selectedTrip.itinerary?.map((step: string, i: number) => (
                  <li key={i} className="flex items-start gap-2.5 text-zinc-300 bg-[#041F1E]/60 p-2.5 rounded-lg border border-[#FFBD59]/10">
                    <span className="text-[#FFBD59] font-bold">0{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Required Gear Checklist */}
            <div className="mb-6">
              <h3 className="text-sm font-mono uppercase font-bold text-[#FFBD59] mb-3">
                Required Gear Checklist
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                {selectedTrip.gear_requirements?.map((gear: string, i: number) => (
                  <label key={i} className="flex items-center gap-2 p-2 rounded-lg bg-[#041F1E]/60 border border-[#FFBD59]/10 text-zinc-300 cursor-pointer hover:bg-[#041F1E]">
                    <input type="checkbox" className="accent-[#FFBD59] rounded" />
                    <span>{gear}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-[#FFBD59]/20 flex flex-col sm:flex-row gap-3 justify-end items-center">
              <button
                onClick={() => setSelectedTrip(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 font-mono text-xs uppercase"
              >
                Close
              </button>

              <button
                onClick={() => handleRegister(selectedTrip.id)}
                className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-mono text-xs uppercase font-bold transition-all shadow ${
                  registeredTrips.includes(selectedTrip.id)
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#FFBD59] text-[#052322] hover:bg-[#FFE0A3]'
                }`}
              >
                {registeredTrips.includes(selectedTrip.id)
                  ? '✔ Registered for Meet'
                  : 'RSVP / Register for Meet →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
