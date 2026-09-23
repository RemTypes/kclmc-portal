import React from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import type { Guide } from '@/types/database';

export const revalidate = 60; // revalidate every minute

interface EnhancedGuide extends Guide {
  website_url: string | null;
  map_url: string;
  topo_url?: string;
  tube_station?: string;
}

const SEED_GUIDES: EnhancedGuide[] = [
  {
    id: '1',
    title: 'Mile End Climbing Wall',
    description: 'The historic home of London bouldering and top-roping in Tower Hamlets. Generous student discounts and weekly club socials.',
    category: 'indoor',
    location: 'Mile End, Haverfield Rd, E3 5BE',
    grade_range: null,
    discount_info: '20% off with KCL student ID',
    website_url: 'https://mileendwall.org.uk',
    map_url: 'https://maps.google.com/?q=Mile+End+Climbing+Wall',
    tube_station: 'Mile End (Central, District, Hammersmith & City)',
    image_url: null,
    sort_order: 1,
    is_published: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'VauxWall East',
    description: 'Premier modern bouldering gym in Vauxhall railway arches. Comp-grade circuit problems, 45° Beastmaker boards, and social space.',
    category: 'indoor',
    location: 'Vauxhall, 47 South Lambeth Rd, SE11 5DF',
    grade_range: null,
    discount_info: '£2 off day pass with KCLMC membership card',
    website_url: 'https://londonclimbingcentres.co.uk/locations/vauxwall-east/',
    map_url: 'https://maps.google.com/?q=VauxWall+East',
    tube_station: 'Vauxhall (Victoria Line, National Rail)',
    image_url: null,
    sort_order: 2,
    is_published: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '3',
    title: 'The Castle Climbing Centre',
    description: 'Iconic converted Victorian water pumping station in North London. Towering top-rope, lead climbing, auto-belays, and extensive bouldering.',
    category: 'indoor',
    location: 'Green Lanes, Manor House, N4 2HA',
    grade_range: null,
    discount_info: 'Free intro session for new KCL members',
    website_url: 'https://www.castle-climbing.co.uk/',
    map_url: 'https://maps.google.com/?q=The+Castle+Climbing+Centre',
    tube_station: 'Manor House (Piccadilly Line)',
    image_url: null,
    sort_order: 3,
    is_published: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '4',
    title: 'Arch Climbing Wall — Building One',
    description: 'Expansive bouldering venue in Bermondsey. High-density setting with circuits from beginner friendly through competition test pieces.',
    category: 'indoor',
    location: 'Bermondsey, Drummond Rd, SE16 4EE',
    grade_range: null,
    discount_info: 'Student off-peak concessions available',
    website_url: 'https://archclimbingwall.com/',
    map_url: 'https://maps.google.com/?q=Arch+Climbing+Wall+Building+One',
    tube_station: 'Bermondsey (Jubilee Line)',
    image_url: null,
    sort_order: 4,
    is_published: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '5',
    title: 'Harrison\'s Rocks',
    description: 'The premier Southern Sandstone crag. Isolated sandstone buttresses with classic top-roping and bouldering just 50 mins from London.',
    category: 'crag',
    location: 'Groombridge, East Sussex',
    grade_range: 'VDiff to E3',
    discount_info: 'Free crag access (BMC owned)',
    website_url: 'https://www.thebmc.co.uk/modules/rad/viewcrag.aspx?id=18',
    map_url: 'https://maps.google.com/?q=Harrisons+Rocks+Groombridge',
    topo_url: 'https://www.ukclimbing.com/logbook/crags/harrisons_rocks-18/',
    image_url: null,
    sort_order: 1,
    is_published: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '6',
    title: 'Bowles Rocks',
    description: 'Sheltered outdoor sandstone crag situated in an outdoor centre. Excellent beginners routes, dry sandstone pockets, and picnic grounds.',
    category: 'crag',
    location: 'Eridge Green, Tunbridge Wells, TN3 9LW',
    grade_range: 'Mod to HVS',
    discount_info: '£5 day permit at centre reception',
    website_url: 'https://bowles.rocks/outdoor-climbing/',
    map_url: 'https://maps.google.com/?q=Bowles+Outdoor+Centre',
    topo_url: 'https://www.ukclimbing.com/logbook/crags/bowles_rocks-21/',
    image_url: null,
    sort_order: 2,
    is_published: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '7',
    title: 'Portland (Isle of Portland)',
    description: 'Sea-cliff limestone paradise on the Jurassic Coast. Hundreds of sport routes across all grades with year-round climbing and sea views.',
    category: 'crag',
    location: 'Dorset, South Coast',
    grade_range: 'F4 to F7c+',
    discount_info: 'Free crag access (Bolt Fund supported)',
    website_url: 'https://www.thebmc.co.uk/modules/rad/viewcrag.aspx?id=86',
    map_url: 'https://maps.google.com/?q=Isle+of+Portland+Dorset',
    topo_url: 'https://www.ukclimbing.com/logbook/crags/portland-86/',
    image_url: null,
    sort_order: 3,
    is_published: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '8',
    title: 'Stanage Edge',
    description: 'The Mecca of British trad climbing. Four continuous miles of world-class gritstone in the Peak District featuring legendary classics.',
    category: 'crag',
    location: 'Hathersage, Peak District National Park',
    grade_range: 'Mod to E8',
    discount_info: 'Free access (Peak District National Park)',
    website_url: 'https://www.peakdistrict.gov.uk/',
    map_url: 'https://maps.google.com/?q=Stanage+Edge+Popular+End',
    topo_url: 'https://www.ukclimbing.com/logbook/crags/stanage_popular-10/',
    image_url: null,
    sort_order: 4,
    is_published: true,
    created_at: new Date().toISOString(),
  },
];

export default async function GuidesPage() {
  let guides: EnhancedGuide[] = SEED_GUIDES;

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 1500)
      );
      const fetchPromise = supabase
        .from('guides')
        .select('*')
        .eq('is_published', true)
        .order('sort_order', { ascending: true });

      const result: any = await Promise.race([fetchPromise, timeoutPromise]);
      const { data, error } = result || {};

      if (!error && data && data.length > 0) {
        // Merge database records with seed metadata
        guides = data.map((d: any) => {
          const seed = SEED_GUIDES.find(s => s.id === d.id || s.title === d.title);
          return {
            ...seed,
            ...d,
            website_url: d.website_url || seed?.website_url || null,
            map_url: seed?.map_url || `https://maps.google.com/?q=${encodeURIComponent(d.title + ' ' + (d.location || ''))}`,
            topo_url: seed?.topo_url,
            tube_station: seed?.tube_station,
          };
        });
      }
    } catch {
      guides = SEED_GUIDES;
    }
  }

  const indoor = guides.filter(g => g.category === 'indoor');
  const outdoor = guides.filter(g => g.category === 'crag');

  return (
    <div className="min-h-screen bg-[#041F1E] text-[#F7F7F7] p-6 md:p-12 relative overflow-hidden font-sans topo-pattern">
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#084746] border border-[#FFBD59]/40 text-[#FFBD59] text-xs font-mono uppercase tracking-widest mb-4">
          Local Beta &amp; Discounts
        </div>
        <h1 className="text-4xl md:text-5xl font-black font-serif text-[#FFBD59] mb-3">
          Crag &amp; Gym Guides
        </h1>
        <p className="text-zinc-300 text-sm md:text-base mb-8 max-w-xl font-sans leading-relaxed">
          Curated directory of London climbing centres with exclusive KCL student concessions, alongside premier outdoor crag topos.
        </p>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Indoor Climbing Centres */}
          <div className="bg-[#084746]/70 backdrop-blur-md p-6 md:p-8 rounded-3xl border border-[#FFBD59]/25 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-6 border-b border-[#FFBD59]/20 pb-4">
                <span className="text-2xl">🧗‍♂️</span>
                <div>
                  <h2 className="text-2xl font-bold font-serif text-white">Indoor Walls</h2>
                  <p className="text-xs text-[#FFBD59] font-mono">London Student Concessions</p>
                </div>
              </div>

              <ul className="space-y-6">
                {indoor.map((g, i) => (
                  <li key={g.id} className={i !== indoor.length - 1 ? "border-b border-white/10 pb-6" : ""}>
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h3 className="font-bold text-lg text-[#FFBD59] font-serif">{g.title}</h3>
                    </div>
                    
                    <p className="text-xs text-zinc-300 mb-3 leading-relaxed">{g.description}</p>
                    
                    {g.tube_station && (
                      <p className="text-[11px] font-mono text-zinc-400 mb-2">
                        🚇 {g.tube_station}
                      </p>
                    )}

                    {g.discount_info && (
                      <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#041F1E] border border-emerald-500/40 text-emerald-400 text-xs font-mono">
                        <span>🏷️ {g.discount_info}</span>
                      </div>
                    )}

                    {/* Action Links */}
                    <div className="flex flex-wrap gap-2 pt-1 font-mono text-xs">
                      {g.website_url && (
                        <a
                          href={g.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-[#041F1E] border border-[#FFBD59]/30 text-[#FFBD59] hover:bg-[#FFBD59] hover:text-[#052322] transition-colors flex items-center gap-1"
                        >
                          <span>Official Website</span>
                          <span>↗</span>
                        </a>
                      )}
                      <a
                        href={g.map_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-[#041F1E] border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors flex items-center gap-1"
                      >
                        <span>Google Maps</span>
                        <span>↗</span>
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Outdoor Crags */}
          <div className="bg-[#084746]/70 backdrop-blur-md p-6 md:p-8 rounded-3xl border border-[#FFBD59]/25 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-6 border-b border-[#FFBD59]/20 pb-4">
                <span className="text-2xl">🪨</span>
                <div>
                  <h2 className="text-2xl font-bold font-serif text-white">Outdoor Crags</h2>
                  <p className="text-xs text-[#FFBD59] font-mono">UK Trad &amp; Sport Destinations</p>
                </div>
              </div>

              <ul className="space-y-6">
                {outdoor.map((g, i) => (
                  <li key={g.id} className={i !== outdoor.length - 1 ? "border-b border-white/10 pb-6" : ""}>
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h3 className="font-bold text-lg text-[#FFBD59] font-serif">{g.title}</h3>
                      {g.grade_range && (
                        <span className="text-[10px] font-mono text-[#FFBD59] bg-[#041F1E] px-2 py-0.5 rounded border border-[#FFBD59]/30 shrink-0">
                          {g.grade_range}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-zinc-300 mb-3 leading-relaxed">{g.description}</p>
                    
                    {g.location && (
                      <p className="text-[11px] font-mono text-zinc-400 mb-3">
                        📍 {g.location}
                      </p>
                    )}

                    {/* Action Links */}
                    <div className="flex flex-wrap gap-2 pt-1 font-mono text-xs">
                      {g.topo_url && (
                        <a
                          href={g.topo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-[#041F1E] border border-[#FFBD59]/30 text-[#FFBD59] hover:bg-[#FFBD59] hover:text-[#052322] transition-colors flex items-center gap-1"
                        >
                          <span>UKC Topo &amp; Logbook</span>
                          <span>↗</span>
                        </a>
                      )}
                      {g.website_url && (
                        <a
                          href={g.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-[#041F1E] border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors flex items-center gap-1"
                        >
                          <span>Crag Info</span>
                          <span>↗</span>
                        </a>
                      )}
                      <a
                        href={g.map_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-[#041F1E] border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors flex items-center gap-1"
                      >
                        <span>Directions</span>
                        <span>↗</span>
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
