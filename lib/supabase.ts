// Mock Supabase Provider
// When real keys are provided, this will be swapped for the actual @supabase/supabase-js client

export type Trip = { id: string, title: string, date: string, type: string };
export type Guide = { id: string, title: string, description: string, category: 'indoor' | 'crag' };
export type LeaderboardTeam = { id: string, rank: number, name: string, points: number };
export type LeaderboardIndividual = { id: string, rank: number, name: string, uni: string, category: string, points: number };

export type LubeRound = { id: string, round: string, venue: string, date: string, status: string };
export type ShopItem = { id: string, name: string, brand: 'KCL' | 'LUBE', currentMoq: number, targetMoq: number, garmentTypes: string, price: number };
export type ScorecardSubmission = { id: string, climberName: string, university: string, category: string, round: string, totalScore: number, tops: number, zones: number, attempts: number, status: 'PENDING' | 'VALID' | 'INVALID', submittedAt: number };

// In-memory mock database
const mockDb = {
  trips: [] as Trip[],
  guides: [] as Guide[],
  leaderboard_teams: [] as LeaderboardTeam[],
  leaderboard_individuals: [] as LeaderboardIndividual[],
  lube_rounds: [] as LubeRound[],
  shop_items: [] as ShopItem[],
  scorecards: [] as ScorecardSubmission[],
  access_codes: [{ id: '1', code: 'LUBE2026' }] // default code
};

// Simulate network delay
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const supabaseMock = {
  from: (table: keyof typeof mockDb) => ({
    select: async <T = any>() => {
      await delay(200);
      return { data: mockDb[table] as unknown as T[], error: null };
    },
    insert: async <T = any>(data: any) => {
      await delay(200);
      const newData = { ...data, id: Math.random().toString(36).substring(7) };
      (mockDb[table] as any[]).push(newData);
      return { data: [newData] as T[], error: null };
    },
    update: (data: any) => ({
      eq: async <T = any>(col: string, val: string) => {
        await delay(200);
        const index = mockDb[table].findIndex((item: any) => item[col] === val);
        if (index > -1) {
          mockDb[table][index] = { ...mockDb[table][index], ...data };
          return { data: [mockDb[table][index]] as T[], error: null };
        }
        return { data: null, error: new Error('Not found') };
      }
    }),
    delete: () => ({
      eq: async (col: string, val: string) => {
        await delay(200);
        const index = mockDb[table].findIndex((item: any) => item[col] === val);
        if (index > -1) {
          mockDb[table].splice(index, 1);
          return { data: [], error: null };
        }
        return { data: null, error: new Error('Not found') };
      }
    })
  })
};
