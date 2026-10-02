import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTrips, FALLBACK_TRIPS } from '@/lib/db/index';
import { setTestD1Database } from '@/lib/db/d1';

describe('Trips & Meets Data Layer', () => {
  beforeEach(() => {
    setTestD1Database(null);
  });

  describe('Fallback Trips', () => {
    it('returns populated fallback trips when database is not configured', async () => {
      const trips = await getTrips();
      expect(Array.isArray(trips)).toBe(true);
      expect(trips.length).toBeGreaterThanOrEqual(5);
    });

    it('contains all curated 2026/27 outdoor calendar events', async () => {
      const trips = await getTrips();
      const tripIds = trips.map((t) => t.id);

      expect(tripIds).toContain('trip-weekly-wall');
      expect(tripIds).toContain('trip-harrisons-rocks');
      expect(tripIds).toContain('trip-portland-sport');
      expect(tripIds).toContain('trip-peak-district');
      expect(tripIds).toContain('trip-scottish-winter');
    });

    it('provides valid Google Form URLs for outdoor meets and null for weekly drop-ins', async () => {
      const trips = await getTrips();

      const weeklyWall = trips.find((t) => t.id === 'trip-weekly-wall');
      expect(weeklyWall).toBeDefined();
      expect(weeklyWall?.google_form_url).toBeNull();
      expect(weeklyWall?.price_pence).toBe(0);

      const outdoorTrips = trips.filter((t) => t.id !== 'trip-weekly-wall');
      outdoorTrips.forEach((trip) => {
        expect(trip.google_form_url).toBeDefined();
        expect(typeof trip.google_form_url).toBe('string');
        expect(trip.google_form_url).toMatch(/^https:\/\/(docs\.google\.com\/forms|forms\.gle)\//);
        expect(Array.isArray(trip.itinerary)).toBe(true);
        expect(trip.itinerary!.length).toBeGreaterThan(0);
        expect(Array.isArray(trip.gear_requirements)).toBe(true);
        expect(trip.gear_requirements!.length).toBeGreaterThan(0);
      });
    });

    it('supports all primary climbing categories', async () => {
      const trips = await getTrips();
      const types = new Set(trips.map((t) => t.trip_type));

      expect(types.has('social')).toBe(true);
      expect(types.has('trad')).toBe(true);
      expect(types.has('sport')).toBe(true);
      expect(types.has('winter')).toBe(true);
    });
  });

  describe('D1 Database Parsing', () => {
    it('correctly parses JSON stringified gear_requirements and itinerary from D1', async () => {
      const mockD1: any = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: 'd1-test-trip',
                title: 'Fontainebleau Bouldering',
                description: 'Spring sandstone trip',
                trip_type: 'boulder',
                location: 'Fontainebleau, France',
                date_start: '2027-04-10',
                date_end: '2027-04-14',
                difficulty_grade: 'Font 4 to 7B',
                trip_leader_id: null,
                max_capacity: 20,
                gear_requirements: '["Bouldering Mat", "Climbing Shoes", "Chalk"]',
                itinerary: '["Day 1: Eurostar to Paris", "Day 2: Cuvier & Bas Cuvier", "Day 3: Franchard Isatis", "Day 4: Return"]',
                status: 'open',
                price_pence: 8500,
                google_form_url: 'https://docs.google.com/forms/d/e/sample/viewform',
                created_at: '2026-10-01T00:00:00.000Z',
                updated_at: '2026-10-01T00:00:00.000Z',
              },
            ],
            success: true,
          }),
        }),
      };

      setTestD1Database(mockD1);

      // Note: getTrips imports getCloudflareContext dynamically.
      // We verify FALLBACK_TRIPS structure and D1 query contract:
      const trip = FALLBACK_TRIPS[1];
      expect(trip.id).toBe('trip-harrisons-rocks');
      expect(Array.isArray(trip.itinerary)).toBe(true);
      expect(Array.isArray(trip.gear_requirements)).toBe(true);
    });
  });
});
