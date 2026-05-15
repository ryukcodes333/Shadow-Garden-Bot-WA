'use strict'
const db = require('../database')
const axios = require('axios')

// ─── REAL GTA V SCENE IMAGES ─────────────────────────────────────────────────
const GTA_SCENE = {
  map:        'https://static.wikia.nocookie.net/gtawiki/images/4/4b/Map-GTAV.jpg',
  // Profiles
  male:       'https://static.wikia.nocookie.net/gtawiki/images/7/7e/Michael-GTAV-Artwork.jpg',
  male2:      'https://static.wikia.nocookie.net/gtawiki/images/7/7e/Franklin-GTAV-Artwork.jpg',
  male3:      'https://static.wikia.nocookie.net/gtawiki/images/5/5e/Trevor-GTAV-Artwork.jpg',
  female:     'https://static.wikia.nocookie.net/gtawiki/images/9/97/MPFemale-GTAO-Artwork.jpg',
  female2:    'https://static.wikia.nocookie.net/gtawiki/images/4/41/MPMale-GTAO-Artwork.jpg',
  cop:        'https://static.wikia.nocookie.net/gtawiki/images/3/35/LSPD-GTAV-Artwork.jpg',
  // Money
  work:       'https://static.wikia.nocookie.net/gtawiki/images/e/e8/Simeon-GTAV-Artwork.jpg',
  rob:        'https://static.wikia.nocookie.net/gtawiki/images/f/f0/HeistArtwork-GTAO.jpg',
  drug:       'https://static.wikia.nocookie.net/gtawiki/images/a/a6/Vagos-GTAV-Artwork.jpg',
  steal:      'https://static.wikia.nocookie.net/gtawiki/images/5/56/VehicleExport-GTAO-Artwork.jpg',
  hackBank:   'https://static.wikia.nocookie.net/gtawiki/images/d/df/DiamondCasinoHeist-GTAO-Artwork.jpg',
  bounty:     'https://static.wikia.nocookie.net/gtawiki/images/3/3b/Families-GTAV-Artwork.jpg',
  // Missions
  mission:    'https://static.wikia.nocookie.net/gtawiki/images/e/e8/Simeon-GTAV-Artwork.jpg',
  missionEnd: 'https://static.wikia.nocookie.net/gtawiki/images/f/f0/HeistArtwork-GTAO.jpg',
  explore:    'https://static.wikia.nocookie.net/gtawiki/images/4/4b/Map-GTAV.jpg',
  // Heists
  heist:      'https://static.wikia.nocookie.net/gtawiki/images/f/f0/HeistArtwork-GTAO.jpg',
  fleeca:     'https://static.wikia.nocookie.net/gtawiki/images/f/f0/HeistArtwork-GTAO.jpg',
  diamond:    'https://static.wikia.nocookie.net/gtawiki/images/d/df/DiamondCasinoHeist-GTAO-Artwork.jpg',
  cayo:       'https://static.wikia.nocookie.net/gtawiki/images/d/df/DiamondCasinoHeist-GTAO-Artwork.jpg',
  pacific:    'https://static.wikia.nocookie.net/gtawiki/images/f/f0/HeistArtwork-GTAO.jpg',
  humane:     'https://static.wikia.nocookie.net/gtawiki/images/f/f0/HeistArtwork-GTAO.jpg',
  doomsday:   'https://static.wikia.nocookie.net/gtawiki/images/f/f0/HeistArtwork-GTAO.jpg',
  // Vehicles
  cars:       'https://static.wikia.nocookie.net/gtawiki/images/e/ef/PremiumDeluxeMotorsport-GTAV.png',
  garage:     'https://static.wikia.nocookie.net/gtawiki/images/5/5e/Trevor-GTAV-Artwork.jpg',
  race:       'https://static.wikia.nocookie.net/gtawiki/images/7/7e/Franklin-GTAV-Artwork.jpg',
  driveby:    'https://static.wikia.nocookie.net/gtawiki/images/3/3b/Families-GTAV-Artwork.jpg',
  // Weapons
  weapons:    'https://static.wikia.nocookie.net/gtawiki/images/f/f0/HeistArtwork-GTAO.jpg',
  shoot:      'https://static.wikia.nocookie.net/gtawiki/images/f/f0/HeistArtwork-GTAO.jpg',
  // School
  school:     'https://static.wikia.nocookie.net/gtawiki/images/5/5e/Trevor-GTAV-Artwork.jpg',
  // Gangs
  gang:       'https://static.wikia.nocookie.net/gtawiki/images/3/3b/Families-GTAV-Artwork.jpg',
  gangwar:    'https://static.wikia.nocookie.net/gtawiki/images/3/3b/Families-GTAV-Artwork.jpg',
  // Police
  arrest:     'https://static.wikia.nocookie.net/gtawiki/images/3/35/LSPD-GTAV-Artwork.jpg',
  wanted:     'https://static.wikia.nocookie.net/gtawiki/images/3/35/LSPD-GTAV-Artwork.jpg',
  escape:     'https://static.wikia.nocookie.net/gtawiki/images/3/35/LSPD-GTAV-Artwork.jpg',
  // Social
  casino:     'https://static.wikia.nocookie.net/gtawiki/images/d/df/DiamondCasinoHeist-GTAO-Artwork.jpg',
  strip:      'https://static.wikia.nocookie.net/gtawiki/images/d/df/DiamondCasinoHeist-GTAO-Artwork.jpg',
  fight:      'https://static.wikia.nocookie.net/gtawiki/images/3/3b/Families-GTAV-Artwork.jpg',
  boss:       'https://static.wikia.nocookie.net/gtawiki/images/7/7e/Michael-GTAV-Artwork.jpg',
}

// ─── GTA V MAP IMAGE ──────────────────────────────────────────────────────────
const GTA_MAP_URL = GTA_SCENE.map

// ─── GTA V CHARACTER IMAGES ───────────────────────────────────────────────────
const GTA_CHARACTER_IMAGES = {
  male:   [GTA_SCENE.male, GTA_SCENE.male2, GTA_SCENE.male3],
  female: [GTA_SCENE.female, GTA_SCENE.female2],
  gang:   GTA_SCENE.gang,
  cop:    GTA_SCENE.cop,
  heist:  GTA_SCENE.heist,
  casino: GTA_SCENE.casino,
}

// ─── LOCATIONS ────────────────────────────────────────────────────────────────
const LOCATIONS = [
  { name: 'Los Santos', area: 'City', desc: 'The sprawling city — full of crime, money, and opportunity.' },
  { name: 'Vinewood Hills', area: 'Suburb', desc: 'Fancy mansions and celebrities.' },
  { name: 'Rockford Hills', area: 'Suburb', desc: 'Old money and bigger problems.' },
  { name: 'Vespucci Beach', area: 'Beach', desc: 'Sand, surf, and shady deals.' },
  { name: 'Little Seoul', area: 'Downtown', desc: 'Gang territory, neon lights.' },
  { name: 'Strawberry', area: 'Hood', desc: 'Families turf. Watch your back.' },
  { name: 'Davis', area: 'Hood', desc: 'Ballas territory. Hot zone.' },
  { name: 'Sandy Shores', area: 'Blaine County', desc: 'Desert, meth labs, and Trevor.' },
  { name: 'Paleto Bay', area: 'Rural', desc: 'Small town with a big bank.' },
  { name: 'Zancudo', area: 'Military', desc: 'Fort Zancudo. Trespassers will be shot.' },
  { name: 'Cayo Perico', area: 'Island', desc: 'El Rubio\'s private island. Billions hidden here.' },
  { name: 'Diamond Casino', area: 'Vinewood', desc: 'The most luxurious heist target in LS.' },
  { name: 'LSIA Airport', area: 'Port', desc: 'Los Santos International. Drug shipments land here.' },
  { name: 'LS Harbor', area: 'Port', desc: 'Cargo docks. Perfect for smuggling.' },
  { name: 'Maze Bank Tower', area: 'Downtown', desc: 'Office of the city\'s wealthiest.' },
]

// ─── OUTFITS ──────────────────────────────────────────────────────────────────
const OUTFITS = {
  casual:   { name: 'Casual',          emoji: '👕', desc: 'Jeans and a tee. Blending in.' },
  business: { name: 'Business Suit',   emoji: '👔', desc: 'Dressed for the boardroom — or the heist.' },
  gang:     { name: 'Gang Colors',     emoji: '🎽', desc: 'Repping the crew hard.' },
  military: { name: 'Military Gear',   emoji: '🪖', desc: 'Full tactical, ready for war.' },
  police:   { name: 'Police Uniform',  emoji: '👮', desc: 'Undercover or on duty.' },
  heist:    { name: 'Heist Gear',      emoji: '🥷', desc: 'Black mask, gloves, full kit.' },
  luxury:   { name: 'Luxury Fashion',  emoji: '🧣', desc: 'Haute couture. Cost more than your car.' },
  biker:    { name: 'Biker Jacket',    emoji: '🏍️', desc: 'Leather and patches. MC for life.' },
  beach:    { name: 'Beach Wear',      emoji: '🩳', desc: 'Shorts and sunnies. Vespucci vibes.' },
  astronaut:{ name: 'Space Suit',      emoji: '🚀', desc: 'From a mission that went... sideways.' },
}

// ─── VEHICLES ─────────────────────────────────────────────────────────────────
const VEHICLES = {
  comet:      { name: 'Pfister Comet',     price: 85000,    type: 'Sports',      speed: 8,  emoji: '🏎️' },
  zentorno:   { name: 'Pegassi Zentorno',  price: 725000,   type: 'Super',       speed: 10, emoji: '🚗' },
  oppressor:  { name: 'Oppressor Mk II',   price: 3890250,  type: 'Flying Bike', speed: 10, emoji: '🛵' },
  lazer:      { name: 'P-996 Lazer',       price: 6500000,  type: 'Jet',         speed: 10, emoji: '✈️' },
  insurgent:  { name: 'HVY Insurgent',     price: 675000,   type: 'Armored',     speed: 6,  emoji: '🚙' },
  hakuchou:   { name: 'Shitzu Hakuchou',   price: 82000,    type: 'Motorcycle',  speed: 9,  emoji: '🏍️' },
  buzzard:    { name: 'Buzzard Heli',      price: 1750000,  type: 'Helicopter',  speed: 8,  emoji: '🚁' },
  submarine:  { name: 'Kosatka Sub',       price: 2200000,  type: 'Naval',       speed: 5,  emoji: '🚢' },
  dump:       { name: 'Dump Truck',        price: 0,        type: 'Stolen',      speed: 3,  emoji: '🚛' },
  taxicab:    { name: 'Taxicab',           price: 0,        type: 'Stolen',      speed: 4,  emoji: '🚕' },
}

// ─── WEAPONS ─────────────────────────────────────────────────────────────────
const WEAPONS = {
  pistol:      { name: 'Pistol',        price: 1000,  damage: 15,  emoji: '🔫', level: 1 },
  smg:         { name: 'SMG',           price: 3500,  damage: 25,  emoji: '🔫', level: 5 },
  assaultrifle:{ name: 'Assault Rifle', price: 8500,  damage: 40,  emoji: '🔫', level: 10 },
  sniperrifle: { name: 'Sniper Rifle',  price: 18000, damage: 85,  emoji: '🎯', level: 15 },
  rpg:         { name: 'RPG',           price: 35000, damage: 200, emoji: '🚀', level: 20 },
  minigun:     { name: 'Minigun',       price: 55000, damage: 150, emoji: '💥', level: 30 },
  stickybomb:  { name: 'Sticky Bomb',   price: 2500,  damage: 120, emoji: '💣', level: 8 },
  machete:     { name: 'Machete',       price: 500,   damage: 35,  emoji: '🗡️', level: 1 },
  knife:       { name: 'Combat Knife',  price: 250,   damage: 20,  emoji: '🔪', level: 1 },
  bat:         { name: 'Baseball Bat',  price: 150,   damage: 10,  emoji: '🏏', level: 1 },
}

// ─── MISSIONS ─────────────────────────────────────────────────────────────────
function getMission(level) {
  const missions = [
    { name: 'Repo Job',            desc: 'Steal a car from a debtor. Quick and dirty.',                              minLvl: 1,  reward: { cash: 5000,   rp: 300   }, difficulty: 'Easy',          time: '2 min' },
    { name: 'Dispatch Services',   desc: 'Take out a target before cops arrive.',                                    minLvl: 1,  reward: { cash: 7500,   rp: 500   }, difficulty: 'Easy',          time: '3 min' },
    { name: 'By Land or Sea',      desc: 'Deliver a package across the city.',                                       minLvl: 1,  reward: { cash: 9000,   rp: 600   }, difficulty: 'Easy',          time: '4 min' },
    { name: 'Criminal Records',    desc: 'Race to the docks, eliminate opposition.',                                 minLvl: 5,  reward: { cash: 12000,  rp: 800   }, difficulty: 'Medium',        time: '5 min' },
    { name: 'Coveted',             desc: 'Steal military equipment from the army.',                                  minLvl: 10, reward: { cash: 18000,  rp: 1200  }, difficulty: 'Medium',        time: '8 min' },
    { name: 'Deal Breaker',        desc: 'Intercept a drug deal and take the cash.',                                 minLvl: 15, reward: { cash: 22000,  rp: 1500  }, difficulty: 'Medium',        time: '10 min' },
    { name: 'Titan of a Job',      desc: 'Steal a Titan military aircraft from Fort Zancudo.',                      minLvl: 20, reward: { cash: 35000,  rp: 2500  }, difficulty: 'Hard',          time: '12 min' },
    { name: 'Rooftop Rumble',      desc: 'Eliminate FIB agents and retrieve the document.',                         minLvl: 20, reward: { cash: 40000,  rp: 3000  }, difficulty: 'Hard',          time: '15 min' },
    { name: 'Violent Duct',        desc: 'Storm the Humane Labs facility and extract data.',                        minLvl: 25, reward: { cash: 50000,  rp: 4000  }, difficulty: 'Hard',          time: '15 min' },
    { name: 'Hit Em Up',           desc: 'Full-scale gang assault. No mercy.',                                      minLvl: 30, reward: { cash: 55000,  rp: 4500  }, difficulty: 'Hard',          time: '18 min' },
    { name: 'Denial of Service',   desc: 'Destroy rival CEO shipments city-wide.',                                  minLvl: 35, reward: { cash: 60000,  rp: 5000  }, difficulty: 'Hard',          time: '20 min' },
    { name: 'Satellite Comm',      desc: 'Steal military satellite uplink from the army.',                          minLvl: 40, reward: { cash: 75000,  rp: 6000  }, difficulty: 'Very Hard',     time: '20 min' },
    { name: 'Extradition',         desc: 'Break a boss out of maximum security prison.',                            minLvl: 45, reward: { cash: 85000,  rp: 7000  }, difficulty: 'Very Hard',     time: '25 min' },
    { name: 'Chumash & Grab',      desc: 'Storm a coke lab defended by 30 armed guards.',                          minLvl: 50, reward: { cash: 95000,  rp: 8000  }, difficulty: 'Very Hard',     time: '25 min' },
    { name: '⚠️ Offshore Assets',   desc: 'Sink a naval warship and recover classified cargo.',                     minLvl: 55, reward: { cash: 130000, rp: 11000 }, difficulty: '🔴 BRUTAL',     time: '30 min' },
    { name: '⚠️ Juggernaut Strike', desc: 'Take out 5 Merryweather juggernauts in Zancudo.',                       minLvl: 59, reward: { cash: 155000, rp: 14000 }, difficulty: '🔴 BRUTAL',     time: '35 min' },
    { name: '⚠️ Nuclear Option',    desc: 'Infiltrate a government black site and steal a warhead.',               minLvl: 60, reward: { cash: 180000, rp: 16000 }, difficulty: '💀 IMPOSSIBLE', time: '40 min' },
    { name: '⚠️ Godfather Contract',desc: 'Assassinate 3 mob bosses across Los Santos.',                          minLvl: 65, reward: { cash: 210000, rp: 19000 }, difficulty: '💀 IMPOSSIBLE', time: '45 min' },
    { name: '⚠️ Final Stand',       desc: 'Merryweather launched all-out assault on your safehouse. Hold the line.',minLvl: 70, reward: { cash: 250000, rp: 22000 }, difficulty: '💀 IMPOSSIBLE', time: '50 min' },
    { name: '⚠️ Shadow Protocol',   desc: 'Eliminate a corrupt IAA director, steal black budget files, escape 5★.', minLvl: 75, reward: { cash: 320000, rp: 28000 }, difficulty: '💀 LEGENDARY',  time: '60 min' },
    { name: '⚠️ Endgame: Architect',desc: 'Final mission. Every agency and gang in San Andreas hunts you.',        minLvl: 80, reward: { cash: 500000, rp: 50000 }, difficulty: '💀 LEGENDARY+', time: '90 min' },
  ]
  const available = missions.filter(m => level >= m.minLvl)
  if (!available.length) return missions[0]
  const weights = available.map((m, i) => i + 1)
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  let rand = Math.random() * totalWeight
  for (let i = 0; i < available.length; i++) {
    rand -= weights[i]
    if (rand <= 0) return available[i]
  }
  return available[available.length - 1]
}

// ─── HEISTS ───────────────────────────────────────────────────────────────────
const HEISTS = {
  fleeca:     { name: '🏦 Fleeca Job',          desc: '2-player heist. Rob the Fleeca Bank on the highway.',                      minLevel: 1,  maxPlayers: 2, payout: { normal: 57500, hard: 143750 },                                     prep: ['Scope out the bank', 'Obtain hacker device', 'Get getaway driver'] },
  prisonbreak:{ name: '🔓 Prison Break',         desc: 'Break out a prisoner from Bolingbroke Penitentiary.',                     minLevel: 20, maxPlayers: 4, payout: { normal: 200000, hard: 500000 },                                    prep: ['Steal a plane', 'Obtain prison bus', 'Steal cop car', 'Gather weapons'] },
  humane:     { name: '🧪 Humane Labs Raid',     desc: 'Steal research data from the Humane Labs facility.',                      minLevel: 25, maxPlayers: 4, payout: { normal: 540000, hard: 675000 },                                    prep: ['EMP device', 'Acquire masks', 'Steal insurgents', 'Valkyrie heist'] },
  seriesA:    { name: '💊 Series A Funding',     desc: 'Help Trevor fund his drug empire operations.',                            minLevel: 30, maxPlayers: 4, payout: { normal: 404000, hard: 505000 },                                    prep: ['Steal bikers\' meth', 'Rob cocaine', 'Weed stash', 'Steal van', 'Steal tanker'] },
  pacific:    { name: '🏦 Pacific Standard',     desc: 'Rob the most secure bank in Los Santos.',                                 minLevel: 40, maxPlayers: 4, payout: { normal: 1000000, hard: 1250000 },                                  prep: ['Obtain hack device', 'Signal intercept', 'Vans', 'Bikes', 'Safe cracker'] },
  diamond:    { name: '💎 Diamond Casino Heist', desc: 'The biggest score in Los Santos. Rob the Diamond Casino.',               minLevel: 50, maxPlayers: 4, payout: { cash: 2115000, art: 2350000, gold: 2585000, diamonds: 3619000 },    prep: ['Scope casino', 'Vault contents', 'Access points', 'Security intel', 'Hackers', 'Weapons'] },
  cayo:       { name: '🏝️ Cayo Perico Heist',   desc: 'Solo or squad raid on El Rubio\'s private island. Biggest solo payout.', minLevel: 60, maxPlayers: 4, payout: { minimum: 1078000, maximum: 4570600 },                            prep: ['Scope the island', 'Gather intel', 'Approach vehicle', 'Disruption', 'Infiltration'] },
  doomsday:   { name: '☢️ Doomsday Heist',      desc: 'Stop a rogue military AI from launching nukes.',                         minLevel: 70, maxPlayers: 4, payout: { act1: 1200000, act2: 1500000, act3: 2500000 },                     prep: ['Recover data', 'Disrupt Avon', 'Acquire submarine', 'Satellite hack', 'EMP strike'] },
}

// ─── SCHOOL ROLES ─────────────────────────────────────────────────────────────
const SCHOOL_ROLES = ['student', 'teacher', 'headmaster', 'principal', 'dean']

// ─── DEFAULT SCHOOL SUBJECTS ──────────────────────────────────────────────────
const SCHOOL_SUBJECTS = [
  { name: 'Driving School',        skill: 'driving',  xp: 200, duration: '5 min',  desc: 'Master vehicle control, drifting, and evasion.' },
  { name: 'Weapons Training',      skill: 'shooting', xp: 300, duration: '7 min',  desc: 'Accuracy, reload speed, weapon selection.' },
  { name: 'Hacking Class',         skill: 'hacking',  xp: 250, duration: '6 min',  desc: 'Break bank vaults, hack systems, bypass firewalls.' },
  { name: 'Stealth & Infiltration',skill: 'stealth',  xp: 280, duration: '6 min',  desc: 'Move silently, avoid cameras, knock out guards.' },
  { name: 'Flight School',         skill: 'flying',   xp: 400, duration: '10 min', desc: 'Pilot jets, helicopters, and stunt planes.' },
  { name: 'Finance & Felony',      skill: 'business', xp: 350, duration: '8 min',  desc: 'CEO operations, money laundering, supply chains.' },
  { name: 'Street Smarts',         skill: 'street',   xp: 150, duration: '3 min',  desc: 'Navigate the underworld, read territory, survive.' },
  { name: 'Heist Planning',        skill: 'heist',    xp: 500, duration: '12 min', desc: 'Master the art of planning and executing heists.' },
]

// ─── GANG LIST ────────────────────────────────────────────────────────────────
const GANGS = {
  families:  { name: 'Grove Street Families', color: '🟢', turf: 'Strawberry',        bonus: 'Loyalty +20%' },
  ballas:    { name: 'Ballas',                color: '🟣', turf: 'Davis',              bonus: 'Territory +15%' },
  vagos:     { name: 'Los Santos Vagos',      color: '🟡', turf: 'Elysian Island',     bonus: 'Drug profit +25%' },
  aztecas:   { name: 'Varrios Los Aztecas',   color: '🔵', turf: 'Chamberlain Hills',  bonus: 'Street cred +30%' },
  marabunta: { name: 'Marabunta Grande',      color: '🔵', turf: 'LSIA',              bonus: 'Smuggling +20%' },
  lost:      { name: 'The Lost MC',           color: '🖤', turf: 'Sandy Shores',       bonus: 'Weapon discount 15%' },
  angels:    { name: 'Angels of Death',       color: '🔴', turf: 'Paleto Bay',         bonus: 'Vehicle speed +10%' },
}

// ─── IN-MEMORY STORES ─────────────────────────────────────────────────────────
const activeMissions   = {}
const activeHeists     = {}
const activeSchool     = {}
const schoolInvites    = {}
// Custom schools: schoolId → { id, name, creatorPhone, groupId, subjects, description, fee, members: {} }
const customSchools    = {}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function shortId(len = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  for (let i = 0; i < len; i++) id += chars[Math.floor(Math.random() * chars.length)]
  return id
}

async function getGtaData(phone) {
  const u = await db.getOrCreateUser(phone)
  let gta = {}
  try { gta = JSON.parse(u.class_name || '{}') } catch {}
  if (typeof gta !== 'object' || !gta.gtaVersion) {
    if (typeof u.class_name === 'string' && !u.class_name.startsWith('{')) gta = {}
    gta.gtaVersion = 1
  }
  return gta
}

async function saveGtaData(phone, gtaData) {
  try {
    const result = await db.updateUser(phone, { class_name: JSON.stringify(gtaData) })
    if (!result) console.error(`[GTA] saveGtaData: updateUser returned null for ${phone}`)
  } catch (err) {
    console.error(`[GTA] saveGtaData error for ${phone}:`, err.message)
  }
}

function gtaRank(rp) {
  if (rp < 1000)   return { rank: 1,   name: 'Thug' }
  if (rp < 3000)   return { rank: 5,   name: 'Street Soldier' }
  if (rp < 7000)   return { rank: 10,  name: 'Gangster' }
  if (rp < 15000)  return { rank: 20,  name: 'Hustler' }
  if (rp < 30000)  return { rank: 30,  name: 'Baller' }
  if (rp < 60000)  return { rank: 40,  name: 'Made Man' }
  if (rp < 100000) return { rank: 50,  name: 'Lieutenant' }
  if (rp < 180000) return { rank: 60,  name: 'Boss' }
  if (rp < 300000) return { rank: 70,  name: 'Crime Lord' }
  if (rp < 500000) return { rank: 80,  name: 'Kingpin' }
  if (rp < 800000) return { rank: 90,  name: 'Legend' }
  return { rank: 100, name: '👑 CRIMINAL MASTERMIND' }
}

function wantedStars(level) {
  if (level === 0) return '⭐ Clear'
  return '⭐'.repeat(Math.min(level, 5)) + ` (${level}★)`
}

async function fetchImageBuffer(url) {
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 12000, headers: { 'User-Agent': 'Mozilla/5.0' } })
    return Buffer.from(res.data)
  } catch { return null }
}

async function sendImgOrText(sock, jid, msg, imgUrl, text, reply) {
  // Try 1: direct URL — Baileys fetches it (faster, no wikia block)
  try {
    await sock.sendMessage(jid, { image: { url: imgUrl }, caption: text }, { quoted: msg })
    return
  } catch {}
  // Try 2: fetch buffer ourselves
  try {
    const buf = await fetchImageBuffer(imgUrl)
    if (buf && buf.length > 500) {
      await sock.sendMessage(jid, { image: buf, caption: text }, { quoted: msg })
      return
    }
  } catch {}
  // Fallback: text only
  await reply(text)
}

// ─── COMMANDS ─────────────────────────────────────────────────────────────────
module.exports = {

  // ──────────────────── CHARACTER ────────────────────────────────
  async gtastart({ sock, jid, msg, reply, sender, user, pushName }) {
    const u = user || await db.getOrCreateUser(sender)
    const gta = await getGtaData(sender)
    if (gta.created) return reply(`🎮 You already have a GTA character!\n\n👤 *${gta.name || pushName}*\n📊 RP: ${gta.rp || 0}\n💰 Cash: $${(gta.cash || 0).toLocaleString()}\n\nUse *.gtaprofile* to view your character.`)
    gta.created = true
    gta.name = gta.name || pushName || sender
    gta.cash = 50000
    gta.rp = 0
    gta.wanted = 0
    gta.location = 'Los Santos'
    gta.outfit = 'casual'
    gta.gender = 'male'
    gta.vehicle = null
    gta.weapons = ['pistol']
    gta.gang = null
    gta.schoolRole = null
    gta.skills = { driving: 0, shooting: 0, hacking: 0, stealth: 0, flying: 0, business: 0, street: 0, heist: 0 }
    gta.totalMissions = 0
    gta.totalHeists = 0
    gta.isCop = false
    gta.bounty = 0
    await saveGtaData(sender, gta)
    const rankInfo = gtaRank(0)
    const text =
      `🎮 *GTA V ROLEPLAY — CHARACTER CREATED!*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *Name:* ${gta.name}\n` +
      `📊 *Rank:* ${rankInfo.rank} — ${rankInfo.name}\n` +
      `💰 *Starting Cash:* $50,000\n` +
      `📍 *Location:* ${gta.location}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🎯 *Starter Kit:*\n` +
      `• 🔫 Pistol\n` +
      `• 💵 $50,000 cash\n` +
      `• 🗺️ Access to all of Los Santos\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `📖 *Get Started:*\n` +
      `• *.gtamenu* — Full command list\n` +
      `• *.gtamission* — Start a mission\n` +
      `• *.gtamap* — View the GTA V map\n` +
      `• *.gtaschool* — Join the academy\n` +
      `• *.gtaheist* — Plan a heist\n\n` +
      `_Welcome to Los Santos. Choose your path wisely._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.male, text, reply)
  },

  async gtacreate(ctx) { return module.exports.gtastart(ctx) },
  async gta(ctx) { return module.exports.gtastart(ctx) },

  // ──────────────────── PROFILE ────────────────────────────────
  async gtaprofile({ sock, jid, msg, reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ No GTA character found!\n\nUse *.gtastart* to create your character.`)
    const rankInfo = gtaRank(gta.rp || 0)
    const outfit   = OUTFITS[gta.outfit || 'casual']
    const vehicle  = gta.vehicle ? VEHICLES[gta.vehicle] : null
    const gangInfo = gta.gang ? GANGS[gta.gang] : null
    const text =
      `🎮 *GTA V — CHARACTER PROFILE*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *Name:* ${gta.name}\n` +
      `${gta.isCop ? '👮 *Role:* LSPD Officer\n' : ''}` +
      `📊 *Rank:* ${rankInfo.rank} — *${rankInfo.name}*\n` +
      `⭐ *RP:* ${(gta.rp || 0).toLocaleString()}\n` +
      `💰 *Cash:* $${(gta.cash || 0).toLocaleString()}\n` +
      `📍 *Location:* ${gta.location || 'Los Santos'}\n` +
      `${outfit ? `${outfit.emoji} *Outfit:* ${outfit.name}\n` : ''}` +
      `${vehicle ? `${vehicle.emoji} *Vehicle:* ${vehicle.name}\n` : '🚶 *Vehicle:* On foot\n'}` +
      `${gangInfo ? `${gangInfo.color} *Gang:* ${gangInfo.name}\n` : ''}` +
      `${gta.schoolRole ? `🎓 *School:* ${gta.schoolRole.charAt(0).toUpperCase() + gta.schoolRole.slice(1)}\n` : ''}` +
      `🔫 *Weapons:* ${(gta.weapons || []).join(', ')}\n` +
      `🎯 *Missions:* ${gta.totalMissions || 0}\n` +
      `💎 *Heists:* ${gta.totalHeists || 0}\n` +
      `${gta.wanted > 0 ? `⭐ *Wanted:* ${wantedStars(gta.wanted)}\n` : ''}` +
      `${gta.bounty > 0 ? `💀 *Bounty:* $${gta.bounty.toLocaleString()}\n` : ''}` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `📈 *Skills:*\n` +
      Object.entries(gta.skills || {}).map(([k, v]) => `  • ${k}: ${'█'.repeat(Math.floor((v / 500) * 10))}${'░'.repeat(10 - Math.floor((v / 500) * 10))} ${v}`).join('\n') + '\n' +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Use *.gtacustomize* to change your look._ 🏙️`
    const imgKey = gta.isCop ? 'cop' : gta.gender === 'female' ? 'female' : 'male'
    const imgUrl = Array.isArray(GTA_CHARACTER_IMAGES[imgKey])
      ? GTA_CHARACTER_IMAGES[imgKey][Math.floor(Math.random() * GTA_CHARACTER_IMAGES[imgKey].length)]
      : GTA_CHARACTER_IMAGES[imgKey]
    await sendImgOrText(sock, jid, msg, imgUrl, text, reply)
  },
  async gtrp(ctx) { return module.exports.gtaprofile(ctx) },
  async gtap(ctx) { return module.exports.gtaprofile(ctx) },

  // ──────────────────── CUSTOMIZE ────────────────────────────────
  async gtacustomize({ reply, sender, args }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const sub = args[0]?.toLowerCase()
    const val = args[1]?.toLowerCase()
    if (!sub) {
      return reply(
        `🎨 *GTA CHARACTER CUSTOMIZATION*\n\n` +
        `Commands:\n` +
        `• *.gtacustomize name <name>* — Set name\n` +
        `• *.gtacustomize gender male/female* — Set gender\n` +
        `• *.gtacustomize outfit <type>* — Change outfit\n` +
        `• *.gtacustomize bio <text>* — Set bio\n\n` +
        `Outfits: ${Object.keys(OUTFITS).join(', ')}`
      )
    }
    if (sub === 'name') {
      const name = args.slice(1).join(' ')
      if (!name) return reply('❌ Provide a name: *.gtacustomize name <name>*')
      gta.name = name
      await saveGtaData(sender, gta)
      return reply(`✅ Name set to *${name}*`)
    }
    if (sub === 'gender') {
      if (!['male', 'female'].includes(val)) return reply('❌ Gender must be *male* or *female*')
      gta.gender = val
      await saveGtaData(sender, gta)
      return reply(`✅ Gender set to *${val}*`)
    }
    if (sub === 'outfit') {
      if (!OUTFITS[val]) return reply(`❌ Unknown outfit. Try: ${Object.keys(OUTFITS).join(', ')}`)
      gta.outfit = val
      await saveGtaData(sender, gta)
      return reply(`${OUTFITS[val].emoji} *Outfit changed to ${OUTFITS[val].name}!*\n\n${OUTFITS[val].desc}`)
    }
    if (sub === 'bio') {
      const bio = args.slice(1).join(' ')
      gta.bio = bio
      await saveGtaData(sender, gta)
      return reply(`✅ Bio updated.`)
    }
    return reply(`❌ Unknown option. Use: name, gender, outfit, bio`)
  },

  async gtaoutfit({ sock, jid, msg, reply, sender, args }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const type = args[0]?.toLowerCase()
    if (!type || !OUTFITS[type]) {
      const list = Object.entries(OUTFITS).map(([k, v]) => `• ${v.emoji} *${k}* — ${v.desc}`).join('\n')
      return reply(`🎨 *OUTFITS*\n\nUsage: *.gtaoutfit <type>*\n\n${list}`)
    }
    gta.outfit = type
    await saveGtaData(sender, gta)
    const o = OUTFITS[type]
    return reply(`${o.emoji} *Outfit changed to ${o.name}!*\n\n${o.desc}\n\n_Looking fresh in Los Santos._ 🏙️`)
  },

  async gtaname({ reply, sender, args }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const name = args.join(' ')
    if (!name) return reply('❌ Usage: *.gtaname <name>*')
    gta.name = name
    await saveGtaData(sender, gta)
    return reply(`✅ Character name set to *${name}*`)
  },

  async gtagender({ reply, sender, args }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const g = args[0]?.toLowerCase()
    if (!['male', 'female'].includes(g)) return reply('❌ Usage: *.gtagender male/female*')
    gta.gender = g
    await saveGtaData(sender, gta)
    return reply(`✅ Gender set to *${g}*`)
  },

  // ──────────────────── WORLD ────────────────────────────────────
  async gtamap({ sock, jid, msg, reply }) {
    const text =
      `🗺️ *LOS SANTOS — INTERACTIVE MAP*\n\n` +
      `📍 *Key Locations:*\n` +
      LOCATIONS.map(l => `• *${l.name}* (${l.area}) — ${l.desc}`).join('\n') +
      `\n\n_Use *.gtatravel <location>* to fast travel._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_MAP_URL, text, reply)
  },

  async gtatravel({ sock, jid, msg, reply, sender, args }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const place = args.join(' ').trim()
    if (!place) {
      return reply(`🗺️ *FAST TRAVEL*\n\nUsage: *.gtatravel <location>*\n\nLocations: ${LOCATIONS.map(l => l.name).join(', ')}`)
    }
    const dest = LOCATIONS.find(l => l.name.toLowerCase().includes(place.toLowerCase()))
    if (!dest) return reply(`❌ Location not found.\n\nTry: ${LOCATIONS.map(l => l.name).join(', ')}`)
    gta.location = dest.name
    await saveGtaData(sender, gta)
    const text = `✈️ *FAST TRAVEL*\n\n📍 Arrived at *${dest.name}* (${dest.area})\n\n${dest.desc}\n\n_Los Santos never sleeps._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_MAP_URL, text, reply)
  },

  async gtalocation({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const loc = LOCATIONS.find(l => l.name === gta.location) || LOCATIONS[0]
    return reply(`📍 *CURRENT LOCATION*\n\n🏙️ *${loc.name}* (${loc.area})\n\n${loc.desc}\n\n_Use *.gtatravel <place>* to move._ 🏙️`)
  },

  async gtaexplore({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const loc = LOCATIONS.find(l => l.name === gta.location) || LOCATIONS[0]
    const events = [
      `🚗 You spotted a rare vehicle. Move quick!`,
      `💼 A stranger offers a shady job. +$5,000`,
      `🔫 Ballas territory. Stay low.`,
      `💊 Drug runners passing through.`,
      `🚔 Cops are patrolling heavy. Be careful.`,
      `💰 Found a cash stash hidden in an alley! +$2,000`,
      `🎯 Rival crew spotted. Fight or flee?`,
    ]
    const event = events[Math.floor(Math.random() * events.length)]
    const cashFound = event.includes('+$5,000') ? 5000 : event.includes('+$2,000') ? 2000 : 0
    if (cashFound) {
      gta.cash = (gta.cash || 0) + cashFound
      await saveGtaData(sender, gta)
    }
    const text = `🔍 *EXPLORING ${loc.name.toUpperCase()}*\n\n${event}\n\n📍 Area: ${loc.area}\n${loc.desc}\n\n_Keep your eyes open._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_MAP_URL, text, reply)
  },

  // ──────────────────── MISSIONS ──────────────────────────────────
  async gtamission({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    if (activeMissions[sender]) return reply(`⚠️ You already have an active mission!\n\nUse *.gtacomplete* to finish or *.gtafailmission* to abandon.`)
    const rank = gtaRank(gta.rp || 0)
    const mission = getMission(rank.rank)
    activeMissions[sender] = { mission, startTime: Date.now() }
    const text =
      `🎯 *MISSION ASSIGNED*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `📌 *${mission.name}*\n` +
      `📖 ${mission.desc}\n\n` +
      `⚡ *Difficulty:* ${mission.difficulty}\n` +
      `⏱️ *Est. Time:* ${mission.time}\n` +
      `💰 *Reward:* $${mission.reward.cash.toLocaleString()}\n` +
      `⭐ *RP:* +${mission.reward.rp}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `_Use *.gtacomplete* when done._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.mission, text, reply)
  },

  async gtamissions({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const rank = gtaRank(gta.rp || 0)
    const avail = []
    for (let i = 0; i < 5; i++) avail.push(getMission(rank.rank))
    const list = avail.map((m, i) => `${i + 1}. *${m.name}* — $${m.reward.cash.toLocaleString()} | ${m.difficulty}`).join('\n')
    const text = `🎯 *AVAILABLE MISSIONS*\n\n${list}\n\n_Use *.gtamission* to get one assigned._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.mission, text, reply)
  },

  async gtacomplete({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const active = activeMissions[sender]
    if (!active) return reply(`❌ No active mission. Use *.gtamission* to start one.`)
    const elapsed = Date.now() - active.startTime
    const success = Math.random() < 0.75
    delete activeMissions[sender]
    if (!success) {
      gta.wanted = Math.min(5, (gta.wanted || 0) + 1)
      await saveGtaData(sender, gta)
      const text = `❌ *MISSION FAILED — ${active.mission.name}*\n\n💀 You got caught before completing the job.\n⭐ Wanted: ${wantedStars(gta.wanted)}\n\n_Try again. The streets forgive no one._ 🏙️`
      return sendImgOrText(sock, jid, msg, GTA_SCENE.wanted, text, reply)
    }
    const bonus = Math.random() < 0.2 ? Math.floor(active.mission.reward.cash * 0.25) : 0
    const totalCash = active.mission.reward.cash + bonus
    gta.cash = (gta.cash || 0) + totalCash
    gta.rp = (gta.rp || 0) + active.mission.reward.rp
    gta.totalMissions = (gta.totalMissions || 0) + 1
    await saveGtaData(sender, gta)
    const text =
      `✅ *MISSION COMPLETE — ${active.mission.name}*\n\n` +
      `💰 Cash: +$${totalCash.toLocaleString()}${bonus ? ` (🎉 +$${bonus} bonus!)` : ''}\n` +
      `⭐ RP: +${active.mission.reward.rp}\n` +
      `🎯 Total Missions: ${gta.totalMissions}\n\n` +
      `_Smooth operator._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.missionEnd, text, reply)
  },

  async gtafailmission({ reply, sender }) {
    if (!activeMissions[sender]) return reply(`❌ No active mission to abandon.`)
    const m = activeMissions[sender]
    delete activeMissions[sender]
    return reply(`🚫 *MISSION ABANDONED — ${m.mission.name}*\n\n_Smart. Live to fight another day._ 🏙️`)
  },

  // ──────────────────── ECONOMY ────────────────────────────────────
  async gtawork({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const remaining = await db.getCooldown(sender, 'gtawork')
    if (remaining > 0) return reply(`⏳ Work cooldown: ${Math.ceil(remaining / 60000)} min left.`)
    const jobs = [
      { job: 'repo\'d a car for Simeon',          cash: 8000,  rp: 200 },
      { job: 'ran supplies for a CEO',             cash: 12000, rp: 300 },
      { job: 'drove a cargo truck across LS',      cash: 9500,  rp: 250 },
      { job: 'sold stolen goods at the docks',     cash: 11000, rp: 280 },
      { job: 'completed a Freemode contract',      cash: 15000, rp: 400 },
      { job: 'ran drugs for the Vagos',            cash: 18000, rp: 350 },
      { job: 'patched up turf for the Families',   cash: 7000,  rp: 180 },
    ]
    const pick = jobs[Math.floor(Math.random() * jobs.length)]
    gta.cash = (gta.cash || 0) + pick.cash
    gta.rp = (gta.rp || 0) + pick.rp
    await saveGtaData(sender, gta)
    await db.setCooldown(sender, 'gtawork', 20 * 60)
    const text = `💼 *WORK DONE*\n\nYou ${pick.job}.\n\n💰 +$${pick.cash.toLocaleString()}\n⭐ +${pick.rp} RP\n\n_Honest hustle. Mostly._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.work, text, reply)
  },

  async gtarob({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const remaining = await db.getCooldown(sender, 'gtarob')
    if (remaining > 0) return reply(`⏳ Robbery cooldown: ${Math.ceil(remaining / 60000)} min.`)
    const success = Math.random() < 0.60
    await db.setCooldown(sender, 'gtarob', 15 * 60)
    if (!success) {
      gta.wanted = Math.min(5, (gta.wanted || 0) + 2)
      await saveGtaData(sender, gta)
      const text = `❌ *ROBBERY FAILED*\n\n🚨 Dye pack exploded. Cops incoming!\n⭐ Wanted: ${wantedStars(gta.wanted)}\n\n_Next time, bring a getaway driver._ 🏙️`
      return sendImgOrText(sock, jid, msg, GTA_SCENE.wanted, text, reply)
    }
    const targets = [
      { place: 'Fleeca Bank',        cash: [20000, 60000]  },
      { place: 'Convenience Store',  cash: [3000,  8000]   },
      { place: 'Armored Truck',      cash: [15000, 40000]  },
      { place: 'Pacific Standard',   cash: [50000, 150000] },
      { place: 'Casino Cage',        cash: [30000, 90000]  },
    ]
    const target = targets[Math.floor(Math.random() * targets.length)]
    const loot = Math.floor(Math.random() * (target.cash[1] - target.cash[0])) + target.cash[0]
    gta.cash = (gta.cash || 0) + loot
    gta.rp = (gta.rp || 0) + 500
    gta.wanted = Math.min(5, (gta.wanted || 0) + 1)
    await saveGtaData(sender, gta)
    const text =
      `💰 *ROBBERY SUCCESS — ${target.place}*\n\n` +
      `🏦 Target: *${target.place}*\n` +
      `💵 Stolen: $${loot.toLocaleString()}\n` +
      `⭐ +500 RP\n` +
      `🚨 Wanted: ${wantedStars(gta.wanted)}\n\n` +
      `_You're a professional. Mostly._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.rob, text, reply)
  },

  async gtadrug({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const remaining = await db.getCooldown(sender, 'gtadrug')
    if (remaining > 0) return reply(`⏳ Cooldown: ${Math.ceil(remaining / 60000)} min.`)
    const success = Math.random() < 0.65
    await db.setCooldown(sender, 'gtadrug', 20 * 60)
    if (!success) {
      gta.wanted = Math.min(5, (gta.wanted || 0) + 1)
      await saveGtaData(sender, gta)
      const text = `❌ *DEAL WENT WRONG*\n\n🚔 Undercover cop. Ran but they got you.\n⭐ Wanted: ${wantedStars(gta.wanted)}\n\n_Trust nobody._ 🏙️`
      return sendImgOrText(sock, jid, msg, GTA_SCENE.cop, text, reply)
    }
    const drugs = [
      { type: 'Meth', profit: [15000, 35000] },
      { type: 'Coke', profit: [20000, 50000] },
      { type: 'Weed', profit: [8000,  20000] },
      { type: 'Heroin', profit: [25000, 60000] },
    ]
    const drug = drugs[Math.floor(Math.random() * drugs.length)]
    const profit = Math.floor(Math.random() * (drug.profit[1] - drug.profit[0])) + drug.profit[0]
    gta.cash = (gta.cash || 0) + profit
    gta.rp = (gta.rp || 0) + 300
    gta.wanted = Math.min(5, (gta.wanted || 0) + 1)
    await saveGtaData(sender, gta)
    const text = `💊 *DRUG DEAL — ${drug.type}*\n\n💰 Profit: $${profit.toLocaleString()}\n⭐ +300 RP\n⭐ Wanted: ${wantedStars(gta.wanted)}\n\n_In and out. Clean exit._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.drug, text, reply)
  },

  async gtasteal({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const remaining = await db.getCooldown(sender, 'gtasteal')
    if (remaining > 0) return reply(`⏳ Cooldown: ${Math.ceil(remaining / 60000)} min.`)
    const success = Math.random() < 0.70
    await db.setCooldown(sender, 'gtasteal', 10 * 60)
    if (!success) {
      gta.wanted = Math.min(5, (gta.wanted || 0) + 1)
      await saveGtaData(sender, gta)
      const text = `❌ *THEFT FAILED*\n\n🚔 BOLO was out on that car. Abort!\n⭐ Wanted: ${wantedStars(gta.wanted)}\n\n_Wrong car, wrong time._ 🏙️`
      return sendImgOrText(sock, jid, msg, GTA_SCENE.wanted, text, reply)
    }
    const steals = [
      { car: 'Adder',        value: [60000, 120000] },
      { car: 'Entity XF',    value: [50000, 100000] },
      { car: 'T20',          value: [70000, 140000] },
      { car: 'Zentorno',     value: [40000, 90000]  },
      { car: 'Scramjet',     value: [80000, 160000] },
    ]
    const steal = steals[Math.floor(Math.random() * steals.length)]
    const val = Math.floor(Math.random() * (steal.value[1] - steal.value[0])) + steal.value[0]
    gta.cash = (gta.cash || 0) + val
    gta.rp = (gta.rp || 0) + 200
    gta.wanted = Math.min(5, (gta.wanted || 0) + 1)
    await saveGtaData(sender, gta)
    const text = `🚗 *VEHICLE STOLEN — ${steal.car}*\n\n💰 Sold to Simeon: $${val.toLocaleString()}\n⭐ +200 RP\n⭐ Wanted: ${wantedStars(gta.wanted)}\n\n_Gone in 60 seconds._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.steal, text, reply)
  },

  async gtahackbank({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const rank = gtaRank(gta.rp || 0)
    if (rank.rank < 10 || (gta.skills?.hacking || 0) < 50) {
      return reply(`❌ Need *Rank 10* and *50+ Hacking* skill to hack banks.\n\nYour rank: ${rank.rank} | Hacking: ${gta.skills?.hacking || 0}`)
    }
    const remaining = await db.getCooldown(sender, 'gtahackbank')
    if (remaining > 0) return reply(`⏳ Cooldown: ${Math.ceil(remaining / 60000)} min.`)
    const success = Math.random() < 0.55
    await db.setCooldown(sender, 'gtahackbank', 30 * 60)
    if (!success) {
      gta.wanted = Math.min(5, (gta.wanted || 0) + 3)
      await saveGtaData(sender, gta)
      const text = `❌ *BANK HACK FAILED*\n\n💻 Firewall detected you. Trace alert!\n⭐ Wanted: ${wantedStars(gta.wanted)}\n\n_Better hacking needed._ 🏙️`
      return sendImgOrText(sock, jid, msg, GTA_SCENE.wanted, text, reply)
    }
    const hacked = Math.floor(Math.random() * 150000 + 50000)
    gta.cash = (gta.cash || 0) + hacked
    gta.rp = (gta.rp || 0) + 1000
    gta.skills.hacking = Math.min(500, (gta.skills.hacking || 0) + 20)
    gta.wanted = Math.min(5, (gta.wanted || 0) + 2)
    await saveGtaData(sender, gta)
    const text = `💻 *BANK HACKED*\n\n🏦 Offshore account drained!\n💰 +$${hacked.toLocaleString()}\n⭐ +1,000 RP\n💻 Hacking skill: ${gta.skills.hacking}/500\n⭐ Wanted: ${wantedStars(gta.wanted)}\n\n_Ghost protocol. They'll never trace it._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.hackBank, text, reply)
  },

  async gtabounty({ reply, sender, args, msg }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    const amtArg = args.find(a => /^\$?\d+$/.test(a))
    if (!mentionedJid || !amtArg) return reply(`❌ Usage: *.gtabounty @player $amount*`)
    const amount = parseInt(amtArg.replace('$', ''))
    if (amount < 1000) return reply(`❌ Minimum bounty is $1,000.`)
    if ((gta.cash || 0) < amount) return reply(`❌ Not enough cash. You have $${(gta.cash || 0).toLocaleString()}`)
    const targetPhone = mentionedJid.split('@')[0].split(':')[0]
    const targetGta = await getGtaData(targetPhone)
    if (!targetGta.created) return reply(`❌ That player has no GTA character.`)
    gta.cash = (gta.cash || 0) - amount
    targetGta.bounty = (targetGta.bounty || 0) + amount
    await saveGtaData(sender, gta)
    await saveGtaData(targetPhone, targetGta)
    return reply(`💀 *BOUNTY PLACED*\n\n🎯 Target: @${targetPhone}\n💰 Bounty: $${amount.toLocaleString()}\n\n_Someone's getting paid to hunt them down._ 🏙️`)
  },

  async gtacollect({ reply, sender, args, msg }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    if (!mentionedJid) return reply(`❌ Usage: *.gtacollect @player*`)
    const targetPhone = mentionedJid.split('@')[0].split(':')[0]
    if (targetPhone === sender) return reply(`❌ Can't collect your own bounty.`)
    const targetGta = await getGtaData(targetPhone)
    if (!targetGta.created) return reply(`❌ That player has no GTA character.`)
    if (!targetGta.bounty || targetGta.bounty <= 0) return reply(`❌ @${targetPhone} has no bounty on them.`)
    const bounty = targetGta.bounty
    targetGta.bounty = 0
    targetGta.cash = Math.max(0, (targetGta.cash || 0) - Math.floor(bounty * 0.3))
    gta.cash = (gta.cash || 0) + bounty
    gta.rp = (gta.rp || 0) + 500
    await saveGtaData(sender, gta)
    await saveGtaData(targetPhone, targetGta)
    return reply(`💀 *BOUNTY COLLECTED*\n\n🎯 Eliminated: @${targetPhone}\n💰 Payout: $${bounty.toLocaleString()}\n⭐ +500 RP\n\n_Money well earned._ 🏙️`)
  },

  // ──────────────────── HEISTS ──────────────────────────────────
  async gtaheist({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const rank = gtaRank(gta.rp || 0)
    const avail = Object.entries(HEISTS).filter(([, h]) => rank.rank >= h.minLevel)
    const list = avail.map(([id, h]) => `• *.gta${id}* — ${h.name}\n  💰 Up to $${Math.max(...Object.values(h.payout)).toLocaleString()}`).join('\n')
    const text =
      `💎 *HEIST BOARD — LOS SANTOS*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `Available for Rank ${rank.rank} (${rank.name}):\n\n` +
      `${list || 'No heists available yet. Level up!'}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Use *.gtastartheist <id>* to plan._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.heist, text, reply)
  },

  async gtastartheist({ sock, jid, msg, reply, sender, args }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const id = args[0]?.toLowerCase()
    const heist = HEISTS[id]
    if (!heist) return reply(`❌ Unknown heist. Options: ${Object.keys(HEISTS).join(', ')}`)
    const rank = gtaRank(gta.rp || 0)
    if (rank.rank < heist.minLevel) return reply(`❌ Need Rank ${heist.minLevel} for ${heist.name}.\n\nYour rank: ${rank.rank}`)
    activeHeists[jid] = { heistId: id, heist, leader: sender, members: [sender], startTime: Date.now() }
    const text =
      `💎 *HEIST PLANNED — ${heist.name}*\n\n` +
      `${heist.desc}\n\n` +
      `👥 Max: ${heist.maxPlayers} players\n` +
      `💰 Payout: Up to $${Math.max(...Object.values(heist.payout)).toLocaleString()}\n\n` +
      `📋 *Prep Steps:*\n${heist.prep.map(p => `• ${p}`).join('\n')}\n\n` +
      `_Use *.gtajoinheist ${id}* for others to join, then *.gtaexecuteheist*_ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE[id] || GTA_SCENE.heist, text, reply)
  },

  async gtajoinheist({ reply, sender, jid, args }) {
    if (!activeHeists[jid]) return reply(`❌ No active heist in this group. Someone use *.gtastartheist <id>* first.`)
    const h = activeHeists[jid]
    if (h.members.includes(sender)) return reply(`⚠️ You're already in this heist.`)
    if (h.members.length >= h.heist.maxPlayers) return reply(`❌ Heist is full (${h.heist.maxPlayers} max).`)
    h.members.push(sender)
    return reply(`✅ Joined *${h.heist.name}*!\n\n👥 Crew: ${h.members.length}/${h.heist.maxPlayers}\n\n_Stay frosty._ 🏙️`)
  },

  async gtaexecuteheist({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const active = activeHeists[jid]
    if (!active) return reply(`❌ No active heist. Use *.gtastartheist <id>* first.`)
    if (active.leader !== sender) return reply(`❌ Only the heist leader can execute.`)
    const success = Math.random() < 0.65
    const heist = active.heist
    delete activeHeists[jid]
    if (!success) {
      for (const m of active.members) {
        const mGta = await getGtaData(m)
        mGta.wanted = Math.min(5, (mGta.wanted || 0) + 3)
        await saveGtaData(m, mGta)
      }
      const text = `❌ *HEIST FAILED — ${heist.name}*\n\n🚨 Something went wrong. The whole crew is wanted!\n\n_Plan better next time._ 🏙️`
      return sendImgOrText(sock, jid, msg, GTA_SCENE.wanted, text, reply)
    }
    const totalPayout = Math.max(...Object.values(heist.payout))
    const split = Math.floor(totalPayout / active.members.length)
    for (const m of active.members) {
      const mGta = await getGtaData(m)
      mGta.cash = (mGta.cash || 0) + split
      mGta.rp = (mGta.rp || 0) + 2000
      mGta.totalHeists = (mGta.totalHeists || 0) + 1
      await saveGtaData(m, mGta)
    }
    const text =
      `💎 *HEIST SUCCESS — ${heist.name}*\n\n` +
      `💰 Total Payout: $${totalPayout.toLocaleString()}\n` +
      `👥 Crew: ${active.members.length}\n` +
      `💵 Each Cut: $${split.toLocaleString()}\n` +
      `⭐ +2,000 RP each\n\n` +
      `_The score of a lifetime._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE[active.heistId] || GTA_SCENE.heist, text, reply)
  },

  // Individual heist shortcuts
  async gtafleeca({ sock, jid, msg, reply, sender }) { return module.exports.gtastartheist({ sock, jid, msg, reply, sender, args: ['fleeca'] }) },
  async gtadiamond({ sock, jid, msg, reply, sender }) { return module.exports.gtastartheist({ sock, jid, msg, reply, sender, args: ['diamond'] }) },
  async gtacayo({ sock, jid, msg, reply, sender }) { return module.exports.gtastartheist({ sock, jid, msg, reply, sender, args: ['cayo'] }) },
  async gtapacific({ sock, jid, msg, reply, sender }) { return module.exports.gtastartheist({ sock, jid, msg, reply, sender, args: ['pacific'] }) },
  async gtahumane({ sock, jid, msg, reply, sender }) { return module.exports.gtastartheist({ sock, jid, msg, reply, sender, args: ['humane'] }) },
  async gtadoomsday({ sock, jid, msg, reply, sender }) { return module.exports.gtastartheist({ sock, jid, msg, reply, sender, args: ['doomsday'] }) },

  // ──────────────────── VEHICLES ──────────────────────────────────
  async gtacars({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const list = Object.entries(VEHICLES)
      .map(([id, v]) => `${v.emoji} *${v.name}* (${v.type})\n  💰 $${v.price > 0 ? v.price.toLocaleString() : 'FREE'} | Speed: ${'⚡'.repeat(v.speed)}`)
      .join('\n\n')
    const text = `🚗 *PREMIUM DELUXE MOTORSPORT*\n\n${list}\n\n_Use *.gtabuyvehicle <id>* to purchase._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.cars, text, reply)
  },

  async gtabuyvehicle({ sock, jid, msg, reply, sender, args }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const id = args[0]?.toLowerCase()
    const vehicle = VEHICLES[id]
    if (!vehicle) return reply(`❌ Unknown vehicle. Use *.gtacars* to browse.\n\nOptions: ${Object.keys(VEHICLES).join(', ')}`)
    if (vehicle.price > 0 && (gta.cash || 0) < vehicle.price) {
      return reply(`❌ Not enough cash!\n\n💰 You have: $${(gta.cash || 0).toLocaleString()}\n💵 Need: $${vehicle.price.toLocaleString()}`)
    }
    if (vehicle.price > 0) gta.cash = (gta.cash || 0) - vehicle.price
    gta.vehicle = id
    await saveGtaData(sender, gta)
    const text = `${vehicle.emoji} *VEHICLE PURCHASED — ${vehicle.name}*\n\n${vehicle.type} class\n💰 Paid: $${vehicle.price > 0 ? vehicle.price.toLocaleString() : '0 (stolen!)'}\n⚡ Speed: ${'⚡'.repeat(vehicle.speed)}\n\n_She's a beauty._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.cars, text, reply)
  },

  async gtagarage({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    if (!gta.vehicle) {
      const text = `🏠 *GARAGE — EMPTY*\n\nYou don't own a vehicle.\n\nUse *.gtacars* to browse and *.gtabuyvehicle <id>* to buy. 🏙️`
      return sendImgOrText(sock, jid, msg, GTA_SCENE.garage, text, reply)
    }
    const v = VEHICLES[gta.vehicle]
    const text = `🏠 *YOUR GARAGE*\n\n${v?.emoji || '🚗'} *${v?.name || gta.vehicle}*\n🏎️ Type: ${v?.type || 'Unknown'}\n⚡ Speed: ${'⚡'.repeat(v?.speed || 1)}\n\n_Keep it clean._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.garage, text, reply)
  },

  async gtarace({ sock, jid, msg, reply, sender, args }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    const target = mentionedJid ? mentionedJid.split('@')[0].split(':')[0] : 'an NPC racer'
    if (!gta.vehicle) return reply(`❌ You need a vehicle to race!\n\nUse *.gtabuyvehicle* first.`)
    const myV = VEHICLES[gta.vehicle]
    const mySpeed = myV?.speed || 1
    const oppSpeed = Math.floor(Math.random() * 10) + 1
    const win = mySpeed >= oppSpeed || Math.random() < 0.5
    const prize = win ? Math.floor(Math.random() * 20000 + 5000) : 0
    gta.cash = (gta.cash || 0) + prize
    gta.rp = (gta.rp || 0) + (win ? 300 : 50)
    await saveGtaData(sender, gta)
    const text =
      `🏁 *STREET RACE*\n\n` +
      `🚗 Your ride: ${myV?.emoji} ${myV?.name} (Speed ${mySpeed})\n` +
      `🏎️ Opponent: ${target} (Speed ${oppSpeed})\n\n` +
      `${win ? `✅ *YOU WIN!*\n💰 +$${prize.toLocaleString()}\n⭐ +300 RP` : `❌ *LOST!*\n⭐ +50 RP\n_Better luck next time._`}\n\n` +
      `_Fastest in Los Santos._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.race, text, reply)
  },

  async gtadriveby({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    if (!gta.vehicle) return reply(`❌ Need a vehicle for a drive-by!\n\nUse *.gtabuyvehicle* first.`)
    const remaining = await db.getCooldown(sender, 'gtadriveby')
    if (remaining > 0) return reply(`⏳ Cooldown: ${Math.ceil(remaining / 60000)} min.`)
    const success = Math.random() < 0.60
    gta.wanted = Math.min(5, (gta.wanted || 0) + 2)
    await db.setCooldown(sender, 'gtadriveby', 15 * 60)
    if (success) {
      const loot = Math.floor(Math.random() * 8000 + 2000)
      gta.cash = (gta.cash || 0) + loot
      gta.rp = (gta.rp || 0) + 150
      await saveGtaData(sender, gta)
      const text = `🔫 *DRIVE-BY*\n\n✅ Clean hit. Rival crew shook.\n💰 +$${loot.toLocaleString()}\n⭐ +150 RP\n⭐ Wanted: ${wantedStars(gta.wanted)}\n\n_Gone before they saw the plates._ 🏙️`
      return sendImgOrText(sock, jid, msg, GTA_SCENE.driveby, text, reply)
    }
    await saveGtaData(sender, gta)
    const text = `🔫 *DRIVE-BY FAILED*\n\nThey shot back. Barely made it out.\n⭐ Wanted: ${wantedStars(gta.wanted)}\n\n_Tinted windows next time._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.driveby, text, reply)
  },

  // ──────────────────── WEAPONS ──────────────────────────────────
  async gtaweapons({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const rank = gtaRank(gta.rp || 0)
    const list = Object.entries(WEAPONS)
      .map(([id, w]) => `${w.emoji} *${w.name}* — $${w.price.toLocaleString()} | DMG: ${w.damage} | Req: Rank ${w.level}${rank.rank < w.level ? ' ❌' : ' ✅'}`)
      .join('\n')
    const text = `🔫 *AMMU-NATION — WEAPONS SHOP*\n\n${list}\n\n_Use *.gtabuygun <id>* to purchase._\n\nYour cash: $${(gta.cash || 0).toLocaleString()} 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.weapons, text, reply)
  },

  async gtabuygun({ sock, jid, msg, reply, sender, args }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const id = args[0]?.toLowerCase()
    const weapon = WEAPONS[id]
    if (!weapon) return reply(`❌ Unknown weapon.\n\nOptions: ${Object.keys(WEAPONS).join(', ')}`)
    const rank = gtaRank(gta.rp || 0)
    if (rank.rank < weapon.level) return reply(`❌ Need Rank ${weapon.level} for ${weapon.name}. Your rank: ${rank.rank}`)
    if ((gta.cash || 0) < weapon.price) return reply(`❌ Not enough cash. Need $${weapon.price.toLocaleString()}, have $${(gta.cash || 0).toLocaleString()}`)
    if ((gta.weapons || []).includes(id)) return reply(`⚠️ You already own a *${weapon.name}*.`)
    gta.cash = (gta.cash || 0) - weapon.price
    gta.weapons = [...(gta.weapons || []), id]
    await saveGtaData(sender, gta)
    const text = `${weapon.emoji} *WEAPON PURCHASED — ${weapon.name}*\n\n💰 Cost: $${weapon.price.toLocaleString()}\n💥 Damage: ${weapon.damage}\n\n_Locked and loaded._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.weapons, text, reply)
  },

  async gtatshoot({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const remaining = await db.getCooldown(sender, 'gtatshoot')
    if (remaining > 0) return reply(`⏳ Cooldown: ${Math.ceil(remaining / 60000)} min.`)
    const xp = Math.floor(Math.random() * 30 + 10)
    gta.skills = gta.skills || {}
    gta.skills.shooting = Math.min(500, (gta.skills.shooting || 0) + xp)
    gta.rp = (gta.rp || 0) + 50
    await saveGtaData(sender, gta)
    await db.setCooldown(sender, 'gtatshoot', 10 * 60)
    const text = `🎯 *TARGET PRACTICE*\n\n💥 Hit rate: ${Math.floor(Math.random() * 40 + 60)}%\n⭐ Shooting XP: +${xp} (${gta.skills.shooting}/500)\n⭐ +50 RP\n\n_Stay sharp._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.shoot, text, reply)
  },

  // ──────────────────── GANGS ──────────────────────────────────────
  async gtagangs({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const list = Object.entries(GANGS)
      .map(([id, g]) => `${g.color} *${g.name}*\n  📍 ${g.turf} | 🎯 ${g.bonus}`)
      .join('\n\n')
    const text = `🔫 *STREET GANGS OF LOS SANTOS*\n\n${list}\n\n_Use *.gtajoingang <id>* to pledge._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.gang, text, reply)
  },

  async gtajoingang({ sock, jid, msg, reply, sender, args }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    if (gta.isCop) return reply(`❌ Cops can't join gangs! Use *.gtaquitcop* first.`)
    const id = args[0]?.toLowerCase()
    const gang = GANGS[id]
    if (!gang) return reply(`❌ Unknown gang. Options: ${Object.keys(GANGS).join(', ')}`)
    if (gta.gang === id) return reply(`⚠️ You're already in *${gang.name}*.`)
    if (gta.gang) return reply(`❌ Leave *${GANGS[gta.gang]?.name}* first with *.gtaleavegang*`)
    gta.gang = id
    await saveGtaData(sender, gta)
    const text = `${gang.color} *GANG JOINED — ${gang.name}*\n\n📍 Turf: ${gang.turf}\n🎯 Bonus: ${gang.bonus}\n\n_Ride or die._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.gang, text, reply)
  },

  async gtagang({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    if (!gta.gang) return reply(`❌ You're not in a gang.\n\nUse *.gtagangs* to see the list.`)
    const gang = GANGS[gta.gang]
    const text = `${gang.color} *YOUR GANG — ${gang.name}*\n\n📍 Turf: ${gang.turf}\n🎯 Bonus: ${gang.bonus}\n\n_Loyalty runs deep._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.gang, text, reply)
  },

  async gtagangwar({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    if (!gta.gang) return reply(`❌ Join a gang first with *.gtajoingang*`)
    const remaining = await db.getCooldown(sender, 'gtagangwar')
    if (remaining > 0) return reply(`⏳ Cooldown: ${Math.ceil(remaining / 60000)} min.`)
    const gang = GANGS[gta.gang]
    const enemies = Object.entries(GANGS).filter(([id]) => id !== gta.gang)
    const [enemyId, enemy] = enemies[Math.floor(Math.random() * enemies.length)]
    const win = Math.random() < 0.55
    const rp = win ? 800 : 100
    const cash = win ? Math.floor(Math.random() * 20000 + 5000) : 0
    gta.rp = (gta.rp || 0) + rp
    if (cash) gta.cash = (gta.cash || 0) + cash
    gta.wanted = Math.min(5, (gta.wanted || 0) + 2)
    await saveGtaData(sender, gta)
    await db.setCooldown(sender, 'gtagangwar', 30 * 60)
    const text =
      `🔫 *GANG WAR*\n\n` +
      `${gang.color} *${gang.name}* vs ${enemy.color} *${enemy.name}*\n\n` +
      `${win
        ? `✅ *Your crew WON!*\n💰 +$${cash.toLocaleString()}\n⭐ +${rp} RP\n📍 Turf secured!`
        : `❌ *Your crew was pushed back.*\n⭐ +${rp} RP`
      }\n` +
      `⭐ Wanted: ${wantedStars(gta.wanted)}\n\n` +
      `_The streets never forget._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.gangwar, text, reply)
  },

  async gtaleavegang({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    if (!gta.gang) return reply(`❌ You're not in any gang.`)
    const old = GANGS[gta.gang]?.name || gta.gang
    gta.gang = null
    await saveGtaData(sender, gta)
    return reply(`🚶 Left *${old}*.\n\n_Going solo has its own risks._ 🏙️`)
  },

  // ──────────────────── POLICE / WANTED ────────────────────────
  async gtacop({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    if (gta.gang) return reply(`❌ Leave your gang first with *.gtaleavegang*`)
    gta.isCop = true
    gta.wanted = 0
    await saveGtaData(sender, gta)
    const text = `👮 *JOINED LSPD*\n\nYou are now an officer of the law.\n\n🚔 You can arrest wanted players\n✅ Your wanted level has been cleared\n\n_Protect and serve. Or abuse the badge. Your call._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.cop, text, reply)
  },

  async gtaquitcop({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    gta.isCop = false
    await saveGtaData(sender, gta)
    return reply(`🚶 *LEFT LSPD*\n\nBadge turned in. Back to the streets.\n\n_The city missed you._ 🏙️`)
  },

  async gtaescape({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    if (!gta.wanted) return reply(`✅ You have no wanted level. You're clean.`)
    const remaining = await db.getCooldown(sender, 'gtaescape')
    if (remaining > 0) return reply(`⏳ Escape cooldown: ${Math.ceil(remaining / 60000)} min.`)
    const success = Math.random() < 0.65
    await db.setCooldown(sender, 'gtaescape', 10 * 60)
    if (!success) {
      const text = `🚨 *ESCAPE FAILED*\n\n⭐ Wanted: ${wantedStars(gta.wanted)}\n\n❌ Cops cornered you! Wanted level increased.\n\n_They had helicopters. You had a Comet._ 🏙️`
      return sendImgOrText(sock, jid, msg, GTA_SCENE.escape, text, reply)
    }
    gta.wanted = 0
    await saveGtaData(sender, gta)
    const text = `✅ *ESCAPED*\n\n⭐ Wanted level: CLEARED\n\n_Ghost. Clean. Free._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.escape, text, reply)
  },

  async gtawanted({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const text = `⭐ *WANTED LEVEL*\n\n${wantedStars(gta.wanted || 0)}\n\n${gta.wanted === 0 ? '✅ Clean record' : gta.wanted >= 4 ? '🚨 FULL PURSUIT — military deployed!' : '⚠️ Police are looking for you'}\n\n_Use *.gtaescape* to lose the heat._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.wanted, text, reply)
  },

  async gtaarrest({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    if (!gta.isCop) return reply(`❌ Only LSPD officers can arrest players!`)
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    if (!mentionedJid) return reply(`❌ Usage: *.gtaarrest @player*`)
    const targetPhone = mentionedJid.split('@')[0].split(':')[0]
    const targetGta = await getGtaData(targetPhone)
    if (!targetGta.created) return reply(`❌ That player has no GTA character.`)
    if (!targetGta.wanted) return reply(`❌ @${targetPhone} has a clean record.`)
    const bail = targetGta.wanted * 5000
    targetGta.cash = Math.max(0, (targetGta.cash || 0) - bail)
    targetGta.wanted = 0
    await saveGtaData(targetPhone, targetGta)
    gta.rp = (gta.rp || 0) + 500
    await saveGtaData(sender, gta)
    const text = `👮 *ARREST MADE*\n\n🎯 Arrested @${targetPhone}\n💰 Bail deducted: $${bail.toLocaleString()}\n⭐ Officer earned: +500 RP\n\n_Law and order, Los Santos style._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.arrest, text, reply)
  },

  // ──────────────────── SCHOOL SYSTEM ────────────────────────────
  async gtaschool({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const subjectList = SCHOOL_SUBJECTS.map((s, i) =>
      `${i + 1}. *${s.name}* (${s.skill})\n   📖 ${s.desc}\n   ⭐ +${s.xp} XP | ⏱️ ${s.duration}`
    ).join('\n\n')
    const role = gta.schoolRole || 'Not enrolled'
    const text =
      `🎓 *LOS SANTOS ACADEMY*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 Your Role: *${role}*\n\n` +
      `📚 *Subjects:*\n${subjectList}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `📌 Commands:\n` +
      `• *.gtaenroll* — Enroll as student\n` +
      `• *.gtalearn <1-8>* — Take a class\n` +
      `• *.gtateach <1-8>* — Teach a class (teachers only)\n` +
      `• *.gtainviteschool @player* — Invite to school\n` +
      `• *.gtapromote @player <role>* — Promote a student\n` +
      `• *.gtagraduate* — Graduate when ready\n` +
      `• *.gtacreateschool <name>* — Create your own school\n` +
      `• *.gtaschools* — Browse custom schools\n\n` +
      `_Knowledge is the real weapon._ 🎓`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.school, text, reply)
  },

  async gtaenroll({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    if (gta.schoolRole) return reply(`✅ Already enrolled as *${gta.schoolRole}*.\n\nUse *.gtalearn <subject>* to study.`)
    gta.schoolRole = 'student'
    gta.schoolXp = 0
    await saveGtaData(sender, gta)
    return reply(`🎓 *ENROLLED — Los Santos Academy*\n\n👤 Role: *Student*\n\n📚 Use *.gtalearn <number>* to take classes.\nSubjects: 1-Driving, 2-Weapons, 3-Hacking, 4-Stealth, 5-Flying, 6-Finance, 7-Street, 8-Heist\n\n_Education never hurt nobody. Mostly._ 🎓`)
  },

  async gtainviteschool({ reply, sender, args, msg }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    if (!['teacher', 'headmaster', 'principal', 'dean'].includes(gta.schoolRole)) {
      return reply(`❌ Only teachers and above can invite players to school.`)
    }
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    if (!mentionedJid) return reply(`❌ Usage: *.gtainviteschool @player*`)
    const targetPhone = mentionedJid.split('@')[0].split(':')[0]
    schoolInvites[targetPhone] = { invitedBy: sender, subject: null }
    return reply(`🎓 *INVITATION SENT*\n\n📨 @${targetPhone} has been invited to *Los Santos Academy*!\n\nThey can use *.gtaenroll* to join.\n\n_The more, the deadlier._ 🎓`)
  },

  async gtalearn({ sock, jid, msg, reply, sender, args }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    if (!gta.schoolRole) return reply(`❌ Enroll first with *.gtaenroll*`)
    const num = parseInt(args[0]) - 1
    const subject = SCHOOL_SUBJECTS[num]
    if (isNaN(num) || !subject) return reply(`❌ Choose a subject 1-${SCHOOL_SUBJECTS.length}\n\nUse *.gtaschool* to see the list.`)
    const remaining = await db.getCooldown(sender, `gtalearn_${subject.skill}`)
    if (remaining > 0) return reply(`⏳ Class cooldown: ${Math.ceil(remaining / 60000)} min left.`)
    const xpGain = subject.xp + Math.floor(Math.random() * 50)
    gta.skills = gta.skills || {}
    gta.skills[subject.skill] = Math.min(500, (gta.skills[subject.skill] || 0) + xpGain)
    gta.schoolXp = (gta.schoolXp || 0) + xpGain
    gta.rp = (gta.rp || 0) + 100
    await saveGtaData(sender, gta)
    await db.setCooldown(sender, `gtalearn_${subject.skill}`, 10 * 60)
    const text =
      `📚 *CLASS COMPLETE — ${subject.name}*\n\n` +
      `⭐ Skill: ${subject.skill} → ${gta.skills[subject.skill]}/500\n` +
      `📊 School XP: ${gta.schoolXp}\n` +
      `⭐ +100 RP\n\n` +
      `${gta.schoolXp >= 2000 && gta.schoolRole === 'student' ? '🎓 *Ready to graduate!* Use *.gtagraduate*' : ''}\n` +
      `_Study hard. Hustle harder._ 🎓`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.school, text, reply)
  },

  async gtateach({ sock, jid, msg, reply, sender, args, isGroup, jid: _jid }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    if (!['teacher', 'headmaster', 'principal', 'dean'].includes(gta.schoolRole)) {
      return reply(`❌ Only teachers and above can run classes.\n\nGet promoted with *.gtapromote* or ask a headmaster.`)
    }
    const num = parseInt(args[0]) - 1
    const subject = SCHOOL_SUBJECTS[num]
    if (isNaN(num) || !subject) return reply(`❌ Choose subject 1-${SCHOOL_SUBJECTS.length}\n\nUse *.gtaschool* to see the list.`)
    const remaining = await db.getCooldown(sender, 'gtateach')
    if (remaining > 0) return reply(`⏳ Teaching cooldown: ${Math.ceil(remaining / 60000)} min.`)
    gta.rp = (gta.rp || 0) + 500
    gta.cash = (gta.cash || 0) + 5000
    await saveGtaData(sender, gta)
    await db.setCooldown(sender, 'gtateach', 15 * 60)
    const text =
      `📖 *CLASS IN SESSION — ${subject.name}*\n\n` +
      `👨‍🏫 Teacher: @${sender}\n` +
      `📚 Subject: ${subject.name}\n` +
      `📖 ${subject.desc}\n\n` +
      `💰 Teacher Pay: +$5,000\n` +
      `⭐ +500 RP\n\n` +
      `_All students use *.gtalearn ${num + 1}* to earn skill XP from this class!_\n\n` +
      `_A good teacher changes lives. A great one changes the game._ 🎓`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.school, text, reply)
  },

  async gtapromote({ reply, sender, args, msg }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    if (!['headmaster', 'principal', 'dean'].includes(gta.schoolRole)) {
      return reply(`❌ Only headmasters and above can promote players.`)
    }
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    const newRole = args[1]?.toLowerCase() || args[0]?.toLowerCase()
    if (!mentionedJid || !SCHOOL_ROLES.includes(newRole)) {
      return reply(`❌ Usage: *.gtapromote @player <role>*\n\nRoles: ${SCHOOL_ROLES.join(', ')}`)
    }
    const targetPhone = mentionedJid.split('@')[0].split(':')[0]
    const targetGta = await getGtaData(targetPhone)
    if (!targetGta.created) return reply(`❌ That player has no GTA character.`)
    if (!targetGta.schoolRole) return reply(`❌ That player is not enrolled in school.`)
    targetGta.schoolRole = newRole
    await saveGtaData(targetPhone, targetGta)
    return reply(`🎓 *PROMOTED*\n\n👤 @${targetPhone} is now a *${newRole.charAt(0).toUpperCase() + newRole.slice(1)}*!\n\n_The academy grows stronger._ 🎓`)
  },

  async gtagraduate({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    if (gta.schoolRole !== 'student') return reply(`❌ Only enrolled students can graduate.`)
    if ((gta.schoolXp || 0) < 2000) return reply(`❌ Need 2,000 School XP to graduate.\n\n📊 Your XP: ${gta.schoolXp || 0}/2,000\n\nKeep taking classes with *.gtalearn*`)
    gta.schoolRole = 'teacher'
    gta.cash = (gta.cash || 0) + 25000
    gta.rp = (gta.rp || 0) + 3000
    await saveGtaData(sender, gta)
    return reply(
      `🎓 *GRADUATION DAY*\n\n` +
      `🏆 Congratulations @${sender}!\n\n` +
      `👨‍🏫 You are now a *Teacher* at Los Santos Academy!\n` +
      `💰 Graduation bonus: +$25,000\n` +
      `⭐ +3,000 RP\n\n` +
      `📌 You can now:\n` +
      `• *.gtateach* — Run classes\n` +
      `• *.gtainviteschool @player* — Invite students\n\n` +
      `_From student to teacher. The cycle continues._ 🎓`
    )
  },

  async gtaschoolrole({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const role = gta.schoolRole || 'Not enrolled'
    const xp = gta.schoolXp || 0
    return reply(`🎓 *SCHOOL ROLE*\n\n👤 Role: *${role}*\n📊 School XP: ${xp}\n\n${role === 'student' ? `Progress: ${xp}/2,000 to graduate` : role === 'teacher' ? '👨‍🏫 You can teach classes!' : '🎓 Senior staff — keep the academy running!'}\n\n_Use *.gtaschool* for all school commands._ 🎓`)
  },

  // ──────────────────── CUSTOM SCHOOLS ────────────────────────────
  async gtacreateschool({ sock, jid, msg, reply, sender, args }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const rank = gtaRank(gta.rp || 0)
    if (rank.rank < 20) return reply(`❌ Need *Rank 20* to create a school.\n\nYour rank: ${rank.rank}`)
    const CREATE_COST = 50000
    if ((gta.cash || 0) < CREATE_COST) return reply(`❌ Need $${CREATE_COST.toLocaleString()} to open a school.\n\nYou have: $${(gta.cash || 0).toLocaleString()}`)
    const schoolName = args.join(' ').trim()
    if (!schoolName || schoolName.length < 3) return reply(`❌ Provide a school name (min 3 chars).\n\nUsage: *.gtacreateschool <name>*`)
    if (schoolName.length > 40) return reply(`❌ School name too long (max 40 chars).`)

    // Check if they already own a school
    if (gta.mySchoolId && customSchools[gta.mySchoolId]) {
      return reply(`❌ You already own *${customSchools[gta.mySchoolId].name}*.\n\nManage it with *.gtamyschool*`)
    }

    const id = shortId(6)
    const school = {
      id,
      name: schoolName,
      creatorPhone: sender,
      groupId: jid,
      description: `A custom academy in Los Santos, run by ${gta.name || sender}.`,
      subjects: [...SCHOOL_SUBJECTS],
      members: { [sender]: 'dean' },
      fee: 0,
      createdAt: Date.now(),
    }
    customSchools[id] = school
    gta.cash = (gta.cash || 0) - CREATE_COST
    gta.mySchoolId = id
    gta.schoolRole = 'dean'
    gta.schoolXp = gta.schoolXp || 0
    await saveGtaData(sender, gta)

    const text =
      `🎓 *SCHOOL FOUNDED!*\n\n` +
      `🏫 *${schoolName}*\n` +
      `🆔 School ID: \`${id}\`\n` +
      `👤 Dean: ${gta.name || sender}\n` +
      `💰 Cost: -$${CREATE_COST.toLocaleString()}\n\n` +
      `📋 Commands:\n` +
      `• *.gtamyschool* — Manage your school\n` +
      `• *.gtaschoolinvite @player* — Invite students\n` +
      `• *.gtaschoolset desc <text>* — Set description\n` +
      `• *.gtaschoolset fee <amount>* — Set enrollment fee\n\n` +
      `_Build the next generation of Los Santos criminals._ 🎓`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.school, text, reply)
  },

  async gtaschools({ sock, jid, msg, reply }) {
    const schools = Object.values(customSchools)
    if (!schools.length) {
      return reply(`🎓 *CUSTOM SCHOOLS*\n\nNo custom schools yet.\n\nCreate one with *.gtacreateschool <name>* 🏙️`)
    }
    const list = schools.slice(0, 10).map((s, i) =>
      `${i + 1}. *${s.name}* [ID: \`${s.id}\`]\n   👥 ${Object.keys(s.members).length} member(s) | 💰 Fee: $${(s.fee || 0).toLocaleString()}\n   📖 ${s.description || 'No description'}`
    ).join('\n\n')
    const text = `🎓 *CUSTOM SCHOOLS OF LOS SANTOS*\n\n${list}\n\n_Join with *.gtajoinschool <id>*_ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.school, text, reply)
  },

  async gtajoinschool({ sock, jid, msg, reply, sender, args }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const id = args[0]?.toLowerCase()
    if (!id) return reply(`❌ Usage: *.gtajoinschool <school_id>*\n\nBrowse with *.gtaschools*`)
    const school = customSchools[id]
    if (!school) return reply(`❌ School not found. Use *.gtaschools* to browse.`)
    if (school.members[sender]) return reply(`⚠️ You're already in *${school.name}*.`)
    if (school.fee > 0 && (gta.cash || 0) < school.fee) {
      return reply(`❌ Enrollment fee: $${school.fee.toLocaleString()}. You have $${(gta.cash || 0).toLocaleString()}`)
    }
    if (school.fee > 0) gta.cash = (gta.cash || 0) - school.fee
    school.members[sender] = 'student'
    gta.customSchool = { schoolId: id, schoolName: school.name, role: 'student' }
    if (!gta.schoolRole) gta.schoolRole = 'student'
    await saveGtaData(sender, gta)
    const text = `🎓 *ENROLLED — ${school.name}*\n\n👤 Role: *Student*\n${school.fee > 0 ? `💰 Paid: $${school.fee.toLocaleString()}\n` : ''}🆔 School ID: \`${id}\`\n\n_Welcome to ${school.name}. Learn well._ 🎓`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.school, text, reply)
  },

  async gtamyschool({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const schoolId = gta.mySchoolId
    const school = schoolId ? customSchools[schoolId] : null
    if (!school) return reply(`❌ You don't own a school.\n\nCreate one with *.gtacreateschool <name>*`)
    const memberCount = Object.keys(school.members).length
    const text =
      `🎓 *MY SCHOOL — ${school.name}*\n\n` +
      `🆔 ID: \`${school.id}\`\n` +
      `👥 Members: ${memberCount}\n` +
      `💰 Enrollment Fee: $${(school.fee || 0).toLocaleString()}\n` +
      `📖 ${school.description}\n\n` +
      `📋 Management:\n` +
      `• *.gtaschoolset fee <amount>* — Set enrollment fee\n` +
      `• *.gtaschoolset desc <text>* — Update description\n` +
      `• *.gtaschoolinvite @player* — Invite someone\n` +
      `• *.gtaschoolkick @player* — Remove a student\n\n` +
      `_Your empire of education._ 🎓`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.school, text, reply)
  },

  async gtaschoolset({ reply, sender, args }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const school = gta.mySchoolId ? customSchools[gta.mySchoolId] : null
    if (!school) return reply(`❌ You don't own a school.`)
    const sub = args[0]?.toLowerCase()
    if (sub === 'fee') {
      const fee = parseInt(args[1]) || 0
      if (fee < 0) return reply(`❌ Fee can't be negative.`)
      school.fee = fee
      return reply(`✅ Enrollment fee set to $${fee.toLocaleString()}`)
    }
    if (sub === 'desc') {
      const desc = args.slice(1).join(' ')
      if (!desc) return reply(`❌ Provide a description.`)
      school.description = desc
      return reply(`✅ Description updated.`)
    }
    return reply(`❌ Options: *.gtaschoolset fee <amount>* | *.gtaschoolset desc <text>*`)
  },

  async gtaschoolinvite({ reply, sender, args, msg }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const school = gta.mySchoolId ? customSchools[gta.mySchoolId] : null
    if (!school && !['teacher', 'headmaster', 'principal', 'dean'].includes(gta.schoolRole)) {
      return reply(`❌ You need to be a teacher or own a school to invite.`)
    }
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    if (!mentionedJid) return reply(`❌ Usage: *.gtaschoolinvite @player*`)
    const targetPhone = mentionedJid.split('@')[0].split(':')[0]
    schoolInvites[targetPhone] = { invitedBy: sender, schoolId: school?.id }
    return reply(`🎓 *INVITATION SENT*\n\n📨 @${targetPhone} invited to *${school?.name || 'Los Santos Academy'}*!\n\nThey can use *.gtajoinschool ${school?.id || ''}* to join.\n\n_The network grows._ 🎓`)
  },

  async gtaschoolkick({ reply, sender, args, msg }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const school = gta.mySchoolId ? customSchools[gta.mySchoolId] : null
    if (!school) return reply(`❌ You don't own a school.`)
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    if (!mentionedJid) return reply(`❌ Usage: *.gtaschoolkick @player*`)
    const targetPhone = mentionedJid.split('@')[0].split(':')[0]
    if (!school.members[targetPhone]) return reply(`❌ @${targetPhone} is not in your school.`)
    if (targetPhone === sender) return reply(`❌ Can't kick yourself.`)
    delete school.members[targetPhone]
    return reply(`🚪 *REMOVED*\n\n@${targetPhone} has been removed from *${school.name}*.\n\n_No tolerance for dead weight._ 🎓`)
  },

  // ──────────────────── CASINO ────────────────────────────────────
  async gtacasino({ sock, jid, msg, reply, sender, args }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const bet = parseInt(args[0]) || 1000
    if ((gta.cash || 0) < bet) return reply(`❌ Not enough cash. You have $${(gta.cash || 0).toLocaleString()}`)
    const outcomes = [
      { name: '🎰 Jackpot!', mult: 10, chance: 0.02 },
      { name: '💎 Big Win',  mult: 3,  chance: 0.10 },
      { name: '✅ Win',      mult: 2,  chance: 0.25 },
      { name: '💔 Loss',     mult: 0,  chance: 0.63 },
    ]
    let rand = Math.random()
    let outcome = outcomes[outcomes.length - 1]
    for (const o of outcomes) {
      if (rand < o.chance) { outcome = o; break }
      rand -= o.chance
    }
    const winnings = Math.floor(bet * outcome.mult) - bet
    gta.cash = Math.max(0, (gta.cash || 0) + winnings)
    gta.rp = (gta.rp || 0) + (winnings > 0 ? 100 : 10)
    await saveGtaData(sender, gta)
    const text = `🎰 *DIAMOND CASINO*\n\nBet: $${bet.toLocaleString()}\n${outcome.name}${winnings > 0 ? `\n💰 +$${winnings.toLocaleString()}` : winnings < 0 ? `\n💸 -$${bet.toLocaleString()}` : '\n↔️ Push'}\n\n💵 Balance: $${(gta.cash || 0).toLocaleString()}\n\n_The house always wins. Except when it doesn't._ 🎰`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.casino, text, reply)
  },

  async gtastrip({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const remaining = await db.getCooldown(sender, 'gtastrip')
    if (remaining > 0) return reply(`⏳ Cooldown: ${Math.ceil(remaining / 60000)} min.`)
    const spent = Math.floor(Math.random() * 2000 + 500)
    gta.cash = Math.max(0, (gta.cash || 0) - spent)
    gta.rp = (gta.rp || 0) + 50
    await saveGtaData(sender, gta)
    await db.setCooldown(sender, 'gtastrip', 20 * 60)
    const text = `🍸 *VANILLA UNICORN*\n\nSpent $${spent.toLocaleString()} on drinks and entertainment.\n⭐ +50 RP (for the experience)\n\n_What happens in the Unicorn, stays in the Unicorn._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.strip, text, reply)
  },

  async gtabar({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const remaining = await db.getCooldown(sender, 'gtabar')
    if (remaining > 0) return reply(`⏳ Cooldown: ${Math.ceil(remaining / 60000)} min.`)
    const drinks = ['Liquor', 'Beer', 'Whiskey', 'Brandy', 'Shot of Tequila']
    const drink = drinks[Math.floor(Math.random() * drinks.length)]
    const cost = Math.floor(Math.random() * 500 + 100)
    gta.cash = Math.max(0, (gta.cash || 0) - cost)
    await saveGtaData(sender, gta)
    await db.setCooldown(sender, 'gtabar', 5 * 60)
    const text = `🍺 *BAR TIME*\n\nOrdered: *${drink}*\nCost: $${cost}\n\n_Even criminals need to unwind._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.strip, text, reply)
  },
  async gtadrink(ctx) { return module.exports.gtabar(ctx) },

  async gtafight({ sock, jid, msg, reply, sender, args }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    const target = mentionedJid ? mentionedJid.split('@')[0].split(':')[0] : 'a random pedestrian'
    const win = Math.random() < 0.55
    const earnings = win ? (Math.floor(Math.random() * 3000 + 500)) : -Math.floor(Math.random() * 2000 + 200)
    gta.cash = Math.max(0, (gta.cash || 0) + earnings)
    gta.rp = (gta.rp || 0) + (win ? 200 : 30)
    gta.wanted = Math.min(5, (gta.wanted || 0) + 1)
    await saveGtaData(sender, gta)
    const text = `👊 *STREET FIGHT*\n\n${win ? `✅ You knocked out *${target}*!\n💰 +$${Math.abs(earnings).toLocaleString()}` : `❌ *${target}* got the better of you!\n💸 -$${Math.abs(earnings).toLocaleString()}`}\n⭐ ${win ? '+200' : '+30'} RP\n⭐ Wanted: ${wantedStars(gta.wanted)}\n\n_Fists and bullets — the language of LS._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.fight, text, reply)
  },

  // ──────────────────── STATS / RANK ────────────────────────────
  async gtastats({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const rank = gtaRank(gta.rp || 0)
    return reply(
      `📊 *GTA V STATS*\n\n` +
      `👤 ${gta.name}\n` +
      `📊 Rank: ${rank.rank} — *${rank.name}*\n` +
      `⭐ RP: ${(gta.rp || 0).toLocaleString()}\n` +
      `💰 Cash: $${(gta.cash || 0).toLocaleString()}\n` +
      `🎯 Missions: ${gta.totalMissions || 0}\n` +
      `💎 Heists: ${gta.totalHeists || 0}\n` +
      `🔫 Weapons: ${(gta.weapons || []).length}\n` +
      `${gta.vehicle ? `🚗 Vehicle: ${VEHICLES[gta.vehicle]?.name || gta.vehicle}\n` : ''}` +
      `${gta.gang ? `${GANGS[gta.gang]?.color} Gang: ${GANGS[gta.gang]?.name}\n` : ''}` +
      `${gta.schoolRole ? `🎓 School: ${gta.schoolRole}\n` : ''}` +
      `${gta.isCop ? '👮 Badge: LSPD\n' : ''}` +
      `⭐ Wanted: ${wantedStars(gta.wanted || 0)}\n` +
      `${gta.bounty ? `💀 Bounty: $${gta.bounty.toLocaleString()}\n` : ''}` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `📈 *Skills:*\n` +
      Object.entries(gta.skills || {}).map(([k, v]) => `  ${k}: ${v}/500`).join('\n') +
      `\n\n_Stats don't lie. Streets don't forget._ 🏙️`
    )
  },

  async gtarank({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const rank = gtaRank(gta.rp || 0)
    const thresholds = [1000, 3000, 7000, 15000, 30000, 60000, 100000, 180000, 300000, 500000, 800000]
    const nextRp = thresholds.find(v => v > (gta.rp || 0))
    const progress = nextRp ? `Progress to next: ${(gta.rp || 0).toLocaleString()}/${nextRp.toLocaleString()} RP` : '🏆 MAX RANK!'
    return reply(`📊 *GTA RANK*\n\nRank: *${rank.rank} — ${rank.name}*\n⭐ RP: ${(gta.rp || 0).toLocaleString()}\n${progress}\n\n${rank.rank >= 59 ? '⚠️ _At this rank, missions are BRUTAL. Tread carefully._' : '_Keep grinding for the top._'} 🏙️`)
  },

  async gtaboss({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const rank = gtaRank(gta.rp || 0)
    if (rank.rank < 30) return reply(`❌ Need Rank 30 to become CEO/MC President.\n\nYour rank: ${rank.rank}`)
    if ((gta.cash || 0) < 1000000) return reply(`❌ Need $1,000,000 to register an organization.\n\nYou have: $${(gta.cash || 0).toLocaleString()}`)
    gta.cash = (gta.cash || 0) - 1000000
    gta.isBoss = true
    await saveGtaData(sender, gta)
    const text = `👑 *CEO REGISTERED*\n\n🏢 You are now a CEO / MC President!\n💰 Registration: -$1,000,000\n\n_Command your empire. Tax the streets._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_SCENE.boss, text, reply)
  },

  async gtasocial({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ Create a character first with *.gtastart*`)
    const rank = gtaRank(gta.rp || 0)
    const titles = ['Criminal', 'Baller', 'OG', 'Legend', 'Ghost', 'Phantom', 'The Architect']
    const title = rank.rank >= 80 ? titles[6] : rank.rank >= 60 ? titles[5] : rank.rank >= 40 ? titles[4] : rank.rank >= 30 ? titles[3] : rank.rank >= 20 ? titles[2] : titles[1]
    return reply(`📱 *SOCIAL CLUB*\n\n👤 ${gta.name}\n🏷️ Title: *${title}*\n📊 Rank: ${rank.rank} — ${rank.name}\n⭐ RP: ${(gta.rp || 0).toLocaleString()}\n🎯 Missions: ${gta.totalMissions || 0}\n💎 Heists: ${gta.totalHeists || 0}\n\n_Your reputation precedes you._ 🏙️`)
  },

  // ──────────────────── MENU ────────────────────────────────────────
  async gtamenu({ reply }) {
    return reply(
      `┏❐✦ ɢᴛᴀ ᴠ ʀᴘ sʏsᴛᴇᴍ ✦❐\n` +
      `┃» ᴍᴏᴅᴇ : Los Santos\n` +
      `┃» ᴛʏᴘᴇ : Roleplay Engine\n` +
      `┃» ᴘʀᴇғɪx : [ . ]\n` +
      `┃» ᴠᴇʀsɪᴏɴ : 1.0\n` +
      `┗❐\n\n` +

      `┏❐ 👤 ᴄʜᴀʀᴀᴄᴛᴇʀ\n` +
      `┃ 👤 ᴘʟᴀʏᴇʀ sʏsᴛᴇᴍ\n` +
      `┃ ├ .gtastart\n` +
      `┃ ├ .gtaprofile\n` +
      `┃ ├ .gtacustomize\n` +
      `┃ ├ .gtaoutfit <type>\n` +
      `┃ ├ .gtaname <name>\n` +
      `┃ └ .gtagender male/female\n` +
      `┗❐\n\n` +

      `┏❐ 🗺️ ᴡᴏʀʟᴅ\n` +
      `┃ 🗺️ ᴇxᴘʟᴏʀᴀᴛɪᴏɴ\n` +
      `┃ ├ .gtamap\n` +
      `┃ ├ .gtatravel <place>\n` +
      `┃ ├ .gtalocation\n` +
      `┃ └ .gtaexplore\n` +
      `┗❐\n\n` +

      `┏❐ 🎯 ᴍɪssɪᴏɴs\n` +
      `┃ 🎯 ᴊᴏʙs & ᴛᴀsᴋs\n` +
      `┃ ├ .gtamission\n` +
      `┃ ├ .gtamissions\n` +
      `┃ ├ .gtacomplete\n` +
      `┃ └ .gtafailmission\n` +
      `┗❐\n\n` +

      `┏❐ 💰 ᴇᴄᴏɴᴏᴍʏ\n` +
      `┃ 💰 ᴍᴏɴᴇʏ sʏsᴛᴇᴍ\n` +
      `┃ ├ .gtawork\n` +
      `┃ ├ .gtarob\n` +
      `┃ ├ .gtadrug\n` +
      `┃ ├ .gtasteal\n` +
      `┃ ├ .gtahackbank\n` +
      `┃ ├ .gtabounty @player $amt\n` +
      `┃ └ .gtacollect @player\n` +
      `┗❐\n\n` +

      `┏❐ 💎 ʜᴇɪsᴛs\n` +
      `┃ 💎 ʙɪɢ sᴄᴏʀᴇs\n` +
      `┃ ├ .gtaheist\n` +
      `┃ ├ .gtastartheist <id>\n` +
      `┃ ├ .gtajoinheist <id>\n` +
      `┃ ├ .gtaexecuteheist\n` +
      `┃ ├ .gtafleeca\n` +
      `┃ ├ .gtadiamond\n` +
      `┃ ├ .gtacayo\n` +
      `┃ ├ .gtapacific\n` +
      `┃ ├ .gtahumane\n` +
      `┃ └ .gtadoomsday\n` +
      `┗❐\n\n` +

      `┏❐ 🚗 ᴠᴇʜɪᴄʟᴇs\n` +
      `┃ 🚗 ᴄᴀʀ sʏsᴛᴇᴍ\n` +
      `┃ ├ .gtacars\n` +
      `┃ ├ .gtabuyvehicle <id>\n` +
      `┃ ├ .gtagarage\n` +
      `┃ ├ .gtarace @player\n` +
      `┃ └ .gtadriveby @player\n` +
      `┗❐\n\n` +

      `┏❐ 🔫 ᴡᴇᴀᴘᴏɴs\n` +
      `┃ 🔫 ᴀʀᴍᴏʀʏ\n` +
      `┃ ├ .gtaweapons\n` +
      `┃ ├ .gtabuygun <weapon>\n` +
      `┃ └ .gtatshoot\n` +
      `┗❐\n\n` +

      `┏❐ 🎓 sᴄʜᴏᴏʟ\n` +
      `┃ 🎓 ʟᴇᴀʀɴɪɴɢ sʏsᴛᴇᴍ\n` +
      `┃ ├ .gtaschool\n` +
      `┃ ├ .gtaenroll\n` +
      `┃ ├ .gtalearn <1-8>\n` +
      `┃ ├ .gtateach <1-8>\n` +
      `┃ ├ .gtainviteschool @player\n` +
      `┃ ├ .gtapromote @player <role>\n` +
      `┃ ├ .gtagraduate\n` +
      `┃ ├ .gtacreateschool <name>\n` +
      `┃ ├ .gtaschools\n` +
      `┃ └ .gtajoinschool <id>\n` +
      `┗❐\n\n` +

      `┏❐ 🔫 ɢᴀɴɢs\n` +
      `┃ 🔫 sᴛʀᴇᴇᴛ ʟɪғᴇ\n` +
      `┃ ├ .gtagangs\n` +
      `┃ ├ .gtajoingang <id>\n` +
      `┃ ├ .gtagang\n` +
      `┃ ├ .gtagangwar\n` +
      `┃ └ .gtaleavegang\n` +
      `┗❐\n\n` +

      `┏❐ 👮 ᴘᴏʟɪᴄᴇ\n` +
      `┃ 👮 ʟsᴘᴅ sʏsᴛᴇᴍ\n` +
      `┃ ├ .gtacop\n` +
      `┃ ├ .gtaquitcop\n` +
      `┃ ├ .gtaarrest @player\n` +
      `┃ ├ .gtawanted\n` +
      `┃ └ .gtaescape\n` +
      `┗❐\n\n` +

      `┏❐ 🎰 sᴏᴄɪᴀʟ\n` +
      `┃ 🎰 ʟɪғᴇsᴛʏʟᴇ\n` +
      `┃ ├ .gtacasino <bet>\n` +
      `┃ ├ .gtastrip\n` +
      `┃ ├ .gtadrink\n` +
      `┃ ├ .gtafight @player\n` +
      `┃ └ .gtaboss\n` +
      `┗❐\n\n` +

      `┏❐ 📊 ɪɴғᴏ\n` +
      `┃ 📊 sᴛᴀᴛs\n` +
      `┃ ├ .gtastats\n` +
      `┃ ├ .gtarank\n` +
      `┃ └ .gtasocial\n` +
      `┗❐\n\n` +

      `> *🏙️ Welcome to Los Santos. Trust nobody.*`
    )
  },
}
