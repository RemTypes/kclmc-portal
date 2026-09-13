'use client';
import { useState, useEffect } from 'react';
import { supabaseMock, LeaderboardTeam, LeaderboardIndividual } from '@/lib/supabase';

export default function LeaderboardPage() {
  const [filter, setFilter] = useState('team');
  const [search, setSearch] = useState('');
  
  const [teams, setTeams] = useState<LeaderboardTeam[]>([]);
  const [individuals, setIndividuals] = useState<LeaderboardIndividual[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const [{ data: teamData }, { data: indData }] = await Promise.all([
        supabaseMock.from('leaderboard_teams').select<LeaderboardTeam>(),
        supabaseMock.from('leaderboard_individuals').select<LeaderboardIndividual>()
      ]);
      setTeams(teamData || []);
      setIndividuals(indData || []);
      setLoading(false);
    }
    fetchData();
  }, []);
  
  const filteredTeams = teams.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  const filteredIndividuals = individuals.filter(i => 
    i.name.toLowerCase().includes(search.toLowerCase()) || 
    i.uni.toLowerCase().includes(search.toLowerCase())
  );
  
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F0] p-8 font-mono">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-black uppercase mb-8">Leaderboard</h1>
        
        <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 mb-8">
          <div className="flex space-x-4">
            <button onClick={() => setFilter('team')} className={`px-4 py-2 border-2 ${filter === 'team' ? 'bg-[#F5F5F0] text-[#0A0A0A]' : 'border-[#F5F5F0]'}`}>University Teams</button>
            <button onClick={() => setFilter('individual')} className={`px-4 py-2 border-2 ${filter === 'individual' ? 'bg-[#F5F5F0] text-[#0A0A0A]' : 'border-[#F5F5F0]'}`}>Individuals</button>
          </div>
          <input 
            type="text" 
            placeholder="Search..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="flex-1 bg-[#121212] border border-[#F5F5F0]/30 p-2 text-[#F5F5F0] focus:outline-none focus:border-[#F5F5F0]"
          />
        </div>
        
        <div className="border border-[#F5F5F0]/30">
          {loading ? (
            <div className="p-8 text-center animate-pulse">Loading Live Data...</div>
          ) : (
          <table className="w-full text-left">
            <thead className="border-b border-[#F5F5F0]/30 bg-[#121212]">
              <tr>
                <th className="p-4 font-bold">Rank</th>
                <th className="p-4 font-bold">{filter === 'team' ? 'University' : 'Name'}</th>
                {filter === 'individual' && <th className="p-4 font-bold">Category</th>}
                <th className="p-4 font-bold">Points</th>
              </tr>
            </thead>
            <tbody>
              {filter === 'team' ? (
                filteredTeams.length > 0 ? filteredTeams.map(t => (
                  <tr key={t.name} className="border-b border-[#F5F5F0]/10 hover:bg-[#121212]">
                    <td className="p-4">{t.rank}</td>
                    <td className="p-4">{t.name}</td>
                    <td className="p-4">{t.points}</td>
                  </tr>
                )) : <tr><td colSpan={3} className="p-4 text-center">No results found</td></tr>
              ) : (
                filteredIndividuals.length > 0 ? filteredIndividuals.map(i => (
                  <tr key={i.name} className="border-b border-[#F5F5F0]/10 hover:bg-[#121212]">
                    <td className="p-4">{i.rank}</td>
                    <td className="p-4">{i.name} ({i.uni})</td>
                    <td className="p-4">{i.category}</td>
                    <td className="p-4">{i.points}</td>
                  </tr>
                )) : <tr><td colSpan={4} className="p-4 text-center">No results found</td></tr>
              )}
            </tbody>
          </table>
          )}
        </div>
      </div>
    </div>
  );
}
