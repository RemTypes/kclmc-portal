'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabaseMock } from '@/lib/supabase';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

type TabName = 'trips' | 'guides' | 'drops' | 'rounds' | 'leaderboard' | 'scorecards';

export default function ContentAdminPage() {
  const [activeTab, setActiveTab] = useState<TabName>('trips');
  
  // Data States
  const [trips, setTrips] = useState<any[]>([]);
  const [guides, setGuides] = useState<any[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [individuals, setIndividuals] = useState<any[]>([]);
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [scorecards, setScorecards] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);

  // Form States
  const [newTrip, setNewTrip] = useState({ title: '', date: '', type: 'Bouldering', location: 'Crag Venue', price: 0 });
  const [newGuide, setNewGuide] = useState({
    title: '',
    description: '',
    category: 'crag',
    location: '',
    grade_range: '',
    discount_info: '',
    website_url: '',
    topo_url: '',
  });
  const [newRound, setNewRound] = useState({ round: '', venue: '', date: '', status: 'Upcoming' });
  const [newTeam, setNewTeam] = useState({ rank: 1, name: '', points: 0 });
  const [newInd, setNewInd] = useState({ rank: 1, name: '', uni: '', category: 'Men', points: 0 });
  const [newShopItem, setNewShopItem] = useState({ name: '', brand: 'KCL', currentMoq: 0, targetMoq: 30, price: 20 });

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);

    let tripsData: any[] = [];
    let guidesData: any[] = [];
    let shopData: any[] = [];

    if (isSupabaseConfigured()) {
      try {
        const [
          { data: liveTrips },
          { data: liveGuides },
          { data: liveShop },
        ] = await Promise.all([
          supabase.from('trips').select('*').order('date_start', { ascending: true }),
          supabase.from('guides').select('*').order('sort_order', { ascending: true }),
          supabase.from('shop_items').select('*'),
        ]);

        if (liveTrips && liveTrips.length > 0) {
          tripsData = liveTrips.map(t => ({
            ...t,
            date: t.date_start,
            type: t.trip_type,
          }));
        }
        if (liveGuides && liveGuides.length > 0) {
          guidesData = liveGuides;
        }
        if (liveShop && liveShop.length > 0) {
          shopData = liveShop.map(s => ({
            ...s,
            price: s.price_pence ? s.price_pence / 100 : 20,
            currentMoq: s.current_moq,
            targetMoq: s.target_moq,
          }));
        }
      } catch (err) {
        console.error('CMS Supabase fetch error:', err);
      }
    }

    // Mock fallbacks for competitions / unconfigured
    const [
      { data: mockTrips }, 
      { data: mockGuides },
      { data: roundsData },
      { data: teamsData },
      { data: indData },
      { data: mockShop },
      { data: scorecardsData }
    ] = await Promise.all([
      supabaseMock.from('trips').select(),
      supabaseMock.from('guides').select(),
      supabaseMock.from('lube_rounds').select(),
      supabaseMock.from('leaderboard_teams').select(),
      supabaseMock.from('leaderboard_individuals').select(),
      supabaseMock.from('shop_items').select(),
      supabaseMock.from('scorecards').select()
    ]);
    
    setTrips(tripsData.length > 0 ? tripsData : (mockTrips || []));
    setGuides(guidesData.length > 0 ? guidesData : (mockGuides || []));
    setRounds(roundsData || []);
    setTeams(teamsData || []);
    setIndividuals(indData || []);
    setShopItems(shopData.length > 0 ? shopData : (mockShop || []));
    setScorecards(scorecardsData || []);
    setLoading(false);
  }

  // Generic Handlers
  async function handleAdd(table: any, payload: any, resetter: () => void) {
    if (isSupabaseConfigured() && ['trips', 'guides', 'shop_items'].includes(table)) {
      try {
        if (table === 'trips') {
          const typeVal = (payload.type || 'bouldering').toLowerCase();
          const cleanType = typeVal.includes('winter') ? 'winter' : typeVal.includes('sport') ? 'sport' : typeVal.includes('trad') ? 'trad' : 'social';
          await supabase.from('trips').insert({
            title: payload.title,
            description: `${payload.title} — Official KCLMC club meet`,
            trip_type: cleanType,
            location: payload.location || 'London / Crag Venue',
            date_start: payload.date || new Date().toISOString().split('T')[0],
            status: 'open',
            price_pence: (payload.price || 0) * 100,
          });
        } else if (table === 'guides') {
          await supabase.from('guides').insert({
            title: payload.title,
            description: payload.description,
            category: payload.category || 'indoor',
            location: payload.location || null,
            grade_range: payload.grade_range || null,
            discount_info: payload.discount_info || null,
            website_url: payload.website_url || null,
            is_published: true,
            sort_order: guides.length + 1,
          });
        } else if (table === 'shop_items') {
          await supabase.from('shop_items').insert({
            name: payload.name,
            brand: payload.brand || 'KCL',
            price_pence: (payload.price || 20) * 100,
            garment_types: 'Apparel',
            current_moq: payload.currentMoq || 0,
            target_moq: payload.targetMoq || 30,
            is_active: true,
          });
        }
      } catch (err) {
        console.error('Error inserting into Supabase:', err);
      }
    } else {
      await supabaseMock.from(table).insert(payload);
    }
    resetter();
    fetchData();
  }

  async function handleDelete(table: any, id: string) {
    if (isSupabaseConfigured() && ['trips', 'guides', 'shop_items'].includes(table)) {
      try {
        await supabase.from(table).delete().eq('id', id);
      } catch (err) {
        console.error('Error deleting from Supabase:', err);
      }
    } else {
      await supabaseMock.from(table).delete().eq('id', id);
    }
    fetchData();
  }

  async function handleToggleScorecard(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'VALID' ? 'INVALID' : 'VALID';
    await supabaseMock.from('scorecards').update({ status: newStatus }).eq('id', id);
    fetchData();
  }

  const tabButton = (id: TabName, label: string) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`py-2 px-4 rounded-xl font-heading uppercase text-xs tracking-wider font-bold transition-all ${
        activeTab === id
          ? 'bg-[#FFBD59] text-[#052322] shadow-md'
          : 'bg-[#084746]/50 text-zinc-300 hover:text-white hover:bg-[#084746]'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-6 md:p-10 font-sans bg-[#041F1E] min-h-screen text-slate-100 relative overflow-hidden topo-pattern">
      <div className="max-w-6xl mx-auto relative z-10">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 border-b border-[#084746] pb-4 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Link href="/admin" className="text-zinc-400 hover:text-[#FFBD59] text-xs font-mono transition-colors">
                ← Back to Dashboard
              </Link>
              <span className="text-zinc-600">/</span>
              <span className="text-xs font-mono font-bold text-[#FFBD59]">CMS Database Manager</span>
            </div>
            <h1 className="text-3xl font-black font-heading uppercase tracking-wide text-white mt-2">
              Content Manager (CMS)
            </h1>
            <p className="text-sm text-zinc-300 mt-1">
              Add and manage live records for trips, crags &amp; gym discount guides, and merch drops.
            </p>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#084746] border border-[#FFBD59]/40 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-zinc-200">Supabase Connected</span>
          </div>
        </div>

        {/* Tab Strip */}
        <div className="flex flex-wrap gap-2 border-b border-[#084746] pb-4 mb-8">
          {tabButton('trips', '🏔️ KCLMC Trips')}
          {tabButton('guides', '🧗 Crags & Gyms')}
          {tabButton('drops', '👕 Shop Drops')}
          {tabButton('rounds', '🏆 LUBE Rounds')}
          {tabButton('leaderboard', '📊 Rankings')}
          {tabButton('scorecards', '📝 Scorecards')}
        </div>

        {loading ? (
          <div className="p-8 text-center text-zinc-400 font-mono">Loading CMS database records...</div>
        ) : activeTab === 'trips' ? (
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="bg-[#052322] border border-[#084746] p-6 rounded-2xl shadow-xl">
              <h2 className="text-xl font-bold font-heading uppercase text-white mb-4">Add New Club Meet / Trip</h2>
              <form onSubmit={e => { e.preventDefault(); handleAdd('trips', newTrip, () => setNewTrip({ title: '', date: '', type: 'Bouldering', location: 'Crag Venue', price: 0 })) }} className="space-y-4">
                <div>
                  <label className="text-xs font-mono text-zinc-400 block mb-1">Trip Title</label>
                  <input required value={newTrip.title} onChange={e => setNewTrip({...newTrip, title: e.target.value})} placeholder="e.g. Peak District Weekend Meet" className="w-full bg-[#041F1E] border border-[#084746] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FFBD59]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-mono text-zinc-400 block mb-1">Date</label>
                    <input required value={newTrip.date} onChange={e => setNewTrip({...newTrip, date: e.target.value})} placeholder="YYYY-MM-DD or Month" className="w-full bg-[#041F1E] border border-[#084746] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FFBD59]" />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-zinc-400 block mb-1">Trip Type</label>
                    <select required value={newTrip.type} onChange={e => setNewTrip({...newTrip, type: e.target.value})} className="w-full bg-[#041F1E] border border-[#084746] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FFBD59]">
                      <option value="Bouldering">Bouldering</option>
                      <option value="Sport">Sport</option>
                      <option value="Winter/Trad">Winter/Trad</option>
                      <option value="Social">Social / Day Meet</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-mono text-zinc-400 block mb-1">Location</label>
                  <input value={newTrip.location} onChange={e => setNewTrip({...newTrip, location: e.target.value})} placeholder="e.g. Hathersage, Peak District" className="w-full bg-[#041F1E] border border-[#084746] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FFBD59]" />
                </div>
                <button type="submit" className="w-full bg-[#FFBD59] hover:bg-[#FFE0A3] text-[#052322] py-3 rounded-xl font-heading font-black text-xs uppercase tracking-wider transition-colors shadow-md">
                  Publish Trip to Database
                </button>
              </form>
            </div>
            <div>
              <h2 className="text-xl font-bold font-heading uppercase text-white mb-4">Current Trips ({trips.length})</h2>
              <div className="space-y-3">
                {trips.map(t => (
                  <div key={t.id} className="bg-[#052322] border border-[#084746] p-4 rounded-xl flex justify-between items-center shadow-md">
                    <div>
                      <h3 className="font-bold text-white font-heading text-lg">{t.title}</h3>
                      <p className="text-xs text-zinc-300 font-mono mt-0.5">{t.date} • <span className="text-[#FFBD59] font-bold">{t.type}</span> • {t.location}</p>
                    </div>
                    <button onClick={() => handleDelete('trips', t.id)} className="text-xs font-mono text-red-400 hover:text-red-300 border border-red-900 px-3 py-1.5 rounded-lg hover:bg-red-950 transition-colors">
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : activeTab === 'guides' ? (
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="bg-[#052322] border border-[#084746] p-6 rounded-2xl shadow-xl">
              <h2 className="text-xl font-bold font-heading uppercase text-white mb-4">Add Crag or Gym Guide</h2>
              <form onSubmit={e => { e.preventDefault(); handleAdd('guides', newGuide, () => setNewGuide({ title: '', description: '', category: 'crag', location: '', grade_range: '', discount_info: '', website_url: '', topo_url: '' })) }} className="space-y-4">
                <div>
                  <label className="text-xs font-mono text-zinc-400 block mb-1">Crag / Wall Name</label>
                  <input required value={newGuide.title} onChange={e => setNewGuide({...newGuide, title: e.target.value})} placeholder="e.g. Harrison's Rocks or VauxWall" className="w-full bg-[#041F1E] border border-[#084746] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FFBD59]" />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-mono text-zinc-400 block mb-1">Category</label>
                    <select required value={newGuide.category} onChange={e => setNewGuide({...newGuide, category: e.target.value as any})} className="w-full bg-[#041F1E] border border-[#084746] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FFBD59]">
                      <option value="crag">Outdoor Crag</option>
                      <option value="indoor">Indoor Wall</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-mono text-zinc-400 block mb-1">Grade Range</label>
                    <input value={newGuide.grade_range} onChange={e => setNewGuide({...newGuide, grade_range: e.target.value})} placeholder="e.g. VDiff to E3 or F4 to F7c" className="w-full bg-[#041F1E] border border-[#084746] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FFBD59]" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-mono text-zinc-400 block mb-1">Location / Postcode</label>
                  <input value={newGuide.location} onChange={e => setNewGuide({...newGuide, location: e.target.value})} placeholder="e.g. Groombridge, East Sussex or Bermondsey, SE16" className="w-full bg-[#041F1E] border border-[#084746] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FFBD59]" />
                </div>

                <div>
                  <label className="text-xs font-mono text-zinc-400 block mb-1">Description / Beta</label>
                  <textarea required rows={2} value={newGuide.description} onChange={e => setNewGuide({...newGuide, description: e.target.value})} placeholder="Classic sandstone top-roping and bouldering 50 mins from London..." className="w-full bg-[#041F1E] border border-[#084746] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FFBD59]" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-mono text-zinc-400 block mb-1">Student Discount / Access Info</label>
                    <input value={newGuide.discount_info} onChange={e => setNewGuide({...newGuide, discount_info: e.target.value})} placeholder="e.g. 20% off with KCL ID" className="w-full bg-[#041F1E] border border-[#084746] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FFBD59]" />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-zinc-400 block mb-1">Website or BMC RAD Link</label>
                    <input value={newGuide.website_url} onChange={e => setNewGuide({...newGuide, website_url: e.target.value})} placeholder="https://..." className="w-full bg-[#041F1E] border border-[#084746] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FFBD59]" />
                  </div>
                </div>

                <button type="submit" className="w-full bg-[#FFBD59] hover:bg-[#FFE0A3] text-[#052322] py-3 rounded-xl font-heading font-black text-xs uppercase tracking-wider transition-colors shadow-md">
                  Publish Guide to Database
                </button>
              </form>
            </div>
            <div>
              <h2 className="text-xl font-bold font-heading uppercase text-white mb-4">Current Guides ({guides.length})</h2>
              <div className="space-y-3">
                {guides.map(g => (
                  <div key={g.id} className="bg-[#052322] border border-[#084746] p-4 rounded-xl shadow-md">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <h3 className="font-bold text-white font-heading text-lg flex items-center gap-2">
                          {g.title}
                          <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                            g.category === 'crag'
                              ? 'bg-[#084746] text-[#FFBD59] border border-[#FFBD59]/40'
                              : 'bg-zinc-800 text-zinc-300'
                          }`}>
                            {g.category === 'crag' ? '⛰️ Outdoor Crag' : '🧗 Indoor Wall'}
                          </span>
                        </h3>
                        <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{g.description}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] font-mono text-zinc-400">
                          {g.location && <span>📍 {g.location}</span>}
                          {g.grade_range && <span className="text-[#FFBD59]">Grades: {g.grade_range}</span>}
                          {g.discount_info && <span className="text-emerald-400">{g.discount_info}</span>}
                        </div>
                        {g.website_url && (
                          <div className="mt-2">
                            <a href={g.website_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#FFBD59] hover:underline font-mono">
                              🔗 Official / BMC RAD Page ↗
                            </a>
                          </div>
                        )}
                      </div>
                      <button onClick={() => handleDelete('guides', g.id)} className="text-xs font-mono text-red-400 hover:text-red-300 border border-red-900 px-3 py-1.5 rounded-lg hover:bg-red-950 transition-colors">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : activeTab === 'drops' ? (
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="bg-[#052322] border border-[#084746] p-6 rounded-2xl shadow-xl">
              <h2 className="text-xl font-bold font-heading uppercase text-white mb-4">Add Shop Item (Drop)</h2>
              <form onSubmit={e => { e.preventDefault(); handleAdd('shop_items', newShopItem, () => setNewShopItem({ name: '', brand: 'KCL', currentMoq: 0, targetMoq: 30, price: 20 })) }} className="space-y-4">
                <div>
                  <label className="text-xs font-mono text-zinc-400 block mb-1">Garment Name</label>
                  <input required value={newShopItem.name} onChange={e => setNewShopItem({...newShopItem, name: e.target.value})} placeholder="e.g. Alpine Heavyweight Hoodie" className="w-full bg-[#041F1E] border border-[#084746] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FFBD59]" />
                </div>
                <div>
                  <label className="text-xs font-mono text-zinc-400 block mb-1">Brand Collection</label>
                  <select required value={newShopItem.brand} onChange={e => setNewShopItem({...newShopItem, brand: e.target.value as 'KCL'|'LUBE'})} className="w-full bg-[#041F1E] border border-[#084746] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FFBD59]">
                    <option value="KCL">KCLMC Alpine Green Drop</option>
                    <option value="LUBE">LUBE Monochrome Drop</option>
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-mono text-zinc-400 block mb-1">Price (£)</label>
                    <input type="number" required value={newShopItem.price} onChange={e => setNewShopItem({...newShopItem, price: parseInt(e.target.value)})} className="w-full bg-[#041F1E] border border-[#084746] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FFBD59]" />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-zinc-400 block mb-1">Current MOQ</label>
                    <input type="number" required value={newShopItem.currentMoq} onChange={e => setNewShopItem({...newShopItem, currentMoq: parseInt(e.target.value)})} className="w-full bg-[#041F1E] border border-[#084746] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FFBD59]" />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-zinc-400 block mb-1">Target MOQ</label>
                    <input type="number" required value={newShopItem.targetMoq} onChange={e => setNewShopItem({...newShopItem, targetMoq: parseInt(e.target.value)})} className="w-full bg-[#041F1E] border border-[#084746] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FFBD59]" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-[#FFBD59] hover:bg-[#FFE0A3] text-[#052322] py-3 rounded-xl font-heading font-black text-xs uppercase tracking-wider transition-colors shadow-md">
                  Publish Garment Drop
                </button>
              </form>
            </div>
            <div>
              <h2 className="text-xl font-bold font-heading uppercase text-white mb-4">Active Shop Drops ({shopItems.length})</h2>
              <div className="space-y-4">
                {shopItems.map(item => (
                  <div key={item.id} className="bg-[#052322] border border-[#084746] p-4 rounded-xl shadow-md flex justify-between items-center">
                    <div className="w-full mr-4">
                      <h3 className="font-bold font-heading text-lg text-white flex items-center gap-2">
                        {item.name} 
                        <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${item.brand === 'KCL' ? 'bg-[#084746] text-[#FFBD59] border border-[#FFBD59]/40' : 'bg-zinc-800 text-white'}`}>{item.brand}</span>
                      </h3>
                      <p className="text-xs font-mono text-zinc-300 mt-1">£{item.price} • MOQ Progress: {item.currentMoq}/{item.targetMoq}</p>
                      <div className="w-full bg-[#041F1E] rounded-full h-2 mt-2 overflow-hidden border border-[#084746]">
                        <div className="bg-[#FFBD59] h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (item.currentMoq/item.targetMoq)*100)}%`}}></div>
                      </div>
                    </div>
                    <button onClick={() => handleDelete('shop_items', item.id)} className="text-xs font-mono text-red-400 hover:text-red-300 border border-red-900 px-3 py-1.5 rounded-lg hover:bg-red-950 transition-colors">
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : activeTab === 'rounds' ? (
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="bg-[#052322] border border-[#084746] p-6 rounded-2xl shadow-xl">
              <h2 className="text-xl font-bold font-heading uppercase text-white mb-4">Add Competition Round</h2>
              <form onSubmit={e => { e.preventDefault(); handleAdd('lube_rounds', newRound, () => setNewRound({ round: '', venue: '', date: '', status: 'Upcoming' })) }} className="space-y-4">
                <input required value={newRound.round} onChange={e => setNewRound({...newRound, round: e.target.value})} placeholder="Round (e.g. Round 1, Finals)" className="w-full bg-[#041F1E] border border-[#084746] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FFBD59]" />
                <input required value={newRound.venue} onChange={e => setNewRound({...newRound, venue: e.target.value})} placeholder="Venue (e.g. VauxWall)" className="w-full bg-[#041F1E] border border-[#084746] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FFBD59]" />
                <input required value={newRound.date} onChange={e => setNewRound({...newRound, date: e.target.value})} placeholder="Date" className="w-full bg-[#041F1E] border border-[#084746] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FFBD59]" />
                <select required value={newRound.status} onChange={e => setNewRound({...newRound, status: e.target.value})} className="w-full bg-[#041F1E] border border-[#084746] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FFBD59]">
                  <option value="Upcoming">Upcoming</option>
                  <option value="Completed">Completed</option>
                </select>
                <button type="submit" className="w-full bg-[#FFBD59] hover:bg-[#FFE0A3] text-[#052322] py-3 rounded-xl font-heading font-black text-xs uppercase tracking-wider transition-colors shadow-md">
                  Save Schedule
                </button>
              </form>
            </div>
            <div>
              <h2 className="text-xl font-bold font-heading uppercase text-white mb-4">Current Schedule</h2>
              <div className="space-y-3">
                {rounds.map(r => (
                  <div key={r.id} className="bg-[#052322] border border-[#084746] p-4 rounded-xl flex justify-between items-center shadow-md">
                    <div>
                      <h3 className="font-bold text-white font-heading text-lg">{r.round}: {r.venue}</h3>
                      <p className="text-xs font-mono text-zinc-300">{r.date} • {r.status}</p>
                    </div>
                    <button onClick={() => handleDelete('lube_rounds', r.id)} className="text-xs font-mono text-red-400 hover:text-red-300 border border-red-900 px-3 py-1.5 rounded-lg hover:bg-red-950 transition-colors">
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : activeTab === 'leaderboard' ? (
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-8">
              <div className="bg-[#052322] border border-[#084746] p-6 rounded-2xl shadow-xl">
                <h2 className="text-xl font-bold font-heading uppercase text-white mb-4">Add Team Ranking</h2>
                <form onSubmit={e => { e.preventDefault(); handleAdd('leaderboard_teams', newTeam, () => setNewTeam({ rank: 1, name: '', points: 0 })) }} className="space-y-4">
                  <input type="number" required value={newTeam.rank} onChange={e => setNewTeam({...newTeam, rank: parseInt(e.target.value)})} placeholder="Rank" className="w-full bg-[#041F1E] border border-[#084746] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FFBD59]" />
                  <input required value={newTeam.name} onChange={e => setNewTeam({...newTeam, name: e.target.value})} placeholder="Team Name (e.g. KCL 1)" className="w-full bg-[#041F1E] border border-[#084746] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FFBD59]" />
                  <input type="number" required value={newTeam.points} onChange={e => setNewTeam({...newTeam, points: parseInt(e.target.value)})} placeholder="Points" className="w-full bg-[#041F1E] border border-[#084746] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#FFBD59]" />
                  <button type="submit" className="w-full bg-[#FFBD59] hover:bg-[#FFE0A3] text-[#052322] py-3 rounded-xl font-heading font-black text-xs uppercase tracking-wider transition-colors shadow-md">
                    Add Team
                  </button>
                </form>
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-xl font-bold font-heading uppercase text-white mb-4">Team Rankings</h2>
              <div className="space-y-2">
                {teams.map(t => (
                  <div key={t.id} className="bg-[#052322] border border-[#084746] p-3.5 rounded-xl flex justify-between items-center text-sm font-mono shadow-sm">
                    <div><span className="font-bold text-[#FFBD59] w-8 inline-block">#{t.rank}</span> <span className="text-white font-sans font-bold">{t.name}</span> ({t.points} pts)</div>
                    <button onClick={() => handleDelete('leaderboard_teams', t.id)} className="text-red-400 font-bold hover:text-red-300">✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : activeTab === 'scorecards' ? (
          <div className="w-full bg-[#052322] border border-[#084746] rounded-2xl overflow-hidden shadow-2xl p-6">
            <h2 className="text-xl font-bold font-heading uppercase text-white mb-4">Submitted Scorecards</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left font-mono">
                <thead className="bg-[#041F1E] text-zinc-400 uppercase text-xs border-b border-[#084746]">
                  <tr>
                    <th className="px-4 py-3">Climber</th>
                    <th className="px-4 py-3">University</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Round</th>
                    <th className="px-4 py-3">Score (Tops/Zones)</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#084746]/60">
                  {scorecards.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-6 text-center text-zinc-400">No scorecards submitted yet.</td></tr>
                  ) : scorecards.map(s => (
                    <tr key={s.id} className="hover:bg-[#084746]/30 transition-colors">
                      <td className="px-4 py-3 font-bold text-white font-sans">{s.climberName}</td>
                      <td className="px-4 py-3 text-zinc-300">{s.university}</td>
                      <td className="px-4 py-3 text-zinc-300">{s.category}</td>
                      <td className="px-4 py-3 text-zinc-300">{s.round}</td>
                      <td className="px-4 py-3">
                        <span className="text-emerald-400 font-bold">{s.totalScore} pts</span>
                        <span className="text-zinc-500 text-xs ml-2">({s.tops}T {s.zones}Z)</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-[10px] uppercase font-bold rounded ${
                          s.status === 'VALID' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                          s.status === 'INVALID' ? 'bg-red-950 text-red-400 border border-red-800' :
                          'bg-zinc-800 text-zinc-400'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button 
                          onClick={() => handleToggleScorecard(s.id, s.status)}
                          className={`text-xs px-2 py-1 font-bold ${s.status === 'VALID' ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'}`}
                        >
                          {s.status === 'VALID' ? 'Invalidate' : 'Validate'}
                        </button>
                        <button onClick={() => handleDelete('scorecards', s.id)} className="text-xs px-2 py-1 text-red-500 hover:text-red-400 font-bold">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
