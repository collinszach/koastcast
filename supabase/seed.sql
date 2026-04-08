-- Auto-generated from data/spots.json — do not edit by hand
-- Re-generate: python3 scripts/gen_seed.py > supabase/seed.sql

INSERT INTO spots (
  name, slug, location, region, country, break_type,
  optimal_swell_direction, optimal_swell_direction_range, optimal_wind_direction,
  optimal_period_min, optimal_period_max, optimal_size_min, optimal_size_max,
  nearest_buoy_id, secondary_buoy_id, swan_enabled, timezone,
  skill_minimum, description
) VALUES
(
  'Westport', 'westport-wa',
  ST_GeomFromText('POINT(-124.1092 46.9024)', 4326)::geography,
  'Pacific Northwest', 'US', 'beach',
  280, 60, 90,
  10, 18, 1.0, 4.0,
  '46041', NULL,
  false, 'America/Los_Angeles',
  'intermediate', 'Washington''s surf capital. Jetty creates consistent sandbars. Cold, powerful, remote.'
),
(
  'Seaside (The Point)', 'seaside-or',
  ST_GeomFromText('POINT(-123.93 45.9934)', 4326)::geography,
  'Pacific Northwest', 'US', 'beach',
  280, 55, 95,
  10, 18, 0.8, 3.5,
  '46029', NULL,
  false, 'America/Los_Angeles',
  'beginner', 'Oregon''s most popular surf town. Protected right-hand point at the turnaround. Consistent and crowded.'
),
(
  'Short Sands (Oswald West)', 'short-sands-or',
  ST_GeomFromText('POINT(-123.9704 45.7638)', 4326)::geography,
  'Pacific Northwest', 'US', 'beach',
  285, 55, 100,
  10, 18, 0.8, 3.5,
  '46029', NULL,
  false, 'America/Los_Angeles',
  'beginner', 'Oregon''s gem, tucked inside Oswald West State Park. Sheltered cove, hike-in, old-growth vibe.'
),
(
  'Pacific City (Cape Kiwanda)', 'pacific-city-or',
  ST_GeomFromText('POINT(-123.9631 45.2163)', 4326)::geography,
  'Pacific Northwest', 'US', 'beach',
  280, 60, 100,
  9, 17, 0.8, 3.5,
  '46029', NULL,
  false, 'America/Los_Angeles',
  'intermediate', 'Dramatic haystack rock backdrop. Dory fleet launches through the surf. Hollow beachbreak peaks.'
),
(
  'Crescent City', 'crescent-city-ca',
  ST_GeomFromText('POINT(-124.199 41.7559)', 4326)::geography,
  'Northern California', 'US', 'beach',
  300, 55, 110,
  10, 18, 0.8, 4.0,
  '46027', NULL,
  false, 'America/Los_Angeles',
  'intermediate', 'Far NorCal beachbreak in the shadow of the redwoods. Cold, uncrowded, raw.'
),
(
  'Mavericks', 'mavericks-ca',
  ST_GeomFromText('POINT(-122.5016 37.4941)', 4326)::geography,
  'Northern California', 'US', 'reef',
  300, 40, 120,
  14, 22, 2.5, 8.0,
  '46012', '46026',
  false, 'America/Los_Angeles',
  'pro', 'World-famous big wave break. Needs serious NW groundswell to light up. Reef bottom.'
),
(
  'Ocean Beach', 'ocean-beach-sf-ca',
  ST_GeomFromText('POINT(-122.5109 37.7609)', 4326)::geography,
  'Northern California', 'US', 'beach',
  285, 60, 100,
  12, 20, 1.5, 5.0,
  '46026', NULL,
  false, 'America/Los_Angeles',
  'advanced', 'San Francisco''s main break. Heavy, powerful beachbreak. Rips and fog are the vibe.'
),
(
  'Fort Point', 'fort-point-sf-ca',
  ST_GeomFromText('POINT(-122.4776 37.8106)', 4326)::geography,
  'Northern California', 'US', 'reef',
  300, 40, 130,
  12, 20, 1.2, 4.0,
  '46026', NULL,
  false, 'America/Los_Angeles',
  'advanced', 'Wedging left under the Golden Gate Bridge. Iconic backdrop, needs solid NW groundswell.'
),
(
  'Bolinas', 'bolinas-ca',
  ST_GeomFromText('POINT(-122.7124 37.9091)', 4326)::geography,
  'Northern California', 'US', 'beach',
  310, 50, 120,
  10, 18, 0.8, 3.0,
  '46026', NULL,
  false, 'America/Los_Angeles',
  'intermediate', 'Tucked-away NorCal gem. Locals keep the sign down for a reason. Sandbar peaks.'
),
(
  'Pacifica', 'pacifica-ca',
  ST_GeomFromText('POINT(-122.4934 37.613)', 4326)::geography,
  'Northern California', 'US', 'beach',
  290, 55, 110,
  10, 18, 0.8, 3.5,
  '46026', NULL,
  false, 'America/Los_Angeles',
  'beginner', 'Linda Mar beach break just south of SF. More sheltered than OB. Good all-skill spot.'
),
(
  'Steamer Lane', 'steamer-lane-ca',
  ST_GeomFromText('POINT(-122.0265 36.9524)', 4326)::geography,
  'Northern California', 'US', 'reef',
  295, 50, 100,
  10, 18, 1.0, 4.0,
  '46042', NULL,
  false, 'America/Los_Angeles',
  'intermediate', 'Santa Cruz''s iconic point break. Consistent NW swell with kelp-padded rights.'
),
(
  'Pleasure Point', 'pleasure-point-ca',
  ST_GeomFromText('POINT(-121.9742 36.9611)', 4326)::geography,
  'Northern California', 'US', 'reef',
  280, 60, 100,
  9, 16, 0.8, 2.5,
  '46042', NULL,
  false, 'America/Los_Angeles',
  'beginner', 'Mellow right-hand reef steps down from 38th Ave to Privates. Perfect longboard wave.'
),
(
  'Pismo Beach', 'pismo-beach-ca',
  ST_GeomFromText('POINT(-120.6413 35.1422)', 4326)::geography,
  'Central California', 'US', 'beach',
  270, 55, 330,
  9, 17, 0.6, 2.5,
  '46011', NULL,
  false, 'America/Los_Angeles',
  'beginner', 'Central Coast beach break between creamy sand dunes. Fun peaks, clam chowder after.'
),
(
  'Rincon', 'rincon-ca',
  ST_GeomFromText('POINT(-119.4755 34.3724)', 4326)::geography,
  'Southern California', 'US', 'point',
  270, 40, 330,
  12, 20, 0.8, 2.5,
  '46053', NULL,
  false, 'America/Los_Angeles',
  'intermediate', 'The Queen of the Coast. Perfect right-hand point. Needs straight W or NW swell.'
),
(
  'C Street (Ventura)', 'c-street-ca',
  ST_GeomFromText('POINT(-119.304 34.2748)', 4326)::geography,
  'Southern California', 'US', 'point',
  260, 50, 340,
  10, 18, 0.6, 2.5,
  '46053', NULL,
  false, 'America/Los_Angeles',
  'beginner', 'Ventura''s long right-hand point. Mellow and user-friendly. Great longboard wave.'
),
(
  'Malibu (Surfrider Beach)', 'malibu-ca',
  ST_GeomFromText('POINT(-118.6784 34.0343)', 4326)::geography,
  'Southern California', 'US', 'point',
  230, 50, 330,
  10, 18, 0.6, 2.0,
  '46025', NULL,
  false, 'America/Los_Angeles',
  'beginner', 'The birthplace of California surf culture. Three points, noseride machines. Always crowded.'
),
(
  'El Porto', 'el-porto-ca',
  ST_GeomFromText('POINT(-118.4212 33.9047)', 4326)::geography,
  'Southern California', 'US', 'beach',
  240, 60, 15,
  9, 16, 0.6, 2.5,
  '46025', NULL,
  false, 'America/Los_Angeles',
  'beginner', 'Manhattan Beach''s north end. LA''s most consistent beachbreak. Works all year.'
),
(
  'Huntington Beach Pier', 'huntington-beach-ca',
  ST_GeomFromText('POINT(-118.002 33.655)', 4326)::geography,
  'Southern California', 'US', 'beach',
  220, 60, 30,
  9, 16, 0.6, 2.5,
  '46047', NULL,
  false, 'America/Los_Angeles',
  'beginner', 'Surf City USA. Reliable beachbreak both sides of the pier. US Open venue.'
),
(
  'The Wedge', 'the-wedge-ca',
  ST_GeomFromText('POINT(-117.8826 33.5935)', 4326)::geography,
  'Southern California', 'US', 'beach',
  175, 30, 310,
  12, 20, 1.5, 6.0,
  '46047', NULL,
  false, 'America/Los_Angeles',
  'advanced', 'Newport''s freak show shorebreak. Jetty reflection creates massive wedging peaks. Bodysurfer heaven.'
),
(
  'Lower Trestles', 'lower-trestles-ca',
  ST_GeomFromText('POINT(-117.5897 33.3849)', 4326)::geography,
  'Southern California', 'US', 'reef',
  220, 50, 20,
  10, 16, 0.8, 2.5,
  '46047', NULL,
  false, 'America/Los_Angeles',
  'intermediate', 'World-class cobblestone reef. CT stop. Works on S swells in summer, NW in winter.'
),
(
  'Grandview Beach', 'grandview-encinitas-ca',
  ST_GeomFromText('POINT(-117.3003 33.0696)', 4326)::geography,
  'Southern California', 'US', 'reef',
  255, 55, 60,
  9, 17, 0.6, 2.5,
  '46258', NULL,
  false, 'America/Los_Angeles',
  'intermediate', 'Encinitas reef at the north end of Leucadia. Staircase access, less crowded than Swamis.'
),
(
  'Swamis', 'swamis-ca',
  ST_GeomFromText('POINT(-117.2921 33.0364)', 4326)::geography,
  'Southern California', 'US', 'reef',
  250, 55, 60,
  10, 18, 0.8, 3.0,
  '46258', NULL,
  false, 'America/Los_Angeles',
  'intermediate', 'Encinitas reef point below the Self-Realization Fellowship. Long, walling rights.'
),
(
  'Pipes (Encinitas)', 'pipes-encinitas-ca',
  ST_GeomFromText('POINT(-117.2959 33.0558)', 4326)::geography,
  'Southern California', 'US', 'reef',
  255, 55, 60,
  9, 17, 0.6, 2.5,
  '46258', NULL,
  false, 'America/Los_Angeles',
  'intermediate', 'Mid-Encinitas reef between Grandview and Swamis. Hollow, punchy peaks on the right swell.'
),
(
  'Cardiff Reef', 'cardiff-reef-ca',
  ST_GeomFromText('POINT(-117.2887 33.0167)', 4326)::geography,
  'Southern California', 'US', 'reef',
  250, 55, 60,
  9, 17, 0.6, 2.5,
  '46258', NULL,
  false, 'America/Los_Angeles',
  'beginner', 'San Elijo reef break in Cardiff. Fun rights and lefts over cobblestone. Parking lot social scene.'
),
(
  'Windansea', 'windansea-ca',
  ST_GeomFromText('POINT(-117.2773 32.8316)', 4326)::geography,
  'Southern California', 'US', 'reef',
  245, 55, 60,
  9, 17, 0.8, 3.0,
  '46258', NULL,
  false, 'America/Los_Angeles',
  'intermediate', 'La Jolla''s most classic reef. Notorious locals, thatched shack, excellent rights and lefts.'
),
(
  'Blacks Beach', 'blacks-beach-ca',
  ST_GeomFromText('POINT(-117.2553 32.8848)', 4326)::geography,
  'Southern California', 'US', 'reef',
  240, 60, 60,
  10, 18, 1.0, 3.5,
  '46258', NULL,
  false, 'America/Los_Angeles',
  'advanced', 'La Jolla''s powerful reef. Hike-in. Best in long-period NW or WNW swells.'
),
(
  'Pipeline', 'pipeline-oahu-hi',
  ST_GeomFromText('POINT(-158.0528 21.6645)', 4326)::geography,
  'Hawaii', 'US', 'reef',
  315, 30, 100,
  14, 22, 2.0, 7.0,
  '51001', NULL,
  false, 'Pacific/Honolulu',
  'pro', 'The most dangerous wave on earth. Phase 2 only — needs additional offshore buoy data.'
),
(
  'Sunset Beach', 'sunset-beach-oahu-hi',
  ST_GeomFromText('POINT(-158.0418 21.6784)', 4326)::geography,
  'Hawaii', 'US', 'reef',
  330, 40, 90,
  14, 22, 2.0, 8.0,
  '51001', NULL,
  false, 'Pacific/Honolulu',
  'pro', 'North Shore''s biggest consistent break. Unpredictable peaks across a vast reef. Triple crown venue.'
),
(
  'Waimea Bay', 'waimea-bay-oahu-hi',
  ST_GeomFromText('POINT(-158.0649 21.6414)', 4326)::geography,
  'Hawaii', 'US', 'reef',
  320, 30, 100,
  16, 24, 4.0, 10.0,
  '51001', NULL,
  false, 'Pacific/Honolulu',
  'pro', 'The Bay only breaks over 20ft. When it does, the world watches. The Eddie is held here.'
),
(
  'Honolua Bay', 'honolua-bay-maui-hi',
  ST_GeomFromText('POINT(-156.6388 21.0155)', 4326)::geography,
  'Hawaii', 'US', 'reef',
  320, 35, 130,
  14, 22, 1.5, 5.0,
  '51001', NULL,
  false, 'Pacific/Honolulu',
  'advanced', 'Maui''s crown jewel. Deep-water right-hand point. Perfectly shaped walls when NW swells arrive.'
),
(
  'Pe''ahi (Jaws)', 'jaws-maui-hi',
  ST_GeomFromText('POINT(-156.3116 20.9386)', 4326)::geography,
  'Hawaii', 'US', 'reef',
  310, 25, 150,
  18, 25, 5.0, 20.0,
  '51001', NULL,
  false, 'Pacific/Honolulu',
  'pro', 'Maui''s tow-in big wave. Masts of water. Only breaks a handful of times per year.'
),
(
  'Nantucket (Cisco Beach)', 'cisco-beach-nantucket-ma',
  ST_GeomFromText('POINT(-70.1381 41.238)', 4326)::geography,
  'East Coast', 'US', 'beach',
  190, 80, 320,
  8, 16, 0.6, 2.5,
  '44008', NULL,
  false, 'America/New_York',
  'intermediate', 'Exposed south-facing beach picks up more swell than anywhere in New England. Remote and wild.'
),
(
  'Narragansett Town Beach', 'narragansett-ri',
  ST_GeomFromText('POINT(-71.4573 41.4268)', 4326)::geography,
  'East Coast', 'US', 'beach',
  160, 70, 300,
  8, 15, 0.5, 2.5,
  '44025', NULL,
  false, 'America/New_York',
  'beginner', 'New England''s most consistent break. Classic shore pound, fun beachbreak, gets good in fall.'
),
(
  'Montauk (Ditch Plains)', 'montauk-ny',
  ST_GeomFromText('POINT(-71.9566 41.0534)', 4326)::geography,
  'East Coast', 'US', 'point',
  120, 60, 310,
  8, 16, 0.6, 2.5,
  '44025', NULL,
  false, 'America/New_York',
  'beginner', 'The end of Long Island. Ditch Plains and beyond. Best in fall hurricane swell.'
),
(
  'Rockaway Beach', 'rockaway-beach-ny',
  ST_GeomFromText('POINT(-73.8348 40.5802)', 4326)::geography,
  'East Coast', 'US', 'beach',
  150, 70, 330,
  7, 14, 0.5, 2.0,
  '44025', NULL,
  false, 'America/New_York',
  'beginner', 'NYC''s surf break. Subway-accessible, surprisingly good in fall swells. Summer crowds ease off by September.'
),
(
  'Manasquan Inlet', 'manasquan-inlet-nj',
  ST_GeomFromText('POINT(-74.0328 40.1019)', 4326)::geography,
  'East Coast', 'US', 'jetty',
  110, 70, 280,
  7, 14, 0.5, 2.5,
  '44025', NULL,
  false, 'America/New_York',
  'intermediate', 'Jersey Shore''s best break. Jetty-induced sandbars on both sides. Epic in NE groundswell.'
),
(
  'Indian River Inlet', 'indian-river-inlet-de',
  ST_GeomFromText('POINT(-75.0704 38.6102)', 4326)::geography,
  'East Coast', 'US', 'jetty',
  100, 70, 270,
  7, 14, 0.5, 2.0,
  '44009', NULL,
  false, 'America/New_York',
  'intermediate', 'Delaware''s best and only real surf spot. Jetty creates consistent peaks. Mid-Atlantic gem.'
),
(
  'Ocean City (Inlet)', 'ocean-city-md',
  ST_GeomFromText('POINT(-75.0849 38.3284)', 4326)::geography,
  'East Coast', 'US', 'beach',
  90, 75, 270,
  7, 14, 0.4, 1.8,
  '44009', NULL,
  false, 'America/New_York',
  'beginner', 'Maryland''s surf town. Inlet jetty creates the best sandbars. Best in fall nor''easters.'
),
(
  'Virginia Beach', 'virginia-beach-va',
  ST_GeomFromText('POINT(-75.9779 36.8508)', 4326)::geography,
  'East Coast', 'US', 'beach',
  70, 80, 250,
  7, 14, 0.5, 2.0,
  '44014', NULL,
  false, 'America/New_York',
  'beginner', 'Mid-Atlantic beachbreak. Best in fall with NE groundswells from nor''easters and hurricanes.'
),
(
  'Kitty Hawk', 'kitty-hawk-nc',
  ST_GeomFromText('POINT(-75.7131 36.0637)', 4326)::geography,
  'East Coast', 'US', 'beach',
  60, 80, 230,
  7, 15, 0.5, 2.0,
  '41025', NULL,
  false, 'America/New_York',
  'beginner', 'Northern Outer Banks beach break. The Wright Brothers flew here for good reason — consistent wind.'
),
(
  'Kill Devil Hills', 'kill-devil-hills-nc',
  ST_GeomFromText('POINT(-75.6574 35.9957)', 4326)::geography,
  'East Coast', 'US', 'beach',
  65, 80, 235,
  7, 15, 0.5, 2.0,
  '41025', NULL,
  false, 'America/New_York',
  'beginner', 'Central Outer Banks. Multiple beach access points, fun peaks. Gets solid in hurricane season.'
),
(
  'Nags Head Pier', 'nags-head-nc',
  ST_GeomFromText('POINT(-75.6248 35.9541)', 4326)::geography,
  'East Coast', 'US', 'beach',
  65, 80, 235,
  7, 15, 0.5, 2.5,
  '41025', NULL,
  false, 'America/New_York',
  'beginner', 'OBX hub. Sandbars around Jennette''s Pier. The most consistent peaks on the northern Banks.'
),
(
  'Rodanthe (S-Turns)', 'rodanthe-nc',
  ST_GeomFromText('POINT(-75.4636 35.5913)', 4326)::geography,
  'East Coast', 'US', 'beach',
  55, 80, 230,
  7, 15, 0.5, 2.5,
  '41025', NULL,
  false, 'America/New_York',
  'intermediate', 'Central OBX at the S-curves. Exposed to more swell than the northern Banks. Gets hollow.'
),
(
  'Avon Pier', 'avon-nc',
  ST_GeomFromText('POINT(-75.495 35.357)', 4326)::geography,
  'East Coast', 'US', 'beach',
  50, 80, 225,
  7, 16, 0.5, 2.5,
  '41025', NULL,
  false, 'America/New_York',
  'beginner', 'South of the S-turns. Pier creates sandbars. Locals know it as the most consistent OBX peak.'
),
(
  'Cape Hatteras', 'cape-hatteras-nc',
  ST_GeomFromText('POINT(-75.5271 35.227)', 4326)::geography,
  'East Coast', 'US', 'beach',
  45, 80, 220,
  8, 16, 0.8, 3.0,
  '41025', NULL,
  false, 'America/New_York',
  'intermediate', 'Graveyard of the Atlantic. Fickle but can be epic. NE swells + W winds = fire.'
),
(
  'Folly Beach', 'folly-beach-sc',
  ST_GeomFromText('POINT(-79.9403 32.6554)', 4326)::geography,
  'East Coast', 'US', 'beach',
  100, 80, 280,
  6, 13, 0.4, 1.5,
  '41004', NULL,
  false, 'America/New_York',
  'beginner', 'Charleston''s beach break. Small and fun on a good day. Hurricane swell turns it on.'
),
(
  'Tybee Island', 'tybee-island-ga',
  ST_GeomFromText('POINT(-80.8438 31.9996)', 4326)::geography,
  'East Coast', 'US', 'beach',
  100, 80, 280,
  6, 13, 0.3, 1.5,
  '41008', NULL,
  false, 'America/New_York',
  'beginner', 'Georgia''s only real surf spot. Tiny by most standards, but locals love it. Hurricane swell required.'
),
(
  'Jacksonville Beach', 'jacksonville-beach-fl',
  ST_GeomFromText('POINT(-81.398 30.284)', 4326)::geography,
  'East Coast', 'US', 'beach',
  75, 75, 270,
  6, 13, 0.4, 1.8,
  '41008', NULL,
  false, 'America/New_York',
  'beginner', 'Northeast Florida''s most consistent beach. Pier sandbars, warm water, active local scene.'
),
(
  'Cocoa Beach', 'cocoa-beach-fl',
  ST_GeomFromText('POINT(-80.6081 28.32)', 4326)::geography,
  'East Coast', 'US', 'beach',
  70, 75, 270,
  6, 12, 0.3, 1.5,
  '41047', NULL,
  false, 'America/New_York',
  'beginner', 'Space Coast surf. Ron Jon''s backyard. Launches and landings visible from the lineup.'
),
(
  'New Smyrna Beach', 'new-smyrna-beach-fl',
  ST_GeomFromText('POINT(-80.9273 29.0258)', 4326)::geography,
  'East Coast', 'US', 'beach',
  65, 75, 270,
  6, 12, 0.4, 1.8,
  '41047', NULL,
  false, 'America/New_York',
  'beginner', 'Florida''s most consistent beachbreak. Fun peaks, warm water, and the shark capital of the world.'
),
(
  'Sebastian Inlet', 'sebastian-inlet-fl',
  ST_GeomFromText('POINT(-80.4494 27.8625)', 4326)::geography,
  'East Coast', 'US', 'jetty',
  60, 70, 270,
  6, 14, 0.5, 2.0,
  '41047', NULL,
  false, 'America/New_York',
  'intermediate', 'Florida''s best wave. Jetty-assisted hollow right. Lights up during NE swells.'
),
(
  'Jeffreys Bay', 'jeffreys-bay-za',
  ST_GeomFromText('POINT(24.9166 -34.0494)', 4326)::geography,
  'Eastern Cape', 'ZA', 'point',
  225, 35, 270,
  12, 20, 1.2, 4.0,
  NULL, NULL,
  false, 'Africa/Johannesburg',
  'intermediate', 'Arguably the world''s best right-hand point. Supertubes to Impossibles. CT stop.'
),
(
  'Hossegor (La Gravière)', 'hossegor-france',
  ST_GeomFromText('POINT(-1.4516 43.6599)', 4326)::geography,
  'Nouvelle-Aquitaine', 'FR', 'beach',
  270, 40, 90,
  10, 18, 1.2, 4.0,
  NULL, NULL,
  false, 'Europe/Paris',
  'advanced', 'Europe''s Pipeline. Deep sandbar funnels powerful Atlantic swells into thick, barreling peaks.'
),
(
  'Uluwatu', 'uluwatu-bali-id',
  ST_GeomFromText('POINT(115.0849 -8.8291)', 4326)::geography,
  'Bali', 'ID', 'reef',
  215, 40, 45,
  10, 18, 1.0, 4.0,
  NULL, NULL,
  false, 'Asia/Makassar',
  'intermediate', 'Bali''s crown jewel. Long left-hand reef below cliff temples. Works year-round.'
),
(
  'Puerto Escondido', 'puerto-escondido-mx',
  ST_GeomFromText('POINT(-97.0673 15.8698)', 4326)::geography,
  'Oaxaca', 'MX', 'beach',
  200, 40, 0,
  14, 22, 1.5, 8.0,
  NULL, NULL,
  false, 'America/Mexico_City',
  'advanced', 'The Mexican Pipeline. Terrifying shorebreak on a steep sandbar. Can reach 30ft in summer.'
),
(
  'Pavones', 'pavones-cr',
  ST_GeomFromText('POINT(-83.172 8.3876)', 4326)::geography,
  'Puntarenas', 'CR', 'point',
  210, 35, 70,
  12, 20, 1.0, 4.0,
  NULL, NULL,
  false, 'America/Costa_Rica',
  'intermediate', 'One of the longest left-hand point breaks on earth. Ride all the way to the river mouth.'
),
(
  'Snapper Rocks', 'snapper-rocks-au',
  ST_GeomFromText('POINT(153.5468 -28.1671)', 4326)::geography,
  'Gold Coast', 'AU', 'reef',
  120, 35, 225,
  10, 18, 0.8, 3.0,
  NULL, NULL,
  false, 'Australia/Brisbane',
  'intermediate', 'Start of the Superbank. Famed right-hander with long cobblestone point runs to Kirra.'
),
(
  'Taghazout (Anchor Point)', 'anchor-point-morocco',
  ST_GeomFromText('POINT(-9.7085 30.5381)', 4326)::geography,
  'Souss-Massa', 'MA', 'point',
  295, 40, 30,
  12, 20, 1.0, 4.0,
  NULL, NULL,
  false, 'Africa/Casablanca',
  'intermediate', 'Morocco''s best right-hand point. Long walls, argan oil, cheap tagine. Europe''s winter escape.'
),
(
  'Cloudbreak', 'cloudbreak-fiji',
  ST_GeomFromText('POINT(177.312 -17.963)', 4326)::geography,
  'Mamanuca Islands', 'FJ', 'reef',
  210, 30, 60,
  14, 22, 1.5, 8.0,
  NULL, NULL,
  false, 'Pacific/Fiji',
  'advanced', 'Boat-access left-hand reef in the middle of the Pacific. Pristine barrels on a razor-sharp reef.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  location = EXCLUDED.location,
  region = EXCLUDED.region,
  optimal_swell_direction = EXCLUDED.optimal_swell_direction,
  optimal_swell_direction_range = EXCLUDED.optimal_swell_direction_range,
  optimal_wind_direction = EXCLUDED.optimal_wind_direction,
  optimal_period_min = EXCLUDED.optimal_period_min,
  optimal_period_max = EXCLUDED.optimal_period_max,
  optimal_size_min = EXCLUDED.optimal_size_min,
  optimal_size_max = EXCLUDED.optimal_size_max,
  nearest_buoy_id = EXCLUDED.nearest_buoy_id,
  swan_enabled = EXCLUDED.swan_enabled,
  description = EXCLUDED.description;
