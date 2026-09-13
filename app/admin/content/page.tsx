'use client';
import { useState, useEffect } from 'react';
import { supabaseMock } from '@/lib/supabase';

type TabName = 'trips' | 'guides' | 'rounds' | 'leaderboard' | 'drops' | 'scorecards';

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
  const [newTrip, setNewTrip] = useState({ title: '', date: '', type: '' });
  const [newGuide, setNewGuide] = useState({ title: '', description: '', category: 'indoor' });
  const [newRound, setNewRound] = useState({ round: '', venue: '', date: '', status: 'Upcoming' });
  const [newTeam, setNewTeam] = useState({ rank: 1, name: '', points: 0 });
  const [newInd, setNewInd] = useState({ rank: 1, name: '', uni: '', category: 'Men', points: 0 });
  const [newShopItem, setNewShopItem] = useState({ name: '', brand: 'KCL', currentMoq: 0, targetMoq: 100, price: 20 });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [
      { data: tripsData }, 
      { data: guidesData },
      { data: roundsData },
      { data: teamsData },
      { data: indData },
      { data: shopData },
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
    
    setTrips(tripsData || []);
    setGuides(guidesData || []);
    setRounds(roundsData || []);
    setTeams(teamsData || []);
    setIndividuals(indData || []);
    setShopItems(shopData || []);
    setScorecards(scorecardsData || []);
    setLoading(false);
  }

  // Generic Handlers
  async function handleAdd(table: any, payload: any, resetter: () => void) {
    await supabaseMock.from(table).insert(payload);
    resetter();
    fetchData();
  }

  async function handleDelete(table: any, id: string) {
    await supabaseMock.from(table).delete().eq('id', id);
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
      className={`py-2 px-4 border-b-2 font-bold ${activeTab === id ? 'border-[#FFBD59] text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-8 font-mono bg-zinc-950 min-h-screen text-zinc-100">
      <h1 className="text-3xl font-black uppercase mb-2">Content Manager (CMS)</h1>
      <p className="text-zinc-400 mb-8 max-w-2xl">
        Manage the database entries directly.
      </p>

      <div className="flex flex-wrap space-x-2 border-b border-zinc-800 mb-8 gap-y-2">
        {tabButton('trips', 'KCLMC Trips')}
        {tabButton('guides', 'Crags & Guides')}
        {tabButton('rounds', 'LUBE Rounds')}
        {tabButton('leaderboard', 'Rankings')}
        {tabButton('drops', 'Shop & Drops')}
        {tabButton('scorecards', 'Submitted Scorecards')}
      </div>

      {loading ? (
        <div className="animate-pulse">Loading database...</div>
      ) : activeTab === 'trips' ? (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">Add New Trip</h2>
            <form onSubmit={e => { e.preventDefault(); handleAdd('trips', newTrip, () => setNewTrip({ title: '', date: '', type: '' })) }} className="space-y-4 flex flex-col">
              <input required value={newTrip.title} onChange={e => setNewTrip({...newTrip, title: e.target.value})} placeholder="Trip Title" className="bg-zinc-950 border border-zinc-700 p-2 text-white" />
              <input required value={newTrip.date} onChange={e => setNewTrip({...newTrip, date: e.target.value})} placeholder="Date" className="bg-zinc-950 border border-zinc-700 p-2 text-white" />
              <select required value={newTrip.type} onChange={e => setNewTrip({...newTrip, type: e.target.value})} className="bg-zinc-950 border border-zinc-700 p-2 text-white">
                <option value="" disabled>Select Type...</option>
                <option value="Bouldering">Bouldering</option>
                <option value="Sport">Sport</option>
                <option value="Winter/Trad">Winter/Trad</option>
              </select>
              <button type="submit" className="bg-[#FFBD59] text-zinc-950 py-2 font-bold hover:bg-[#FFE0A3] transition-colors">Save to Database</button>
            </form>
          </div>
          <div>
            <h2 className="text-xl font-bold mb-4">Current Trips</h2>
            <div className="space-y-4">
              {trips.map(t => (
                <div key={t.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg flex justify-between items-center">
                  <div>
                    <h3 className="font-bold">{t.title}</h3>
                    <p className="text-sm text-zinc-400">{t.date} • {t.type}</p>
                  </div>
                  <button onClick={() => handleDelete('trips', t.id)} className="text-red-500 font-bold">DELETE</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : activeTab === 'guides' ? (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">Add New Guide</h2>
            <form onSubmit={e => { e.preventDefault(); handleAdd('guides', newGuide, () => setNewGuide({ title: '', description: '', category: 'indoor' })) }} className="space-y-4 flex flex-col">
              <input required value={newGuide.title} onChange={e => setNewGuide({...newGuide, title: e.target.value})} placeholder="Location Name" className="bg-zinc-950 border border-zinc-700 p-2 text-white" />
              <input required value={newGuide.description} onChange={e => setNewGuide({...newGuide, description: e.target.value})} placeholder="Description" className="bg-zinc-950 border border-zinc-700 p-2 text-white" />
              <select required value={newGuide.category} onChange={e => setNewGuide({...newGuide, category: e.target.value as any})} className="bg-zinc-950 border border-zinc-700 p-2 text-white">
                <option value="indoor">Indoor Wall</option>
                <option value="crag">Outdoor Local Crag</option>
              </select>
              <button type="submit" className="bg-[#FFBD59] text-zinc-950 py-2 font-bold hover:bg-[#FFE0A3] transition-colors">Save to Database</button>
            </form>
          </div>
          <div>
            <h2 className="text-xl font-bold mb-4">Current Guides</h2>
            <div className="space-y-4">
              {guides.map(g => (
                <div key={g.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg flex justify-between items-center">
                  <div>
                    <h3 className="font-bold">{g.title} <span className="text-xs bg-zinc-800 px-2 py-1 rounded ml-2">{g.category}</span></h3>
                    <p className="text-sm text-zinc-400">{g.description}</p>
                  </div>
                  <button onClick={() => handleDelete('guides', g.id)} className="text-red-500 font-bold">DELETE</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : activeTab === 'rounds' ? (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">Add Competition Round</h2>
            <form onSubmit={e => { e.preventDefault(); handleAdd('lube_rounds', newRound, () => setNewRound({ round: '', venue: '', date: '', status: 'Upcoming' })) }} className="space-y-4 flex flex-col">
              <input required value={newRound.round} onChange={e => setNewRound({...newRound, round: e.target.value})} placeholder="Round (e.g. Round 1, Finals)" className="bg-zinc-950 border border-zinc-700 p-2 text-white" />
              <input required value={newRound.venue} onChange={e => setNewRound({...newRound, venue: e.target.value})} placeholder="Venue (e.g. VauxWall)" className="bg-zinc-950 border border-zinc-700 p-2 text-white" />
              <input required value={newRound.date} onChange={e => setNewRound({...newRound, date: e.target.value})} placeholder="Date" className="bg-zinc-950 border border-zinc-700 p-2 text-white" />
              <select required value={newRound.status} onChange={e => setNewRound({...newRound, status: e.target.value})} className="bg-zinc-950 border border-zinc-700 p-2 text-white">
                <option value="Upcoming">Upcoming</option>
                <option value="Completed">Completed</option>
              </select>
              <button type="submit" className="bg-[#FFBD59] text-zinc-950 py-2 font-bold hover:bg-[#FFE0A3] transition-colors">Save to Database</button>
            </form>
          </div>
          <div>
            <h2 className="text-xl font-bold mb-4">Current Schedule</h2>
            <div className="space-y-4">
              {rounds.map(r => (
                <div key={r.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg flex justify-between items-center">
                  <div>
                    <h3 className="font-bold">{r.round}: {r.venue}</h3>
                    <p className="text-sm text-zinc-400">{r.date} • {r.status}</p>
                  </div>
                  <button onClick={() => handleDelete('lube_rounds', r.id)} className="text-red-500 font-bold">DELETE</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : activeTab === 'leaderboard' ? (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-8">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-4">Add Team Ranking</h2>
              <form onSubmit={e => { e.preventDefault(); handleAdd('leaderboard_teams', newTeam, () => setNewTeam({ rank: 1, name: '', points: 0 })) }} className="space-y-4 flex flex-col">
                <input type="number" required value={newTeam.rank} onChange={e => setNewTeam({...newTeam, rank: parseInt(e.target.value)})} placeholder="Rank" className="bg-zinc-950 border border-zinc-700 p-2 text-white" />
                <input required value={newTeam.name} onChange={e => setNewTeam({...newTeam, name: e.target.value})} placeholder="Team Name (e.g. KCL 1)" className="bg-zinc-950 border border-zinc-700 p-2 text-white" />
                <input type="number" required value={newTeam.points} onChange={e => setNewTeam({...newTeam, points: parseInt(e.target.value)})} placeholder="Points" className="bg-zinc-950 border border-zinc-700 p-2 text-white" />
                <button type="submit" className="bg-[#FFBD59] text-zinc-950 py-2 font-bold hover:bg-[#FFE0A3] transition-colors">Add Team</button>
              </form>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-4">Add Individual Ranking</h2>
              <form onSubmit={e => { e.preventDefault(); handleAdd('leaderboard_individuals', newInd, () => setNewInd({ rank: 1, name: '', uni: '', category: 'Men', points: 0 })) }} className="space-y-4 flex flex-col">
                <input type="number" required value={newInd.rank} onChange={e => setNewInd({...newInd, rank: parseInt(e.target.value)})} placeholder="Rank" className="bg-zinc-950 border border-zinc-700 p-2 text-white" />
                <input required value={newInd.name} onChange={e => setNewInd({...newInd, name: e.target.value})} placeholder="Climber Name" className="bg-zinc-950 border border-zinc-700 p-2 text-white" />
                <input required value={newInd.uni} onChange={e => setNewInd({...newInd, uni: e.target.value})} placeholder="University" className="bg-zinc-950 border border-zinc-700 p-2 text-white" />
                <select required value={newInd.category} onChange={e => setNewInd({...newInd, category: e.target.value})} className="bg-zinc-950 border border-zinc-700 p-2 text-white">
                  <option value="Men">Men</option>
                  <option value="Women">Women</option>
                  <option value="Non-Binary">Non-Binary</option>
                </select>
                <input type="number" required value={newInd.points} onChange={e => setNewInd({...newInd, points: parseInt(e.target.value)})} placeholder="Points" className="bg-zinc-950 border border-zinc-700 p-2 text-white" />
                <button type="submit" className="bg-[#FFBD59] text-zinc-950 py-2 font-bold hover:bg-[#FFE0A3] transition-colors">Add Individual</button>
              </form>
            </div>
          </div>
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold mb-4">Team Rankings</h2>
              <div className="space-y-2">
                {teams.map(t => (
                  <div key={t.id} className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg flex justify-between items-center text-sm">
                    <div><span className="font-bold text-gray-500 w-6 inline-block">#{t.rank}</span> {t.name} ({t.points} pts)</div>
                    <button onClick={() => handleDelete('leaderboard_teams', t.id)} className="text-red-500 font-bold">X</button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold mb-4">Individual Rankings</h2>
              <div className="space-y-2">
                {individuals.map(ind => (
                  <div key={ind.id} className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg flex justify-between items-center text-sm">
                    <div><span className="font-bold text-gray-500 w-6 inline-block">#{ind.rank}</span> {ind.name} - {ind.uni} ({ind.category})</div>
                    <button onClick={() => handleDelete('leaderboard_individuals', ind.id)} className="text-red-500 font-bold">X</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'drops' ? (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">Add Shop Item (Drop)</h2>
            <form onSubmit={e => { e.preventDefault(); handleAdd('shop_items', newShopItem, () => setNewShopItem({ name: '', brand: 'KCL', currentMoq: 0, targetMoq: 100, price: 20 })) }} className="space-y-4 flex flex-col">
              <input required value={newShopItem.name} onChange={e => setNewShopItem({...newShopItem, name: e.target.value})} placeholder="Garment Name" className="bg-zinc-950 border border-zinc-700 p-2 text-white" />
              <select required value={newShopItem.brand} onChange={e => setNewShopItem({...newShopItem, brand: e.target.value as 'KCL'|'LUBE'})} className="bg-zinc-950 border border-zinc-700 p-2 text-white">
                <option value="KCL">KCLMC (Crimson Drop)</option>
                <option value="LUBE">LUBE (Chalk Drop)</option>
              </select>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-zinc-500">Price (£)</label>
                  <input type="number" required value={newShopItem.price} onChange={e => setNewShopItem({...newShopItem, price: parseInt(e.target.value)})} className="w-full bg-zinc-950 border border-zinc-700 p-2 text-white" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-zinc-500">Current MOQ</label>
                  <input type="number" required value={newShopItem.currentMoq} onChange={e => setNewShopItem({...newShopItem, currentMoq: parseInt(e.target.value)})} className="w-full bg-zinc-950 border border-zinc-700 p-2 text-white" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-zinc-500">Target MOQ</label>
                  <input type="number" required value={newShopItem.targetMoq} onChange={e => setNewShopItem({...newShopItem, targetMoq: parseInt(e.target.value)})} className="w-full bg-zinc-950 border border-zinc-700 p-2 text-white" />
                </div>
              </div>
              <button type="submit" className="bg-[#FFBD59] text-zinc-950 py-2 font-bold hover:bg-[#FFE0A3] transition-colors">Save to Database</button>
            </form>
          </div>
          <div>
            <h2 className="text-xl font-bold mb-4">Active Shop Drops</h2>
            <div className="space-y-4">
              {shopItems.map(item => (
                <div key={item.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg flex justify-between items-center">
                  <div className="w-full mr-4">
                    <h3 className="font-bold flex items-center gap-2">
                      {item.name} 
                      <span className={`text-[10px] px-2 py-0.5 rounded ${item.brand === 'KCL' ? 'bg-red-950 text-red-400' : 'bg-zinc-800 text-white'}`}>{item.brand}</span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1">£{item.price} • MOQ Progress: {item.currentMoq}/{item.targetMoq}</p>
                    <div className="w-full bg-zinc-950 h-1 mt-2">
                      <div className="bg-emerald-500 h-1" style={{ width: `${Math.min(100, (item.currentMoq/item.targetMoq)*100)}%`}}></div>
                    </div>
                  </div>
                  <button onClick={() => handleDelete('shop_items', item.id)} className="text-red-500 font-bold">DELETE</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : activeTab === 'scorecards' ? (
        <div className="w-full">
          <h2 className="text-xl font-bold mb-4">Submitted Scorecards</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-900 text-zinc-400 uppercase text-xs">
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
              <tbody>
                {scorecards.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-4 text-center text-zinc-500 bg-zinc-900/50">No scorecards submitted yet.</td></tr>
                ) : scorecards.map(s => (
                  <tr key={s.id} className="border-b border-zinc-800 bg-zinc-900/30">
                    <td className="px-4 py-3 font-bold">{s.climberName}</td>
                    <td className="px-4 py-3">{s.university}</td>
                    <td className="px-4 py-3">{s.category}</td>
                    <td className="px-4 py-3">{s.round}</td>
                    <td className="px-4 py-3">
                      <span className="text-emerald-400 font-bold">{s.totalScore} pts</span>
                      <span className="text-zinc-500 text-xs ml-2">({s.tops}T {s.zones}Z)</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-[10px] uppercase font-bold rounded ${
                        s.status === 'VALID' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                        s.status === 'INVALID' ? 'bg-red-950 text-red-400 border border-red-800' :
                        'bg-zinc-800 text-zinc-400 border border-zinc-600'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button 
                        onClick={() => handleToggleScorecard(s.id, s.status)}
                        className={`text-xs px-2 py-1 font-bold ${s.status === 'VALID' ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'}`}
                      >
                        {s.status === 'VALID' ? 'Mark Invalid' : 'Mark Valid'}
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
  );
}
