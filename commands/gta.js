'use strict'
const db = require('../database')
const axios = require('axios')

// ─── GTA V MAP IMAGE (real GTA V map from Rockstar/fan sources) ──────────────
const GTA_MAP_URL = 'https://static.wikia.nocookie.net/gtawiki/images/4/4b/Map-GTAV.jpg'

// ─── GTA V CHARACTER IMAGES (real GTA character art) ────────────────────────
const GTA_CHARACTER_IMAGES = {
  male: [
    'https://static.wikia.nocookie.net/gtawiki/images/7/7e/Michael-GTAV-Artwork.jpg',
    'https://static.wikia.nocookie.net/gtawiki/images/5/5e/Trevor-GTAV-Artwork.jpg',
    'https://static.wikia.nocookie.net/gtawiki/images/7/7e/Franklin-GTAV-Artwork.jpg',
  ],
  female: [
    'https://static.wikia.nocookie.net/gtawiki/images/9/97/MPFemale-GTAO-Artwork.jpg',
    'https://static.wikia.nocookie.net/gtawiki/images/4/41/MPMale-GTAO-Artwork.jpg',
  ],
  gang: 'https://static.wikia.nocookie.net/gtawiki/images/3/3b/Families-GTAV-Artwork.jpg',
  cop:  'https://static.wikia.nocookie.net/gtawiki/images/3/35/LSPD-GTAV-Artwork.jpg',
  heist:'https://static.wikia.nocookie.net/gtawiki/images/f/f0/HeistArtwork-GTAO.jpg',
  casino:'https://static.wikia.nocookie.net/gtawiki/images/d/df/DiamondCasinoHeist-GTAO-Artwork.jpg',
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
  casual: { name: 'Casual', emoji: '👕', desc: 'Jeans and a tee. Blending in.' },
  business: { name: 'Business Suit', emoji: '👔', desc: 'Dressed for the boardroom — or the heist.' },
  gang: { name: 'Gang Colors', emoji: '🎽', desc: 'Repping the crew hard.' },
  military: { name: 'Military Gear', emoji: '🪖', desc: 'Full tactical, ready for war.' },
  police: { name: 'Police Uniform', emoji: '👮', desc: 'Undercover or on duty.' },
  heist: { name: 'Heist Gear', emoji: '🥷', desc: 'Black mask, gloves, full kit.' },
  luxury: { name: 'Luxury Fashion', emoji: '🧣', desc: 'Haute couture. Cost more than your car.' },
  biker: { name: 'Biker Jacket', emoji: '🏍️', desc: 'Leather and patches. MC for life.' },
  beach: { name: 'Beach Wear', emoji: '🩳', desc: 'Shorts and sunnies. Vespucci vibes.' },
  astronaut: { name: 'Space Suit', emoji: '🚀', desc: 'From a mission that went... sideways.' },
}

// ─── VEHICLES ─────────────────────────────────────────────────────────────────
const VEHICLES = {
  comet: { name: 'Pfister Comet', price: 85000, type: 'Sports', speed: 8, emoji: '🏎️' },
  zentorno: { name: 'Pegassi Zentorno', price: 725000, type: 'Super', speed: 10, emoji: '🚗' },
  oppressor: { name: 'Oppressor Mk II', price: 3890250, type: 'Flying Bike', speed: 10, emoji: '🛵' },
  lazer: { name: 'P-996 Lazer', price: 6500000, type: 'Jet', speed: 10, emoji: '✈️' },
  insurgent: { name: 'HVY Insurgent', price: 675000, type: 'Armored', speed: 6, emoji: '🚙' },
  hakuchou: { name: 'Shitzu Hakuchou', price: 82000, type: 'Motorcycle', speed: 9, emoji: '🏍️' },
  buzzard: { name: 'Buzzard Heli', price: 1750000, type: 'Helicopter', speed: 8, emoji: '🚁' },
  submarine: { name: 'Kosatka Sub', price: 2200000, type: 'Naval', speed: 5, emoji: '🚢' },
  dump: { name: 'Dump Truck', price: 0, type: 'Stolen', speed: 3, emoji: '🚛' },
  taxicab: { name: 'Taxicab', price: 0, type: 'Stolen', speed: 4, emoji: '🚕' },
}

// ─── WEAPONS ─────────────────────────────────────────────────────────────────
const WEAPONS = {
  pistol: { name: 'Pistol', price: 1000, damage: 15, emoji: '🔫', level: 1 },
  smg: { name: 'SMG', price: 3500, damage: 25, emoji: '🔫', level: 5 },
  assaultrifle: { name: 'Assault Rifle', price: 8500, damage: 40, emoji: '🔫', level: 10 },
  sniperrifle: { name: 'Sniper Rifle', price: 18000, damage: 85, emoji: '🎯', level: 15 },
  rpg: { name: 'RPG', price: 35000, damage: 200, emoji: '🚀', level: 20 },
  minigun: { name: 'Minigun', price: 55000, damage: 150, emoji: '💥', level: 30 },
  stickybomb: { name: 'Sticky Bomb', price: 2500, damage: 120, emoji: '💣', level: 8 },
  machete: { name: 'Machete', price: 500, damage: 35, emoji: '🗡️', level: 1 },
  knife: { name: 'Combat Knife', price: 250, damage: 20, emoji: '🔪', level: 1 },
  bat: { name: 'Baseball Bat', price: 150, damage: 10, emoji: '🏏', level: 1 },
}

// ─── MISSIONS (scale with level — above 59 gets brutal) ──────────────────────
function getMission(level) {
  const missions = [
    // Beginner (1-20)
    { name: 'Repo Job', desc: 'Steal a car from a debtor. Quick and dirty.', minLvl: 1, reward: { cash: 5000, rp: 300 }, difficulty: 'Easy', time: '2 min' },
    { name: 'Dispatch Services', desc: 'Take out a target before cops arrive.', minLvl: 1, reward: { cash: 7500, rp: 500 }, difficulty: 'Easy', time: '3 min' },
    { name: 'By Land or Sea', desc: 'Deliver a package across the city.', minLvl: 1, reward: { cash: 9000, rp: 600 }, difficulty: 'Easy', time: '4 min' },
    { name: 'Criminal Records', desc: 'Race to the docks, eliminate opposition.', minLvl: 5, reward: { cash: 12000, rp: 800 }, difficulty: 'Medium', time: '5 min' },
    { name: 'Coveted', desc: 'Steal military equipment from the army.', minLvl: 10, reward: { cash: 18000, rp: 1200 }, difficulty: 'Medium', time: '8 min' },
    { name: 'Deal Breaker', desc: 'Intercept a drug deal and take the cash.', minLvl: 15, reward: { cash: 22000, rp: 1500 }, difficulty: 'Medium', time: '10 min' },
    // Mid (20-50)
    { name: 'Titan of a Job', desc: 'Steal a Titan military aircraft from Fort Zancudo.', minLvl: 20, reward: { cash: 35000, rp: 2500 }, difficulty: 'Hard', time: '12 min' },
    { name: 'Rooftop Rumble', desc: 'Eliminate FIB agents and retrieve the document.', minLvl: 20, reward: { cash: 40000, rp: 3000 }, difficulty: 'Hard', time: '15 min' },
    { name: 'Violent Duct', desc: 'Storm the Humane Labs facility and extract data.', minLvl: 25, reward: { cash: 50000, rp: 4000 }, difficulty: 'Hard', time: '15 min' },
    { name: 'Hit Em Up', desc: 'Full-scale gang assault. No mercy.', minLvl: 30, reward: { cash: 55000, rp: 4500 }, difficulty: 'Hard', time: '18 min' },
    { name: 'Denial of Service', desc: 'Destroy rival CEO shipments city-wide.', minLvl: 35, reward: { cash: 60000, rp: 5000 }, difficulty: 'Hard', time: '20 min' },
    { name: 'Satellite Communication', desc: 'Steal military satellite uplink from the army.', minLvl: 40, reward: { cash: 75000, rp: 6000 }, difficulty: 'Very Hard', time: '20 min' },
    { name: 'Extradition', desc: 'Break a boss out of maximum security prison.', minLvl: 45, reward: { cash: 85000, rp: 7000 }, difficulty: 'Very Hard', time: '25 min' },
    { name: 'Chumash & Grab', desc: 'Storm a coke lab defended by 30 armed guards.', minLvl: 50, reward: { cash: 95000, rp: 8000 }, difficulty: 'Very Hard', time: '25 min' },
    // Pro 59+ (HARD)
    { name: '⚠️ Offshore Assets', desc: 'Sink a naval warship and recover classified cargo.', minLvl: 55, reward: { cash: 130000, rp: 11000 }, difficulty: '🔴 BRUTAL', time: '30 min' },
    { name: '⚠️ Juggernaut Strike', desc: 'Take out 5 Merryweather juggernauts in Zancudo. Zero cover.', minLvl: 59, reward: { cash: 155000, rp: 14000 }, difficulty: '🔴 BRUTAL', time: '35 min' },
    { name: '⚠️ Nuclear Option', desc: 'Infiltrate a government black site and steal a warhead.', minLvl: 60, reward: { cash: 180000, rp: 16000 }, difficulty: '💀 IMPOSSIBLE', time: '40 min' },
    { name: '⚠️ Godfather Contract', desc: 'Assassinate 3 mob bosses across Los Santos. Survivors are not an option.', minLvl: 65, reward: { cash: 210000, rp: 19000 }, difficulty: '💀 IMPOSSIBLE', time: '45 min' },
    { name: '⚠️ Final Stand', desc: 'Merryweather has launched an all-out assault on your safe house. Hold the line.', minLvl: 70, reward: { cash: 250000, rp: 22000 }, difficulty: '💀 IMPOSSIBLE', time: '50 min' },
    { name: '⚠️ Shadow Protocol', desc: 'Go rogue: eliminate a corrupt IAA director, steal black budget files, escape 5-star wanted. 0 teammates allowed.', minLvl: 75, reward: { cash: 320000, rp: 28000 }, difficulty: '💀 LEGENDARY', time: '60 min' },
    { name: '⚠️ Endgame: The Architect', desc: 'The final mission. Every agency, gang, and military unit in San Andreas is hunting you. Do not come back without the package.', minLvl: 80, reward: { cash: 500000, rp: 50000 }, difficulty: '💀 LEGENDARY+', time: '90 min' },
  ]

  const available = missions.filter(m => level >= m.minLvl)
  if (!available.length) return missions[0]
  // Higher level players get harder missions weighted
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
  fleeca: {
    name: '🏦 Fleeca Job',
    desc: '2-player heist. Rob the Fleeca Bank on the highway.',
    minLevel: 1, maxPlayers: 2,
    payout: { normal: 57500, hard: 143750 },
    prep: ['Scope out the bank', 'Obtain hacker device', 'Get getaway driver'],
  },
  prisonbreak: {
    name: '🔓 Prison Break',
    desc: 'Break out a prisoner from Bolingbroke Penitentiary.',
    minLevel: 20, maxPlayers: 4,
    payout: { normal: 200000, hard: 500000 },
    prep: ['Steal a plane', 'Obtain prison bus', 'Steal cop car', 'Gather weapons'],
  },
  humane: {
    name: '🧪 Humane Labs Raid',
    desc: 'Steal research data from the Humane Labs facility.',
    minLevel: 25, maxPlayers: 4,
    payout: { normal: 540000, hard: 675000 },
    prep: ['EMP device', 'Acquire masks', 'Steal insurgents', 'Valkyrie heist'],
  },
  seriesA: {
    name: '💊 Series A Funding',
    desc: 'Help Trevor fund his drug empire operations.',
    minLevel: 30, maxPlayers: 4,
    payout: { normal: 404000, hard: 505000 },
    prep: ['Steal bikers\' meth', 'Rob cocaine', 'Weed stash', 'Steal van', 'Steal tanker'],
  },
  pacific: {
    name: '🏦 Pacific Standard',
    desc: 'Rob the most secure bank in Los Santos.',
    minLevel: 40, maxPlayers: 4,
    payout: { normal: 1000000, hard: 1250000 },
    prep: ['Obtain hack device', 'Signal intercept', 'Vans', 'Bikes', 'Safe cracker'],
  },
  diamond: {
    name: '💎 Diamond Casino Heist',
    desc: 'The biggest score in Los Santos. Rob the Diamond Casino.',
    minLevel: 50, maxPlayers: 4,
    payout: { cash: 2115000, art: 2350000, gold: 2585000, diamonds: 3619000 },
    prep: ['Scope casino', 'Vault contents', 'Access points', 'Security intel', 'Hackers', 'Weapons'],
  },
  cayo: {
    name: '🏝️ Cayo Perico Heist',
    desc: 'Solo or squad raid on El Rubio\'s private island. Biggest solo payout ever.',
    minLevel: 60, maxPlayers: 4,
    payout: { minimum: 1078000, maximum: 4570600 },
    prep: ['Scope the island', 'Gather intel', 'Approach vehicle', 'Disruption', 'Infiltration'],
  },
  doomsday: {
    name: '☢️ Doomsday Heist',
    desc: 'Stop a rogue military AI from launching nukes. Most complex heist in history.',
    minLevel: 70, maxPlayers: 4,
    payout: { act1: 1200000, act2: 1500000, act3: 2500000 },
    prep: ['Recover data', 'Disrupt Avon', 'Acquire submarine', 'Satellite hack', 'EMP strike'],
  },
}

// ─── SCHOOL ROLES ─────────────────────────────────────────────────────────────
const SCHOOL_ROLES = ['student', 'teacher', 'headmaster', 'principal', 'dean']

// ─── SCHOOL SUBJECTS ──────────────────────────────────────────────────────────
const SCHOOL_SUBJECTS = [
  { name: 'Driving School', skill: 'driving', xp: 200, duration: '5 min', desc: 'Master vehicle control, drifting, and evasion.' },
  { name: 'Weapons Training', skill: 'shooting', xp: 300, duration: '7 min', desc: 'Accuracy, reload speed, weapon selection.' },
  { name: 'Hacking Class', skill: 'hacking', xp: 250, duration: '6 min', desc: 'Break bank vaults, hack systems, bypass firewalls.' },
  { name: 'Stealth & Infiltration', skill: 'stealth', xp: 280, duration: '6 min', desc: 'Move silently, avoid cameras, knock out guards.' },
  { name: 'Flight School', skill: 'flying', xp: 400, duration: '10 min', desc: 'Pilot jets, helicopters, and stunt planes.' },
  { name: 'Finance & Felony', skill: 'business', xp: 350, duration: '8 min', desc: 'CEO operations, money laundering, supply chains.' },
  { name: 'Street Smarts', skill: 'street', xp: 150, duration: '3 min', desc: 'Navigate the underworld, read territory, survive.' },
  { name: 'Heist Planning', skill: 'heist', xp: 500, duration: '12 min', desc: 'Master the art of planning and executing heists.' },
]

// ─── GANG LIST ────────────────────────────────────────────────────────────────
const GANGS = {
  families: { name: 'Grove Street Families', color: '🟢', turf: 'Strawberry', bonus: 'Loyalty +20%' },
  ballas: { name: 'Ballas', color: '🟣', turf: 'Davis', bonus: 'Territory +15%' },
  vagos: { name: 'Los Santos Vagos', color: '🟡', turf: 'Elysian Island', bonus: 'Drug profit +25%' },
  aztecas: { name: 'Varrios Los Aztecas', color: '🔵', turf: 'Chamberlain Hills', bonus: 'Street cred +30%' },
  marabunta: { name: 'Marabunta Grande', color: '🔵', turf: 'LSIA', bonus: 'Smuggling +20%' },
  lost: { name: 'The Lost MC', color: '🖤', turf: 'Sandy Shores', bonus: 'Weapon discount 15%' },
  angels: { name: 'Angels of Death', color: '🔴', turf: 'Paleto Bay', bonus: 'Vehicle speed +10%' },
}

// ─── ACTIVE DATA (in-memory, persisted to DB via gta_data column) ─────────────
const activeMissions = {}
const activeHeists = {}
const activeSchool = {} // groupId → { subject, teacher, students, startTime }
const schoolInvites = {} // phone → { groupId, subject, invitedBy }

// ─── HELPERS ──────────────────────────────────────────────────────────────────
async function getGtaData(phone) {
  const u = await db.getOrCreateUser(phone)
  let gta = {}
  try { gta = JSON.parse(u.class_name || '{}') } catch {}
  // class_name field is being repurposed as a JSON store for GTA data (it's TEXT in DB)
  // We store gta data under a prefix to avoid conflicts with rpg class_name
  if (typeof gta !== 'object' || !gta.gtaVersion) {
    // Check if class_name is an RPG class string (not JSON)
    if (typeof u.class_name === 'string' && !u.class_name.startsWith('{')) {
      gta = {}
    }
    gta.gtaVersion = 1
  }
  return gta
}

async function saveGtaData(phone, gtaData) {
  await db.updateUser(phone, { class_name: JSON.stringify(gtaData) })
}

function gtaRank(rp) {
  if (rp < 1000) return { rank: 1, name: 'Thug' }
  if (rp < 3000) return { rank: 5, name: 'Street Soldier' }
  if (rp < 7000) return { rank: 10, name: 'Gangster' }
  if (rp < 15000) return { rank: 20, name: 'Hustler' }
  if (rp < 30000) return { rank: 30, name: 'Baller' }
  if (rp < 60000) return { rank: 40, name: 'Made Man' }
  if (rp < 100000) return { rank: 50, name: 'Lieutenant' }
  if (rp < 180000) return { rank: 60, name: 'Boss' }
  if (rp < 300000) return { rank: 70, name: 'Crime Lord' }
  if (rp < 500000) return { rank: 80, name: 'Kingpin' }
  if (rp < 800000) return { rank: 90, name: 'Legend' }
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
  try {
    const buf = await fetchImageBuffer(imgUrl)
    if (buf && buf.length > 500) {
      await sock.sendMessage(jid, { image: buf, caption: text }, { quoted: msg })
      return
    }
  } catch {}
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
    const img = GTA_CHARACTER_IMAGES.male[0]
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
    await sendImgOrText(sock, jid, msg, img, text, reply)
  },

  async gtacreate(ctx) { return module.exports.gtastart(ctx) },
  async gta(ctx) { return module.exports.gtastart(ctx) },

  // ──────────────────── PROFILE ────────────────────────────────
  async gtaprofile({ sock, jid, msg, reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const gta = await getGtaData(sender)
    if (!gta.created) return reply(`❌ No GTA character found!\n\nUse *.gtastart* to create your character.`)
    const rankInfo = gtaRank(gta.rp || 0)
    const outfit = OUTFITS[gta.outfit || 'casual']
    const vehicle = gta.vehicle ? VEHICLES[gta.vehicle] : null
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
      Object.entries(gta.skills || {}).map(([k, v]) => `  • ${k}: ${'█'.repeat(Math.floor((v/500)*10))}${'░'.repeat(10 - Math.floor((v/500)*10))} ${v}`).join('\n') + '\n' +
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
        `🎽 *Outfits:* ${Object.keys(OUTFITS).join(', ')}\n\n` +
        `_Style is everything in Los Santos._ 🏙️`
      )
    }

    if (sub === 'name') {
      const newName = args.slice(1).join(' ')
      if (!newName) return reply('❌ Usage: *.gtacustomize name YourName*')
      gta.name = newName.slice(0, 30)
      await saveGtaData(sender, gta)
      return reply(`✅ Name changed to *${gta.name}*`)
    }

    if (sub === 'gender') {
      if (!['male', 'female'].includes(val)) return reply('❌ Use *male* or *female*')
      gta.gender = val
      await saveGtaData(sender, gta)
      return reply(`✅ Gender set to *${val}*`)
    }

    if (sub === 'outfit') {
      if (!OUTFITS[val]) return reply(`❌ Unknown outfit. Options: ${Object.keys(OUTFITS).join(', ')}`)
      gta.outfit = val
      await saveGtaData(sender, gta)
      const o = OUTFITS[val]
      return reply(`✅ ${o.emoji} Outfit changed to *${o.name}*\n_${o.desc}_`)
    }

    if (sub === 'bio') {
      const bio = args.slice(1).join(' ')
      gta.bio = bio.slice(0, 100)
      await saveGtaData(sender, gta)
      return reply(`✅ Bio updated: _${gta.bio}_`)
    }

    return reply(`❌ Unknown option. Use *.gtacustomize* for help.`)
  },
  async gtaname({ reply, sender, args }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const name = args.join(' ')
    if (!name) return reply('❌ Usage: *.gtaname YourName*')
    gta.name = name.slice(0, 30)
    await saveGtaData(sender, gta)
    return reply(`✅ Name set to *${gta.name}*`)
  },
  async gtaoutfit({ reply, sender, args }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const choice = args[0]?.toLowerCase()
    if (!choice || !OUTFITS[choice]) {
      const list = Object.entries(OUTFITS).map(([k, v]) => `${v.emoji} \`${k}\` — ${v.name}: ${v.desc}`).join('\n')
      return reply(`🎽 *GTA OUTFITS*\n\n${list}\n\n📌 Usage: *.gtaoutfit <type>*`)
    }
    gta.outfit = choice
    await saveGtaData(sender, gta)
    const o = OUTFITS[choice]
    return reply(`${o.emoji} Outfit changed to *${o.name}*\n_${o.desc}_`)
  },
  async gtaskin(ctx) { return module.exports.gtaoutfit(ctx) },
  async gtabio({ reply, sender, args }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const bio = args.join(' ')
    gta.bio = bio.slice(0, 100)
    await saveGtaData(sender, gta)
    return reply(`✅ Bio set: _${gta.bio}_`)
  },
  async gtagender({ reply, sender, args }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const g = args[0]?.toLowerCase()
    if (!['male', 'female'].includes(g)) return reply('❌ Use: *.gtagender male* or *.gtagender female*')
    gta.gender = g
    await saveGtaData(sender, gta)
    return reply(`✅ Gender set to *${g}*`)
  },

  // ──────────────────── MAP & LOCATION ────────────────────────────
  async gtamap({ sock, jid, msg, reply }) {
    const text =
      `🗺️ *GTA V — LOS SANTOS & BLAINE COUNTY*\n\n` +
      `📍 *Key Locations:*\n` +
      LOCATIONS.map(l => `• *${l.name}* [${l.area}] — ${l.desc}`).join('\n') + '\n\n' +
      `📌 Use *.gtatravel <location>* to travel there.\n` +
      `_The city is yours. If you can take it._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_MAP_URL, text, reply)
  },

  async gtatravel({ reply, sender, args }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const dest = args.join(' ').toLowerCase()
    const loc = LOCATIONS.find(l => l.name.toLowerCase().includes(dest) || l.area.toLowerCase().includes(dest))
    if (!dest || !loc) {
      return reply(`📍 *AVAILABLE LOCATIONS:*\n\n${LOCATIONS.map(l => `• *${l.name}* [${l.area}]`).join('\n')}\n\n📌 Usage: *.gtatravel los santos*`)
    }
    gta.location = loc.name
    await saveGtaData(sender, gta)
    return reply(`✈️ *TRAVELING...*\n\n📍 Arrived at *${loc.name}*\n🗺️ Area: ${loc.area}\n📖 ${loc.desc}\n\n_New turf, new opportunities._ 🏙️`)
  },
  async gtalocation({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const loc = LOCATIONS.find(l => l.name === gta.location) || LOCATIONS[0]
    return reply(`📍 *CURRENT LOCATION*\n\n🗺️ *${loc.name}*\nArea: ${loc.area}\n${loc.desc}\n\n_Use *.gtatravel <place>* to move._ 🏙️`)
  },
  async gtahere(ctx) { return module.exports.gtalocation(ctx) },
  async gtaexplore({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const events = [
      `💰 Found $${Math.floor(Math.random()*5000+500)} in a dumpster!`,
      `🔫 Discovered a weapons cache! Got ammo.`,
      `🚗 Spotted an abandoned supercar. It's yours now.`,
      `💊 Stumbled on a drug deal gone wrong. Grabbed the bag.`,
      `👮 Narrowly avoided a police checkpoint. +1 street cred.`,
      `🎯 Rival gang spotted you. Managed to escape. +50 RP.`,
      `💎 Found a briefcase. ${Math.random() < 0.2 ? 'It had diamonds!' : 'Just some cash.'}`,
      `🏠 Discovered a safe house. Marked on map.`,
      `🚁 Merryweather patrol flew over. Didn't see you.`,
      `💣 Diffused a rival bomb. Mayor will thank you. Maybe.`,
    ]
    const event = events[Math.floor(Math.random() * events.length)]
    const cashFind = Math.random() < 0.4 ? Math.floor(Math.random() * 3000 + 200) : 0
    const rpFind = Math.floor(Math.random() * 300 + 50)
    if (cashFind > 0) {
      gta.cash = (gta.cash || 0) + cashFind
    }
    gta.rp = (gta.rp || 0) + rpFind
    await saveGtaData(sender, gta)
    return reply(`🗺️ *EXPLORING ${gta.location || 'Los Santos'}*\n\n${event}\n${cashFind > 0 ? `💰 +$${cashFind}\n` : ''}⭐ +${rpFind} RP\n\n_The city always has something to offer._ 🏙️`)
  },

  // ──────────────────── MISSIONS ────────────────────────────────
  async gtamission({ sock, jid, msg, reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    if (activeMissions[sender]) {
      const m = activeMissions[sender]
      return reply(`⚠️ *MISSION IN PROGRESS*\n\n🎯 *${m.name}*\n${m.desc}\n\n💀 Difficulty: ${m.difficulty}\n💰 Payout: $${m.reward.cash.toLocaleString()}\n\nUse *.gtacomplete* to finish or *.gtafailmission* to bail.`)
    }
    const remaining = await db.getCooldown(sender, 'gtamission')
    if (remaining > 0) {
      const mins = Math.ceil(remaining / 60000)
      return reply(`⏳ Mission cooldown: *${mins} min* remaining.\n\n_Rest up. The city waits._ 🏙️`)
    }
    const rank = gtaRank(gta.rp || 0)
    const mission = getMission(rank.rank)
    activeMissions[sender] = mission
    const isHard = rank.rank >= 59
    const warningText = isHard
      ? `\n⚠️ *WARNING:* You are Rank ${rank.rank}. Missions at this level are BRUTAL. Failure is always possible.\n`
      : ''
    const text =
      `🎯 *NEW MISSION*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `📋 *${mission.name}*\n` +
      `📖 ${mission.desc}\n\n` +
      `💀 Difficulty: *${mission.difficulty}*\n` +
      `⏱️ Time Limit: ${mission.time}\n` +
      `💰 Payout: $${mission.reward.cash.toLocaleString()}\n` +
      `⭐ RP: +${mission.reward.rp.toLocaleString()}\n` +
      `${warningText}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `📌 Use *.gtacomplete* when you're done!\n` +
      `📌 Use *.gtafailmission* to abandon.\n\n` +
      `_No second chances in Los Santos._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_CHARACTER_IMAGES.heist, text, reply)
  },
  async gtamissions({ reply, sender }) {
    const rank = gtaRank((await getGtaData(sender)).rp || 0)
    const available = [
      { name: 'Repo Job', difficulty: 'Easy', payout: '$5,000', minRank: 1 },
      { name: 'Rooftop Rumble', difficulty: 'Hard', payout: '$40,000', minRank: 20 },
      { name: 'Titan of a Job', difficulty: 'Hard', payout: '$35,000', minRank: 20 },
      { name: 'Violent Duct', difficulty: 'Hard', payout: '$50,000', minRank: 25 },
      { name: 'Juggernaut Strike ⚠️', difficulty: '🔴 BRUTAL', payout: '$155,000', minRank: 59 },
      { name: 'Nuclear Option ⚠️', difficulty: '💀 IMPOSSIBLE', payout: '$180,000', minRank: 60 },
      { name: 'Endgame: The Architect ⚠️', difficulty: '💀 LEGENDARY+', payout: '$500,000', minRank: 80 },
    ].filter(m => rank.rank >= m.minRank)
    return reply(`🎯 *AVAILABLE MISSIONS — Rank ${rank.rank}*\n\n${available.map(m => `• *${m.name}*\n  Difficulty: ${m.difficulty} | Payout: ${m.payout}`).join('\n\n')}\n\n📌 Use *.gtamission* to get assigned one.\n_${rank.rank >= 59 ? '⚠️ At your rank, every mission is a fight to survive.' : 'Prove yourself in the field.'}_ 🏙️`)
  },

  async gtacomplete({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const mission = activeMissions[sender]
    if (!mission) return reply('❌ No active mission. Use *.gtamission* to start one.')
    // Success chance drops for harder missions / higher rank
    const rank = gtaRank(gta.rp || 0)
    const baseDiff = mission.difficulty.includes('LEGENDARY') ? 0.40 : mission.difficulty.includes('IMPOSSIBLE') ? 0.55 : mission.difficulty.includes('BRUTAL') ? 0.65 : mission.difficulty.includes('Very Hard') ? 0.75 : mission.difficulty.includes('Hard') ? 0.85 : 0.95
    const success = Math.random() < baseDiff
    delete activeMissions[sender]
    await db.setCooldown(sender, 'gtamission', 5 * 60)
    if (!success) {
      gta.wanted = Math.min(5, (gta.wanted || 0) + 1)
      await saveGtaData(sender, gta)
      return reply(`💀 *MISSION FAILED — ${mission.name}*\n\n❌ You didn't make it.\n⭐ Wanted Level: ${wantedStars(gta.wanted)}\n\n_Fail in Los Santos and the city makes you pay._ 🏙️`)
    }
    const bonus = rank.rank >= 59 ? Math.floor(mission.reward.cash * 0.25) : 0
    const totalCash = mission.reward.cash + bonus
    gta.cash = (gta.cash || 0) + totalCash
    gta.rp = (gta.rp || 0) + mission.reward.rp
    gta.totalMissions = (gta.totalMissions || 0) + 1
    gta.wanted = Math.max(0, (gta.wanted || 0) - 1)
    const newRank = gtaRank(gta.rp)
    await saveGtaData(sender, gta)
    return reply(
      `✅ *MISSION COMPLETE — ${mission.name}*\n\n` +
      `💰 Cash: +$${totalCash.toLocaleString()}${bonus > 0 ? ` (incl. $${bonus.toLocaleString()} elite bonus)` : ''}\n` +
      `⭐ RP: +${mission.reward.rp.toLocaleString()}\n` +
      `📊 Rank: ${newRank.rank} — *${newRank.name}*\n` +
      `🎯 Total Missions: ${gta.totalMissions}\n\n` +
      `_Another job done. The city bows to no one — except you._ 🏙️`
    )
  },
  async gtafailmission({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!activeMissions[sender]) return reply('❌ No active mission to abandon.')
    const mission = activeMissions[sender]
    delete activeMissions[sender]
    gta.wanted = Math.min(5, (gta.wanted || 0) + 1)
    await saveGtaData(sender, gta)
    return reply(`🏳️ *MISSION ABANDONED — ${mission.name}*\n\n⭐ Wanted: ${wantedStars(gta.wanted)}\n\n_Running never ends well in this city._ 🏙️`)
  },

  // ──────────────────── JOBS / MONEY ────────────────────────────
  async gtawork({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const remaining = await db.getCooldown(sender, 'gtawork')
    if (remaining > 0) return reply(`⏳ Work cooldown: ${Math.ceil(remaining / 60000)} min left.`)
    const jobs = [
      { name: 'Taxi Driver', cash: 800, rp: 50 },
      { name: 'Security Guard', cash: 1200, rp: 80 },
      { name: 'Mechanic', cash: 1500, rp: 100 },
      { name: 'Bouncer', cash: 2000, rp: 150 },
      { name: 'Arms Dealer', cash: 5000, rp: 300 },
      { name: 'Drug Runner', cash: 8000, rp: 500 },
      { name: 'Hitman', cash: 15000, rp: 800 },
    ]
    const rank = gtaRank(gta.rp || 0)
    const available = jobs.slice(0, Math.min(jobs.length, 3 + Math.floor(rank.rank / 20)))
    const job = available[Math.floor(Math.random() * available.length)]
    gta.cash = (gta.cash || 0) + job.cash
    gta.rp = (gta.rp || 0) + job.rp
    await saveGtaData(sender, gta)
    await db.setCooldown(sender, 'gtawork', 15 * 60)
    return reply(`💼 *JOB DONE*\n\nWorked as *${job.name}*\n💰 +$${job.cash.toLocaleString()}\n⭐ +${job.rp} RP\n\n_Cooldown: 15 min_\n_Keep grinding._ 🏙️`)
  },
  async gwork(ctx) { return module.exports.gtawork(ctx) },

  async gtarob({ reply, sender, args, isGroup }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const remaining = await db.getCooldown(sender, 'gtarob')
    if (remaining > 0) return reply(`⏳ Rob cooldown: ${Math.ceil(remaining / 60000)} min left.`)
    const targets = ['a convenience store', 'an armored truck', 'a jewelry store', 'a gas station', 'a liquor store', 'a small bank branch']
    const target = targets[Math.floor(Math.random() * targets.length)]
    const success = Math.random() < 0.70
    await db.setCooldown(sender, 'gtarob', 10 * 60)
    if (!success) {
      gta.wanted = Math.min(5, (gta.wanted || 0) + 2)
      await saveGtaData(sender, gta)
      return reply(`🚨 *ROBBERY FAILED*\n\n❌ Cops caught you robbing ${target}!\n⭐ Wanted: ${wantedStars(gta.wanted)}\n\n_Use *.gtaescape* to lose the heat._ 🏙️`)
    }
    const haul = Math.floor(Math.random() * 20000 + 3000)
    gta.cash = (gta.cash || 0) + haul
    gta.rp = (gta.rp || 0) + 200
    gta.wanted = Math.min(5, (gta.wanted || 0) + 1)
    await saveGtaData(sender, gta)
    return reply(`💰 *ROBBERY SUCCESS*\n\n🏪 Robbed ${target}!\n💰 +$${haul.toLocaleString()}\n⭐ +200 RP\n⭐ Wanted: ${wantedStars(gta.wanted)}\n\n_Quick. Drive._ 🏙️`)
  },

  async gtadrug({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const remaining = await db.getCooldown(sender, 'gtadrug')
    if (remaining > 0) return reply(`⏳ Drug deal cooldown: ${Math.ceil(remaining / 60000)} min left.`)
    const success = Math.random() < 0.75
    await db.setCooldown(sender, 'gtadrug', 8 * 60)
    if (!success) {
      const lost = Math.floor(Math.random() * 5000 + 1000)
      gta.cash = Math.max(0, (gta.cash || 0) - lost)
      gta.wanted = Math.min(5, (gta.wanted || 0) + 2)
      await saveGtaData(sender, gta)
      return reply(`🚨 *DEAL GONE WRONG*\n\n❌ Rival gang hit the deal!\n💸 Lost $${lost.toLocaleString()}\n⭐ Wanted: ${wantedStars(gta.wanted)}\n\n_Never trust a stranger in LS._ 🏙️`)
    }
    const profit = Math.floor(Math.random() * 15000 + 5000)
    gta.cash = (gta.cash || 0) + profit
    gta.rp = (gta.rp || 0) + 400
    await saveGtaData(sender, gta)
    return reply(`💊 *DEAL COMPLETE*\n\n💰 +$${profit.toLocaleString()}\n⭐ +400 RP\n\n_Keep the product moving._ 🏙️`)
  },

  async gtahackbank({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const remaining = await db.getCooldown(sender, 'gtahack')
    if (remaining > 0) return reply(`⏳ Hack cooldown: ${Math.ceil(remaining / 60000)} min left.`)
    const rank = gtaRank(gta.rp || 0)
    const hackSkill = (gta.skills?.hacking || 0)
    const successChance = Math.min(0.9, 0.3 + hackSkill / 1000 + rank.rank / 200)
    const success = Math.random() < successChance
    await db.setCooldown(sender, 'gtahack', 20 * 60)
    if (!success) {
      gta.wanted = Math.min(5, (gta.wanted || 0) + 3)
      await saveGtaData(sender, gta)
      return reply(`💻 *HACK FAILED*\n\n❌ Firewall detected you! FIB is on the way.\n⭐ Wanted: ${wantedStars(gta.wanted)}\n\n_Train your hacking skill at *.gtaschool*_ 🏙️`)
    }
    const haul = Math.floor(Math.random() * 80000 + 20000) * (1 + hackSkill / 500)
    gta.cash = (gta.cash || 0) + Math.floor(haul)
    gta.rp = (gta.rp || 0) + 1500
    gta.wanted = Math.min(5, (gta.wanted || 0) + 1)
    await saveGtaData(sender, gta)
    return reply(`💻 *BANK HACKED*\n\n💰 +$${Math.floor(haul).toLocaleString()}\n⭐ +1,500 RP\n⭐ Wanted: ${wantedStars(gta.wanted)}\n\n_Ghost in the machine._ 🏙️`)
  },

  async gtabounty({ reply, sender, args, msg }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    const amount = parseInt(args[0]) || parseInt(args[1]) || 5000
    if (!mentionedJid) return reply('❌ Usage: *.gtabounty @player 5000*')
    const targetPhone = mentionedJid.split('@')[0].split(':')[0]
    if ((gta.cash || 0) < amount) return reply(`❌ Not enough cash. You have $${(gta.cash || 0).toLocaleString()}`)
    gta.cash = (gta.cash || 0) - amount
    await saveGtaData(sender, gta)
    const targetGta = await getGtaData(targetPhone)
    if (!targetGta.created) return reply('❌ That player has no GTA character.')
    targetGta.bounty = (targetGta.bounty || 0) + amount
    await saveGtaData(targetPhone, targetGta)
    return reply(`💀 *BOUNTY PLACED*\n\n🎯 Target: @${targetPhone}\n💰 Bounty: $${amount.toLocaleString()}\n\n_Someone's getting paid to end them._ 🏙️`)
  },

  async gtacollectbounty({ reply, sender, args, msg }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    if (!mentionedJid) return reply('❌ Usage: *.gtacollectbounty @player*')
    const targetPhone = mentionedJid.split('@')[0].split(':')[0]
    const targetGta = await getGtaData(targetPhone)
    if (!targetGta.created || !targetGta.bounty) return reply('❌ That player has no bounty.')
    const bounty = targetGta.bounty
    const success = Math.random() < 0.65
    if (!success) return reply(`❌ *BOUNTY MISSED*\n\nTarget escaped! Better luck next time.\n\n_They saw you coming._ 🏙️`)
    targetGta.bounty = 0
    await saveGtaData(targetPhone, targetGta)
    gta.cash = (gta.cash || 0) + bounty
    gta.rp = (gta.rp || 0) + 1000
    await saveGtaData(sender, gta)
    return reply(`💀 *BOUNTY COLLECTED*\n\n🎯 Took out @${targetPhone}\n💰 +$${bounty.toLocaleString()}\n⭐ +1,000 RP\n\n_Another one bites the dust._ 🏙️`)
  },
  async gtacollect(ctx) { return module.exports.gtacollectbounty(ctx) },

  async gtasteal({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const remaining = await db.getCooldown(sender, 'gtasteal')
    if (remaining > 0) return reply(`⏳ Cooldown: ${Math.ceil(remaining / 60000)} min left.`)
    const cars = ['Zentorno', 'Comet', 'Banshee', 'Elegy RH8', 'Rapid GT', 'Infernus', 'Bullet', 'Adder']
    const car = cars[Math.floor(Math.random() * cars.length)]
    const success = Math.random() < 0.80
    await db.setCooldown(sender, 'gtasteal', 5 * 60)
    if (!success) {
      gta.wanted = Math.min(5, (gta.wanted || 0) + 1)
      await saveGtaData(sender, gta)
      return reply(`🚨 *CAR THEFT FAILED*\n\n❌ Alarm triggered on the ${car}!\n⭐ Wanted: ${wantedStars(gta.wanted)}\n\n_Next time disable the alarm first._ 🏙️`)
    }
    const value = Math.floor(Math.random() * 30000 + 5000)
    gta.cash = (gta.cash || 0) + value
    gta.rp = (gta.rp || 0) + 150
    gta.wanted = Math.min(5, (gta.wanted || 0) + 1)
    await saveGtaData(sender, gta)
    return reply(`🚗 *CAR STOLEN*\n\n${car} — sold for $${value.toLocaleString()}\n⭐ +150 RP\n⭐ Wanted: ${wantedStars(gta.wanted)}\n\n_Chop shop paid well._ 🏙️`)
  },
  async gtacarsteal(ctx) { return module.exports.gtasteal(ctx) },

  // ──────────────────── VEHICLES ────────────────────────────────
  async gtacars({ reply }) {
    const list = Object.entries(VEHICLES).map(([k, v]) => `${v.emoji} \`${k}\` *${v.name}* [${v.type}]\n  💰 $${v.price.toLocaleString()} | Speed: ${'⚡'.repeat(v.speed)}`).join('\n\n')
    return reply(`🚗 *GTA V VEHICLES*\n\n${list}\n\n📌 Usage: *.gtabuyvehicle <id>*`)
  },
  async gtabuyvehicle({ reply, sender, args }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const id = args[0]?.toLowerCase()
    const vehicle = VEHICLES[id]
    if (!id || !vehicle) return reply(`❌ Unknown vehicle. Use *.gtacars* for the list.`)
    if (vehicle.price === 0) return reply('❌ That vehicle cannot be purchased — steal it instead.')
    if ((gta.cash || 0) < vehicle.price) return reply(`❌ Not enough cash.\n💰 You have: $${(gta.cash || 0).toLocaleString()}\n💵 Needed: $${vehicle.price.toLocaleString()}`)
    gta.cash = (gta.cash || 0) - vehicle.price
    gta.vehicle = id
    await saveGtaData(sender, gta)
    return reply(`${vehicle.emoji} *VEHICLE PURCHASED*\n\n*${vehicle.name}* [${vehicle.type}]\n💰 Paid: $${vehicle.price.toLocaleString()}\n💵 Remaining: $${(gta.cash || 0).toLocaleString()}\n\n_Flexing on the streets._ 🏙️`)
  },
  async gtabuy(ctx) { return module.exports.gtabuyvehicle(ctx) },
  async gtagarage({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    if (!gta.vehicle) return reply(`🅿️ *GARAGE*\n\n🚶 You don't own a vehicle.\n\n📌 Use *.gtacars* to browse and *.gtabuyvehicle* to buy.`)
    const v = VEHICLES[gta.vehicle]
    return reply(`🅿️ *YOUR GARAGE*\n\n${v ? `${v.emoji} *${v.name}*\nType: ${v.type}\nSpeed: ${'⚡'.repeat(v.speed)}` : `Vehicle: ${gta.vehicle}`}\n\n_Park it, love it, never let it go._ 🏙️`)
  },
  async gtarace({ reply, sender, args, msg }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    if (!mentionedJid) return reply('❌ Usage: *.gtarace @player*\n\nChallenge someone to a street race!')
    const bet = parseInt(args[0]) || 5000
    const mySpeed = gta.vehicle ? (VEHICLES[gta.vehicle]?.speed || 5) : 3
    const win = Math.random() < (mySpeed / 15 + 0.2)
    const earnings = win ? bet : -bet
    gta.cash = Math.max(0, (gta.cash || 0) + earnings)
    gta.rp = (gta.rp || 0) + (win ? 300 : 50)
    await saveGtaData(sender, gta)
    const target = mentionedJid.split('@')[0].split(':')[0]
    return reply(`🏎️ *STREET RACE*\n\n${win ? `✅ YOU WIN against @${target}!\n💰 +$${bet.toLocaleString()}` : `❌ @${target} dusted you!\n💸 -$${bet.toLocaleString()}`}\n⭐ +${win ? 300 : 50} RP\n\n${gta.vehicle ? `_Your ${VEHICLES[gta.vehicle]?.name || gta.vehicle} ${win ? 'dominated' : 'wasn\'t enough'}._` : '_Next time get a real car._'} 🏙️`)
  },
  async gtadriveby({ reply, sender, args, msg }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    if (!gta.vehicle) return reply('❌ You need a vehicle for a drive-by!')
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    if (!mentionedJid) return reply('❌ Usage: *.gtadriveby @player*')
    const success = Math.random() < 0.60
    const target = mentionedJid.split('@')[0].split(':')[0]
    gta.wanted = Math.min(5, (gta.wanted || 0) + 2)
    await saveGtaData(sender, gta)
    return reply(`🚗💨 *DRIVE-BY*\n\n${success ? `✅ Hit @${target} in the drive-by!\n⭐ +500 RP` : `❌ Missed @${target}! They scattered.`}\n⭐ Wanted: ${wantedStars(gta.wanted)}\n\n_Streets are watching._ 🏙️`)
  },

  // ──────────────────── WEAPONS ────────────────────────────────
  async gtaweapons({ reply }) {
    const list = Object.entries(WEAPONS).map(([k, v]) => `${v.emoji} \`${k}\` *${v.name}* — $${v.price.toLocaleString()} | DMG: ${v.damage} | Min Rank: ${v.level}`).join('\n')
    return reply(`🔫 *GTA WEAPON SHOP*\n\n${list}\n\n📌 Usage: *.gtabuygun <weapon>*`)
  },
  async gtabuygun({ reply, sender, args }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const id = args[0]?.toLowerCase()
    const weapon = WEAPONS[id]
    if (!id || !weapon) return reply(`❌ Unknown weapon. Use *.gtaweapons* to see all.`)
    const rank = gtaRank(gta.rp || 0)
    if (rank.rank < weapon.level) return reply(`❌ Rank ${weapon.level} required. You are Rank ${rank.rank}.`)
    if ((gta.cash || 0) < weapon.price) return reply(`❌ Not enough cash.\n💰 You: $${(gta.cash || 0).toLocaleString()} | Need: $${weapon.price.toLocaleString()}`)
    if ((gta.weapons || []).includes(id)) return reply(`✅ You already own a *${weapon.name}*.`)
    gta.cash = (gta.cash || 0) - weapon.price
    gta.weapons = [...(gta.weapons || []), id]
    await saveGtaData(sender, gta)
    return reply(`${weapon.emoji} *WEAPON PURCHASED*\n\n*${weapon.name}*\nDamage: ${weapon.damage}\n💰 Paid: $${weapon.price.toLocaleString()}\n\n_Locked and loaded._ 🏙️`)
  },
  async gtatshoot({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const remaining = await db.getCooldown(sender, 'gtatarget')
    if (remaining > 0) return reply(`⏳ Cooldown: ${Math.ceil(remaining / 60000)} min left.`)
    const skill = (gta.skills?.shooting || 0) + Math.floor(Math.random() * 50 + 10)
    gta.skills = gta.skills || {}
    gta.skills.shooting = Math.min(500, skill)
    await saveGtaData(sender, gta)
    await db.setCooldown(sender, 'gtatarget', 5 * 60)
    return reply(`🎯 *TARGET PRACTICE*\n\nShooting skill: ${gta.skills.shooting}/500\n\n_Practice makes perfect. Or deadly._ 🏙️`)
  },

  // ──────────────────── HEISTS ────────────────────────────────
  async gtaheist({ sock, jid, msg, reply, sender, isGroup }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const list = Object.entries(HEISTS).map(([k, h]) =>
      `🎯 \`${k}\` *${h.name}*\nMin Rank: ${h.minLevel} | ${isGroup ? `Max ${h.maxPlayers} players` : ''}\n📖 ${h.desc}`
    ).join('\n\n')
    const text = `💎 *GTA V HEIST BOARD*\n\n${list}\n\n📌 Usage: *.gtastartheist <heist_id>*\n📌 *.gtajoinhiest <heist_id>* — join a heist in this group\n\n_The biggest scores require the best crew._ 🏙️`
    await sendImgOrText(sock, jid, msg, GTA_CHARACTER_IMAGES.heist, text, reply)
  },
  async gtaheistlist(ctx) { return module.exports.gtaheist(ctx) },

  async gtastartheist({ reply, sender, args, isGroup, jid }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    if (!isGroup) return reply('❌ Heists must be planned in a group chat!')
    const id = args[0]?.toLowerCase()
    const heist = HEISTS[id]
    if (!id || !heist) return reply(`❌ Unknown heist. Use *.gtaheist* to see all.`)
    const rank = gtaRank(gta.rp || 0)
    if (rank.rank < heist.minLevel) return reply(`❌ Rank ${heist.minLevel} required. You are Rank ${rank.rank}.`)
    if (activeHeists[jid]) return reply(`⚠️ A heist is already being planned in this group! Use *.gtajoinhiest* to join.`)
    activeHeists[jid] = {
      id, heist, leader: sender, players: [sender], started: Date.now(), finalized: false,
    }
    const payoutText = heist.payout
      ? Object.entries(heist.payout).map(([k, v]) => `  • ${k}: $${v.toLocaleString()}`).join('\n') : ''
    return reply(
      `💎 *HEIST STARTED — ${heist.name}*\n\n` +
      `📋 ${heist.desc}\n\n` +
      `👑 Leader: @${sender}\n` +
      `👥 Players: 1/${heist.maxPlayers}\n\n` +
      `📦 *Prep Steps:*\n${heist.prep.map(p => `• ${p}`).join('\n')}\n\n` +
      `💰 *Potential Payout:*\n${payoutText}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `📌 Others: *.gtajoinhiest ${id}* to join\n` +
      `📌 Leader: *.gtaexecuteheist* when crew is ready\n\n` +
      `_You need a crew. You need a plan. You need balls._ 🏙️`
    )
  },

  async gtajoinhiest({ reply, sender, args, isGroup, jid }) {
    if (!isGroup) return reply('❌ Use this in a group chat.')
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const session = activeHeists[jid]
    if (!session) return reply(`❌ No heist planned in this group. Use *.gtastartheist <id>* to start one.`)
    if (session.players.includes(sender)) return reply('✅ You are already in this heist crew!')
    if (session.players.length >= session.heist.maxPlayers) return reply(`❌ Crew full (${session.heist.maxPlayers}/${session.heist.maxPlayers})`)
    session.players.push(sender)
    return reply(`✅ *JOINED HEIST — ${session.heist.name}*\n\n👥 Crew: ${session.players.length}/${session.heist.maxPlayers}\n\nWait for *.gtaexecuteheist* from the leader.\n\n_Welcome to the crew._ 🏙️`)
  },
  async gtajoinheist(ctx) { return module.exports.gtajoinhiest(ctx) },

  async gtaexecuteheist({ reply, sender, isGroup, jid }) {
    if (!isGroup) return reply('❌ Heists run in groups only.')
    const session = activeHeists[jid]
    if (!session) return reply('❌ No active heist. Use *.gtastartheist* to plan one.')
    if (session.leader !== sender) return reply('❌ Only the heist leader can execute!')
    const heist = session.heist
    const crewSize = session.players.length
    const successBase = crewSize >= 2 ? 0.70 : 0.50
    const success = Math.random() < successBase
    delete activeHeists[jid]
    await db.setCooldown(sender, 'gtaheist', 30 * 60)
    if (!success) {
      return reply(`💀 *HEIST FAILED — ${heist.name}*\n\n❌ The plan fell apart. Cops swarmed.\n\n👥 Crew: ${crewSize} player(s)\n\n_Back to the drawing board._ 🏙️`)
    }
    const payouts = Object.values(heist.payout || { payout: 500000 })
    const totalPayout = typeof payouts[0] === 'number' ? Math.max(...payouts) : payouts[0]
    const perPlayer = Math.floor(totalPayout / crewSize)
    for (const phone of session.players) {
      const playerGta = await getGtaData(phone)
      playerGta.cash = (playerGta.cash || 0) + perPlayer
      playerGta.rp = (playerGta.rp || 0) + 5000
      playerGta.totalHeists = (playerGta.totalHeists || 0) + 1
      await saveGtaData(phone, playerGta)
    }
    return reply(
      `✅ *HEIST COMPLETE — ${heist.name}*\n\n` +
      `👥 Crew: ${crewSize} player(s)\n` +
      `💰 Total Haul: $${totalPayout.toLocaleString()}\n` +
      `💵 Each Player: $${perPlayer.toLocaleString()}\n` +
      `⭐ RP: +5,000 each\n\n` +
      `_That's what a real crew does._ 🏙️`
    )
  },

  // Specific heist shortcuts
  async gtacayo({ reply, sender, isGroup, jid }) { return module.exports.gtastartheist({ reply, sender, args: ['cayo'], isGroup, jid }) },
  async gtadiamond({ reply, sender, isGroup, jid }) { return module.exports.gtastartheist({ reply, sender, args: ['diamond'], isGroup, jid }) },
  async gtafleeca({ reply, sender, isGroup, jid }) { return module.exports.gtastartheist({ reply, sender, args: ['fleeca'], isGroup, jid }) },
  async gtapacific({ reply, sender, isGroup, jid }) { return module.exports.gtastartheist({ reply, sender, args: ['pacific'], isGroup, jid }) },
  async gtahumane({ reply, sender, isGroup, jid }) { return module.exports.gtastartheist({ reply, sender, args: ['humane'], isGroup, jid }) },
  async gtadoomsday({ reply, sender, isGroup, jid }) { return module.exports.gtastartheist({ reply, sender, args: ['doomsday'], isGroup, jid }) },

  // ──────────────────── GANGS ────────────────────────────────
  async gtagangs({ reply }) {
    const list = Object.entries(GANGS).map(([k, g]) => `${g.color} \`${k}\` *${g.name}*\nTurf: ${g.turf} | Bonus: ${g.bonus}`).join('\n\n')
    return reply(`🔫 *LOS SANTOS GANGS*\n\n${list}\n\n📌 Use *.gtajoingang <id>* to join a gang.\n\n_Pick your side. There's no neutral in LS._ 🏙️`)
  },
  async gtajoingang({ reply, sender, args }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const id = args[0]?.toLowerCase()
    const gang = GANGS[id]
    if (!id || !gang) return reply(`❌ Unknown gang. Use *.gtagangs* to see all.`)
    if (gta.isCop) return reply('❌ You\'re a cop! Leave the force first with *.gtaquitcop*')
    gta.gang = id
    await saveGtaData(sender, gta)
    return reply(`${gang.color} *GANG JOINED — ${gang.name}*\n\n📍 Turf: ${gang.turf}\n💪 Bonus: ${gang.bonus}\n\n_You're family now. Don't embarrass us._ 🏙️`)
  },
  async gtagang({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    if (!gta.gang) return reply('❌ You\'re not in a gang.\n\nUse *.gtajoingang <id>* to join one.\nUse *.gtagangs* to see all gangs.')
    const gang = GANGS[gta.gang]
    return reply(`${gang.color} *YOUR GANG — ${gang.name}*\n\nTurf: ${gang.turf}\nBonus: ${gang.bonus}\n\n_Ride or die._ 🏙️`)
  },
  async gtagangwar({ reply, sender, isGroup }) {
    if (!isGroup) return reply('❌ Gang wars happen in group chats!')
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    if (!gta.gang) return reply('❌ Join a gang first with *.gtajoingang*')
    const remaining = await db.getCooldown(sender, 'gangwar')
    if (remaining > 0) return reply(`⏳ Gang war cooldown: ${Math.ceil(remaining / 60000)} min.`)
    const enemyGangs = Object.entries(GANGS).filter(([k]) => k !== gta.gang)
    const enemy = enemyGangs[Math.floor(Math.random() * enemyGangs.length)]
    const success = Math.random() < 0.60
    const myGang = GANGS[gta.gang]
    const prize = Math.floor(Math.random() * 30000 + 10000)
    await db.setCooldown(sender, 'gangwar', 20 * 60)
    if (!success) {
      gta.wanted = Math.min(5, (gta.wanted || 0) + 2)
      await saveGtaData(sender, gta)
      return reply(`🔫 *GANG WAR — LOST*\n\n${myGang.color} ${myGang.name} vs ${enemy[1].color} ${enemy[1].name}\n\n❌ Your gang got pushed back!\n⭐ Wanted: ${wantedStars(gta.wanted)}\n\n_Regroup. Reload. Revenge._ 🏙️`)
    }
    gta.cash = (gta.cash || 0) + prize
    gta.rp = (gta.rp || 0) + 2000
    await saveGtaData(sender, gta)
    return reply(`🔫 *GANG WAR — WON*\n\n${myGang.color} ${myGang.name} vs ${enemy[1].color} ${enemy[1].name}\n\n✅ Your gang took their turf!\n💰 +$${prize.toLocaleString()}\n⭐ +2,000 RP\n\n_The streets belong to us._ 🏙️`)
  },
  async gtaleavegang({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    if (!gta.gang) return reply('❌ You\'re not in a gang.')
    const old = GANGS[gta.gang]?.name || gta.gang
    gta.gang = null
    await saveGtaData(sender, gta)
    return reply(`🚶 Left *${old}*.\n\n_Going solo has its own risks._ 🏙️`)
  },

  // ──────────────────── POLICE / WANTED ────────────────────────
  async gtacop({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    if (gta.gang) return reply('❌ Leave your gang first with *.gtaleavegang*')
    gta.isCop = true
    gta.wanted = 0
    await saveGtaData(sender, gta)
    return reply(`👮 *JOINED LSPD*\n\nYou are now an officer of the law.\n\n🚔 You can arrest wanted players\n✅ Your wanted level has been cleared\n\n_Protect and serve. Or abuse the badge. Your call._ 🏙️`)
  },
  async gtaquitcop({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    gta.isCop = false
    await saveGtaData(sender, gta)
    return reply(`🚶 *LEFT LSPD*\n\nBadge turned in. Back to the streets.\n\n_The city missed you._ 🏙️`)
  },
  async gtaescape({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    if (!gta.wanted) return reply('✅ You have no wanted level. You\'re clean.')
    const remaining = await db.getCooldown(sender, 'gtaescape')
    if (remaining > 0) return reply(`⏳ Escape cooldown: ${Math.ceil(remaining / 60000)} min.`)
    const success = Math.random() < 0.65
    await db.setCooldown(sender, 'gtaescape', 10 * 60)
    if (!success) {
      return reply(`🚨 *ESCAPE FAILED*\n\n⭐ Wanted: ${wantedStars(gta.wanted)}\n\n❌ Cops cornered you! Wanted level increased.\n\n_They had helicopters. You had a Comet._ 🏙️`)
    }
    gta.wanted = 0
    await saveGtaData(sender, gta)
    return reply(`✅ *ESCAPED*\n\n⭐ Wanted level: CLEARED\n\n_Ghost. Clean. Free._ 🏙️`)
  },
  async gtawanted({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    return reply(`⭐ *WANTED LEVEL*\n\n${wantedStars(gta.wanted || 0)}\n\n${gta.wanted === 0 ? '✅ Clean record' : gta.wanted >= 4 ? '🚨 FULL PURSUIT — military deployed!' : '⚠️ Police are looking for you'}\n\n_Use *.gtaescape* to lose the heat._ 🏙️`)
  },
  async gtaarrest({ reply, sender, args, msg }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    if (!gta.isCop) return reply('❌ Only LSPD officers can arrest players!')
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    if (!mentionedJid) return reply('❌ Usage: *.gtaarrest @player*')
    const targetPhone = mentionedJid.split('@')[0].split(':')[0]
    const targetGta = await getGtaData(targetPhone)
    if (!targetGta.created) return reply('❌ That player has no GTA character.')
    if (!targetGta.wanted) return reply(`❌ @${targetPhone} has a clean record.`)
    const bail = targetGta.wanted * 5000
    targetGta.cash = Math.max(0, (targetGta.cash || 0) - bail)
    targetGta.wanted = 0
    await saveGtaData(targetPhone, targetGta)
    gta.rp = (gta.rp || 0) + 500
    await saveGtaData(sender, gta)
    return reply(`👮 *ARREST MADE*\n\n🎯 Arrested @${targetPhone}\n💰 Bail deducted: $${bail.toLocaleString()}\n⭐ Officer earned: +500 RP\n\n_Law and order, Los Santos style._ 🏙️`)
  },

  // ──────────────────── SCHOOL SYSTEM ────────────────────────
  async gtaschool({ reply, sender, isGroup }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const subjectList = SCHOOL_SUBJECTS.map((s, i) => `${i + 1}. *${s.name}* (${s.skill})\n   📖 ${s.desc}\n   ⭐ +${s.xp} XP | ⏱️ ${s.duration}`).join('\n\n')
    const role = gta.schoolRole || 'Not enrolled'
    return reply(
      `🎓 *LOS SANTOS ACADEMY*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 Your Role: *${role}*\n\n` +
      `📚 *Subjects:*\n${subjectList}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `📌 Commands:\n` +
      `• *.gtaenroll* — Enroll as student\n` +
      `• *.gtalearn <subject_#>* — Take a class\n` +
      `• *.gtateach <subject_#>* — Teach a class (teachers only)\n` +
      `• *.gtainviteschool @player* — Invite to school\n` +
      `• *.gtapromote @player <role>* — Promote a student\n` +
      `• *.gtagraduate* — Graduate when ready\n\n` +
      `_Knowledge is the real weapon._ 🎓`
    )
  },

  async gtaenroll({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    if (gta.schoolRole) return reply(`✅ Already enrolled as *${gta.schoolRole}*.\n\nUse *.gtalearn <subject>* to study.`)
    gta.schoolRole = 'student'
    gta.schoolXp = 0
    await saveGtaData(sender, gta)
    return reply(`🎓 *ENROLLED — Los Santos Academy*\n\n👤 Role: *Student*\n\n📚 Use *.gtalearn <number>* to take classes.\nSubjects: 1-Driving, 2-Weapons, 3-Hacking, 4-Stealth, 5-Flying, 6-Finance, 7-Street, 8-Heist\n\n_Education never hurt nobody. Mostly._ 🎓`)
  },

  async gtainviteschool({ reply, sender, args, msg }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    if (!['teacher', 'headmaster', 'principal', 'dean'].includes(gta.schoolRole)) {
      return reply('❌ Only teachers and above can invite players to school.')
    }
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    if (!mentionedJid) return reply('❌ Usage: *.gtainviteschool @player*')
    const targetPhone = mentionedJid.split('@')[0].split(':')[0]
    schoolInvites[targetPhone] = { invitedBy: sender, subject: null }
    return reply(`🎓 *INVITATION SENT*\n\n📨 @${targetPhone} has been invited to *Los Santos Academy*!\n\nThey can use *.gtaenroll* to join.\n\n_The more, the deadlier._ 🎓`)
  },

  async gtalearn({ reply, sender, args }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    if (!gta.schoolRole) return reply('❌ Enroll first with *.gtaenroll*')
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
    return reply(
      `📚 *CLASS COMPLETE — ${subject.name}*\n\n` +
      `⭐ Skill: ${subject.skill} → ${gta.skills[subject.skill]}/500\n` +
      `📊 School XP: ${gta.schoolXp}\n` +
      `⭐ +100 RP\n\n` +
      `${gta.schoolXp >= 2000 && gta.schoolRole === 'student' ? '🎓 *Ready to graduate!* Use *.gtagraduate*' : ''}\n` +
      `_Study hard. Hustle harder._ 🎓`
    )
  },

  async gtateach({ reply, sender, args, isGroup, jid }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    if (!['teacher', 'headmaster', 'principal', 'dean'].includes(gta.schoolRole)) {
      return reply('❌ Only teachers and above can run classes.\n\nGet promoted with *.gtapromote* or ask a headmaster.')
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
    return reply(
      `📖 *CLASS IN SESSION — ${subject.name}*\n\n` +
      `👨‍🏫 Teacher: @${sender}\n` +
      `📚 Subject: ${subject.name}\n` +
      `📖 ${subject.desc}\n\n` +
      `💰 Teacher Pay: +$5,000\n` +
      `⭐ +500 RP\n\n` +
      `_All students use *.gtalearn ${num + 1}* to earn skill XP from this class!_\n\n` +
      `_A good teacher changes lives. A great one changes the game._ 🎓`
    )
  },

  async gtapromote({ reply, sender, args, msg }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    if (!['headmaster', 'principal', 'dean'].includes(gta.schoolRole)) {
      return reply('❌ Only headmasters and above can promote players.')
    }
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    const newRole = args[1]?.toLowerCase() || args[0]?.toLowerCase()
    if (!mentionedJid || !SCHOOL_ROLES.includes(newRole)) {
      return reply(`❌ Usage: *.gtapromote @player <role>*\n\nRoles: ${SCHOOL_ROLES.join(', ')}`)
    }
    const targetPhone = mentionedJid.split('@')[0].split(':')[0]
    const targetGta = await getGtaData(targetPhone)
    if (!targetGta.created) return reply('❌ That player has no GTA character.')
    if (!targetGta.schoolRole) return reply('❌ That player is not enrolled in school.')
    targetGta.schoolRole = newRole
    await saveGtaData(targetPhone, targetGta)
    return reply(`🎓 *PROMOTED*\n\n👤 @${targetPhone} is now a *${newRole.charAt(0).toUpperCase() + newRole.slice(1)}*!\n\n_The academy grows stronger._ 🎓`)
  },

  async gtagraduate({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    if (gta.schoolRole !== 'student') return reply('❌ Only enrolled students can graduate.')
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
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const role = gta.schoolRole || 'Not enrolled'
    const xp = gta.schoolXp || 0
    return reply(`🎓 *SCHOOL ROLE*\n\n👤 Role: *${role}*\n📊 School XP: ${xp}\n\n${role === 'student' ? `Progress: ${xp}/2,000 to graduate` : role === 'teacher' ? '👨‍🏫 You can teach classes!' : '🎓 Senior staff — keep the academy running!'}\n\n_Use *.gtaschool* for all school commands._ 🎓`)
  },

  // ──────────────────── CASINO ────────────────────────────────
  async gtacasino({ reply, sender, args }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const bet = parseInt(args[0]) || 1000
    if ((gta.cash || 0) < bet) return reply(`❌ Not enough cash. You have $${(gta.cash || 0).toLocaleString()}`)
    const outcomes = [
      { name: '🎰 Jackpot!', mult: 10, chance: 0.02 },
      { name: '💎 Big Win', mult: 3, chance: 0.10 },
      { name: '✅ Win', mult: 2, chance: 0.25 },
      { name: '💔 Loss', mult: 0, chance: 0.63 },
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
    return reply(`🎰 *DIAMOND CASINO*\n\nBet: $${bet.toLocaleString()}\n${outcome.name}${winnings > 0 ? `\n💰 +$${winnings.toLocaleString()}` : winnings < 0 ? `\n💸 -$${bet.toLocaleString()}` : '\n↔️ Push'}\n\n💵 Balance: $${(gta.cash || 0).toLocaleString()}\n\n_The house always wins. Except when it doesn't._ 🎰`)
  },

  async gtastrip({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const remaining = await db.getCooldown(sender, 'gtastrip')
    if (remaining > 0) return reply(`⏳ Cooldown: ${Math.ceil(remaining / 60000)} min.`)
    const spent = Math.floor(Math.random() * 2000 + 500)
    gta.cash = Math.max(0, (gta.cash || 0) - spent)
    gta.rp = (gta.rp || 0) + 50
    await saveGtaData(sender, gta)
    await db.setCooldown(sender, 'gtastrip', 20 * 60)
    return reply(`🍸 *VANILLA UNICORN*\n\nSpent $${spent.toLocaleString()} on drinks and entertainment.\n⭐ +50 RP (for the experience)\n\n_What happens in the Unicorn, stays in the Unicorn._ 🏙️`)
  },

  async gtabar({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const remaining = await db.getCooldown(sender, 'gtabar')
    if (remaining > 0) return reply(`⏳ Cooldown: ${Math.ceil(remaining / 60000)} min.`)
    const drinks = ['Liquor', 'Beer', 'Whiskey', 'Brandy', 'Shot of Tequila']
    const drink = drinks[Math.floor(Math.random() * drinks.length)]
    const cost = Math.floor(Math.random() * 500 + 100)
    gta.cash = Math.max(0, (gta.cash || 0) - cost)
    await saveGtaData(sender, gta)
    await db.setCooldown(sender, 'gtabar', 5 * 60)
    return reply(`🍺 *BAR TIME*\n\nOrdered: *${drink}*\nCost: $${cost}\n\n_Even criminals need to unwind._ 🏙️`)
  },
  async gtadrink(ctx) { return module.exports.gtabar(ctx) },

  async gtafight({ reply, sender, args, msg }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    const target = mentionedJid ? mentionedJid.split('@')[0].split(':')[0] : 'a random pedestrian'
    const bet = parseInt(args[0]) || 0
    const win = Math.random() < 0.55
    const rank = gtaRank(gta.rp || 0)
    const earnings = win ? (bet + Math.floor(Math.random() * 3000 + 500)) : -Math.floor(Math.random() * 2000 + 200)
    gta.cash = Math.max(0, (gta.cash || 0) + earnings)
    gta.rp = (gta.rp || 0) + (win ? 200 : 30)
    gta.wanted = Math.min(5, (gta.wanted || 0) + 1)
    await saveGtaData(sender, gta)
    return reply(`👊 *STREET FIGHT*\n\n${win ? `✅ You knocked out *${target}*!\n💰 +$${Math.abs(earnings).toLocaleString()}` : `❌ *${target}* got the better of you!\n💸 -$${Math.abs(earnings).toLocaleString()}`}\n⭐ ${win ? '+200' : '+30'} RP\n⭐ Wanted: ${wantedStars(gta.wanted)}\n\n_Fists and bullets — the language of LS._ 🏙️`)
  },

  // ──────────────────── STATS / RANK / LEADERBOARD ─────────────
  async gtastats({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
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
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const rank = gtaRank(gta.rp || 0)
    const nextRankRp = { 1: 1000, 5: 3000, 10: 7000, 20: 15000, 30: 30000, 40: 60000, 50: 100000, 60: 180000, 70: 300000, 80: 500000, 90: 800000, 100: Infinity }
    const nextRp = Object.values(nextRankRp).find(v => v > (gta.rp || 0)) || Infinity
    const progress = nextRp !== Infinity ? `Progress to next: ${(gta.rp || 0).toLocaleString()}/${nextRp.toLocaleString()} RP` : '🏆 MAX RANK!'
    return reply(`📊 *GTA RANK*\n\nRank: *${rank.rank} — ${rank.name}*\n⭐ RP: ${(gta.rp || 0).toLocaleString()}\n${progress}\n\n${rank.rank >= 59 ? '⚠️ _At this rank, missions are BRUTAL. Tread carefully._' : '_Keep grinding for the top._'} 🏙️`)
  },

  async gtaboss({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const rank = gtaRank(gta.rp || 0)
    if (rank.rank < 30) return reply(`❌ Need Rank 30 to become CEO/MC President.\n\nYour rank: ${rank.rank}`)
    if ((gta.cash || 0) < 1000000) return reply(`❌ Need $1,000,000 to register an organization.\n\nYou have: $${(gta.cash || 0).toLocaleString()}`)
    gta.cash = (gta.cash || 0) - 1000000
    gta.isBoss = true
    await saveGtaData(sender, gta)
    return reply(`👑 *CEO REGISTERED*\n\n🏢 You are now a CEO / MC President!\n💰 Registration: -$1,000,000\n\n_Command your empire. Tax the streets._ 🏙️`)
  },

  async gtasocial({ reply, sender }) {
    const gta = await getGtaData(sender)
    if (!gta.created) return reply('❌ Create a character first with *.gtastart*')
    const rank = gtaRank(gta.rp || 0)
    const titles = ['Criminal', 'Baller', 'OG', 'Legend', 'Ghost', 'Phantom', 'The Architect']
    const title = rank.rank >= 80 ? titles[6] : rank.rank >= 60 ? titles[5] : rank.rank >= 40 ? titles[4] : rank.rank >= 30 ? titles[3] : rank.rank >= 20 ? titles[2] : titles[1]
    return reply(`📱 *SOCIAL CLUB*\n\n👤 ${gta.name}\n🏷️ Title: *${title}*\n📊 Rank: ${rank.rank} — ${rank.name}\n⭐ RP: ${(gta.rp || 0).toLocaleString()}\n🎯 Missions: ${gta.totalMissions || 0}\n💎 Heists: ${gta.totalHeists || 0}\n\n_Your reputation precedes you._ 🏙️`)
  },

  // ──────────────────── MENU ────────────────────────────────────
  async gtamenu({ reply }) {
    return reply(
      `🎮 *GTA V RP — COMMAND MENU*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `👤 *CHARACTER*\n` +
      `• *.gtastart* — Create character\n` +
      `• *.gtaprofile* — View profile\n` +
      `• *.gtacustomize* — Customize character\n` +
      `• *.gtaoutfit <type>* — Change outfit\n` +
      `• *.gtaname <name>* — Change name\n` +
      `• *.gtagender male/female*\n\n` +
      `🗺️ *WORLD*\n` +
      `• *.gtamap* — Real GTA V map\n` +
      `• *.gtatravel <place>* — Travel to location\n` +
      `• *.gtalocation* — Where you are\n` +
      `• *.gtaexplore* — Explore your area\n\n` +
      `🎯 *MISSIONS*\n` +
      `• *.gtamission* — Start a mission\n` +
      `• *.gtamissions* — Available missions\n` +
      `• *.gtacomplete* — Complete mission\n` +
      `• *.gtafailmission* — Abandon mission\n\n` +
      `💰 *MONEY*\n` +
      `• *.gtawork* — Work a job\n` +
      `• *.gtarob* — Rob a place\n` +
      `• *.gtadrug* — Drug deal\n` +
      `• *.gtasteal* — Steal a car\n` +
      `• *.gtahackbank* — Hack a bank\n` +
      `• *.gtabounty @player $amt* — Set bounty\n` +
      `• *.gtacollect @player* — Collect bounty\n\n` +
      `💎 *HEISTS*\n` +
      `• *.gtaheist* — Heist board\n` +
      `• *.gtastartheist <id>* — Plan heist\n` +
      `• *.gtajoinhiest <id>* — Join heist\n` +
      `• *.gtaexecuteheist* — Execute heist\n` +
      `• *.gtafleeca* *.gtadiamond* *.gtacayo*\n` +
      `• *.gtapacific* *.gtahumane* *.gtadoomsday*\n\n` +
      `🚗 *VEHICLES*\n` +
      `• *.gtacars* — Browse vehicles\n` +
      `• *.gtabuyvehicle <id>* — Buy vehicle\n` +
      `• *.gtagarage* — Your garage\n` +
      `• *.gtarace @player* — Street race\n` +
      `• *.gtadriveby @player* — Drive-by\n\n` +
      `🔫 *WEAPONS*\n` +
      `• *.gtaweapons* — Weapon shop\n` +
      `• *.gtabuygun <weapon>* — Buy weapon\n` +
      `• *.gtatshoot* — Target practice\n\n` +
      `🎓 *SCHOOL*\n` +
      `• *.gtaschool* — School menu\n` +
      `• *.gtaenroll* — Enroll as student\n` +
      `• *.gtalearn <1-8>* — Take a class\n` +
      `• *.gtateach <1-8>* — Teach a class\n` +
      `• *.gtainviteschool @player* — Invite\n` +
      `• *.gtapromote @player <role>* — Promote\n` +
      `• *.gtagraduate* — Graduate\n\n` +
      `🔫 *GANGS*\n` +
      `• *.gtagangs* — Gang list\n` +
      `• *.gtajoingang <id>* — Join gang\n` +
      `• *.gtagang* — Your gang\n` +
      `• *.gtagangwar* — Gang war\n` +
      `• *.gtaleavegang* — Leave gang\n\n` +
      `👮 *POLICE*\n` +
      `• *.gtacop* — Join LSPD\n` +
      `• *.gtaquitcop* — Quit LSPD\n` +
      `• *.gtaarrest @player* — Arrest\n` +
      `• *.gtawanted* — Your wanted level\n` +
      `• *.gtaescape* — Lose the cops\n\n` +
      `🎰 *SOCIAL*\n` +
      `• *.gtacasino <bet>* — Casino\n` +
      `• *.gtastrip* — Vanilla Unicorn\n` +
      `• *.gtadrink* — Bar time\n` +
      `• *.gtafight @player* — Street fight\n` +
      `• *.gtaboss* — Become CEO\n\n` +
      `📊 *INFO*\n` +
      `• *.gtastats* — Full stats\n` +
      `• *.gtarank* — Your rank\n` +
      `• *.gtasocial* — Social Club card\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Welcome to Los Santos. Population: criminals._ 🏙️`
    )
  },
}
