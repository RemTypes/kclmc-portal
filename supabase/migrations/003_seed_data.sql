-- ============================================================
-- 003_seed_data.sql
-- Starter content for the KCLMC Club Beta
-- ============================================================

-- Guides: Indoor Walls
insert into public.guides (title, description, category, location, discount_info, sort_order) values
  ('Mile End Climbing Wall', 'Community wall in Tower Hamlets. Great for after-lecture sessions. Bouldering and top-rope.', 'indoor', 'Mile End, E3', '20% off with KCL student ID', 1),
  ('VauxWall East', 'Premier bouldering in Vauxhall railway arches. Comp-grade setting and excellent training boards.', 'indoor', 'Vauxhall, SE11', '£2 off day pass with KCLMC membership card', 2),
  ('The Castle Climbing Centre', 'Iconic converted Victorian water tower. Lead, top-rope, and bouldering across all grades.', 'indoor', 'Manor House, N4', 'Free intro session for new KCL members', 3),
  ('Arch Climbing Wall', 'Three London locations. Modern commercial walls with auto-belays and competition bouldering.', 'indoor', 'Bermondsey / Brentford / North Greenwich', null, 4);

-- Guides: Outdoor Crags
insert into public.guides (title, description, category, location, grade_range, sort_order) values
  ('Harrison''s Rocks', 'Southern Sandstone classic. Top-rope only. Perfect weekend trip from London Bridge (50 min train).', 'crag', 'Groombridge, Kent', 'VDiff to E3', 1),
  ('Bowles Rocks', 'Nearby alternative to Harrison''s with a wider range of easier routes and good group logistics.', 'crag', 'Eridge, East Sussex', 'Mod to HVS', 2),
  ('Portland', 'Sea-cliff limestone sport climbing on the Jurassic Coast. Weekend trip destination.', 'crag', 'Dorset', 'F4 to F7c', 3),
  ('Stanage Edge', 'Peak District gritstone. The UK''s most famous crag. Trad climbing at its finest.', 'crag', 'Sheffield, Peak District', 'VDiff to E7', 4);

-- Trips: Upcoming season
insert into public.trips (title, description, trip_type, location, date_start, date_end, difficulty_grade, max_capacity, gear_requirements, status, price_pence) values
  ('Weekly Social Wall — Mile End', 'Drop-in Tuesday evening session. No booking required. Meet at reception 6:30pm.', 'social', 'Mile End Climbing Wall, E3', '2026-10-01', null, 'All levels', 30, '{}', 'open', 0),
  ('Harrison''s Rocks Day Trip', 'Southern Sandstone top-roping. Transport arranged from Waterloo. All gear provided.', 'trad', 'Groombridge, Kent', '2026-10-12', '2026-10-12', 'VDiff to HVS', 16, '{"helmet","harness"}', 'open', 1500),
  ('Peak District Weekend', 'Two days on Stanage Edge and Burbage. Wild camping option. Trad lead and second pairs.', 'trad', 'Hathersage, Peak District', '2026-10-25', '2026-10-26', 'Severe to E1', 12, '{"helmet","harness","trad rack","sleeping bag"}', 'open', 4500),
  ('Scottish Winter Mountaineering', 'Grade I-III winter routes in Glencoe. Crampon and ice axe skills required. Pre-trip training mandatory.', 'winter', 'Glencoe, Scotland', '2026-12-14', '2026-12-17', 'Grade I to III', 8, '{"crampons","ice axe","helmet","harness","winter boots"}', 'draft', 15000);

-- Shop Items: Active KCL drop
insert into public.shop_items (name, brand, price_pence, garment_types, current_moq, target_moq) values
  ('KCLMC Alpine Tee 2026', 'KCL', 1800, 'T-Shirt', 12, 30),
  ('KCLMC Summit Hoodie', 'KCL', 3500, 'Hoodie', 8, 25),
  ('KCLMC Expedition Sweater', 'KCL', 2800, 'Sweater', 5, 20);
