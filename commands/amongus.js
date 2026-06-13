// commands/amongus.js — Full Among Us WhatsApp Game System
'use strict'

const mongoose = require('mongoose')
const path = require('path')
const fs = require('fs')
const db = require('../database')

// ─────────────────────────────────────────────────────────────────────────────
// MONGOOSE SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const auPlayerSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  crewmate_wins:    { type: Number, default: 0 },
  impostor_wins:    { type: Number, default: 0 },
  games_played:     { type: Number, default: 0 },
  tasks_completed:  { type: Number, default: 0 },
  kills:            { type: Number, default: 0 },
  meetings_called:  { type: Number, default: 0 },
  correct_votes:    { type: Number, default: 0 },
  vent_count:       { type: Number, default: 0 },
  voted_out_crewmate: { type: Number, default: 0 },
  survival_count:   { type: Number, default: 0 },
  most_visited:     { type: Map, of: Number, default: {} },
  level:            { type: Number, default: 1 },
  xp:               { type: Number, default: 0 },
  coins:            { type: Number, default: 0 },
  titles:           { type: [String], default: [] },
  equipped_title:   { type: String, default: '' },
  owned_hats:       { type: [String], default: [] },
  owned_suits:      { type: [String], default: [] },
  owned_visors:     { type: [String], default: [] },
  owned_effects:    { type: [String], default: [] },
  owned_pets:       { type: [String], default: [] },
  owned_nameplates: { type: [String], default: [] },
  equipped_hat:     { type: String, default: '' },
  equipped_suit:    { type: String, default: 'red' },
  equipped_visor:   { type: String, default: '' },
  equipped_effect:  { type: String, default: '' },
  equipped_pet:     { type: String, default: '' },
  equipped_nameplate: { type: String, default: '' },
  achievements:     { type: [String], default: [] },
  crates:           { type: Number, default: 0 },
  spin_last:        { type: Date,   default: null },
}, { timestamps: true })

let AuPlayer
try { AuPlayer = mongoose.model('AuPlayer') } catch { AuPlayer = mongoose.model('AuPlayer', auPlayerSchema) }

async function getAuPlayer(phone) {
  try {
    let p = await AuPlayer.findOne({ phone })
    if (!p) p = await AuPlayer.create({ phone, owned_suits: ['red'] })
    return p
  } catch { return null }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — COLORS
// ─────────────────────────────────────────────────────────────────────────────

const PLAYER_COLORS = [
  { name: 'Red',      emoji: '🔴' },
  { name: 'Blue',     emoji: '🔵' },
  { name: 'Green',    emoji: '🟢' },
  { name: 'Purple',   emoji: '🟣' },
  { name: 'Yellow',   emoji: '🟡' },
  { name: 'Black',    emoji: '⚫' },
  { name: 'White',    emoji: '⚪' },
  { name: 'Orange',   emoji: '🟠' },
  { name: 'Brown',    emoji: '🟤' },
  { name: 'Cyan',     emoji: '🩵' },
  { name: 'Lime',     emoji: '💚' },
  { name: 'Maroon',   emoji: '🔻' },
  { name: 'Coral',    emoji: '🪸' },
  { name: 'Gray',     emoji: '🩶' },
  { name: 'Lavender', emoji: '💜' },
  { name: 'Tan',      emoji: '🌿' },
  { name: 'Rose',     emoji: '🩷' },
  { name: 'Banana',   emoji: '🍌' },
  { name: 'Ruby',     emoji: '💎' },
  { name: 'Teal',     emoji: '🫐' },
]

function getColorEmoji(colorName) {
  const c = PLAYER_COLORS.find(c => c.name.toLowerCase() === colorName?.toLowerCase())
  return c ? c.emoji : '⚪'
}

function pickRandomColor(usedColors = []) {
  const available = PLAYER_COLORS.filter(c => !usedColors.includes(c.name))
  if (!available.length) return PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)]
  return available[Math.floor(Math.random() * available.length)]
}

function playerTag(player) {
  // Returns: 🔴 Name (Red)
  const emoji = getColorEmoji(player.color)
  return `${emoji} ${player.pushName}`
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — MAP & ROOMS
// ─────────────────────────────────────────────────────────────────────────────

const SKELD_MAP_PATH = path.join(__dirname, '../assets/skeld-map.jpg')

const ROOMS = [
  'Cafeteria', 'Electrical', 'Security', 'Reactor', 'Storage',
  'MedBay', 'Navigation', 'Weapons', 'Admin', 'Shields',
  'Upper Engine', 'Lower Engine', 'Communications',
]

const ROOM_ALIASES = {
  cafe: 'Cafeteria', caf: 'Cafeteria',
  elec: 'Electrical', electrical: 'Electrical',
  sec: 'Security', security: 'Security',
  react: 'Reactor', reactor: 'Reactor',
  stor: 'Storage', storage: 'Storage',
  med: 'MedBay', medbay: 'MedBay', medibay: 'MedBay',
  nav: 'Navigation', navigation: 'Navigation',
  weap: 'Weapons', weapons: 'Weapons',
  admin: 'Admin',
  shield: 'Shields', shields: 'Shields',
  upper: 'Upper Engine', upperengine: 'Upper Engine', ue: 'Upper Engine',
  lower: 'Lower Engine', lowerengine: 'Lower Engine', le: 'Lower Engine',
  comms: 'Communications', comm: 'Communications', communications: 'Communications',
}

const VENT_NETWORK = {
  'Electrical':    ['MedBay', 'Security'],
  'MedBay':        ['Electrical', 'Security'],
  'Security':      ['Electrical', 'MedBay'],
  'Weapons':       ['Navigation', 'Shields'],
  'Navigation':    ['Weapons', 'Shields'],
  'Shields':       ['Weapons', 'Navigation'],
  'Reactor':       ['Upper Engine', 'Lower Engine'],
  'Upper Engine':  ['Reactor', 'Lower Engine'],
  'Lower Engine':  ['Reactor', 'Upper Engine'],
}

const TASKS_BY_ROOM = {
  'Cafeteria':      ['Fix Wiring', 'Empty Garbage'],
  'Electrical':     ['Fix Wiring', 'Calibrate Distributor', 'Divert Power'],
  'Security':       ['View Cameras'],
  'Reactor':        ['Unlock Manifolds', 'Start Reactor'],
  'Storage':        ['Fill Canisters', 'Empty Garbage'],
  'MedBay':         ['Submit Scan', 'Inspect Sample'],
  'Navigation':     ['Chart Course', 'Stabilize Steering'],
  'Weapons':        ['Clear Asteroids', 'Calibrate Targeting'],
  'Admin':          ['Swipe Card', 'Upload Data'],
  'Shields':        ['Prime Shields'],
  'Upper Engine':   ['Align Engine Output', 'Fix Wiring'],
  'Lower Engine':   ['Align Engine Output', 'Fix Wiring'],
  'Communications': ['Download Data', 'Decode Signal'],
}

const ALL_TASKS = []
for (const [room, tasks] of Object.entries(TASKS_BY_ROOM)) {
  for (const task of tasks) ALL_TASKS.push({ room, name: task })
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — COSMETICS & TITLES
// ─────────────────────────────────────────────────────────────────────────────

const COSMETICS = {
  hats: [
    { id: 'crown',      name: 'Crown',        price: 2000, emoji: '👑', rarity: 'Epic' },
    { id: 'halo',       name: 'Halo',         price: 1500, emoji: '😇', rarity: 'Rare' },
    { id: 'witch_hat',  name: 'Witch Hat',    price: 1200, emoji: '🧙', rarity: 'Rare' },
    { id: 'party_hat',  name: 'Party Hat',    price: 500,  emoji: '🎉', rarity: 'Common' },
    { id: 'cap',        name: 'Baseball Cap', price: 400,  emoji: '🧢', rarity: 'Common' },
    { id: 'beanie',     name: 'Beanie',       price: 350,  emoji: '🧣', rarity: 'Common' },
    { id: 'tophat',     name: 'Top Hat',      price: 800,  emoji: '🎩', rarity: 'Uncommon' },
    { id: 'horns',      name: 'Devil Horns',  price: 1000, emoji: '😈', rarity: 'Rare' },
  ],
  suits: [
    { id: 'red',      name: 'Red',      price: 0,    emoji: '🔴', rarity: 'Common' },
    { id: 'black',    name: 'Black',    price: 300,  emoji: '⚫', rarity: 'Common' },
    { id: 'blue',     name: 'Blue',     price: 300,  emoji: '🔵', rarity: 'Common' },
    { id: 'purple',   name: 'Purple',   price: 400,  emoji: '🟣', rarity: 'Uncommon' },
    { id: 'yellow',   name: 'Yellow',   price: 400,  emoji: '🟡', rarity: 'Uncommon' },
    { id: 'green',    name: 'Green',    price: 500,  emoji: '🟢', rarity: 'Uncommon' },
    { id: 'white',    name: 'White',    price: 500,  emoji: '⚪', rarity: 'Uncommon' },
    { id: 'orange',   name: 'Orange',   price: 500,  emoji: '🟠', rarity: 'Uncommon' },
    { id: 'konosuba', name: 'Konosuba', price: 5000, emoji: '🖤', rarity: 'Legendary' },
  ],
  visors: [
    { id: 'glitch',   name: 'Glitch',  price: 800, emoji: '👾', rarity: 'Rare' },
    { id: 'scanner',  name: 'Scanner', price: 600, emoji: '🔍', rarity: 'Uncommon' },
    { id: 'glasses',  name: 'Glasses', price: 400, emoji: '👓', rarity: 'Common' },
    { id: 'shades',   name: 'Shades',  price: 550, emoji: '🕶️', rarity: 'Common' },
  ],
  effects: [
    { id: 'lightning',   name: 'Lightning',   price: 1500, emoji: '⚡', rarity: 'Rare' },
    { id: 'blood_burst', name: 'Blood Burst', price: 2000, emoji: '🩸', rarity: 'Epic' },
    { id: 'confetti',    name: 'Confetti',    price: 1000, emoji: '🎊', rarity: 'Rare' },
    { id: 'smoke',       name: 'Smoke',       price: 700,  emoji: '💨', rarity: 'Uncommon' },
  ],
  pets: [
    { id: 'mini_crew', name: 'Mini Crewmate', price: 2500, emoji: '🐾', rarity: 'Epic' },
    { id: 'hamster',   name: 'Hamster',       price: 1000, emoji: '🐹', rarity: 'Uncommon' },
    { id: 'dog',       name: 'Dog',           price: 800,  emoji: '🐕', rarity: 'Common' },
    { id: 'cat',       name: 'Cat',           price: 900,  emoji: '🐱', rarity: 'Common' },
    { id: 'robo_pet',  name: 'Robot Pet',     price: 1800, emoji: '🤖', rarity: 'Rare' },
  ],
  nameplates: [
    { id: 'star',   name: 'Starfield', price: 1200, emoji: '⭐', rarity: 'Rare' },
    { id: 'galaxy', name: 'Galaxy',    price: 2000, emoji: '🌌', rarity: 'Epic' },
    { id: 'flame',  name: 'Flame',     price: 1000, emoji: '🔥', rarity: 'Rare' },
  ],
}

function getAllCosmeticItems() {
  return [
    ...COSMETICS.hats, ...COSMETICS.suits, ...COSMETICS.visors,
    ...COSMETICS.effects, ...COSMETICS.pets, ...COSMETICS.nameplates,
  ]
}

function isCosmetic(name) {
  const lower = name.toLowerCase()
  return getAllCosmeticItems().some(i => i.name.toLowerCase() === lower || i.id === lower)
}

const CRATE_REWARDS = [
  ...COSMETICS.hats.filter(i => i.rarity !== 'Common'),
  ...COSMETICS.suits.filter(i => i.price > 0),
  ...COSMETICS.visors,
  ...COSMETICS.effects,
  ...COSMETICS.pets.filter(i => i.rarity !== 'Common'),
]

const SPIN_REWARDS = [
  { type: 'coins', amount: 500 },
  { type: 'coins', amount: 1000 },
  { type: 'coins', amount: 2000 },
  { type: 'xp',    amount: 200 },
  { type: 'xp',    amount: 500 },
  { type: 'crate', amount: 1 },
  { type: 'coins', amount: 250 },
  { type: 'xp',    amount: 100 },
]

const SECRET_TITLES = [
  { id: 'vent_goblin',       name: 'Vent Goblin',              desc: 'Use vents 500 times',             condition: p => p.vent_count >= 500 },
  { id: 'definitely_innocent', name: 'Definitely Innocent',   desc: 'Voted out as Crewmate 25 times',  condition: p => p.voted_out_crewmate >= 25 },
  { id: 'emergency_addict',  name: 'Emergency Meeting Addict', desc: 'Call 100 meetings',               condition: p => p.meetings_called >= 100 },
  { id: 'master_impostor',   name: 'Master Impostor',          desc: 'Win 100 Impostor games',          condition: p => p.impostor_wins >= 100 },
  { id: 'task_slave',        name: 'Task Slave',               desc: 'Complete 5,000 tasks',            condition: p => p.tasks_completed >= 5000 },
  { id: 'sherlock',          name: 'Sherlock',                 desc: 'Correctly vote Impostors 250x',   condition: p => p.correct_votes >= 250 },
  { id: 'detective',         name: 'Detective',                desc: 'Correctly vote Impostors 50x',    condition: p => p.correct_votes >= 50 },
  { id: 'survivor',          name: 'Survivor',                 desc: 'Survive 50 games',                condition: p => p.survival_count >= 50 },
  { id: 'bloodthirsty',      name: 'Bloodthirsty',             desc: 'Get 100 kills',                   condition: p => p.kills >= 100 },
  { id: 'veteran',           name: 'Veteran',                  desc: 'Play 200 games',                  condition: p => p.games_played >= 200 },
]

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY GAME STATE
// ─────────────────────────────────────────────────────────────────────────────

const activeGames = {}    // groupJid → game object
const playerToGame = {}   // phone → groupJid

function getGame(jid) { return activeGames[jid] || null }
function findPlayerGame(phone) {
  const jid = playerToGame[phone]
  return jid ? (activeGames[jid] || null) : null
}

function resolveRoom(input) {
  const lower = input.toLowerCase().replace(/\s+/g, '')
  if (ROOM_ALIASES[lower]) return ROOM_ALIASES[lower]
  return ROOMS.find(r => r.toLowerCase() === input.toLowerCase() || r.toLowerCase().replace(/\s+/g, '') === lower) || null
}

function generateCode() { return Math.random().toString(36).substring(2, 8).toUpperCase() }

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLE / TASK ASSIGNMENT
// ─────────────────────────────────────────────────────────────────────────────

function assignPlayerTasks() {
  return shuffleArray([...ALL_TASKS]).slice(0, 3).map((t, i) => ({ id: i + 1, name: t.name, room: t.room, done: false }))
}

function assignRoles(players, settings) {
  const count = players.length
  const impostorCount = Math.min(settings.impostorCount || 2, Math.max(1, Math.floor(count / 3)))

  let specials = []
  if (count >= 6)  specials.push('Engineer')
  if (count >= 7)  specials.push('Scientist')
  if (count >= 8)  specials.push('Guardian Angel')
  if (count >= 9)  specials.push('Shapeshifter')
  if (count >= 10) specials.push('Tracker')

  const shuffled = shuffleArray([...players])
  for (let i = 0; i < impostorCount; i++) shuffled[i].role = 'Impostor'

  let idx = impostorCount
  for (const role of specials) {
    if (idx < shuffled.length) { shuffled[idx].role = role; idx++ }
  }
  for (let i = idx; i < shuffled.length; i++) shuffled[i].role = 'Crewmate'

  for (const p of shuffled) p.tasks = assignPlayerTasks()
  return shuffled
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function sendDM(sock, phone, text) {
  try { await sock.sendMessage(`${phone}@s.whatsapp.net`, { text }) } catch {}
}

async function sendPublic(sock, jid, text, quotedMsg) {
  const opts = quotedMsg ? { quoted: quotedMsg } : {}
  await sock.sendMessage(jid, { text }, opts)
}

function getTaskProgress(game) {
  const allTasks = game.players.filter(p => p.role !== 'Impostor').flatMap(p => p.tasks)
  const total = allTasks.length
  const done  = allTasks.filter(t => t.done).length
  return { total, done, percent: total > 0 ? Math.round((done / total) * 100) : 0 }
}

function checkWinCondition(game) {
  const alive     = game.players.filter(p => p.alive)
  const impostors = alive.filter(p => p.role === 'Impostor' || p.role === 'Shapeshifter')
  const crew      = alive.filter(p => p.role !== 'Impostor' && p.role !== 'Shapeshifter')

  if (impostors.length === 0) return { winner: 'Crewmates', reason: 'All Impostors Eliminated' }
  if (impostors.length >= crew.length) return { winner: 'Impostors', reason: 'Crew Outnumbered' }

  const prog = getTaskProgress(game)
  if (prog.total > 0 && prog.done >= prog.total) return { winner: 'Crewmates', reason: 'All Tasks Completed' }

  return null
}

function findPlayerByColor(game, colorInput) {
  const lower = colorInput.toLowerCase()
  return game.players.find(p => p.color?.toLowerCase() === lower)
}

// ─────────────────────────────────────────────────────────────────────────────
// AWARDS
// ─────────────────────────────────────────────────────────────────────────────

async function awardTitles(phone, profile) {
  const newTitles = []
  for (const t of SECRET_TITLES) {
    if (!profile.titles.includes(t.id) && t.condition(profile)) {
      profile.titles.push(t.id)
      newTitles.push(t.name)
    }
  }
  if (newTitles.length) await profile.save()
  return newTitles
}

async function grantGameRewards(game, winner) {
  for (const player of game.players) {
    try {
      const profile = await getAuPlayer(player.phone)
      if (!profile) continue

      profile.games_played += 1
      let coins = 0, xp = 0

      if (winner === 'Crewmates' && player.role !== 'Impostor' && player.role !== 'Shapeshifter') {
        profile.crewmate_wins += 1; coins += 500; xp += 50
        if (player.alive) profile.survival_count += 1
      } else if (winner === 'Impostors' && (player.role === 'Impostor' || player.role === 'Shapeshifter')) {
        profile.impostor_wins += 1; coins += 750; xp += 75
        if (player.alive) profile.survival_count += 1
      }

      const tasksDone = player.tasks.filter(t => t.done).length
      coins += tasksDone * 20; xp += tasksDone * 5
      profile.coins += coins; profile.xp += xp

      const xpNeeded = profile.level * 500
      if (profile.xp >= xpNeeded) { profile.level += 1; profile.xp -= xpNeeded }

      await profile.save()
      await awardTitles(player.phone, profile)

      try {
        const mu = await db.getOrCreateUser(player.phone)
        if (mu) { mu.wallet = (mu.wallet || 0) + coins; mu.xp = (mu.xp || 0) + xp; await mu.save() }
      } catch {}
    } catch (e) { console.error('[AU Rewards]', e.message) }
  }
}

async function endGame(sock, game, winner, reason) {
  game.status = 'ended'
  if (game._meetingTimer) { clearTimeout(game._meetingTimer); game._meetingTimer = null }
  if (game.sabotage?.timer) { clearTimeout(game.sabotage.timer); game.sabotage = null }

  const impostors = game.players
    .filter(p => p.role === 'Impostor' || p.role === 'Shapeshifter')
    .map(p => `${playerTag(p)} (${p.pushName})`)
    .join(', ')

  const resultEmoji = winner === 'Crewmates' ? '🏆' : '🔪'
  const rewardText  = winner === 'Crewmates' ? '+500 Coins | +50 XP' : '+750 Coins | +75 XP'

  await sendPublic(sock, game.groupJid,
    `${resultEmoji} *${winner.toUpperCase()} WIN!*\n\nReason:\n└ ${reason}\n\nThe Impostor(s) were:\n└ ${impostors || 'Unknown'}\n\nRewards:\n└ ${rewardText}`
  )

  await grantGameRewards(game, winner)

  for (const p of game.players) delete playerToGame[p.phone]
  delete activeGames[game.groupJid]
}

// ─────────────────────────────────────────────────────────────────────────────
// MEETING SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

async function endMeeting(sock, game) {
  if (!game.meeting) return
  if (game._meetingTimer) { clearTimeout(game._meetingTimer); game._meetingTimer = null }

  const votes = {}
  let skipVotes = 0

  for (const p of game.players.filter(q => q.alive && q.voted)) {
    if (p.voteTarget === 'skip') skipVotes++
    else votes[p.voteTarget] = (votes[p.voteTarget] || 0) + 1
  }

  let maxVotes = skipVotes
  let ejected  = null

  for (const [phone, count] of Object.entries(votes)) {
    if (count > maxVotes) { maxVotes = count; ejected = phone }
    else if (count === maxVotes && ejected) ejected = null
  }

  let results = `🗳️ *VOTING RESULTS*\n\n`
  for (const [phone, count] of Object.entries(votes)) {
    const ep = game.players.find(q => q.phone === phone)
    results += `${playerTag(ep)} — ${count} vote${count !== 1 ? 's' : ''}\n`
  }
  results += `⏭️ Skip — ${skipVotes} vote${skipVotes !== 1 ? 's' : ''}\n\n`

  if (ejected) {
    const ep = game.players.find(p => p.phone === ejected)
    ep.alive = false
    const wasImp = ep.role === 'Impostor' || ep.role === 'Shapeshifter'
    results += `🚀 *EJECTED*\n\n${playerTag(ep)} was...\n${wasImp ? '🔴 *AN IMPOSTOR*' : '🔵 *NOT AN IMPOSTOR*'}`

    if (wasImp) {
      for (const p of game.players.filter(q => q.voteTarget === ejected && q.alive)) {
        try { const profile = await getAuPlayer(p.phone); if (profile) { profile.correct_votes += 1; await profile.save() } } catch {}
      }
    } else {
      try { const profile = await getAuPlayer(ep.phone); if (profile) { profile.voted_out_crewmate += 1; await profile.save() } } catch {}
    }
  } else {
    results += `🤷 No one was ejected.`
  }

  await sendPublic(sock, game.groupJid, results)
  game.meeting = null
  game.status  = 'playing'

  const win = checkWinCondition(game)
  if (win) { await endGame(sock, game, win.winner, win.reason); return }

  await sendPublic(sock, game.groupJid,
    `🎮 *Game continues!*\n\nUse *.go <room>* to move.\nImpostors — go low.`
  )
}

async function startMeeting(sock, game, type, caller, bodyOf = null) {
  if (game.meeting) return
  game.status  = 'meeting'
  game.meeting = { type, caller, bodyOf, startedAt: Date.now() }

  for (const p of game.players) { p.voted = false; p.voteTarget = null }

  const alive     = game.players.filter(p => p.alive)
  const aliveList = alive.map(p => `${playerTag(p)}`).join('\n')
  const bodyName  = bodyOf ? game.players.find(p => p.phone === bodyOf)?.pushName : null
  const bodyRoom  = bodyOf ? game.bodies.find(b => b.phone === bodyOf)?.room : null

  const header = type === 'body'
    ? `☠️ *BODY REPORTED!*\n\n${bodyName} was found in ${bodyRoom || '???'}.`
    : `🚨 *EMERGENCY MEETING!*\n\nCalled by: ${playerTag(alive.find(p => p.phone === caller) || { color: '', pushName: caller })}`

  await sendPublic(sock, game.groupJid,
    `${header}\n\n👥 *Alive Players:*\n${aliveList}\n\n⏰ Discussion: 60 seconds\n\nUse *.vote @user* or color (*.vote Red*) — or *.skip*`
  )

  game._meetingTimer = setTimeout(async () => { await endMeeting(sock, game) }, 60000)
}

// ─────────────────────────────────────────────────────────────────────────────
// SABOTAGE TIMER
// ─────────────────────────────────────────────────────────────────────────────

async function startSabotageTimer(sock, game, type, ms) {
  if (game.sabotage?.timer) clearTimeout(game.sabotage.timer)
  game.sabotage = {
    type, startedAt: Date.now(), expiresAt: Date.now() + ms,
    timer: setTimeout(async () => {
      if (!activeGames[game.groupJid]) return
      if (['reactor', 'o2'].includes(type)) {
        await endGame(sock, game, 'Impostors', 'Critical Sabotage Successful')
      } else {
        if (activeGames[game.groupJid]) game.sabotage = null
      }
    }, ms),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND: .amongus (router)
// ─────────────────────────────────────────────────────────────────────────────

async function cmdAmongUs(ctx) {
  const { args, reply } = ctx
  const sub = (args[0] || '').toLowerCase()

  if (sub === 'create')    return cmdCreate(ctx)
  if (sub === 'join')      return cmdJoin({ ...ctx, args: args.slice(1) })
  if (sub === 'leave')     return cmdLeave(ctx)
  if (sub === 'players')   return cmdPlayers(ctx)
  if (sub === 'startau')   return cmdStart(ctx)
  if (sub === 'role')      return cmdRole(ctx)
  if (sub === 'status')    return cmdStatus(ctx)
  if (sub === 'code')      return cmdCode(ctx)
  if (sub === 'host')      return cmdHost(ctx)
  if (sub === 'settings')  return cmdSettings(ctx)
  if (sub === 'room')      return cmdRoom(ctx)

  return reply(
`╔═════ ⋆⋅☆⋅⋆ ═════╗
🚀 *AMONG US HELP*
╚═════ ⋆⋅☆⋅⋆ ═════╝

🎮 *Lobby*
• .amongus create
• .join — join lobby
• .leave
• .players
• .startau (host only)

🗺️ *Gameplay*
• .go <room> — move
• .tasks — view tasks
• .task <id> — complete task
• .room — current room

🔴 *Colors*
• .colours — color list
• .color switch <n> — switch color

👻 *Impostor*
• .kill <color> — kill by color
• .vent / .vent <room>
• .sabotage <lights/reactor/o2>

🗳️ *Meeting*
• .report — found a body
• .meeting — emergency
• .vote <color> — vote
• .skip

🏷️ *Profile*
• .crewcard — your profile
• .cosmetics — shop
• .buyau <item>
• .locker — owned items
• .equip <item>
• .map — show The Skeld`
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND: .create
// ─────────────────────────────────────────────────────────────────────────────

async function cmdCreate(ctx) {
  const { reply, jid, sender, senderJid, pushName, sock, msg } = ctx

  if (!ctx.isGroup) return reply(`⚠️ Among Us can only be played in a group chat.`)
  if (playerToGame[sender]) return reply(`⚠️ You're already in a lobby.`)
  if (activeGames[jid]) return reply(`⚠️ A lobby already exists in this group. Join it with *.join*`)

  const code  = generateCode()
  const color = pickRandomColor()

  const game = {
    code,
    groupJid: jid,
    host: sender,
    status: 'lobby',
    players: [{
      phone: sender, jid: senderJid, pushName,
      color: color.name,
      role: null, alive: true, room: 'Cafeteria',
      tasks: [], voted: false, voteTarget: null,
      protected: false, protectUsed: false,
      killCooldown: 0, vitalsCharges: 3, shiftsRemaining: 3,
    }],
    bodies: [],
    meeting: null, _meetingTimer: null,
    sabotage: null, sabotageCD: 0,
    settings: { maxPlayers: 15, impostorCount: 2, killCooldown: 30, meetings: 1 },
    meetingsRemaining: { [sender]: 1 },
  }

  activeGames[jid]  = game
  playerToGame[sender] = jid

  await sock.sendMessage(jid, {
    text:
      `🚀 *AMONG US LOBBY CREATED*\n\n` +
      `Host:\n└ @${sender}\n\n` +
      `Your Color:\n└ ${color.emoji} ${color.name}\n\n` +
      `Players:\n└ 1/${game.settings.maxPlayers}\n\n` +
      `Lobby Code:\n└ \`${code}\`\n\n` +
      `Type *.join* to enter.\nType *.startau* when everyone is in.`,
    mentions: [senderJid],
  }, { quoted: msg })
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND: .join
// ─────────────────────────────────────────────────────────────────────────────

async function cmdJoin(ctx) {
  const { reply, jid, sender, senderJid, pushName, sock, msg } = ctx

  if (!ctx.isGroup) return reply(`⚠️ Among Us can only be played in a group chat.`)
  if (playerToGame[sender]) return reply(`⚠️ You're already in a lobby.`)

  const game = activeGames[jid]
  if (!game)                            return reply(`⚠️ No active lobby here. Create one with *.au create*`)
  if (game.status !== 'lobby')          return reply(`⚠️ The match has already started.`)
  if (game.players.length >= game.settings.maxPlayers) return reply(`⚠️ Lobby is full!`)

  // Assign a unique color
  const usedColors = game.players.map(p => p.color)
  const color = pickRandomColor(usedColors)

  game.players.push({
    phone: sender, jid: senderJid, pushName,
    color: color.name,
    role: null, alive: true, room: 'Cafeteria',
    tasks: [], voted: false, voteTarget: null,
    protected: false, protectUsed: false,
    killCooldown: 0, vitalsCharges: 3, shiftsRemaining: 3,
  })

  playerToGame[sender]          = jid
  game.meetingsRemaining[sender] = 1

  await sock.sendMessage(jid, {
    text:
      `${color.emoji} @${sender} joined!\n\n` +
      `Your Color:\n└ ${color.emoji} *${color.name}*\n\n` +
      `Players:\n└ ${game.players.length}/${game.settings.maxPlayers}\n\n` +
      `Don't like it? Use *.colours* to switch.`,
    mentions: [senderJid],
  }, { quoted: msg })
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND: .colours (show color list) / .color switch <n>
// ─────────────────────────────────────────────────────────────────────────────

async function cmdColours(ctx) {
  const { reply, jid, sender } = ctx
  const game = activeGames[jid] || findPlayerGame(sender)
  if (!game || game.status !== 'lobby') return reply(`⚠️ Colors can only be changed during the lobby phase.`)

  const player   = game.players.find(p => p.phone === sender)
  if (!player) return reply(`⚠️ You're not in this lobby.`)

  const usedColors = game.players.filter(p => p.phone !== sender).map(p => p.color)

  const list = PLAYER_COLORS.map((c, i) => {
    const taken  = usedColors.includes(c.name) ? ' *(Taken)*' : ''
    const active = player.color === c.name ? ' ← *Yours*' : ''
    return `${i + 1}. ${c.emoji} ${c.name}${taken}${active}`
  }).join('\n')

  return reply(
    `🎨 *AVAILABLE COLORS*\n\n${list}\n\n` +
    `Your Color:\n└ ${getColorEmoji(player.color)} ${player.color}\n\n` +
    `Use *.color switch <number>* to switch.`
  )
}

async function cmdColorSwitch(ctx) {
  const { reply, jid, sender, args, sock } = ctx
  const game = activeGames[jid] || findPlayerGame(sender)
  if (!game || game.status !== 'lobby') return reply(`⚠️ You can only change color during the lobby.`)

  const player = game.players.find(p => p.phone === sender)
  if (!player) return reply(`⚠️ You're not in this lobby.`)

  const num = parseInt(args[0])
  if (isNaN(num) || num < 1 || num > PLAYER_COLORS.length) {
    return reply(`⚠️ Pick a number between 1 and ${PLAYER_COLORS.length}.`)
  }

  const chosen     = PLAYER_COLORS[num - 1]
  const usedColors = game.players.filter(p => p.phone !== sender).map(p => p.color)

  if (usedColors.includes(chosen.name)) {
    return reply(`⚠️ ${chosen.emoji} ${chosen.name} is already taken. Pick a different color.`)
  }

  player.color = chosen.name

  await sock.sendMessage(jid, {
    text: `🎨 *Color Changed!*\n\n@${sender}\nNew Color:\n└ ${chosen.emoji} *${chosen.name}*`,
    mentions: [player.jid],
  }, { quoted: ctx.msg })
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND: .leave
// ─────────────────────────────────────────────────────────────────────────────

async function cmdLeave(ctx) {
  const { reply, jid, sender, senderJid, sock, msg } = ctx

  const game = activeGames[jid] || findPlayerGame(sender)
  if (!game) return reply(`⚠️ You're not in any lobby.`)

  // Dead players cannot leave mid-game (anti-exploit)
  const player = game.players.find(p => p.phone === sender)
  if (game.status === 'playing' || game.status === 'meeting') {
    if (player && !player.alive) {
      return reply(`💀 Dead players cannot leave during a match.`)
    }
  }

  const wasHost = game.host === sender
  game.players  = game.players.filter(p => p.phone !== sender)
  delete playerToGame[sender]

  await sock.sendMessage(jid, {
    text: `👋 @${sender} left the lobby.`,
    mentions: [senderJid],
  }, { quoted: msg })

  if (game.players.length === 0) { delete activeGames[game.groupJid]; return }

  if (wasHost) {
    game.host = game.players[0].phone
    await reply(`👑 New host: ${game.players[0].pushName}`)
  }

  if (game.status === 'playing' || game.status === 'meeting') {
    const win = checkWinCondition(game)
    if (win) await endGame(sock, game, win.winner, win.reason)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND: .players
// ─────────────────────────────────────────────────────────────────────────────

async function cmdPlayers(ctx) {
  const { reply, jid, sender } = ctx
  const game = activeGames[jid] || findPlayerGame(sender)
  if (!game) return reply(`⚠️ No active lobby in this group.`)

  const list = game.players.map(p => `${playerTag(p)}`).join('\n')
  return reply(`🚀 *LOBBY PLAYERS*\n\n${list}\n\nTotal:\n└ ${game.players.length}/${game.settings.maxPlayers}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND: .start
// ─────────────────────────────────────────────────────────────────────────────

async function cmdStart(ctx) {
  const { reply, sock, jid, sender } = ctx

  const game = activeGames[jid]
  if (!game)                      return reply(`⚠️ No active lobby in this group.`)
  if (game.host !== sender)       return reply(`⚠️ Only the host can start the game.`)
  if (game.players.length < 4)   return reply(`⚠️ Need at least 4 players to start!`)
  if (game.status !== 'lobby')   return reply(`⚠️ The match has already started.`)

  game.status = 'playing'
  assignRoles(game.players, game.settings)

  const colorList = game.players.map(p => `${playerTag(p)}`).join('\n')

  await sendPublic(sock, jid,
    `🚀 *Match Started!*\n\nPlayers:\n${colorList}\n\nRoles have been sent to your DM.\nCheck your private messages!`
  )

  // DM each player their role + tasks
  const impostors = game.players.filter(p => p.role === 'Impostor' || p.role === 'Shapeshifter')
  const impNames  = impostors.map(p => `${playerTag(p)} (${p.pushName})`).join(', ')

  for (const player of game.players) {
    let roleMsg = ''
    const taskList = player.tasks.map(t => `□ ${t.id}. ${t.name} (${t.room})`).join('\n')

    if (player.role === 'Impostor') {
      const others = impostors.filter(p => p.phone !== player.phone).map(p => `${playerTag(p)}`).join(', ')
      roleMsg =
        `🔴 *ROLE: IMPOSTOR*\n\n` +
        `Your Color:\n└ ${playerTag(player)}\n\n` +
        `Objective:\n└ Kill all crewmates.\n└ Blend in.\n\n` +
        `${others ? `Other Impostors:\n└ ${others}\n\n` : ''}` +
        `Commands:\n• .kill <color>\n• .vent / .vent <room>\n• .sabotage <type>`
    } else if (player.role === 'Shapeshifter') {
      const others = impostors.filter(p => p.phone !== player.phone).map(p => `${playerTag(p)}`).join(', ')
      roleMsg =
        `🎭 *ROLE: SHAPESHIFTER*\n\n` +
        `Your Color:\n└ ${playerTag(player)}\n\n` +
        `Objective:\n└ Kill all crewmates while hidden.\n\n` +
        `${others ? `Team:\n└ ${others}\n\n` : ''}` +
        `Commands:\n• .kill <color>\n• .vent / .vent <room>\n• .sabotage <type>\n• .shift <color> (3 uses)`
    } else if (player.role === 'Engineer') {
      roleMsg =
        `🔧 *ROLE: ENGINEER*\n\n` +
        `Your Color:\n└ ${playerTag(player)}\n\n` +
        `Objective:\n└ Complete tasks. Find Impostors.\n\nAbility:\n└ Use vents to travel.\n\nCommands:\n• .vent / .vent <room>`
    } else if (player.role === 'Scientist') {
      roleMsg =
        `🧪 *ROLE: SCIENTIST*\n\n` +
        `Your Color:\n└ ${playerTag(player)}\n\n` +
        `Objective:\n└ Complete tasks. Find Impostors.\n\nAbility:\n└ Check player vitals. (3 charges)\n\nCommands:\n• .vitals`
    } else if (player.role === 'Guardian Angel') {
      roleMsg =
        `😇 *ROLE: GUARDIAN ANGEL*\n\n` +
        `Your Color:\n└ ${playerTag(player)}\n\n` +
        `Objective:\n└ Complete tasks. Protect a crewmate.\n\nAbility:\n└ Protect one player from being killed. (1 use)\n\nCommands:\n• .protect <color>`
    } else if (player.role === 'Tracker') {
      roleMsg =
        `📍 *ROLE: TRACKER*\n\n` +
        `Your Color:\n└ ${playerTag(player)}\n\n` +
        `Objective:\n└ Complete tasks. Track suspicious players.\n\nAbility:\n└ See last room of any player.\n\nCommands:\n• .track <color>`
    } else {
      roleMsg =
        `🔵 *ROLE: CREWMATE*\n\n` +
        `Your Color:\n└ ${playerTag(player)}\n\n` +
        `Objective:\n└ Complete tasks.\n└ Find the Impostors.\n\nAbilities:\n• .tasks / .task <id>\n• .report / .meeting\n• .vote <color> / .skip`
    }

    roleMsg += `\n\n📋 *Your Tasks:*\n${taskList}`
    await sendDM(sock, player.phone, roleMsg)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND: .role / .status / .code / .host / .settings / .room
// ─────────────────────────────────────────────────────────────────────────────

async function cmdRole(ctx) {
  const { reply, sender, sock } = ctx
  const game = findPlayerGame(sender)
  if (!game || game.status === 'lobby') return reply(`⚠️ No active game right now.`)

  const player = game.players.find(p => p.phone === sender)
  if (!player) return reply(`⚠️ You're not in this game.`)

  const roleEmoji = { Crewmate: '🔵', Impostor: '🔴', Engineer: '🔧', Scientist: '🧪', 'Guardian Angel': '😇', Shapeshifter: '🎭', Tracker: '📍' }
  await sendDM(sock, sender, `${roleEmoji[player.role] || '❓'} *Role: ${player.role}*\n\nColor:\n└ ${playerTag(player)}`)
  return reply(`✅ Role sent to your DM.`)
}

async function cmdStatus(ctx) {
  const { reply, jid, sender } = ctx
  const game = activeGames[jid] || findPlayerGame(sender)
  if (!game || game.status === 'lobby') return reply(`⚠️ No active match.`)

  const alive    = game.players.filter(p => p.alive).length
  const dead     = game.players.filter(p => !p.alive).length
  const progress = getTaskProgress(game)
  const sab      = game.sabotage ? game.sabotage.type : 'None'

  return reply(
    `📊 *MATCH STATUS*\n\nAlive:\n└ ${alive}\n\nDead:\n└ ${dead}\n\nTask Progress:\n└ ${progress.percent}%\n\nSabotage:\n└ ${sab}`
  )
}

async function cmdCode(ctx) {
  const game = activeGames[ctx.jid] || findPlayerGame(ctx.sender)
  if (!game) return ctx.reply(`⚠️ No active lobby in this group.`)
  return ctx.reply(`🔑 *Lobby Code*\n\n└ \`${game.code}\``)
}

async function cmdHost(ctx) {
  const game = activeGames[ctx.jid] || findPlayerGame(ctx.sender)
  if (!game) return ctx.reply(`⚠️ No active lobby in this group.`)
  const host = game.players.find(p => p.phone === game.host)
  await ctx.sock.sendMessage(ctx.jid, {
    text: `👑 *Host*\n\n└ @${game.host}`,
    mentions: [host?.jid || `${game.host}@s.whatsapp.net`],
  }, { quoted: ctx.msg })
}

async function cmdSettings(ctx) {
  const game = activeGames[ctx.jid] || findPlayerGame(ctx.sender)
  if (!game) return ctx.reply(`⚠️ No active lobby in this group.`)
  const s = game.settings
  return ctx.reply(
    `⚙️ *LOBBY SETTINGS*\n\nMax Players:\n└ ${s.maxPlayers}\n\nImpostors:\n└ ${s.impostorCount}\n\nKill Cooldown:\n└ ${s.killCooldown}s\n\nEmergency Meetings:\n└ ${s.meetings}`
  )
}

async function cmdRoom(ctx) {
  const { reply, jid, sender } = ctx
  const game = activeGames[jid] || findPlayerGame(sender)
  if (!game || game.status === 'lobby') return reply(`⚠️ No active game right now.`)

  const player = game.players.find(p => p.phone === sender)
  if (!player) return reply(`⚠️ You're not in this game.`)

  const here  = game.players.filter(p => p.alive && p.room === player.room && p.phone !== sender).map(p => `• ${playerTag(p)}`).join('\n')
  const hasBody = game.bodies.some(b => b.room === player.room)

  return reply(
    `📍 *CURRENT ROOM*\n\n${player.room}\n\nPlayers:\n${here || '• None'}${hasBody ? '\n\n⚠️ There is a dead body here!' : ''}`
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND: .go / .move
// ─────────────────────────────────────────────────────────────────────────────

async function cmdGo(ctx) {
  const { reply, sock, jid, sender, senderJid, args } = ctx

  const game = activeGames[jid]
  if (!game || game.status === 'lobby') return  // fall through to other handlers

  const player = game.players.find(p => p.phone === sender)
  if (!player) return
  if (game.status === 'meeting') return reply(`⚠️ Meeting in progress — wait for voting to end.`)
  if (!player.alive) {
    // Ghosts can still roam
  }

  const roomInput = args.join(' ')
  if (!roomInput) return reply(`⚠️ Usage: .go <room name>`)

  const room = resolveRoom(roomInput)
  if (!room) return reply(`⚠️ Invalid room.\n\nValid rooms:\n${ROOMS.join(', ')}`)

  player.room = room

  // Track most visited
  try {
    const profile = await getAuPlayer(sender)
    if (profile) {
      const cur = profile.most_visited.get(room) || 0
      profile.most_visited.set(room, cur + 1)
      await profile.save()
    }
  } catch {}

  const here     = game.players.filter(p => p.alive && p.room === room && p.phone !== sender).map(p => `• ${playerTag(p)}`).join('\n')
  const hasBody  = game.bodies.some(b => b.room === room)

  let txt = `${playerTag(player)} moved to *${room}*.`
  if (here)    txt += `\n\nPlayers Here:\n${here}`
  if (hasBody) txt += `\n\n⚠️ Dead body here!`

  await sock.sendMessage(jid, { text: txt, mentions: [senderJid] }, { quoted: ctx.msg })
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND: .tasks / .task <id>
// ─────────────────────────────────────────────────────────────────────────────

async function cmdTasks(ctx) {
  const { reply, sender } = ctx
  const game = findPlayerGame(sender)
  if (!game || game.status === 'lobby') return reply(`⚠️ No active game right now.`)

  const player = game.players.find(p => p.phone === sender)
  if (!player) return reply(`⚠️ You're not in this game.`)

  const list = player.tasks.map(t => `${t.done ? '✅' : '□'} ${t.id}. ${t.name} (${t.room})`).join('\n')
  const done = player.tasks.filter(t => t.done).length

  return reply(`📋 *YOUR TASKS*\n\n${list}\n\nProgress:\n└ ${done}/${player.tasks.length}`)
}

async function cmdTask(ctx) {
  const { reply, sock, jid, sender, args } = ctx
  const game = findPlayerGame(sender)
  if (!game || game.status === 'lobby') return reply(`⚠️ No active game right now.`)
  if (game.status === 'meeting') return reply(`⚠️ A meeting is in progress — wait for it to end.`)

  const player = game.players.find(p => p.phone === sender)
  if (!player) return reply(`⚠️ You're not in this game.`)

  const taskId = parseInt(args[0]) - 1
  if (isNaN(taskId) || taskId < 0 || taskId >= player.tasks.length) {
    return reply(`⚠️ Invalid task number. Use *.tasks* to see your list.`)
  }

  const task = player.tasks[taskId]
  if (task.done) return reply(`✅ That task is already completed.`)

  // Crewmates must be in the right room; impostors fake tasks anywhere
  if (player.role !== 'Impostor' && player.role !== 'Shapeshifter' && player.room !== task.room) {
    return reply(`⚠️ You need to be in *${task.room}* to do this task.\nCurrently in: ${player.room}`)
  }

  task.done = true

  try {
    const profile = await getAuPlayer(sender)
    if (profile) { profile.tasks_completed += 1; await profile.save() }
  } catch {}

  const done     = player.tasks.filter(t => t.done).length
  const progress = getTaskProgress(game)

  await sendDM(sock, sender,
    `✅ *Task Completed!*\n\n${task.name}\n\nGlobal Task Bar:\n└ ${progress.percent}% (${progress.done}/${progress.total})`
  )

  await sendPublic(sock, game.groupJid,
    `📋 Task bar: ${progress.done}/${progress.total} — ${progress.percent}%`
  )

  const win = checkWinCondition(game)
  if (win) await endGame(sock, game, win.winner, win.reason)
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND: .kill <color>
// ─────────────────────────────────────────────────────────────────────────────

async function cmdKill(ctx) {
  const { reply, sock, jid, sender, args, msg } = ctx
  if (ctx.isGroup) return sendDM(sock, sender, `🔒 Use *.eliminate* in my DMs — private actions must not be sent in the group.`)
  const game = activeGames[jid] || findPlayerGame(sender)
  if (!game || game.status !== 'playing') return

  const player = game.players.find(p => p.phone === sender)
  if (!player?.alive) return

  if (player.role !== 'Impostor' && player.role !== 'Shapeshifter') {
    return sendDM(sock, sender, `⚠️ Only Impostors can kill.`)
  }

  // Resolve target — by color name, @mention, or phone
  let target = null

  const colorArg = args.join(' ').trim()
  if (colorArg) {
    target = findPlayerByColor(game, colorArg)
    if (!target) {
      // Try by @mention
      const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
      const q        = msg.message?.extendedTextMessage?.contextInfo?.participant
      const tJid     = mentions[0] || q
      const tPhone   = tJid?.split('@')[0]?.split(':')[0]
      target = game.players.find(p => p.phone === tPhone)
    }
  } else {
    return sendDM(sock, sender, `⚠️ Usage: .kill <color>\nExample: .kill Red`)
  }

  if (!target)           return sendDM(sock, sender, `⚠️ Player not found. Use their color name.`)
  if (!target.alive)     return sendDM(sock, sender, `💀 ${playerTag(target)} is already dead.`)
  if (target.phone === sender) return sendDM(sock, sender, `⚠️ You can't kill yourself.`)

  // Same room check
  if (player.room !== target.room) {
    return sendDM(sock, sender,
      `⚠️ ${playerTag(target)} is not in your room.\nThey are in: ${target.room}\nYou are in: ${player.room}`
    )
  }

  // Cooldown check
  const now = Date.now()
  if (player.killCooldown && now < player.killCooldown) {
    const left = Math.ceil((player.killCooldown - now) / 1000)
    return sendDM(sock, sender, `⏳ Kill on cooldown. Wait ${left}s.`)
  }

  // Guardian Angel protection
  if (target.protected) {
    target.protected = false
    await sendDM(sock, sender,   `🛡️ Your kill was blocked! A Guardian Angel protected ${playerTag(target)}.`)
    await sendDM(sock, target.phone, `🛡️ A Guardian Angel saved you from being eliminated!`)
    return
  }

  // Commit the kill
  target.alive = false
  game.bodies.push({ phone: target.phone, room: target.room })
  player.killCooldown = now + (game.settings.killCooldown * 1000)

  try {
    const profile = await getAuPlayer(sender)
    if (profile) { profile.kills += 1; await profile.save() }
  } catch {}

  await sendDM(sock, sender,
    `🔪 *Kill Successful*\n\nVictim:\n└ ${playerTag(target)}\n\nDon't get caught. Leave the area.\nCooldown: ${game.settings.killCooldown}s`
  )
  await sendDM(sock, target.phone,
    `💀 *You were killed.*\n\nYou are now a ghost.\nYou can still complete tasks to help your team!`
  )

  const win = checkWinCondition(game)
  if (win) await endGame(sock, game, win.winner, win.reason)
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND: .vent / .vent <room>
// ─────────────────────────────────────────────────────────────────────────────

async function cmdVent(ctx) {
  const { sock, jid, sender, args } = ctx
  if (ctx.isGroup) return sendDM(sock, sender, `🔒 Use *.vent* in my DMs — private actions must not be sent in the group.`)
  const game = activeGames[jid] || findPlayerGame(sender)
  if (!game || game.status !== 'playing') return

  const player = game.players.find(p => p.phone === sender)
  if (!player?.alive) return

  if (player.role !== 'Impostor' && player.role !== 'Shapeshifter' && player.role !== 'Engineer') {
    return sendDM(sock, sender, `⚠️ Only Impostors and Engineers can use vents.`)
  }

  const opts = VENT_NETWORK[player.room]
  if (!opts) return sendDM(sock, sender, `⚠️ No vent in *${player.room}*.`)

  if (!args[0]) {
    const list = opts.map((r, i) => `${i + 1}. ${r}`).join('\n')
    return sendDM(sock, sender, `🕳️ *VENTS IN ${player.room.toUpperCase()}*\n\n${list}\n\nUse *.vent <room name>* to travel.`)
  }

  const dest = resolveRoom(args.join(' '))
  if (!dest || !opts.includes(dest)) {
    return sendDM(sock, sender, `⚠️ Invalid vent destination.\nAvailable from ${player.room}:\n${opts.join(', ')}`)
  }

  player.room = dest

  try {
    const profile = await getAuPlayer(sender)
    if (profile) { profile.vent_count += 1; await profile.save() }
  } catch {}

  await sendDM(sock, sender, `🕳️ *Vent Travel*\n\nDestination:\n└ ${dest}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND: .sabotage <type>
// ─────────────────────────────────────────────────────────────────────────────

async function cmdSabotage(ctx) {
  const { sock, jid, sender, args } = ctx
  if (ctx.isGroup) return sendDM(sock, sender, `🔒 Use *.sabo* in my DMs — private actions must not be sent in the group.`)
  const game = activeGames[jid] || findPlayerGame(sender)
  if (!game || game.status !== 'playing') return

  const player = game.players.find(p => p.phone === sender)
  if (!player?.alive) return

  if (player.role !== 'Impostor' && player.role !== 'Shapeshifter') {
    return sendDM(sock, sender, `⚠️ Only Impostors can sabotage.`)
  }

  const now = Date.now()
  if (game.sabotageCD && now < game.sabotageCD) {
    const left = Math.ceil((game.sabotageCD - now) / 1000)
    return sendDM(sock, sender, `⏳ Sabotage on cooldown. Wait ${left}s.`)
  }
  if (game.sabotage) return sendDM(sock, sender, `⚠️ A sabotage is already active.`)

  const type = (args[0] || '').toLowerCase()
  const valid = { lights: true, reactor: true, o2: true, oxygen: true, doors: true, comms: true, communications: true }
  if (!valid[type]) {
    return sendDM(sock, sender, `⚠️ Invalid sabotage type.\nOptions: *lights, reactor, o2, doors, comms*`)
  }

  const canon = type === 'oxygen' ? 'o2' : type === 'communications' ? 'comms' : type

  if (canon === 'lights') {
    await startSabotageTimer(sock, game, 'lights', 45000)
    await sendPublic(sock, game.groupJid, `💡 *LIGHTS SABOTAGED!*\n\nCrew vision reduced.\nRepair at Electrical with *.fix*`)
  } else if (canon === 'reactor') {
    await startSabotageTimer(sock, game, 'reactor', 45000)
    await sendPublic(sock, game.groupJid, `☢️ *REACTOR MELTDOWN!*\n\n⏰ 45 seconds before Impostors win!\n\nRepair at Reactor — use *.fix*`)
  } else if (canon === 'o2') {
    await startSabotageTimer(sock, game, 'o2', 45000)
    await sendPublic(sock, game.groupJid, `🫁 *OXYGEN FAILURE!*\n\n⏰ 45 seconds before Impostors win!\n\nRepair at Comms or Admin — use *.fix*`)
  } else if (canon === 'doors') {
    await startSabotageTimer(sock, game, 'doors', 30000)
    await sendPublic(sock, game.groupJid, `🚪 *DOORS LOCKED!*\n\nMovement restricted for 30 seconds.`)
  } else if (canon === 'comms') {
    await startSabotageTimer(sock, game, 'comms', 45000)
    await sendPublic(sock, game.groupJid, `📡 *COMMUNICATIONS DOWN!*\n\nTask tracking unavailable.\nRepair at Comms — use *.fix*`)
  }

  game.sabotageCD = now + 30000
  await sendDM(sock, sender, `✅ Sabotage activated: *${canon}*`)
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND: .fix / .repair
// ─────────────────────────────────────────────────────────────────────────────

async function cmdFix(ctx) {
  const { reply, sock, jid, sender } = ctx
  const game = activeGames[jid] || findPlayerGame(sender)
  if (!game) return reply(`⚠️ No sabotage is active right now.`)
  if (!game.sabotage) return reply(`⚠️ Nothing to fix right now.`)

  const player = game.players.find(p => p.phone === sender)
  if (!player?.alive) return reply(`💀 Ghosts cannot fix sabotages.`)

  const fixRooms = {
    lights: ['Electrical'],
    reactor: ['Reactor'],
    o2: ['Communications', 'Admin'],
    doors: ROOMS,
    comms: ['Communications'],
  }
  const needed = fixRooms[game.sabotage.type] || []
  if (needed.length > 0 && !ROOMS.every(_ => needed.includes('*')) && !needed.includes(player.room)) {
    return reply(`⚠️ Go to *${needed.join('* or *')}* to fix this!\nCurrently in: ${player.room}`)
  }

  if (game.sabotage.timer) clearTimeout(game.sabotage.timer)
  game.sabotage = null

  await sock.sendMessage(jid, {
    text: `✅ *Sabotage Fixed!*\n\n${playerTag(player)} repaired the situation.`,
    mentions: [player.jid],
  }, { quoted: ctx.msg })
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND: .report
// ─────────────────────────────────────────────────────────────────────────────

async function cmdReport(ctx) {
  const { reply, sock, jid, sender } = ctx
  const game = activeGames[jid] || findPlayerGame(sender)
  if (!game || game.status !== 'playing') return reply(`⚠️ No active game right now.`)

  const player = game.players.find(p => p.phone === sender)
  if (!player?.alive) return reply(`💀 Ghosts cannot report bodies.`)
  if (game.meeting) return reply(`⚠️ A meeting is already in progress.`)

  const body = game.bodies.find(b => b.room === player.room)
  if (!body) return reply(`⚠️ No body found in *${player.room}*.\n\nMove to where the body is first.`)

  game.bodies.splice(game.bodies.indexOf(body), 1)
  await startMeeting(sock, game, 'body', sender, body.phone)
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND: .meeting (emergency)
// ─────────────────────────────────────────────────────────────────────────────

async function cmdMeeting(ctx) {
  const { reply, sock, jid, sender } = ctx
  const game = activeGames[jid] || findPlayerGame(sender)
  if (!game || game.status !== 'playing') return reply(`⚠️ No active game right now.`)

  const player = game.players.find(p => p.phone === sender)
  if (!player?.alive) return reply(`💀 Ghosts cannot call meetings.`)
  if (game.meeting) return reply(`⚠️ A meeting is already active.`)

  const remaining = game.meetingsRemaining[sender] ?? 1
  if (remaining <= 0) return reply(`⚠️ No emergency meetings remaining.`)

  game.meetingsRemaining[sender] = remaining - 1

  try {
    const profile = await getAuPlayer(sender)
    if (profile) { profile.meetings_called += 1; await profile.save() }
  } catch {}

  await startMeeting(sock, game, 'emergency', sender)
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND: .vote <color or @mention> / .skip
// ─────────────────────────────────────────────────────────────────────────────

async function cmdVote(ctx) {
  const { reply, sock, jid, sender, args, msg } = ctx
  const game = activeGames[jid] || findPlayerGame(sender)
  if (!game || game.status !== 'meeting') return reply(`⚠️ No meeting is in progress.`)

  const player = game.players.find(p => p.phone === sender)
  if (!player?.alive) return reply(`💀 Dead players cannot vote.`)
  if (player.voted)   return reply(`⚠️ You already voted.`)

  // Resolve target — by color name or @mention
  const colorArg = args.join(' ').trim()
  let target = null

  if (colorArg) target = findPlayerByColor(game, colorArg)
  if (!target) {
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const q        = msg.message?.extendedTextMessage?.contextInfo?.participant
    const tJid     = mentions[0] || q
    const tPhone   = tJid?.split('@')[0]?.split(':')[0]
    target = game.players.find(p => p.phone === tPhone)
  }

  if (!target)              return reply(`⚠️ Player not found. Use their color name or @mention them.`)
  if (!target.alive)        return reply(`💀 That player is already dead.`)
  if (target.phone === sender) return reply(`⚠️ You can't vote for yourself. Use *.skip* to abstain.`)

  player.voted       = true
  player.voteTarget  = target.phone

  await ctx.sock.sendMessage(jid, {
    text: `🗳️ Vote recorded.\n\n${playerTag(player)} → ${playerTag(target)}`,
    mentions: [player.jid, target.jid],
  }, { quoted: ctx.msg })

  // Auto-end if everyone voted
  const alive = game.players.filter(p => p.alive)
  if (alive.every(p => p.voted)) await endMeeting(sock, game)
}

async function cmdSkip(ctx) {
  const { reply, sock, jid, sender } = ctx
  const game = activeGames[jid] || findPlayerGame(sender)
  if (!game || game.status !== 'meeting') return reply(`⚠️ No meeting is in progress.`)

  const player = game.players.find(p => p.phone === sender)
  if (!player?.alive) return reply(`💀 Dead players cannot vote.`)
  if (player.voted)   return reply(`⚠️ You already voted.`)

  player.voted      = true
  player.voteTarget = 'skip'

  await reply(`🗳️ ${playerTag(player)} skipped.`)

  const alive = game.players.filter(p => p.alive)
  if (alive.every(p => p.voted)) await endMeeting(sock, game)
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND: .observe <color>
// ─────────────────────────────────────────────────────────────────────────────

async function cmdObserve(ctx) {
  const { reply, jid, sender, args } = ctx
  const game = activeGames[jid] || findPlayerGame(sender)
  if (!game || game.status !== 'playing') return

  const player = game.players.find(p => p.phone === sender)
  if (!player?.alive) return

  const colorArg = args.join(' ').trim()
  if (!colorArg) return reply(`⚠️ Usage: .observe <color>`)

  const target = findPlayerByColor(game, colorArg)
  if (!target?.alive) return reply(`⚠️ Player not found.`)

  const responses = [
    `👀 ${playerTag(target)} appears to be working.`,
    `👀 ${playerTag(target)} looks suspicious.`,
    `👀 ${playerTag(target)} seems normal.`,
    `👀 Unable to determine activity.`,
    `👀 ${playerTag(target)} is moving around quickly.`,
  ]
  return reply(responses[Math.floor(Math.random() * responses.length)])
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND: Special role abilities
// ─────────────────────────────────────────────────────────────────────────────

async function cmdVitals(ctx) {
  const { sock, jid, sender } = ctx
  if (ctx.isGroup) return sendDM(sock, sender, `🔒 Use *.vitals* in my DMs — private actions must not be sent in the group.`)
  const game = activeGames[jid] || findPlayerGame(sender)
  if (!game || game.status === 'lobby') return

  const player = game.players.find(p => p.phone === sender)
  if (!player) return
  if (player.role !== 'Scientist') return sendDM(sock, sender, `⚠️ Only Scientists can check vitals.`)

  player.vitalsCharges = player.vitalsCharges ?? 3
  if (player.vitalsCharges <= 0) return sendDM(sock, sender, `⚠️ No vitals charges remaining.`)

  player.vitalsCharges -= 1

  const vitals = game.players.map(p => `${playerTag(p)} — ${p.alive ? '❤️ Alive' : '💀 Dead'}`).join('\n')
  await sendDM(sock, sender, `❤️ *VITALS MONITOR*\n\n${vitals}\n\nCharges remaining: ${player.vitalsCharges}`)
}

async function cmdProtect(ctx) {
  const { reply, sock, jid, sender, args } = ctx
  const game = activeGames[jid] || findPlayerGame(sender)
  if (!game || game.status !== 'playing') return

  const player = game.players.find(p => p.phone === sender)
  if (!player?.alive) return
  if (player.role !== 'Guardian Angel') return sendDM(sock, sender, `⚠️ Only Guardian Angels can protect.`)
  if (player.protectUsed) return sendDM(sock, sender, `⚠️ You already used your protection this game.`)

  const colorArg = args.join(' ').trim()
  const target   = findPlayerByColor(game, colorArg)
  if (!target?.alive) return sendDM(sock, sender, `⚠️ Player not found. Use their color.`)

  target.protected   = true
  player.protectUsed = true

  await sendDM(sock, sender, `🛡️ *Protection Applied*\n\nProtecting:\n└ ${playerTag(target)}\n\nThey will survive one kill attempt.`)
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND: .guard <player>  — Guardian Angel (activates AFTER death)
// ─────────────────────────────────────────────────────────────────────────────

async function cmdGuard(ctx) {
  const { sock, jid, sender, args } = ctx
  if (ctx.isGroup) return sendDM(sock, sender, `🔒 Use *.guard* in my DMs — private actions must not be sent in the group.`)
  const game = activeGames[jid] || findPlayerGame(sender)
  if (!game || game.status !== 'playing') return

  const player = game.players.find(p => p.phone === sender)
  if (!player) return
  if (player.role !== 'Guardian Angel') return sendDM(sock, sender, `⚠️ Only Guardian Angels can use .guard.`)
  if (player.alive) return sendDM(sock, sender, `⚠️ Guardian Angel ability unlocks after you die. Stay alive for now!`)
  if (player.protectUsed) return sendDM(sock, sender, `⚠️ You already used your protection this game.`)

  const colorArg = args.join(' ').trim()
  if (!colorArg) return sendDM(sock, sender, `⚠️ Usage: .guard <color>\nExample: .guard Red`)

  const target = findPlayerByColor(game, colorArg)
  if (!target?.alive) return sendDM(sock, sender, `⚠️ Player not found or already dead. Use their color.`)
  if (target.phone === sender) return sendDM(sock, sender, `⚠️ You cannot guard yourself.`)

  target.protected   = true
  player.protectUsed = true

  await sendDM(sock, sender,
    `😇 *Guardian Protection Applied*\n\nProtecting:\n└ ${playerTag(target)}\n\nThey will survive the next kill attempt.\n\n_(One-time use — ability spent)_`
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND: .ventto <room>  — explicit vent-to destination
// ─────────────────────────────────────────────────────────────────────────────

async function cmdVentTo(ctx) {
  const { sock, jid, sender, args } = ctx
  if (ctx.isGroup) return sendDM(sock, sender, `🔒 Use *.ventto* in my DMs — private actions must not be sent in the group.`)
  const game = activeGames[jid] || findPlayerGame(sender)
  if (!game || game.status !== 'playing') return

  const player = game.players.find(p => p.phone === sender)
  if (!player?.alive) return

  if (player.role !== 'Impostor' && player.role !== 'Shapeshifter' && player.role !== 'Engineer') {
    return sendDM(sock, sender, `⚠️ Only Impostors and Engineers can use vents.`)
  }

  const opts = VENT_NETWORK[player.room]
  if (!opts) return sendDM(sock, sender, `⚠️ No vent in *${player.room}*.`)

  const dest = resolveRoom(args.join(' '))
  if (!dest || !opts.includes(dest)) {
    return sendDM(sock, sender,
      `⚠️ Invalid vent destination.\nAvailable from ${player.room}:\n${opts.join(', ')}`
    )
  }

  player.room = dest

  try {
    const profile = await getAuPlayer(sender)
    if (profile) { profile.vent_count += 1; await profile.save() }
  } catch {}

  await sendDM(sock, sender, `🕳️ *Vent Travel*\n\nDestination:\n└ ${dest}`)
}

async function cmdShift(ctx) {
  const { sock, jid, sender, args } = ctx
  if (ctx.isGroup) return sendDM(sock, sender, `🔒 Use *.shift* in my DMs — private actions must not be sent in the group.`)
  const game = activeGames[jid] || findPlayerGame(sender)
  if (!game || game.status !== 'playing') return

  const player = game.players.find(p => p.phone === sender)
  if (!player?.alive) return
  if (player.role !== 'Shapeshifter') return sendDM(sock, sender, `⚠️ Only Shapeshifters can shift.`)

  player.shiftsRemaining = player.shiftsRemaining ?? 3
  if (player.shiftsRemaining <= 0) return sendDM(sock, sender, `⚠️ No shifts remaining.`)

  const colorArg = args.join(' ').trim()
  const target   = findPlayerByColor(game, colorArg)
  if (!target?.alive) return sendDM(sock, sender, `⚠️ Player not found. Use their color.`)

  player.shiftsRemaining -= 1
  await sendDM(sock, sender,
    `🎭 *Shape Shifted*\n\nNow appearing as:\n└ ${playerTag(target)}\n\nShifts remaining: ${player.shiftsRemaining}`
  )
}

async function cmdTrack(ctx) {
  const { sock, jid, sender, args } = ctx
  if (ctx.isGroup) return sendDM(sock, sender, `🔒 Use *.track* in my DMs — private actions must not be sent in the group.`)
  const game = activeGames[jid] || findPlayerGame(sender)
  if (!game || game.status !== 'playing') return

  const player = game.players.find(p => p.phone === sender)
  if (!player?.alive) return
  if (player.role !== 'Tracker') return sendDM(sock, sender, `⚠️ Only Trackers can track players.`)

  const colorArg = args.join(' ').trim()
  const target   = findPlayerByColor(game, colorArg)
  if (!target?.alive) return sendDM(sock, sender, `⚠️ Player not found. Use their color.`)

  await sendDM(sock, sender,
    `📍 *TRACKING RESULT*\n\n${playerTag(target)}\nLast seen in:\n└ *${target.room}*`
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND: .map
// ─────────────────────────────────────────────────────────────────────────────

async function cmdMap(ctx) {
  const { sock, jid, reply, msg } = ctx
  const caption =
    `🗺️ *THE SKELD*\n\n` +
    `📍 *Rooms:*\n${ROOMS.map(r => `• ${r}`).join('\n')}\n\n` +
    `🕳️ *Vent Network:*\n• Electrical ↔ MedBay ↔ Security\n• Weapons ↔ Navigation ↔ Shields\n• Reactor ↔ Upper Engine ↔ Lower Engine`

  if (fs.existsSync(SKELD_MAP_PATH)) {
    try {
      const image = fs.readFileSync(SKELD_MAP_PATH)
      await sock.sendMessage(jid, { image, caption }, { quoted: msg })
      return
    } catch {}
  }
  return reply(caption)
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE COMMANDS
// ─────────────────────────────────────────────────────────────────────────────

async function cmdCrewCard(ctx) {
  const { reply, sender, args } = ctx
  const withImage = args.includes('--image')
  const profile   = await getAuPlayer(sender)
  if (!profile) return reply(`⚠️ No profile yet. Play a game first.`)

  const mainUser = await db.getOrCreateUser(sender).catch(() => null)
  const name     = mainUser?.name || ctx.pushName || sender

  let mostVisited = 'None'
  let maxVisits   = 0
  for (const [room, count] of profile.most_visited.entries()) {
    if (count > maxVisits) { maxVisits = count; mostVisited = room }
  }

  const titleObj = SECRET_TITLES.find(t => t.id === profile.equipped_title)
  const title    = titleObj ? `『${titleObj.name}』` : 'None'
  const survRate = profile.games_played > 0 ? Math.round((profile.survival_count / profile.games_played) * 100) : 0

  const card =
    `🪪 *CREWCARD*\n\n` +
    `${name}\n\n` +
    `Level:\n└ ${profile.level}\n\n` +
    `Crewmate Wins:\n└ ${profile.crewmate_wins}\n\n` +
    `Impostor Wins:\n└ ${profile.impostor_wins}\n\n` +
    `Tasks Completed:\n└ ${profile.tasks_completed.toLocaleString()}\n\n` +
    `Kills:\n└ ${profile.kills}\n\n` +
    `Meetings Called:\n└ ${profile.meetings_called}\n\n` +
    `Survival Rate:\n└ ${survRate}%\n\n` +
    `Favorite Room:\n└ ${mostVisited}\n\n` +
    `Title:\n└ ${title}`

  return reply(card)
}

async function cmdLocker(ctx) {
  const { reply, sender } = ctx
  const profile = await getAuPlayer(sender)
  if (!profile) return reply(`⚠️ No profile yet. Play a game first.`)

  const fmt = (ids, list) => ids.length > 0
    ? ids.map(id => { const i = list.find(c => c.id === id); return `✔ ${i?.emoji || ''} ${i?.name || id}` }).join('\n')
    : '(none)'

  const equippedHat  = COSMETICS.hats.find(c => c.id === profile.equipped_hat)?.name   || 'None'
  const equippedSuit = COSMETICS.suits.find(c => c.id === profile.equipped_suit)?.name || 'Red'

  return reply(
    `🎒 *LOCKER*\n\n` +
    `🧢 *Hats*\n${fmt(profile.owned_hats, COSMETICS.hats)}\n\n` +
    `👕 *Suits*\n${fmt(profile.owned_suits, COSMETICS.suits)}\n\n` +
    `👁 *Visors*\n${fmt(profile.owned_visors, COSMETICS.visors)}\n\n` +
    `☠ *Kill Effects*\n${fmt(profile.owned_effects, COSMETICS.effects)}\n\n` +
    `🐾 *Pets*\n${fmt(profile.owned_pets, COSMETICS.pets)}\n\n` +
    `Equipped:\n└ 👑 Hat: ${equippedHat}\n└ 👕 Suit: ${equippedSuit}`
  )
}

async function cmdCosmeticsShop(ctx) {
  const { reply, sender } = ctx
  const profile = await getAuPlayer(sender)
  const balance = profile?.coins || 0

  const fmt = (list) => list.map(i => `${i.emoji} ${i.name} — ${i.price.toLocaleString()} coins [${i.rarity}]`).join('\n')

  return reply(
    `🛒 *COSMETICS SHOP*\n\n` +
    `🧢 *Hats*\n${fmt(COSMETICS.hats)}\n\n` +
    `👕 *Suits*\n${fmt(COSMETICS.suits.filter(s => s.price > 0))}\n\n` +
    `👁 *Visors*\n${fmt(COSMETICS.visors)}\n\n` +
    `☠ *Kill Effects*\n${fmt(COSMETICS.effects)}\n\n` +
    `🐾 *Pets*\n${fmt(COSMETICS.pets)}\n\n` +
    `🏷 *Nameplates*\n${fmt(COSMETICS.nameplates)}\n\n` +
    `Balance:\n└ ${balance.toLocaleString()} Coins\n\n` +
    `Use *.buyau <item name>*`
  )
}

async function cmdBuyAu(ctx) {
  const { reply, sender, args } = ctx
  if (!args.length) return reply(`⚠️ Usage: .buyau <item name>`)

  const itemName = args.join(' ')
  const item     = getAllCosmeticItems().find(i =>
    i.name.toLowerCase() === itemName.toLowerCase() || i.id === itemName.toLowerCase()
  )
  if (!item) return reply(`⚠️ Item "*${itemName}*" not found. Check *.cosmetics* for the full list.`)

  const profile = await getAuPlayer(sender)
  if (!profile) return reply(`⚠️ Profile not found.`)

  const allOwned = [...profile.owned_hats, ...profile.owned_suits, ...profile.owned_visors, ...profile.owned_effects, ...profile.owned_pets, ...profile.owned_nameplates]
  if (allOwned.includes(item.id)) return reply(`✅ You already own *${item.name}*.`)
  if (profile.coins < item.price) return reply(`⚠️ Not enough coins.\nNeed: ${item.price.toLocaleString()} | Have: ${profile.coins.toLocaleString()}`)

  profile.coins -= item.price

  if (COSMETICS.hats.find(i => i.id === item.id))       profile.owned_hats.push(item.id)
  else if (COSMETICS.suits.find(i => i.id === item.id)) profile.owned_suits.push(item.id)
  else if (COSMETICS.visors.find(i => i.id === item.id)) profile.owned_visors.push(item.id)
  else if (COSMETICS.effects.find(i => i.id === item.id)) profile.owned_effects.push(item.id)
  else if (COSMETICS.pets.find(i => i.id === item.id))  profile.owned_pets.push(item.id)
  else if (COSMETICS.nameplates.find(i => i.id === item.id)) profile.owned_nameplates.push(item.id)

  await profile.save()
  return reply(
    `✅ *Purchase Successful*\n\nItem:\n└ ${item.emoji} ${item.name}\n\nCost:\n└ ${item.price.toLocaleString()} Coins\n\nBalance:\n└ ${profile.coins.toLocaleString()} Coins`
  )
}

async function cmdEquipCosmetic(ctx) {
  const { reply, sender, args } = ctx
  if (!args.length) return reply(`⚠️ Usage: .equip <item name>`)

  const itemName = args.join(' ')
  const item     = getAllCosmeticItems().find(i =>
    i.name.toLowerCase() === itemName.toLowerCase() || i.id === itemName.toLowerCase()
  )
  if (!item) return null  // Fall through to RPG equip if not a cosmetic

  const profile = await getAuPlayer(sender)
  if (!profile) return reply(`⚠️ Profile not found.`)

  const allOwned = [...profile.owned_hats, ...profile.owned_suits, ...profile.owned_visors, ...profile.owned_effects, ...profile.owned_pets, ...profile.owned_nameplates]
  if (!allOwned.includes(item.id) && item.price > 0) return reply(`⚠️ You don't own *${item.name}*. Buy it with *.buyau ${item.name}*`)

  if (COSMETICS.hats.find(i => i.id === item.id))       profile.equipped_hat     = item.id
  else if (COSMETICS.suits.find(i => i.id === item.id)) profile.equipped_suit    = item.id
  else if (COSMETICS.visors.find(i => i.id === item.id)) profile.equipped_visor  = item.id
  else if (COSMETICS.effects.find(i => i.id === item.id)) profile.equipped_effect = item.id
  else if (COSMETICS.pets.find(i => i.id === item.id))  profile.equipped_pet     = item.id
  else if (COSMETICS.nameplates.find(i => i.id === item.id)) profile.equipped_nameplate = item.id

  await profile.save()
  return reply(`✨ *Equipped*\n\n${item.emoji} ${item.name}`)
}

async function cmdTitles(ctx) {
  const { reply, sender } = ctx
  const profile = await getAuPlayer(sender)
  if (!profile) return reply(`⚠️ No profile yet. Play a game first.`)

  const owned  = SECRET_TITLES.filter(t => profile.titles.includes(t.id))
  const locked = SECRET_TITLES.filter(t => !profile.titles.includes(t.id))

  const ownedStr  = owned.length  > 0 ? owned.map(t => `✔ ${t.name}`).join('\n')           : '(none)'
  const lockedStr = locked.length > 0 ? locked.map(t => `🔒 ${t.name}\n  ${t.desc}`).join('\n') : 'All unlocked!'

  return reply(`🎖️ *TITLES*\n\nUnlocked:\n${ownedStr}\n\nLocked:\n${lockedStr}`)
}

async function cmdAuStats(ctx) {
  const { reply, sender } = ctx
  const profile = await getAuPlayer(sender)
  if (!profile) return reply(`⚠️ No stats yet — play a game first.`)

  const wins       = profile.crewmate_wins + profile.impostor_wins
  const survRate   = profile.games_played > 0 ? Math.round((profile.survival_count / profile.games_played) * 100) : 0
  const killRate   = profile.games_played > 0 ? (profile.kills / profile.games_played).toFixed(1) : '0.0'

  return reply(
    `📈 *AMONG US STATS*\n\n` +
    `Games Played:\n└ ${profile.games_played}\n\n` +
    `Wins:\n└ ${wins}\n\n` +
    `Crewmate Wins:\n└ ${profile.crewmate_wins}\n\n` +
    `Impostor Wins:\n└ ${profile.impostor_wins}\n\n` +
    `Tasks Completed:\n└ ${profile.tasks_completed.toLocaleString()}\n\n` +
    `Kills:\n└ ${profile.kills} (${killRate} avg)\n\n` +
    `Survival Rate:\n└ ${survRate}%\n\n` +
    `Level:\n└ ${profile.level} (${profile.xp} XP)`
  )
}

async function cmdAuLeaderboard(ctx) {
  const { reply } = ctx
  try {
    const top = await AuPlayer.find({}).sort({ crewmate_wins: -1, impostor_wins: -1 }).limit(10)
    if (!top.length) return reply(`📊 No leaderboard data yet.`)

    const list = top.map((p, i) => {
      const medal  = ['🥇', '🥈', '🥉'][i] || `#${i + 1}`
      const wins   = p.crewmate_wins + p.impostor_wins
      const xpTotal = (p.crewmate_wins * 50) + (p.impostor_wins * 75) + (p.tasks_completed * 5)
      return `${medal} @${p.phone}\n└ ${wins} wins | ${xpTotal.toLocaleString()} XP`
    }).join('\n\n')

    return reply(`🏆 *AMONG US LEADERBOARD*\n\n${list}`)
  } catch { return reply(`⚠️ Leaderboard unavailable right now.`) }
}

async function cmdCrate(ctx) {
  const { reply, sender } = ctx
  const profile = await getAuPlayer(sender)
  if (!profile) return reply(`⚠️ Profile not found.`)
  if (profile.crates <= 0) return reply(`⚠️ No crates available.\n\nWin games to earn crates!`)

  profile.crates -= 1

  const reward = CRATE_REWARDS[Math.floor(Math.random() * CRATE_REWARDS.length)]
  const allOwned = [...profile.owned_hats, ...profile.owned_suits, ...profile.owned_visors, ...profile.owned_effects, ...profile.owned_pets]

  if (allOwned.includes(reward.id)) {
    profile.coins += 500
    await profile.save()
    return reply(`📦 *CRATE OPENED*\n\nDuplicate!\n\nReward:\n└ +500 Coins (duplicate item)`)
  }

  if (COSMETICS.hats.find(i => i.id === reward.id))       profile.owned_hats.push(reward.id)
  else if (COSMETICS.suits.find(i => i.id === reward.id)) profile.owned_suits.push(reward.id)
  else if (COSMETICS.visors.find(i => i.id === reward.id)) profile.owned_visors.push(reward.id)
  else if (COSMETICS.effects.find(i => i.id === reward.id)) profile.owned_effects.push(reward.id)
  else if (COSMETICS.pets.find(i => i.id === reward.id))  profile.owned_pets.push(reward.id)

  await profile.save()
  return reply(`📦 *CRATE OPENED*\n\nReward:\n└ ${reward.emoji} ${reward.name}\n\nRarity:\n└ ${reward.rarity}`)
}

async function cmdSpin(ctx) {
  const { reply, sender } = ctx
  const profile = await getAuPlayer(sender)
  if (!profile) return reply(`⚠️ Profile not found.`)

  const now    = Date.now()
  const cd     = 6 * 60 * 60 * 1000
  if (profile.spin_last && (now - new Date(profile.spin_last).getTime()) < cd) {
    const left = Math.ceil((cd - (now - new Date(profile.spin_last).getTime())) / 60000)
    return reply(`⏳ Spin available in: ${left} minutes.`)
  }

  const reward = SPIN_REWARDS[Math.floor(Math.random() * SPIN_REWARDS.length)]
  profile.spin_last = new Date()

  let rewardText = ''
  if (reward.type === 'coins')  { profile.coins  += reward.amount; rewardText = `${reward.amount.toLocaleString()} 🪙 Coins` }
  if (reward.type === 'xp')     { profile.xp     += reward.amount; rewardText = `${reward.amount} ⚡ XP` }
  if (reward.type === 'crate')  { profile.crates += 1;             rewardText = `📦 1 Crate` }

  await profile.save()
  return reply(`🎡 *SPIN RESULT*\n\nReward:\n└ ${rewardText}`)
}

async function cmdPet(ctx) {
  const { reply, sender } = ctx
  const profile = await getAuPlayer(sender)
  if (!profile?.equipped_pet) return reply(`⚠️ No pet equipped. Browse *.cosmetics*, buy with *.buyau <name>*, equip with *.equip <name>*`)

  const pet  = COSMETICS.pets.find(p => p.id === profile.equipped_pet)
  if (!pet) return reply(`⚠️ Pet not found.`)

  const bond = Math.min(10, Math.floor(profile.games_played / 5) + 1)
  return reply(`${pet.emoji} *PET*\n\nName:\n└ ${pet.name}\n\nBond Level:\n└ ${bond}/10`)
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // main router
  'amongus': cmdAmongUs,

  // expose state for index.js context checks
  activeGames,
  findPlayerGame,
  isCosmetic,

  // lobby
  'join':      cmdJoin,
  'joinau':    cmdJoin,
  'leave':     cmdLeave,
  'leaveau':   cmdLeave,
  'players':   cmdPlayers,
  'playersau': cmdPlayers,
  'startau':   cmdStart,

  // gameplay — canonical names from master rules
  'walk':      cmdGo,
  'go':        cmdGo,
  'move':      cmdGo,
  'room':      cmdRoom,
  'duties':    cmdTasks,
  'tasks':     cmdTasks,
  'complete':  cmdTask,
  'task':      cmdTask,

  // colors
  'colours':   cmdColours,
  'colors':    cmdColours,
  'colour':    cmdColours,
  'color':     async (ctx) => {
    const sub = (ctx.args[0] || '').toLowerCase()
    if (sub === 'switch') return cmdColorSwitch({ ...ctx, args: ctx.args.slice(1) })
    return cmdColours(ctx)
  },

  // impostor actions — canonical names from master rules (DM-only enforced inside)
  'eliminate': cmdKill,
  'kill':      cmdKill,
  'ventto':    cmdVentTo,
  'vent':      cmdVent,
  'sabo':      cmdSabotage,
  'sabotage':  cmdSabotage,
  'fix':       cmdFix,
  'repair':    cmdFix,

  // meetings
  'body':      cmdReport,
  'report':    cmdReport,
  'emergency': cmdMeeting,
  'meeting':   cmdMeeting,
  'vote':      cmdVote,
  'skip':      cmdSkip,

  // observe
  'observe':   cmdObserve,

  // special roles
  'vitals':    cmdVitals,
  'guard':     cmdGuard,
  'protect':   cmdProtect,
  'shift':     cmdShift,
  'track':     cmdTrack,

  // map
  'map':       cmdMap,
  'ausmap':    cmdMap,

  // profile
  'crewcard':  cmdCrewCard,
  'locker':    cmdLocker,
  'cosmetics': cmdCosmeticsShop,
  'buyau':     cmdBuyAu,
  'equip':     cmdEquipCosmetic,   // returns null if not a cosmetic → falls to rpg equip
  'titles':    cmdTitles,
  'austats':   cmdAuStats,
  'aulb':      cmdAuLeaderboard,
  'crate':     cmdCrate,
  'spin':      cmdSpin,
  'pet':       cmdPet,

  // expose model
  AuPlayer,
}
