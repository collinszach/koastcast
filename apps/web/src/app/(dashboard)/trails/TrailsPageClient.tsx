'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
// Leaflet used via dynamic import — no static type import needed

// ─── Types ─────────────────────────────────────────────────────────────────────

type TrailConditionKey = 'DRY' | 'WET' | 'MUDDY' | 'SNOW' | 'CLOSED' | 'ICY'
type DifficultyKey     = 'EASY' | 'MODERATE' | 'HARD' | 'EXPERT'
type RegionKey         = 'Sierra Nevada' | 'Pacific NW' | 'Southwest' | 'Rockies' | 'Southeast' | 'Northeast' | 'California Coast'

interface Trail {
  id: string
  name: string
  park: string
  region: RegionKey
  state: string
  lat: number
  lng: number
  difficulty: 'easy' | 'moderate' | 'hard' | 'expert'
  condition: 'dry' | 'wet' | 'muddy' | 'snow' | 'closed' | 'icy'
  distance_km: number
  elevation_gain_m: number
  highest_point_m: number
  surface: string
  best_season: string
  type: 'loop' | 'out-and-back' | 'point-to-point' | 'lollipop'
  description: string
  path: Array<[number, number]>  // [lng, lat] waypoints
  weekDays: TrailConditionKey[]
}

// ─── Trail Data ────────────────────────────────────────────────────────────────

const TRAILS: Trail[] = [
  // ── Sierra Nevada ──────────────────────────────────────────────────────────
  {
    id: 'half-dome',
    name: 'Half Dome',
    park: 'Yosemite National Park',
    region: 'Sierra Nevada',
    state: 'CA',
    lat: 37.7459, lng: -119.5332,
    difficulty: 'hard',
    condition: 'dry',
    distance_km: 24,
    elevation_gain_m: 1500,
    highest_point_m: 2695,
    surface: 'Rock / Mixed',
    best_season: 'Jun–Oct',
    type: 'out-and-back',
    description: 'Iconic granite dome with cable route to the summit. Permits required for the cables section.',
    weekDays: ['DRY', 'DRY', 'DRY', 'WET', 'DRY'],
    path: [
      [-119.5567, 37.7339], [-119.5520, 37.7360], [-119.5490, 37.7390],
      [-119.5450, 37.7410], [-119.5410, 37.7430], [-119.5375, 37.7445],
      [-119.5350, 37.7452], [-119.5332, 37.7459],
    ],
  },
  {
    id: 'jmt-start',
    name: 'John Muir Trail Start',
    park: 'Yosemite National Park',
    region: 'Sierra Nevada',
    state: 'CA',
    lat: 37.7270, lng: -119.5556,
    difficulty: 'expert',
    condition: 'snow',
    distance_km: 338,
    elevation_gain_m: 4000,
    highest_point_m: 4418,
    surface: 'Dirt / Rock',
    best_season: 'Jul–Sep',
    type: 'point-to-point',
    description: 'One of America\'s greatest long-distance trails, traversing the Sierra Nevada from Yosemite to Whitney.',
    weekDays: ['SNOW', 'SNOW', 'DRY', 'DRY', 'DRY'],
    path: [
      [-119.5556, 37.7270], [-119.5200, 37.7100], [-119.4800, 37.6800],
      [-119.4200, 37.6400], [-119.3500, 37.5800], [-119.2800, 37.5200],
      [-118.8000, 37.2000], [-118.4000, 36.9000], [-118.2923, 36.5786],
    ],
  },
  {
    id: 'mt-whitney',
    name: 'Mount Whitney Main Trail',
    park: 'Inyo National Forest',
    region: 'Sierra Nevada',
    state: 'CA',
    lat: 36.5786, lng: -118.2923,
    difficulty: 'hard',
    condition: 'snow',
    distance_km: 35,
    elevation_gain_m: 1830,
    highest_point_m: 4421,
    surface: 'Rock',
    best_season: 'Jul–Sep',
    type: 'out-and-back',
    description: 'Summit of the contiguous US. 99 switchbacks to the top, stunning Sierra views throughout.',
    weekDays: ['SNOW', 'SNOW', 'SNOW', 'DRY', 'DRY'],
    path: [
      [-118.2923, 36.5786], [-118.2960, 36.5830], [-118.2985, 36.5870],
      [-118.2990, 36.5920], [-118.2975, 36.5970], [-118.2950, 36.6020],
      [-118.2930, 36.6060], [-118.2921, 36.6071],
    ],
  },
  {
    id: 'mist-trail',
    name: 'Nevada Falls / Mist Trail',
    park: 'Yosemite National Park',
    region: 'Sierra Nevada',
    state: 'CA',
    lat: 37.7339, lng: -119.5567,
    difficulty: 'moderate',
    condition: 'wet',
    distance_km: 11,
    elevation_gain_m: 610,
    highest_point_m: 2076,
    surface: 'Rock / Granite Steps',
    best_season: 'Apr–Oct',
    type: 'out-and-back',
    description: 'Iconic spray-drenched hike past Vernal and Nevada Falls. Bring a rain jacket in spring.',
    weekDays: ['WET', 'WET', 'WET', 'DRY', 'DRY'],
    path: [
      [-119.5567, 37.7339], [-119.5530, 37.7360], [-119.5500, 37.7385],
      [-119.5475, 37.7410], [-119.5450, 37.7440], [-119.5430, 37.7470],
    ],
  },
  {
    id: 'clouds-rest',
    name: 'Clouds Rest',
    park: 'Yosemite National Park',
    region: 'Sierra Nevada',
    state: 'CA',
    lat: 37.7620, lng: -119.4980,
    difficulty: 'hard',
    condition: 'dry',
    distance_km: 22,
    elevation_gain_m: 820,
    highest_point_m: 2996,
    surface: 'Granite / Dirt',
    best_season: 'Jun–Oct',
    type: 'out-and-back',
    description: 'The highest point accessible by trail in Yosemite, with panoramic views of Half Dome and the Valley.',
    weekDays: ['DRY', 'DRY', 'DRY', 'DRY', 'DRY'],
    path: [
      [-119.4950, 37.7680], [-119.4960, 37.7660], [-119.4970, 37.7640],
      [-119.4975, 37.7620], [-119.4980, 37.7620],
    ],
  },
  {
    id: 'crystal-crag',
    name: 'Crystal Crag',
    park: 'Mammoth Lakes',
    region: 'Sierra Nevada',
    state: 'CA',
    lat: 37.6128, lng: -119.0081,
    difficulty: 'moderate',
    condition: 'dry',
    distance_km: 5,
    elevation_gain_m: 490,
    highest_point_m: 3218,
    surface: 'Rock / Talus',
    best_season: 'Jul–Oct',
    type: 'out-and-back',
    description: 'Short but steep scramble above Lake George with dramatic views of the Mammoth Lakes basin.',
    weekDays: ['DRY', 'DRY', 'WET', 'DRY', 'DRY'],
    path: [
      [-119.0081, 37.6128], [-119.0085, 37.6145], [-119.0088, 37.6160],
      [-119.0090, 37.6175], [-119.0092, 37.6190],
    ],
  },

  // ── Pacific NW ─────────────────────────────────────────────────────────────
  {
    id: 'enchantments',
    name: 'Enchantments Core Zone',
    park: 'Okanogan-Wenatchee National Forest',
    region: 'Pacific NW',
    state: 'WA',
    lat: 47.5317, lng: -120.8124,
    difficulty: 'hard',
    condition: 'snow',
    distance_km: 29,
    elevation_gain_m: 1670,
    highest_point_m: 2400,
    surface: 'Rock / Alpine',
    best_season: 'Jul–Oct',
    type: 'point-to-point',
    description: 'Washington\'s most coveted backcountry destination — crystal lakes, mountain goats, and granite spires.',
    weekDays: ['SNOW', 'SNOW', 'DRY', 'DRY', 'MUDDY'],
    path: [
      [-120.8124, 47.5317], [-120.8200, 47.5280], [-120.8280, 47.5250],
      [-120.8350, 47.5210], [-120.8430, 47.5170], [-120.8500, 47.5120],
      [-120.8560, 47.5080], [-120.8620, 47.5040],
    ],
  },
  {
    id: 'mailbox-peak',
    name: 'Mailbox Peak',
    park: 'Okanogan-Wenatchee National Forest',
    region: 'Pacific NW',
    state: 'WA',
    lat: 47.5082, lng: -121.6883,
    difficulty: 'hard',
    condition: 'muddy',
    distance_km: 14,
    elevation_gain_m: 1580,
    highest_point_m: 1520,
    surface: 'Dirt / Root',
    best_season: 'Jun–Oct',
    type: 'out-and-back',
    description: 'Brutal, relentless climb rewarded with panoramic Cascades views. One of the toughest day hikes in WA.',
    weekDays: ['MUDDY', 'MUDDY', 'WET', 'DRY', 'DRY'],
    path: [
      [-121.6883, 47.5082], [-121.6900, 47.5110], [-121.6910, 47.5140],
      [-121.6915, 47.5170], [-121.6910, 47.5200], [-121.6900, 47.5230],
      [-121.6890, 47.5260],
    ],
  },
  {
    id: 'snow-lake-wa',
    name: 'Snow Lake',
    park: 'Alpine Lakes Wilderness',
    region: 'Pacific NW',
    state: 'WA',
    lat: 47.4447, lng: -121.5291,
    difficulty: 'moderate',
    condition: 'dry',
    distance_km: 13,
    elevation_gain_m: 460,
    highest_point_m: 1523,
    surface: 'Dirt / Rock',
    best_season: 'Jun–Oct',
    type: 'out-and-back',
    description: 'Popular alpine lake in the Snoqualmie area with stunning reflections of surrounding granite peaks.',
    weekDays: ['DRY', 'WET', 'WET', 'DRY', 'DRY'],
    path: [
      [-121.5291, 47.4447], [-121.5330, 47.4470], [-121.5370, 47.4490],
      [-121.5410, 47.4510], [-121.5450, 47.4525], [-121.5490, 47.4540],
    ],
  },
  {
    id: 'rattlesnake-ledge',
    name: 'Rattlesnake Ledge',
    park: 'Rattlesnake Lake Recreation Area',
    region: 'Pacific NW',
    state: 'WA',
    lat: 47.4337, lng: -121.7688,
    difficulty: 'moderate',
    condition: 'wet',
    distance_km: 8,
    elevation_gain_m: 370,
    highest_point_m: 572,
    surface: 'Dirt / Gravel',
    best_season: 'Year-round',
    type: 'out-and-back',
    description: 'Seattle\'s most popular hike with sweeping views of Rattlesnake Lake and the valley below.',
    weekDays: ['WET', 'DRY', 'DRY', 'WET', 'DRY'],
    path: [
      [-121.7688, 47.4337], [-121.7710, 47.4360], [-121.7725, 47.4385],
      [-121.7735, 47.4410], [-121.7740, 47.4435],
    ],
  },
  {
    id: 'multnomah-falls',
    name: 'Multnomah Falls Loop',
    park: 'Columbia River Gorge National Scenic Area',
    region: 'Pacific NW',
    state: 'OR',
    lat: 45.5762, lng: -122.1158,
    difficulty: 'moderate',
    condition: 'wet',
    distance_km: 6,
    elevation_gain_m: 245,
    highest_point_m: 368,
    surface: 'Paved / Dirt',
    best_season: 'Year-round',
    type: 'loop',
    description: 'Oregon\'s most visited trail, passing the iconic 189m two-tiered Multnomah Falls and gorge viewpoints.',
    weekDays: ['WET', 'WET', 'DRY', 'DRY', 'WET'],
    path: [
      [-122.1158, 45.5762], [-122.1170, 45.5780], [-122.1185, 45.5800],
      [-122.1195, 45.5820], [-122.1180, 45.5835], [-122.1160, 45.5820],
      [-122.1158, 45.5762],
    ],
  },
  {
    id: 'south-sister',
    name: 'South Sister Summit',
    park: 'Deschutes National Forest',
    region: 'Pacific NW',
    state: 'OR',
    lat: 44.1035, lng: -121.7693,
    difficulty: 'hard',
    condition: 'snow',
    distance_km: 22,
    elevation_gain_m: 1470,
    highest_point_m: 3157,
    surface: 'Volcanic Rock / Snow',
    best_season: 'Jul–Sep',
    type: 'out-and-back',
    description: 'Oregon\'s third-highest peak. Steady climb up volcanic slopes with a stunning crater lake at the summit.',
    weekDays: ['SNOW', 'DRY', 'DRY', 'DRY', 'DRY'],
    path: [
      [-121.7693, 44.1035], [-121.7720, 44.1080], [-121.7730, 44.1130],
      [-121.7735, 44.1180], [-121.7730, 44.1230], [-121.7720, 44.1280],
      [-121.7710, 44.1330], [-121.7700, 44.1383],
    ],
  },
  {
    id: 'crater-lake-rim',
    name: 'Crater Lake Rim Loop',
    park: 'Crater Lake National Park',
    region: 'Pacific NW',
    state: 'OR',
    lat: 42.9446, lng: -122.1090,
    difficulty: 'hard',
    condition: 'snow',
    distance_km: 53,
    elevation_gain_m: 1240,
    highest_point_m: 2484,
    surface: 'Pumice / Rock',
    best_season: 'Jul–Sep',
    type: 'loop',
    description: 'Circumnavigate the deepest lake in the US on this multi-day rim trail with volcanic scenery throughout.',
    weekDays: ['SNOW', 'DRY', 'DRY', 'DRY', 'DRY'],
    path: [
      [-122.1090, 42.9446], [-122.0700, 42.9600], [-121.9800, 42.9700],
      [-121.9200, 42.9600], [-121.9000, 42.9300], [-121.9200, 42.9000],
      [-122.0000, 42.8800], [-122.0800, 42.8900], [-122.1200, 42.9100],
      [-122.1090, 42.9446],
    ],
  },
  {
    id: 'hurricane-ridge',
    name: 'Hurricane Ridge Trail',
    park: 'Olympic National Park',
    region: 'Pacific NW',
    state: 'WA',
    lat: 47.9700, lng: -123.4984,
    difficulty: 'moderate',
    condition: 'dry',
    distance_km: 8,
    elevation_gain_m: 335,
    highest_point_m: 1680,
    surface: 'Paved / Dirt',
    best_season: 'Jun–Oct',
    type: 'out-and-back',
    description: 'Alpine meadows, black-tailed deer, and sweeping views of the Olympic Mountains and Strait of Juan de Fuca.',
    weekDays: ['DRY', 'DRY', 'WET', 'DRY', 'DRY'],
    path: [
      [-123.4984, 47.9700], [-123.5000, 47.9730], [-123.5010, 47.9760],
      [-123.5015, 47.9790], [-123.5010, 47.9820],
    ],
  },

  // ── Southwest ──────────────────────────────────────────────────────────────
  {
    id: 'zion-narrows',
    name: 'Zion Narrows Bottom-Up',
    park: 'Zion National Park',
    region: 'Southwest',
    state: 'UT',
    lat: 37.2905, lng: -112.9478,
    difficulty: 'moderate',
    condition: 'wet',
    distance_km: 16,
    elevation_gain_m: 150,
    highest_point_m: 1292,
    surface: 'River / Rock',
    best_season: 'May–Oct',
    type: 'point-to-point',
    description: 'Wade through the Virgin River in the world\'s narrowest slot canyon. Flash flood danger — check forecasts.',
    weekDays: ['WET', 'WET', 'WET', 'WET', 'WET'],
    path: [
      [-112.9478, 37.2905], [-112.9470, 37.2960], [-112.9465, 37.3010],
      [-112.9460, 37.3060], [-112.9455, 37.3110], [-112.9450, 37.3160],
      [-112.9445, 37.3210], [-112.9440, 37.3260],
    ],
  },
  {
    id: 'angels-landing',
    name: 'Angels Landing',
    park: 'Zion National Park',
    region: 'Southwest',
    state: 'UT',
    lat: 37.2687, lng: -112.9521,
    difficulty: 'hard',
    condition: 'dry',
    distance_km: 8,
    elevation_gain_m: 454,
    highest_point_m: 1763,
    surface: 'Paved / Rock',
    best_season: 'Mar–Nov',
    type: 'out-and-back',
    description: 'Harrowing chain-assisted scramble to a sheer-sided monolith. Permit required. Not for acrophobes.',
    weekDays: ['DRY', 'DRY', 'DRY', 'DRY', 'DRY'],
    path: [
      [-112.9521, 37.2687], [-112.9515, 37.2710], [-112.9510, 37.2735],
      [-112.9508, 37.2760], [-112.9505, 37.2785], [-112.9500, 37.2810],
    ],
  },
  {
    id: 'emerald-pools',
    name: 'Emerald Pools',
    park: 'Zion National Park',
    region: 'Southwest',
    state: 'UT',
    lat: 37.2546, lng: -112.9624,
    difficulty: 'easy',
    condition: 'dry',
    distance_km: 5,
    elevation_gain_m: 180,
    highest_point_m: 1388,
    surface: 'Paved / Dirt',
    best_season: 'Year-round',
    type: 'loop',
    description: 'Family-friendly loop to three tiered pools fed by waterfalls dropping off the canyon walls.',
    weekDays: ['DRY', 'DRY', 'DRY', 'DRY', 'DRY'],
    path: [
      [-112.9624, 37.2546], [-112.9635, 37.2565], [-112.9640, 37.2585],
      [-112.9635, 37.2605], [-112.9620, 37.2615], [-112.9605, 37.2605],
      [-112.9600, 37.2585], [-112.9610, 37.2565], [-112.9624, 37.2546],
    ],
  },
  {
    id: 'delicate-arch',
    name: 'Delicate Arch',
    park: 'Arches National Park',
    region: 'Southwest',
    state: 'UT',
    lat: 38.7436, lng: -109.4993,
    difficulty: 'moderate',
    condition: 'dry',
    distance_km: 5,
    elevation_gain_m: 149,
    highest_point_m: 1723,
    surface: 'Slickrock',
    best_season: 'Sep–May',
    type: 'out-and-back',
    description: 'Utah\'s most iconic arch. Slickrock trail to a freestanding 16m sandstone arch framing the La Sal Mountains.',
    weekDays: ['DRY', 'DRY', 'DRY', 'DRY', 'DRY'],
    path: [
      [-109.4993, 38.7436], [-109.4970, 38.7455], [-109.4950, 38.7470],
      [-109.4935, 38.7485], [-109.4920, 38.7499], [-109.4910, 38.7459],
    ],
  },
  {
    id: 'grand-canyon-rim-rim',
    name: 'Rim-to-Rim',
    park: 'Grand Canyon National Park',
    region: 'Southwest',
    state: 'AZ',
    lat: 36.0586, lng: -112.1401,
    difficulty: 'expert',
    condition: 'dry',
    distance_km: 34,
    elevation_gain_m: 1676,
    highest_point_m: 2804,
    surface: 'Dirt / Rock',
    best_season: 'Oct–Apr',
    type: 'point-to-point',
    description: 'The grand traverse of the Grand Canyon — South Rim to North Rim through the inner gorge. Requires two days minimum.',
    weekDays: ['DRY', 'DRY', 'DRY', 'DRY', 'DRY'],
    path: [
      [-112.1401, 36.0586], [-112.1430, 36.0650], [-112.1440, 36.0720],
      [-112.1435, 36.0800], [-112.1425, 36.0870], [-112.1415, 36.0940],
      [-112.1410, 36.1010], [-112.1400, 36.1080], [-112.1390, 36.2070],
    ],
  },
  {
    id: 'bright-angel',
    name: 'Bright Angel Trail',
    park: 'Grand Canyon National Park',
    region: 'Southwest',
    state: 'AZ',
    lat: 36.0565, lng: -112.1432,
    difficulty: 'hard',
    condition: 'dry',
    distance_km: 15,
    elevation_gain_m: 1320,
    highest_point_m: 2164,
    surface: 'Dirt / Rock',
    best_season: 'Oct–Apr',
    type: 'out-and-back',
    description: 'The Grand Canyon\'s main corridor trail. Descend through geological time to the Colorado River.',
    weekDays: ['DRY', 'DRY', 'DRY', 'DRY', 'DRY'],
    path: [
      [-112.1432, 36.0565], [-112.1435, 36.0630], [-112.1440, 36.0700],
      [-112.1445, 36.0770], [-112.1448, 36.0840], [-112.1450, 36.0900],
      [-112.1448, 36.0960], [-112.1445, 36.0990],
    ],
  },
  {
    id: 'bryce-fairyland',
    name: 'Fairyland Loop',
    park: 'Bryce Canyon National Park',
    region: 'Southwest',
    state: 'UT',
    lat: 37.6428, lng: -112.1572,
    difficulty: 'moderate',
    condition: 'dry',
    distance_km: 13,
    elevation_gain_m: 720,
    highest_point_m: 2642,
    surface: 'Dirt / Hoodoo',
    best_season: 'May–Oct',
    type: 'loop',
    description: 'Wind through a forest of hoodoos in Bryce\'s most serene and least-crowded section.',
    weekDays: ['DRY', 'DRY', 'DRY', 'DRY', 'DRY'],
    path: [
      [-112.1572, 37.6428], [-112.1540, 37.6460], [-112.1510, 37.6490],
      [-112.1480, 37.6510], [-112.1460, 37.6530], [-112.1480, 37.6555],
      [-112.1510, 37.6570], [-112.1545, 37.6565], [-112.1570, 37.6545],
      [-112.1572, 37.6428],
    ],
  },
  {
    id: 'the-wave',
    name: 'The Wave',
    park: 'Vermilion Cliffs National Monument',
    region: 'Southwest',
    state: 'AZ',
    lat: 36.9959, lng: -112.0058,
    difficulty: 'moderate',
    condition: 'dry',
    distance_km: 10,
    elevation_gain_m: 180,
    highest_point_m: 1619,
    surface: 'Slickrock / Sand',
    best_season: 'Oct–Apr',
    type: 'out-and-back',
    description: 'Lottery-only access to surreal Jurassic sandstone wave formations. Only 64 permits per day.',
    weekDays: ['DRY', 'DRY', 'DRY', 'DRY', 'DRY'],
    path: [
      [-112.0058, 36.9959], [-112.0080, 36.9980], [-112.0100, 36.9995],
      [-112.0115, 37.0010], [-112.0125, 37.0025], [-112.0130, 37.0035],
    ],
  },
  {
    id: 'canyon-overlook',
    name: 'Canyon Overlook Trail',
    park: 'Zion National Park',
    region: 'Southwest',
    state: 'UT',
    lat: 37.2126, lng: -112.9442,
    difficulty: 'easy',
    condition: 'dry',
    distance_km: 3,
    elevation_gain_m: 100,
    highest_point_m: 1506,
    surface: 'Rock / Ledge',
    best_season: 'Year-round',
    type: 'out-and-back',
    description: 'Short but spectacular — a narrow ledge trail above Pine Creek Canyon with big canyon views.',
    weekDays: ['DRY', 'DRY', 'DRY', 'DRY', 'DRY'],
    path: [
      [-112.9442, 37.2126], [-112.9460, 37.2140], [-112.9475, 37.2150],
      [-112.9488, 37.2158],
    ],
  },

  // ── Rockies ────────────────────────────────────────────────────────────────
  {
    id: 'longs-peak',
    name: 'Longs Peak',
    park: 'Rocky Mountain National Park',
    region: 'Rockies',
    state: 'CO',
    lat: 40.2549, lng: -105.6153,
    difficulty: 'expert',
    condition: 'snow',
    distance_km: 24,
    elevation_gain_m: 1680,
    highest_point_m: 4346,
    surface: 'Rock / Boulder',
    best_season: 'Jul–Sep',
    type: 'out-and-back',
    description: 'Colorado\'s northernmost 14er. Boulderfield approach gives way to an exposed keyhole scramble to the summit.',
    weekDays: ['SNOW', 'DRY', 'DRY', 'DRY', 'DRY'],
    path: [
      [-105.6153, 40.2549], [-105.6160, 40.2590], [-105.6155, 40.2640],
      [-105.6145, 40.2690], [-105.6140, 40.2740], [-105.6142, 40.2790],
      [-105.6148, 40.2840], [-105.6155, 40.2883],
    ],
  },
  {
    id: 'bear-lake',
    name: 'Bear Lake Loop',
    park: 'Rocky Mountain National Park',
    region: 'Rockies',
    state: 'CO',
    lat: 40.3128, lng: -105.6453,
    difficulty: 'easy',
    condition: 'snow',
    distance_km: 5,
    elevation_gain_m: 45,
    highest_point_m: 2895,
    surface: 'Paved / Dirt',
    best_season: 'Year-round',
    type: 'loop',
    description: 'Accessible paved loop around an alpine lake with stunning views of Hallett Peak and Flattop Mountain.',
    weekDays: ['SNOW', 'SNOW', 'DRY', 'DRY', 'DRY'],
    path: [
      [-105.6453, 40.3128], [-105.6440, 40.3140], [-105.6430, 40.3150],
      [-105.6420, 40.3145], [-105.6415, 40.3135], [-105.6425, 40.3120],
      [-105.6440, 40.3115], [-105.6453, 40.3128],
    ],
  },
  {
    id: 'maroon-bells',
    name: 'Maroon Bells Four Pass Loop',
    park: 'White River National Forest',
    region: 'Rockies',
    state: 'CO',
    lat: 39.0711, lng: -106.9392,
    difficulty: 'expert',
    condition: 'snow',
    distance_km: 69,
    elevation_gain_m: 2770,
    highest_point_m: 3938,
    surface: 'Alpine / Rock',
    best_season: 'Jul–Sep',
    type: 'loop',
    description: 'Four high passes above 12,000ft in the Elk Mountains. Colorado\'s most iconic multi-day loop.',
    weekDays: ['SNOW', 'DRY', 'DRY', 'DRY', 'DRY'],
    path: [
      [-106.9392, 39.0711], [-106.9500, 39.0600], [-106.9600, 39.0500],
      [-106.9700, 39.0600], [-106.9750, 39.0700], [-106.9700, 39.0800],
      [-106.9600, 39.0900], [-106.9500, 39.0850], [-106.9392, 39.0711],
    ],
  },
  {
    id: 'grinnell-glacier',
    name: 'Grinnell Glacier',
    park: 'Glacier National Park',
    region: 'Rockies',
    state: 'MT',
    lat: 48.7596, lng: -113.7178,
    difficulty: 'hard',
    condition: 'snow',
    distance_km: 19,
    elevation_gain_m: 780,
    highest_point_m: 1940,
    surface: 'Dirt / Rock',
    best_season: 'Jul–Sep',
    type: 'out-and-back',
    description: 'Trek past turquoise glacial lakes to one of Glacier\'s most accessible remaining glaciers.',
    weekDays: ['SNOW', 'SNOW', 'DRY', 'DRY', 'DRY'],
    path: [
      [-113.7178, 48.7596], [-113.7200, 48.7630], [-113.7215, 48.7660],
      [-113.7220, 48.7695], [-113.7215, 48.7725], [-113.7210, 48.7755],
      [-113.7205, 48.7785], [-113.7200, 48.7810],
    ],
  },
  {
    id: 'hidden-lake-mt',
    name: 'Hidden Lake Overlook',
    park: 'Glacier National Park',
    region: 'Rockies',
    state: 'MT',
    lat: 48.6973, lng: -113.7180,
    difficulty: 'moderate',
    condition: 'snow',
    distance_km: 8,
    elevation_gain_m: 410,
    highest_point_m: 2070,
    surface: 'Boardwalk / Rock',
    best_season: 'Jul–Sep',
    type: 'out-and-back',
    description: 'From Logan Pass to a stunning overlook above Hidden Lake, with frequent mountain goat sightings.',
    weekDays: ['SNOW', 'DRY', 'DRY', 'DRY', 'DRY'],
    path: [
      [-113.7180, 48.6973], [-113.7190, 48.6940], [-113.7200, 48.6910],
      [-113.7210, 48.6880], [-113.7215, 48.6850],
    ],
  },
  {
    id: 'highline-mt',
    name: 'Highline Trail',
    park: 'Glacier National Park',
    region: 'Rockies',
    state: 'MT',
    lat: 48.6962, lng: -113.7176,
    difficulty: 'hard',
    condition: 'snow',
    distance_km: 27,
    elevation_gain_m: 450,
    highest_point_m: 2335,
    surface: 'Rock / Ledge',
    best_season: 'Jul–Sep',
    type: 'point-to-point',
    description: 'Traverse along the Continental Divide on a dramatic ledge trail. Goat Haunt shuttle connects the endpoints.',
    weekDays: ['SNOW', 'DRY', 'DRY', 'DRY', 'DRY'],
    path: [
      [-113.7176, 48.6962], [-113.7000, 48.7100], [-113.6800, 48.7250],
      [-113.6600, 48.7400], [-113.6400, 48.7550], [-113.6200, 48.7700],
      [-113.6050, 48.7900],
    ],
  },
  {
    id: 'teton-crest',
    name: 'Teton Crest Trail',
    park: 'Grand Teton National Park',
    region: 'Rockies',
    state: 'WY',
    lat: 43.7904, lng: -110.6818,
    difficulty: 'expert',
    condition: 'snow',
    distance_km: 80,
    elevation_gain_m: 3500,
    highest_point_m: 3836,
    surface: 'Alpine / Rock',
    best_season: 'Jul–Sep',
    type: 'point-to-point',
    description: 'A bucket-list multi-day route along the spine of the Tetons with unrivaled mountain scenery.',
    weekDays: ['SNOW', 'DRY', 'DRY', 'DRY', 'DRY'],
    path: [
      [-110.6818, 43.7904], [-110.7000, 43.7700], [-110.7150, 43.7500],
      [-110.7200, 43.7300], [-110.7150, 43.7100], [-110.7000, 43.6900],
      [-110.6800, 43.6700], [-110.6600, 43.6500],
    ],
  },
  {
    id: 'cascade-canyon',
    name: 'Cascade Canyon',
    park: 'Grand Teton National Park',
    region: 'Rockies',
    state: 'WY',
    lat: 43.7490, lng: -110.7199,
    difficulty: 'moderate',
    condition: 'dry',
    distance_km: 21,
    elevation_gain_m: 390,
    highest_point_m: 2134,
    surface: 'Dirt / Rock',
    best_season: 'Jun–Oct',
    type: 'out-and-back',
    description: 'Classic Teton canyon hike with jaw-dropping views of Grand Teton\'s sheer north face the whole way.',
    weekDays: ['DRY', 'DRY', 'DRY', 'DRY', 'DRY'],
    path: [
      [-110.7199, 43.7490], [-110.7300, 43.7450], [-110.7400, 43.7410],
      [-110.7500, 43.7380], [-110.7600, 43.7360], [-110.7700, 43.7350],
      [-110.7800, 43.7345],
    ],
  },

  // ── Southeast ──────────────────────────────────────────────────────────────
  {
    id: 'at-springer',
    name: 'AT Springer Mountain',
    park: 'Chattahoochee National Forest',
    region: 'Southeast',
    state: 'GA',
    lat: 34.6274, lng: -84.1937,
    difficulty: 'moderate',
    condition: 'dry',
    distance_km: 8,
    elevation_gain_m: 295,
    highest_point_m: 1160,
    surface: 'Dirt / Root',
    best_season: 'Mar–May',
    type: 'out-and-back',
    description: 'Southern terminus of the Appalachian Trail. Touch the bronze plaque that marks the start of 3,500 km to Maine.',
    weekDays: ['DRY', 'DRY', 'WET', 'WET', 'DRY'],
    path: [
      [-84.1937, 34.6274], [-84.1940, 34.6310], [-84.1942, 34.6345],
      [-84.1940, 34.6380], [-84.1935, 34.6415],
    ],
  },
  {
    id: 'alum-cave',
    name: 'Alum Cave to Mt LeConte',
    park: 'Great Smoky Mountains National Park',
    region: 'Southeast',
    state: 'TN',
    lat: 35.6320, lng: -83.4537,
    difficulty: 'hard',
    condition: 'wet',
    distance_km: 18,
    elevation_gain_m: 940,
    highest_point_m: 2010,
    surface: 'Root / Rock',
    best_season: 'Apr–Nov',
    type: 'out-and-back',
    description: 'Smokies\' most dramatic trail. Pass through old-growth forest and an arching bluff to LeConte Lodge summit.',
    weekDays: ['WET', 'WET', 'DRY', 'DRY', 'WET'],
    path: [
      [-83.4537, 35.6320], [-83.4520, 35.6360], [-83.4510, 35.6400],
      [-83.4505, 35.6440], [-83.4500, 35.6480], [-83.4495, 35.6520],
      [-83.4490, 35.6560], [-83.4483, 35.6601],
    ],
  },
  {
    id: 'black-rock-mountain',
    name: 'Black Rock Mountain Loop',
    park: 'Black Rock Mountain State Park',
    region: 'Southeast',
    state: 'GA',
    lat: 34.9159, lng: -83.4143,
    difficulty: 'moderate',
    condition: 'dry',
    distance_km: 11,
    elevation_gain_m: 330,
    highest_point_m: 1104,
    surface: 'Dirt / Rock',
    best_season: 'Year-round',
    type: 'loop',
    description: 'Summit Georgia\'s highest state park with panoramic Blue Ridge views on this rewarding loop.',
    weekDays: ['DRY', 'DRY', 'DRY', 'WET', 'DRY'],
    path: [
      [-83.4143, 34.9159], [-83.4160, 34.9180], [-83.4170, 34.9205],
      [-83.4165, 34.9230], [-83.4150, 34.9250], [-83.4130, 34.9260],
      [-83.4110, 34.9250], [-83.4105, 34.9230], [-83.4115, 34.9205],
      [-83.4130, 34.9185], [-83.4143, 34.9159],
    ],
  },

  // ── Northeast ──────────────────────────────────────────────────────────────
  {
    id: 'presidential-traverse',
    name: 'Presidential Traverse',
    park: 'White Mountain National Forest',
    region: 'Northeast',
    state: 'NH',
    lat: 44.2706, lng: -71.3033,
    difficulty: 'expert',
    condition: 'icy',
    distance_km: 32,
    elevation_gain_m: 2700,
    highest_point_m: 1917,
    surface: 'Rock / Exposed Ridge',
    best_season: 'Jun–Sep',
    type: 'point-to-point',
    description: 'New England\'s legendary ridge traverse over Mounts Jefferson, Adams, and Washington — home of the world\'s worst weather.',
    weekDays: ['ICY', 'DRY', 'DRY', 'DRY', 'WET'],
    path: [
      [-71.3033, 44.2706], [-71.3050, 44.2760], [-71.3070, 44.2820],
      [-71.3080, 44.2880], [-71.3085, 44.2930], [-71.3090, 44.2980],
      [-71.3090, 44.3030], [-71.3085, 44.3080], [-71.3082, 44.3103],
    ],
  },
  {
    id: 'katahdin',
    name: 'Mount Katahdin',
    park: 'Baxter State Park',
    region: 'Northeast',
    state: 'ME',
    lat: 45.9044, lng: -68.9213,
    difficulty: 'hard',
    condition: 'dry',
    distance_km: 20,
    elevation_gain_m: 1430,
    highest_point_m: 1606,
    surface: 'Rock / Boulder',
    best_season: 'Jun–Oct',
    type: 'out-and-back',
    description: 'The northern terminus of the Appalachian Trail, with a thrilling knife-edge ridge to the summit.',
    weekDays: ['DRY', 'DRY', 'WET', 'DRY', 'DRY'],
    path: [
      [-68.9213, 45.9044], [-68.9220, 45.9090], [-68.9215, 45.9140],
      [-68.9205, 45.9190], [-68.9200, 45.9240], [-68.9205, 45.9290],
      [-68.9215, 45.9330], [-68.9221, 45.9360],
    ],
  },
  {
    id: 'acadia-mountain',
    name: 'Acadia Mountain Loop',
    park: 'Acadia National Park',
    region: 'Northeast',
    state: 'ME',
    lat: 44.3213, lng: -68.3503,
    difficulty: 'moderate',
    condition: 'dry',
    distance_km: 5,
    elevation_gain_m: 180,
    highest_point_m: 155,
    surface: 'Rock / Granite',
    best_season: 'Year-round',
    type: 'loop',
    description: 'Best views in Acadia of Somes Sound and the Cranberry Isles from this compact granite summit loop.',
    weekDays: ['DRY', 'WET', 'DRY', 'DRY', 'WET'],
    path: [
      [-68.3503, 44.3213], [-68.3510, 44.3230], [-68.3515, 44.3248],
      [-68.3510, 44.3265], [-68.3495, 44.3270], [-68.3480, 44.3260],
      [-68.3478, 44.3240], [-68.3490, 44.3220], [-68.3503, 44.3213],
    ],
  },
  {
    id: 'franconia-ridge',
    name: 'Franconia Ridge Loop',
    park: 'White Mountain National Forest',
    region: 'Northeast',
    state: 'NH',
    lat: 44.1381, lng: -71.6839,
    difficulty: 'hard',
    condition: 'icy',
    distance_km: 13,
    elevation_gain_m: 940,
    highest_point_m: 1717,
    surface: 'Rock / Exposed Ridge',
    best_season: 'Jun–Oct',
    type: 'loop',
    description: 'The Northeast\'s finest ridge walk — above treeline along a dramatic knife-edge connecting three peaks.',
    weekDays: ['ICY', 'DRY', 'DRY', 'DRY', 'WET'],
    path: [
      [-71.6839, 44.1381], [-71.6820, 44.1420], [-71.6810, 44.1460],
      [-71.6815, 44.1500], [-71.6820, 44.1540], [-71.6830, 44.1570],
      [-71.6845, 44.1545], [-71.6850, 44.1510], [-71.6848, 44.1470],
      [-71.6845, 44.1430], [-71.6839, 44.1381],
    ],
  },

  // ── California Coast ───────────────────────────────────────────────────────
  {
    id: 'dipsea-trail',
    name: 'Dipsea Trail',
    park: 'Mt Tamalpais State Park',
    region: 'California Coast',
    state: 'CA',
    lat: 37.8977, lng: -122.6033,
    difficulty: 'moderate',
    condition: 'dry',
    distance_km: 19,
    elevation_gain_m: 760,
    highest_point_m: 784,
    surface: 'Dirt / Root / Steps',
    best_season: 'Oct–Apr',
    type: 'point-to-point',
    description: 'America\'s oldest trail race route. Old-growth redwood canyons give way to Stinson Beach sea views.',
    weekDays: ['DRY', 'DRY', 'WET', 'WET', 'DRY'],
    path: [
      [-122.6033, 37.8977], [-122.6060, 37.9000], [-122.6090, 37.9030],
      [-122.6120, 37.9060], [-122.6150, 37.9090], [-122.6180, 37.9110],
      [-122.6210, 37.9125], [-122.6240, 37.9135], [-122.6270, 37.9100],
      [-122.6290, 37.9060], [-122.6295, 37.9020],
    ],
  },
  {
    id: 'lost-coast',
    name: 'Lost Coast Trail',
    park: 'King Range National Conservation Area',
    region: 'California Coast',
    state: 'CA',
    lat: 40.4178, lng: -124.0741,
    difficulty: 'hard',
    condition: 'wet',
    distance_km: 42,
    elevation_gain_m: 1200,
    highest_point_m: 400,
    surface: 'Beach / Rock',
    best_season: 'Apr–Oct',
    type: 'point-to-point',
    description: 'Remote coastal wilderness where the King Range drops directly into the Pacific. Tide tables are essential.',
    weekDays: ['WET', 'WET', 'DRY', 'DRY', 'DRY'],
    path: [
      [-124.0741, 40.4178], [-124.0770, 40.4050], [-124.0790, 40.3920],
      [-124.0810, 40.3790], [-124.0820, 40.3660], [-124.0815, 40.3530],
      [-124.0800, 40.3400], [-124.0785, 40.3270], [-124.0770, 40.3140],
    ],
  },
]

// ─── Condition → uppercase key mapping ─────────────────────────────────────────

function condKey(c: Trail['condition']): TrailConditionKey {
  const map: Record<Trail['condition'], TrailConditionKey> = {
    dry: 'DRY', wet: 'WET', muddy: 'MUDDY', snow: 'SNOW', closed: 'CLOSED', icy: 'ICY',
  }
  return map[c]
}

function diffKey(d: Trail['difficulty']): DifficultyKey {
  const map: Record<Trail['difficulty'], DifficultyKey> = {
    easy: 'EASY', moderate: 'MODERATE', hard: 'HARD', expert: 'EXPERT',
  }
  return map[d]
}

// ─── Community Reports ─────────────────────────────────────────────────────────

const COMMUNITY_REPORTS = [
  {
    id: 'r1',
    text: 'Summit was clear until noon, then clouds rolled in. Trail dry all the way up.',
    author: 'TrailRunner92',
    trail: 'Half Dome',
    age: '2 days ago',
    likes: 14,
    initials: 'TR',
    avatarColor: '#10B981',
  },
  {
    id: 'r2',
    text: 'Narrows thigh-deep on Wednesday. Cold but doable with a wetsuit.',
    author: 'CanyonWader',
    trail: 'Zion Narrows',
    age: '3 days ago',
    likes: 8,
    initials: 'CW',
    avatarColor: '#3B82F6',
  },
  {
    id: 'r3',
    text: 'Fresh 6″ of snow above 8,000ft. Microspikes essential from the saddle.',
    author: 'SierraHiker',
    trail: 'Mount Whitney',
    age: '1 week ago',
    likes: 22,
    initials: 'SH',
    avatarColor: '#8B5CF6',
  },
  {
    id: 'r4',
    text: 'Presidential Traverse was icy on the ridge. Full crampons required above treeline.',
    author: 'NHSummiteer',
    trail: 'Presidential Traverse',
    age: '4 days ago',
    likes: 31,
    initials: 'NS',
    avatarColor: '#F59E0B',
  },
  {
    id: 'r5',
    text: 'Grinnell Glacier approach was muddy but the turquoise lake views were worth every step.',
    author: 'MontanaWanderer',
    trail: 'Grinnell Glacier',
    age: '5 days ago',
    likes: 17,
    initials: 'MW',
    avatarColor: '#0EA5E9',
  },
]

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEK_FORECAST = [
  { cond: '☀️', tempLow: 44, tempHigh: 63, rain: 5,  hike: true  },
  { cond: '⛅', tempLow: 46, tempHigh: 61, rain: 15, hike: true  },
  { cond: '🌧', tempLow: 48, tempHigh: 55, rain: 75, hike: false },
  { cond: '🌧', tempLow: 47, tempHigh: 54, rain: 80, hike: false },
  { cond: '☀️', tempLow: 43, tempHigh: 62, rain: 10, hike: true  },
  { cond: '☀️', tempLow: 45, tempHigh: 67, rain: 5,  hike: true  },
  { cond: '⛅', tempLow: 47, tempHigh: 64, rain: 20, hike: true  },
]

// ─── Condition config ──────────────────────────────────────────────────────────

const COND_CONFIG: Record<TrailConditionKey, { color: string; bg: string; border: string; label: string }> = {
  DRY:    { color: '#059669', bg: 'rgba(5,150,105,0.10)',   border: 'rgba(5,150,105,0.3)',   label: 'DRY ✓'  },
  WET:    { color: '#2563EB', bg: 'rgba(37,99,235,0.10)',   border: 'rgba(37,99,235,0.3)',   label: 'WET'     },
  MUDDY:  { color: '#B45309', bg: 'rgba(180,83,9,0.10)',    border: 'rgba(180,83,9,0.3)',    label: 'MUDDY'   },
  SNOW:   { color: '#7C3AED', bg: 'rgba(124,58,237,0.10)',  border: 'rgba(124,58,237,0.3)',  label: 'SNOW'    },
  CLOSED: { color: '#DC2626', bg: 'rgba(220,38,38,0.10)',   border: 'rgba(220,38,38,0.3)',   label: 'CLOSED'  },
  ICY:    { color: '#0891B2', bg: 'rgba(8,145,178,0.10)',   border: 'rgba(8,145,178,0.3)',   label: 'ICY'     },
}

const DIFF_CONFIG: Record<DifficultyKey, { color: string; bg: string; border: string }> = {
  EASY:     { color: '#059669', bg: 'rgba(5,150,105,0.10)',  border: 'rgba(5,150,105,0.25)'  },
  MODERATE: { color: '#B45309', bg: 'rgba(180,83,9,0.10)',   border: 'rgba(180,83,9,0.25)'  },
  HARD:     { color: '#C2410C', bg: 'rgba(194,65,12,0.10)',  border: 'rgba(194,65,12,0.25)'  },
  EXPERT:   { color: '#DC2626', bg: 'rgba(220,38,38,0.10)',  border: 'rgba(220,38,38,0.25)'  },
}

// Path color by condition
function pathColor(cond: Trail['condition']): string {
  const map: Record<Trail['condition'], string> = {
    dry: '#059669', wet: '#2563EB', muddy: '#B45309', snow: '#7C3AED', closed: '#DC2626', icy: '#0891B2',
  }
  return map[cond]
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function CondPill({ cond }: { cond: TrailConditionKey }) {
  const c = COND_CONFIG[cond]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontFamily: 'var(--font-data)', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
      color: c.color, background: c.bg, border: `1px solid ${c.border}`,
      padding: '2px 8px', borderRadius: 20,
    }}>{c.label}</span>
  )
}

function DiffBadge({ diff }: { diff: DifficultyKey }) {
  const c = DIFF_CONFIG[diff]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontFamily: 'var(--font-data)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
      color: c.color, background: c.bg, border: `1px solid ${c.border}`,
      padding: '2px 7px', borderRadius: 20,
    }}>{diff.toUpperCase()}</span>
  )
}

// ─── TrailCard ─────────────────────────────────────────────────────────────────

function TrailCard({
  trail,
  selected,
  onSelect,
  onViewMap,
}: {
  trail: Trail
  selected: boolean
  onSelect: () => void
  onViewMap: () => void
}) {
  const ck = condKey(trail.condition)
  const dk = diffKey(trail.difficulty)

  return (
    <div
      className="glass-card"
      onClick={onSelect}
      style={{
        padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12,
        cursor: 'pointer',
        border: selected
          ? '1px solid rgba(5,150,105,0.55)'
          : '1px solid var(--tile-border)',
        boxShadow: selected
          ? '0 0 0 2px rgba(5,150,105,0.18), var(--tile-shadow)'
          : undefined,
        transition: 'border 0.15s, box-shadow 0.15s',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800,
            color: 'var(--foam)', letterSpacing: '-0.02em', lineHeight: 1.2,
          }}>
            {trail.name}
          </div>
          <div style={{ fontFamily: 'var(--font-data)', fontSize: 9, color: 'var(--spray)', letterSpacing: '0.08em', marginTop: 3, textTransform: 'uppercase' }}>
            {trail.park} · {trail.state}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginTop: 2 }}>
          <DiffBadge diff={dk} />
          <CondPill cond={ck} />
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'DISTANCE', value: `${trail.distance_km} km` },
          { label: 'GAIN',     value: `${trail.elevation_gain_m.toLocaleString()} m` },
          { label: 'HIGHEST',  value: `${trail.highest_point_m.toLocaleString()} m` },
          { label: 'TYPE',     value: trail.type.replace(/-/g, ' ') },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontFamily: 'var(--font-data)', fontSize: 8, color: 'var(--spray)', letterSpacing: '0.1em' }}>{label}</span>
            <span style={{ fontFamily: 'var(--font-data)', fontSize: 12, fontWeight: 700, color: 'var(--foam)', lineHeight: 1, textTransform: 'capitalize' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Surface + season */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: 'var(--font-data)', fontSize: 9, color: 'var(--spray)',
          background: 'var(--paper-sunken)', border: '1px solid var(--tile-border)',
          padding: '2px 8px', borderRadius: 20, letterSpacing: '0.04em',
        }}>
          {trail.surface}
        </span>
        <span style={{
          fontFamily: 'var(--font-data)', fontSize: 9, color: 'var(--spray)',
          letterSpacing: '0.04em',
        }}>
          Best: {trail.best_season}
        </span>
      </div>

      {/* Description */}
      <p style={{
        fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--mist)',
        lineHeight: 1.6, margin: 0,
      }}>
        {trail.description}
      </p>

      {/* Week conditions bar */}
      <div>
        <div style={{ fontFamily: 'var(--font-data)', fontSize: 8, color: 'var(--spray)', letterSpacing: '0.1em', marginBottom: 6, textTransform: 'uppercase' }}>
          This Week
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const).map((day, i) => {
            const dc = COND_CONFIG[trail.weekDays[i]]
            return (
              <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div style={{
                  height: 28, width: '100%', borderRadius: 6,
                  background: dc.bg, border: `1px solid ${dc.border}`,
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    height: '60%', background: `linear-gradient(0deg, ${dc.color}30, transparent)`,
                  }} />
                </div>
                <span style={{ fontFamily: 'var(--font-data)', fontSize: 8, color: 'var(--spray)', letterSpacing: '0.04em' }}>{day}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* View on Map button */}
      <button
        onClick={(e) => { e.stopPropagation(); onViewMap() }}
        style={{
          alignSelf: 'flex-start',
          fontFamily: 'var(--font-data)', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
          color: selected ? 'var(--trail-bright)' : 'var(--spray)',
          background: selected ? 'var(--trail-muted)' : 'var(--paper-sunken)',
          border: `1px solid ${selected ? 'rgba(5,150,105,0.3)' : 'var(--tile-border-strong)'}`,
          padding: '5px 14px', borderRadius: 20, cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        {selected ? '✓ Shown on Map' : 'View on Map'}
      </button>
    </div>
  )
}

// ─── Trail Map ─────────────────────────────────────────────────────────────────

function TrailsMap({
  trails,
  selectedTrailId,
  onTrailSelect,
}: {
  trails: Trail[]
  selectedTrailId: string | null
  onTrailSelect: (id: string) => void
}) {
  const containerRef   = useRef<HTMLDivElement>(null)
  const mapRef         = useRef<import('leaflet').Map | null>(null)
  const pathLayerRef   = useRef<import('leaflet').Polyline | null>(null)
  const pathBgLayerRef = useRef<import('leaflet').Polyline | null>(null)

  // Initial map setup
  useEffect(() => {
    if (!containerRef.current) return

    import('leaflet').then(({ default: L }) => {
      if (!containerRef.current || mapRef.current) return

      const map = L.map(containerRef.current, {
        center: [40, -110],
        zoom: 4.5,
        zoomControl: false,
        attributionControl: false,
      })
      mapRef.current = map

      L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        subdomains: ['a', 'b', 'c'],
        maxZoom: 17,
        attribution: '© OpenTopoMap contributors',
      }).addTo(map)

      trails.forEach(trail => {
        const ck = condKey(trail.condition)
        const condC = COND_CONFIG[ck]

        const el = document.createElement('div')
        el.style.cssText = `
          width: 14px; height: 14px; border-radius: 50%;
          background: ${condC.color};
          border: 2px solid #fff;
          box-shadow: 0 0 8px ${condC.color}, 0 2px 6px rgba(0,0,0,0.5);
          cursor: pointer;
          transition: transform 0.15s;
        `
        el.title = trail.name
        el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.5)' })
        el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)' })

        const icon = L.divIcon({ html: el, className: '', iconSize: [14, 14], iconAnchor: [7, 7] })
        const marker = L.marker([trail.lat, trail.lng], { icon }).addTo(map)
        marker.on('click', () => onTrailSelect(trail.id))
      })
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Trail path overlay
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Remove existing path layers
    if (pathBgLayerRef.current) { map.removeLayer(pathBgLayerRef.current); pathBgLayerRef.current = null }
    if (pathLayerRef.current)   { map.removeLayer(pathLayerRef.current);   pathLayerRef.current = null }

    if (!selectedTrailId) return

    const trail = TRAILS.find(t => t.id === selectedTrailId)
    if (!trail || trail.path.length < 2) return

    import('leaflet').then(({ default: L }) => {
      if (!mapRef.current) return
      const m = mapRef.current

      // path is stored as [lng, lat] — flip to Leaflet's [lat, lng]
      const latlngs = trail.path.map((p: number[]) => [p[1], p[0]] as [number, number])

      pathBgLayerRef.current = L.polyline(latlngs, {
        color: '#000', weight: 6, opacity: 0.4,
      }).addTo(m)

      const color = pathColor(trail.condition)
      pathLayerRef.current = L.polyline(latlngs, {
        color, weight: 3, opacity: 0.9, dashArray: '6 4',
      }).addTo(m)

      // Fit bounds
      const bounds = L.latLngBounds(latlngs)
      m.fitBounds(bounds, { padding: [60, 60], animate: true, duration: 1 })
    })
  }, [selectedTrailId])

  return (
    <div
      ref={containerRef}
      className="glass-card"
      style={{ height: 480, borderRadius: 12, overflow: 'hidden' }}
    />
  )
}

// ─── Weekly Forecast ──────────────────────────────────────────────────────────

function WeeklyForecast() {
  return (
    <div className="glass-card" style={{ padding: '20px 24px' }}>
      <h3 style={{
        fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em',
        color: 'var(--foam)', margin: '0 0 16px 0', textTransform: 'uppercase',
      }}>
        7-Day Hiking Windows
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {WEEK_DAYS.map((day, i) => {
          const f = WEEK_FORECAST[i]
          return (
            <div key={day} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: '10px 4px', borderRadius: 10,
              background: f.hike ? 'rgba(5,150,105,0.06)' : 'rgba(220,38,38,0.04)',
              border: `1px solid ${f.hike ? 'rgba(5,150,105,0.15)' : 'rgba(220,38,38,0.1)'}`,
            }}>
              <span style={{ fontFamily: 'var(--font-data)', fontSize: 9, color: 'var(--spray)', letterSpacing: '0.06em' }}>{day}</span>
              <span style={{ fontSize: 18 }}>{f.cond}</span>
              <span style={{ fontFamily: 'var(--font-data)', fontSize: 9, color: 'var(--mist)', letterSpacing: '0.02em' }}>
                {f.tempLow}–{f.tempHigh}°F
              </span>
              <span style={{ fontFamily: 'var(--font-data)', fontSize: 9, color: f.rain > 50 ? '#2563EB' : 'var(--spray)', letterSpacing: '0.02em' }}>
                {f.rain}%
              </span>
              <span style={{
                fontFamily: 'var(--font-data)', fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
                color: f.hike ? '#059669' : '#DC2626',
                background: f.hike ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.1)',
                border: `1px solid ${f.hike ? 'rgba(5,150,105,0.2)' : 'rgba(220,38,38,0.15)'}`,
                padding: '2px 6px', borderRadius: 20,
              }}>
                {f.hike ? 'HIKE ✓' : 'AVOID'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Conditions Table ─────────────────────────────────────────────────────────

function ConditionsTable({ trails }: { trails: Trail[] }) {
  return (
    <div className="glass-card" style={{ padding: '20px 24px', overflowX: 'auto' }}>
      <h3 style={{
        fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em',
        color: 'var(--foam)', margin: '0 0 14px 0', textTransform: 'uppercase',
      }}>
        Trail Conditions Summary
      </h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Trail', 'Park', 'Region', 'Difficulty', 'Condition', 'Access'].map(col => (
              <th key={col} style={{
                fontFamily: 'var(--font-data)', fontSize: 9, color: 'var(--spray)',
                letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'left',
                padding: '6px 12px', borderBottom: '1px solid var(--tile-border)',
              }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trails.map((trail, idx) => {
            const ck = condKey(trail.condition)
            const dk = diffKey(trail.difficulty)
            const condC = COND_CONFIG[ck]
            const diffC = DIFF_CONFIG[dk]
            return (
              <tr key={trail.id} style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--paper-sunken)' }}>
                <td style={{ padding: '8px 12px', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: 'var(--foam)', whiteSpace: 'nowrap' }}>
                  {trail.name}
                </td>
                <td style={{ padding: '8px 12px', fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--mist)', whiteSpace: 'nowrap', maxWidth: 180 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                    {trail.park}
                  </span>
                </td>
                <td style={{ padding: '8px 12px', fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--spray)', whiteSpace: 'nowrap' }}>
                  {trail.region}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{
                    display: 'inline-block',
                    fontFamily: 'var(--font-data)', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                    color: diffC.color, background: diffC.bg, border: `1px solid ${diffC.border}`,
                    padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase',
                  }}>
                    {trail.difficulty}
                  </span>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{
                    display: 'inline-block',
                    fontFamily: 'var(--font-data)', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                    color: condC.color, background: condC.bg, border: `1px solid ${condC.border}`,
                    padding: '2px 8px', borderRadius: 20,
                  }}>
                    {condC.label}
                  </span>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{
                    display: 'inline-block',
                    fontFamily: 'var(--font-data)', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                    color: trail.condition === 'closed' ? '#DC2626' : '#059669',
                    background: trail.condition === 'closed' ? 'rgba(220,38,38,0.1)' : 'rgba(5,150,105,0.1)',
                    border: `1px solid ${trail.condition === 'closed' ? 'rgba(220,38,38,0.2)' : 'rgba(5,150,105,0.2)'}`,
                    padding: '2px 8px', borderRadius: 20,
                  }}>
                    {trail.condition === 'closed' ? 'CLOSED' : 'OPEN'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Community Reports ────────────────────────────────────────────────────────

function CommunityReports() {
  return (
    <div>
      <h3 style={{
        fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em',
        color: 'var(--foam)', margin: '0 0 14px 0', textTransform: 'uppercase',
      }}>
        Community Reports
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {COMMUNITY_REPORTS.map(report => (
          <div key={report.id} className="glass-card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: report.avatarColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 900,
                color: '#fff', letterSpacing: '0.02em',
              }}>
                {report.initials}
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: 'var(--foam)' }}>
                  {report.author}
                </div>
                <div style={{ fontFamily: 'var(--font-data)', fontSize: 9, color: 'var(--spray)', letterSpacing: '0.04em' }}>
                  {report.trail} · {report.age}
                </div>
              </div>
            </div>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--mist)',
              lineHeight: 1.65, margin: 0, borderLeft: `2px solid ${report.avatarColor}40`,
              paddingLeft: 10,
            }}>
              {report.text}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'var(--paper-sunken)', border: '1px solid var(--tile-border)',
                borderRadius: 20, padding: '3px 10px', cursor: 'pointer',
                fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--spray)',
              }}>
                👍 {report.likes}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Region tabs config ────────────────────────────────────────────────────────

type RegionFilterKey = 'all' | 'sierra' | 'pacificnw' | 'southwest' | 'rockies' | 'southeast' | 'northeast' | 'cacoast'

const REGION_TO_KEY: Record<RegionKey, RegionFilterKey> = {
  'Sierra Nevada':     'sierra',
  'Pacific NW':        'pacificnw',
  'Southwest':         'southwest',
  'Rockies':           'rockies',
  'Southeast':         'southeast',
  'Northeast':         'northeast',
  'California Coast':  'cacoast',
}

const REGION_TABS: { key: RegionFilterKey; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'sierra',    label: 'Sierra Nevada' },
  { key: 'pacificnw', label: 'Pacific NW' },
  { key: 'southwest', label: 'Southwest' },
  { key: 'rockies',   label: 'Rockies' },
  { key: 'southeast', label: 'Southeast' },
  { key: 'northeast', label: 'Northeast' },
  { key: 'cacoast',   label: 'California Coast' },
]

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function TrailsPageClient() {
  const [activeRegion, setActiveRegion] = useState<RegionFilterKey>('all')
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null)
  const mapSectionRef = useRef<HTMLDivElement>(null)

  const filteredTrails = activeRegion === 'all'
    ? TRAILS
    : TRAILS.filter(t => REGION_TO_KEY[t.region] === activeRegion)

  const openCount  = TRAILS.filter(t => t.condition !== 'closed').length
  const bestCount  = TRAILS.filter(t => t.condition === 'dry').length
  const alertCount = 2

  const handleTrailSelect = useCallback((id: string) => {
    setSelectedTrailId(prev => prev === id ? null : id)
  }, [])

  const handleViewMap = useCallback((id: string) => {
    setSelectedTrailId(id)
    mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <>
    <style>{`
      .tr-scroll::-webkit-scrollbar { width: 3px }
      .tr-scroll::-webkit-scrollbar-thumb { background: rgba(5,150,105,0.25); border-radius: 2px }
      .tr-scroll::-webkit-scrollbar-track { background: transparent }
    `}</style>
    <div
      className="tr-scroll"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' as never }}
    >
    <div style={{ padding: '28px 24px 48px', maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 900,
            color: 'var(--foam)', letterSpacing: '-0.03em', margin: 0, lineHeight: 1,
          }}>
            Trail Conditions
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--spray)', margin: '6px 0 0 0' }}>
            Live trail reports, weather, and optimal windows — {TRAILS.length} trails across US National &amp; State Parks
          </p>
        </div>

        {/* Region selector tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {REGION_TABS.map(({ key, label }) => {
            const active = activeRegion === key
            return (
              <button
                key={key}
                onClick={() => setActiveRegion(key)}
                style={{
                  fontFamily: 'var(--font-data)', fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.04em', padding: '6px 14px', borderRadius: 20,
                  cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                  background: active ? 'var(--trail)' : 'var(--paper-sunken)',
                  color: active ? '#fff' : 'var(--spray)',
                  boxShadow: active ? '0 2px 8px rgba(5,150,105,0.25)' : 'none',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Alert Banner ── */}
      <div style={{
        borderRadius: 12, overflow: 'hidden',
        border: '1px solid rgba(220,38,38,0.25)',
        background: 'rgba(220,38,38,0.05)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px',
          borderBottom: '1px solid rgba(220,38,38,0.12)',
          background: 'rgba(220,38,38,0.07)',
        }}>
          <span style={{ fontSize: 14 }}>⚠</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 800, color: '#DC2626', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Active Alerts — {alertCount} closures in effect
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { icon: '🔥', text: 'FIRE ALERT: Caldor Fire area — Eldorado NF trails closed' },
            { icon: '⛔', text: 'SNOW CLOSURE: Whitney Portal Road closed until June 1' },
          ].map(({ icon, text }) => (
            <div key={text} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 16px', borderBottom: '1px solid rgba(220,38,38,0.08)',
              fontFamily: 'var(--font-data)', fontSize: 11, color: '#B91C1C', letterSpacing: '0.02em',
            }}>
              <span>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Conditions Summary Strip ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { label: 'TRAILS TOTAL',     value: TRAILS.length, color: '#0EA5E9' },
          { label: 'TRAILS OPEN',      value: openCount,     color: '#059669' },
          { label: 'BEST CONDITIONS',  value: bestCount,     color: '#059669' },
          { label: 'ALERTS',           value: alertCount,    color: '#DC2626' },
          { label: 'SEASON',           value: 'Spring',      color: '#B45309', isText: true },
        ].map(({ label, value, color, isText }) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--paper-sunken)', border: `1px solid ${color}30`,
            borderRadius: 24, padding: '7px 16px',
          }}>
            <span style={{
              fontFamily: 'var(--font-data)', fontSize: isText ? 11 : 16, fontWeight: 900,
              color, lineHeight: 1,
            }}>
              {value}
            </span>
            <span style={{ fontFamily: 'var(--font-data)', fontSize: 9, color: 'var(--spray)', letterSpacing: '0.08em' }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Trail Cards Grid ── */}
      <div>
        <h2 style={{
          fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em',
          color: 'var(--foam)', margin: '0 0 16px 0',
        }}>
          Featured Trails
          {activeRegion !== 'all' && (
            <span style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--trail)', marginLeft: 10, fontWeight: 400 }}>
              — {REGION_TABS.find(t => t.key === activeRegion)?.label}
            </span>
          )}
          <span style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--spray)', marginLeft: 10, fontWeight: 400 }}>
            ({filteredTrails.length} trails)
          </span>
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {filteredTrails.map(trail => (
            <TrailCard
              key={trail.id}
              trail={trail}
              selected={selectedTrailId === trail.id}
              onSelect={() => handleTrailSelect(trail.id)}
              onViewMap={() => handleViewMap(trail.id)}
            />
          ))}
        </div>
        {filteredTrails.length === 0 && (
          <div style={{
            padding: '40px 0', textAlign: 'center',
            fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--deep-text)', letterSpacing: '0.08em',
          }}>
            No trails in this region
          </div>
        )}
      </div>

      {/* ── Trail Map ── */}
      <div ref={mapSectionRef}>
        <h2 style={{
          fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em',
          color: 'var(--foam)', margin: '0 0 8px 0',
        }}>
          Trail Map
        </h2>
        {selectedTrailId && (() => {
          const t = TRAILS.find(tr => tr.id === selectedTrailId)
          return t ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
              padding: '8px 14px', borderRadius: 10,
              background: 'var(--trail-muted)', border: '1px solid rgba(5,150,105,0.25)',
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: pathColor(t.condition),
                flexShrink: 0,
              }} />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: 'var(--foam)' }}>
                {t.name}
              </span>
              <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--spray)' }}>
                {t.park} · {t.distance_km}km · {t.elevation_gain_m}m gain
              </span>
              <button
                onClick={() => setSelectedTrailId(null)}
                style={{
                  marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--spray)',
                  padding: '2px 8px',
                }}
              >
                ✕ Clear
              </button>
            </div>
          ) : null
        })()}
        <TrailsMap
          trails={filteredTrails}
          selectedTrailId={selectedTrailId}
          onTrailSelect={handleTrailSelect}
        />
        <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
          {(Object.entries(COND_CONFIG) as [TrailConditionKey, typeof COND_CONFIG[TrailConditionKey]][]).map(([key, c]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.color }} />
              <span style={{ fontFamily: 'var(--font-data)', fontSize: 9, color: 'var(--spray)', letterSpacing: '0.06em' }}>{key}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Weekly Forecast ── */}
      <WeeklyForecast />

      {/* ── Conditions Table ── */}
      <ConditionsTable trails={filteredTrails} />

      {/* ── Community Reports ── */}
      <CommunityReports />

    </div>
    </div>
    </>
  )
}
