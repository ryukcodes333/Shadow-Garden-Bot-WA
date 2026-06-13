const mongoose = require('mongoose')

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://konosubacommunity1:kono%2Esuba001@cluster-kono.41yglcv.mongodb.net/?appName=Cluster-kono'

let isConnected = false

async function connectDB() {
  if (isConnected) return
  try {
    await mongoose.connect(MONGO_URI)
    isConnected = true
    console.log('✅ MongoDB connected successfully')

    // Drop the legacy non-sparse jid_1 index that blocks inserts when jid is null
    try {
      const db = mongoose.connection.db
      const usersCol = db.collection('users')
      const indexes = await usersCol.indexes()
      const hasJidIndex = indexes.some(i => i.name === 'jid_1' && !i.sparse)
      if (hasJidIndex) {
        await usersCol.dropIndex('jid_1')
        console.log('🗑️  Dropped stale jid_1 index from users collection')
      }
    } catch (idxErr) {
      console.warn('⚠️  Could not clean jid index:', idxErr.message)
    }
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message)
    console.warn('⚠️  Server starting without database connection.')
  }
}
connectDB()

// ── Schemas ────────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema({
  phone:      { type: String, unique: true, sparse: true },
  name:       { type: String, default: 'Unknown' },
  password:   { type: String, default: null },
  wallet:     { type: Number, default: 0 },
  bank:       { type: Number, default: 500 },
  bank_limit: { type: Number, default: 50000 },
  gems:       { type: Number, default: 0 },
  xp:         { type: Number, default: 0 },
  rpg_xp:     { type: Number, default: 0 },
  rpg_wallet: { type: Number, default: 0 },
  level:      { type: Number, default: 1 },
  streak:     { type: Number, default: 0 },
  banned:     { type: Boolean, default: false },
  premium:    { type: Boolean, default: false },
  role:       { type: String, default: 'member' },
  title:      { type: String, default: 'Newcomer' },
  bio:        { type: String, default: '' },
  pokemon_badges: { type: Number, default: 0 },
  pokemon_wins:   { type: Number, default: 0 },
  pokemon_losses: { type: Number, default: 0 },
  created_at:     { type: Date, default: Date.now },
  reputation:     { type: Number, default: 0 },
  class_name:     { type: String, default: null },
  skill_xp:       { type: String, default: '{}' },
  profile_pp:     { type: String, default: null },
  profile_bg:     { type: String, default: null },
  profile_frame:  { type: Number, default: 1 },
  jid:            { type: String, unique: true, sparse: true },
}, { timestamps: true })

const groupSchema = new mongoose.Schema({
  group_id:        { type: String, unique: true },
  name:            { type: String, default: '' },
  antilink:        { type: Boolean, default: false },
  antilink_action: { type: String, default: 'warn' },
  antispam:        { type: Boolean, default: false },
  welcome:         { type: Boolean, default: false },
  leave:           { type: Boolean, default: false },
  muted:           { type: Boolean, default: false },
  pokemon_enabled:   { type: Boolean, default: false },
  antibot:           { type: Boolean, default: false },
  cardspawn_enabled: { type: Boolean, default: false },
  cardspawn_today:   { type: Number,  default: 0 },
  cardspawn_date:    { type: String,  default: '' },
  cardspawn_next:    { type: Date,    default: null },
}, { timestamps: true })

const warningSchema = new mongoose.Schema({
  user_phone: String,
  group_id:   String,
  reason:     String,
  by_phone:   String,
}, { timestamps: true })

const afkSchema = new mongoose.Schema({
  phone:    { type: String, unique: true },
  reason:   String,
  since:    { type: Date, default: Date.now },
  mentions: { type: Number, default: 0 },
})

const messageSchema = new mongoose.Schema({
  user_phone: String,
  group_id:   String,
  created_at: { type: Date, default: Date.now },
})

const cooldownSchema = new mongoose.Schema({
  phone:      String,
  command:    String,
  expires_at: Date,
})
cooldownSchema.index({ phone: 1, command: 1 }, { unique: true })

const inventorySchema = new mongoose.Schema({
  phone:    String,
  item:     String,
  quantity: { type: Number, default: 1 },
})
inventorySchema.index({ phone: 1, item: 1 }, { unique: true })

const cardSchema = new mongoose.Schema({
  name:        String,
  tier:        String,
  series:      String,
  price:       { type: Number, default: 35000 },
  image_url:   String,
  rarity:      String,
  uploaded_by: String,
  external_id: { type: String, sparse: true },
}, { timestamps: true })

const userCardSchema = new mongoose.Schema({
  phone:   String,
  card_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Card' },
  in_deck: { type: Boolean, default: false },
}, { timestamps: true })

const userPokemonSchema = new mongoose.Schema({
  phone:      String,
  name:       String,
  pokemon_id: Number,
  level:      { type: Number, default: 1 },
  xp:         { type: Number, default: 0 },
  hp:         Number,
  max_hp:     Number,
  base_xp:    Number,
  in_party:   { type: Boolean, default: true },
  is_shiny:   { type: Boolean, default: false },
  types:      { type: [String], default: [] },
  moves:      { type: [String], default: [] },
  abilities:  { type: [String], default: [] },
  ball:       { type: String, default: 'pokeball' },
  slot:       { type: Number, default: 1 },
  height:     Number,
  weight:     Number,
  location:   String,
}, { timestamps: true })

const gameSchema = new mongoose.Schema({
  group_id:  String,
  game_type: String,
  players:   mongoose.Schema.Types.Mixed,
  state:     mongoose.Schema.Types.Mixed,
  active:    { type: Boolean, default: true },
}, { timestamps: true })

const summerTokenSchema = new mongoose.Schema({
  phone:        { type: String, unique: true },
  tokens:       { type: Number, default: 0 },
  last_claimed: Date,
})

const guildSchema = new mongoose.Schema({
  name:         { type: String, unique: true },
  leader_phone: String,
  member_count: { type: Number, default: 1 },
  xp:           { type: Number, default: 0 },
}, { timestamps: true })

const guildMemberSchema = new mongoose.Schema({
  guild_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Guild' },
  phone:     String,
  is_leader: { type: Boolean, default: false },
})

const loanSchema = new mongoose.Schema({
  phone:       { type: String, unique: true },
  amount:      { type: Number, default: 0 },
  interest:    { type: Number, default: 0 },
  total_due:   { type: Number, default: 0 },
  tier:        { type: String, default: 'Bronze' },
  issued_at:   { type: Date, default: Date.now },
  due_date:    { type: Date },
}, { timestamps: true })

const blacklistSchema = new mongoose.Schema({
  group_id: String,
  word:     String,
})
blacklistSchema.index({ group_id: 1, word: 1 }, { unique: true })

const disabledCommandSchema = new mongoose.Schema({
  command: { type: String, unique: true },
  reason:  String,
})

// Singleton document that stores the bot's trained AI persona (name + facts).
// Staff can update these via .aitrain. Groq uses them as a dynamic system prompt.
const aiBotPersonaSchema = new mongoose.Schema({
  singleton: { type: String, default: 'main', unique: true },
  name:      { type: String, default: '' },
  facts:     { type: [String], default: [] },
}, { timestamps: true })

// ── Models ─────────────────────────────────────────────────────────────────

const User           = mongoose.model('User',           userSchema)
const Group          = mongoose.model('Group',          groupSchema)
const AiBotPersona   = mongoose.model('AiBotPersona',   aiBotPersonaSchema)
const Warning        = mongoose.model('Warning',        warningSchema)
const AFK            = mongoose.model('AFK',            afkSchema)
const Message        = mongoose.model('Message',        messageSchema)
const Cooldown       = mongoose.model('Cooldown',       cooldownSchema)
const Inventory      = mongoose.model('Inventory',      inventorySchema)
const Card           = mongoose.model('Card',           cardSchema)
const UserCard       = mongoose.model('UserCard',       userCardSchema)
const UserPokemon    = mongoose.model('UserPokemon',    userPokemonSchema)
const Game           = mongoose.model('Game',           gameSchema)
const SummerToken    = mongoose.model('SummerToken',    summerTokenSchema)
const Guild          = mongoose.model('Guild',          guildSchema)
const GuildMember    = mongoose.model('GuildMember',    guildMemberSchema)
const Loan           = mongoose.model('Loan',           loanSchema)
const Blacklist      = mongoose.model('Blacklist',      blacklistSchema)
const DisabledCommand= mongoose.model('DisabledCommand',disabledCommandSchema)

// ── Helpers ────────────────────────────────────────────────────────────────

function cleanPhone(phone) {
  if (!phone) return ''
  return String(phone).split('@')[0].split(':')[0]
}

// ── User functions ─────────────────────────────────────────────────────────

async function getUser(phone) {
  phone = cleanPhone(phone)
  return User.findOne({ phone }).lean()
}

async function createUser(phone, name) {
  phone = cleanPhone(phone)
  try {
    const u = await User.create({ phone, name: name || phone, wallet: 0, bank: 500, gems: 0, xp: 0, level: 1 })
    return u.toObject()
  } catch (err) {
    if (err.code === 11000) return getUser(phone)
    console.error('createUser error:', err.message)
    return null
  }
}

async function getOrCreateUser(phone, name, jid) {
  // ── JID-first lookup (post-WA↔web link) ──────────────────────────────────
  // After a user links their WhatsApp to their web account via .link, the master
  // record stores the web phone. The bot's sender phone (from the JID) may differ.
  // Look up by JID first so the bot always reads/writes the canonical master record.
  if (jid) {
    try {
      const cleanedJid = String(jid).includes('@') ? jid : `${jid}@s.whatsapp.net`
      const byJid = await User.findOne({ jid: cleanedJid }).lean()
      if (byJid) {
        console.log(`[getOrCreateUser] found by JID: phone=${byJid.phone} jid=${cleanedJid}`)
        return byJid
      }
    } catch {}
  }
  // ── Phone-based lookup / create ───────────────────────────────────────────
  phone = cleanPhone(phone)
  try {
    let user = await getUser(phone)
    if (!user) user = await createUser(phone, name)
    if (!user) return { phone, name: name || phone, wallet: 0, bank: 500, gems: 0, xp: 0, level: 1, streak: 0, role: 'member', banned: false }
    return user
  } catch (err) {
    console.error('getOrCreateUser error:', err.message)
    return { phone, name: name || phone, wallet: 0, bank: 500, gems: 0, xp: 0, level: 1, streak: 0, role: 'member', banned: false }
  }
}

async function updateUser(phone, updates) {
  phone = cleanPhone(phone)
  const u = await User.findOneAndUpdate({ phone }, { $set: updates }, { new: true, upsert: false }).lean()
  return u
}

// ── Group functions ────────────────────────────────────────────────────────

async function getGroup(groupId) {
  return Group.findOne({ group_id: groupId }).lean()
}

async function getOrCreateGroup(groupId, name) {
  let g = await getGroup(groupId)
  if (!g) {
    try {
      const doc = await Group.create({ group_id: groupId, name: name || groupId })
      g = doc.toObject()
    } catch {
      g = await getGroup(groupId)
    }
  }
  return g
}

async function updateGroup(groupId, updates) {
  const g = await Group.findOneAndUpdate({ group_id: groupId }, { $set: updates }, { new: true, upsert: false }).lean()
  return g
}

// ── Warning functions ──────────────────────────────────────────────────────

async function addWarning(phone, groupId, reason, byPhone) {
  phone = cleanPhone(phone); byPhone = cleanPhone(byPhone)
  const w = await Warning.create({ user_phone: phone, group_id: groupId, reason, by_phone: byPhone })
  return w.toObject()
}

async function getWarnings(phone, groupId) {
  phone = cleanPhone(phone)
  return Warning.find({ user_phone: phone, group_id: groupId }).lean()
}

async function resetWarnings(phone, groupId) {
  phone = cleanPhone(phone)
  await Warning.deleteMany({ user_phone: phone, group_id: groupId })
}

// ── AFK functions ──────────────────────────────────────────────────────────

async function setAFK(phone, reason) {
  phone = cleanPhone(phone)
  await AFK.findOneAndUpdate({ phone }, { reason, since: new Date(), mentions: 0 }, { upsert: true })
}

async function getAFK(phone) {
  phone = cleanPhone(phone)
  return AFK.findOne({ phone }).lean()
}

async function removeAFK(phone) {
  phone = cleanPhone(phone)
  await AFK.deleteOne({ phone })
}

async function incrementAFKMentions(phone) {
  phone = cleanPhone(phone)
  await AFK.findOneAndUpdate({ phone }, { $inc: { mentions: 1 } })
}

// ── Message logging ────────────────────────────────────────────────────────

async function logMessage(phone, groupId) {
  phone = cleanPhone(phone)
  await Message.create({ user_phone: phone, group_id: groupId })
}

async function getMessageCount(groupId, hours = 24) {
  const since = new Date(Date.now() - hours * 3600000)
  return Message.countDocuments({ group_id: groupId, created_at: { $gte: since } })
}

async function getActiveUsers(groupId, hours = 24) {
  const since = new Date(Date.now() - hours * 3600000)
  const docs  = await Message.find({ group_id: groupId, created_at: { $gte: since } }, 'user_phone').lean()
  return [...new Set(docs.map(d => d.user_phone))]
}

async function getTopUser(groupId, hours = 24) {
  const since = new Date(Date.now() - hours * 3600000)
  const docs  = await Message.find({ group_id: groupId, created_at: { $gte: since } }, 'user_phone').lean()
  if (!docs.length) return null
  const counts = {}
  for (const m of docs) counts[m.user_phone] = (counts[m.user_phone] || 0) + 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
}

// ── Cooldown functions ─────────────────────────────────────────────────────

async function setCooldown(phone, command, seconds) {
  phone = cleanPhone(phone)
  const expires = new Date(Date.now() + seconds * 1000)
  await Cooldown.findOneAndUpdate({ phone, command }, { expires_at: expires }, { upsert: true })
}

async function getCooldown(phone, command) {
  phone = cleanPhone(phone)
  const doc = await Cooldown.findOne({ phone, command }).lean()
  if (!doc) return 0
  const remaining = new Date(doc.expires_at).getTime() - Date.now()
  return remaining > 0 ? remaining : 0
}

// ── Inventory functions ────────────────────────────────────────────────────

async function getInventory(phone) {
  phone = cleanPhone(phone)
  return Inventory.find({ phone }).lean()
}

async function addItem(phone, item, qty = 1) {
  phone = cleanPhone(phone)
  await Inventory.findOneAndUpdate(
    { phone, item },
    { $inc: { quantity: qty } },
    { upsert: true }
  )
}

async function removeItem(phone, item, qty = 1) {
  phone = cleanPhone(phone)
  const doc = await Inventory.findOne({ phone, item }).lean()
  if (!doc) return false
  if (doc.quantity <= qty) {
    await Inventory.deleteOne({ phone, item })
  } else {
    await Inventory.findOneAndUpdate({ phone, item }, { $inc: { quantity: -qty } })
  }
  return true
}

// ── Leaderboard ────────────────────────────────────────────────────────────

async function getLeaderboard(limit = 10) {
  return User.find({}).sort({ xp: -1, level: -1 }).limit(limit).lean()
}

async function getRichList(limit = 10) {
  return User.find({}).sort({ bank: -1, wallet: -1 }).limit(limit).lean()
}

async function getUserCount() {
  return User.countDocuments()
}

async function getGroupCount() {
  return Group.countDocuments()
}

// ── Card functions ─────────────────────────────────────────────────────────

async function addCard(name, tier, series, price, imageUrl, rarity, uploadedBy) {
  const c = await Card.create({ name, tier, series, price, image_url: imageUrl, rarity, uploaded_by: uploadedBy })
  return c.toObject()
}

async function getCards(filters = {}) {
  const query = {}
  if (filters.tier)   query.tier   = filters.tier
  if (filters.series) query.series = new RegExp(filters.series, 'i')
  if (filters.name)   query.name   = new RegExp(filters.name, 'i')
  return Card.find(query).limit(50).lean()
}

async function getCard(id) {
  return Card.findById(id).lean()
}

async function getUserCards(phone) {
  phone = cleanPhone(phone)
  return UserCard.find({ phone }).populate('card_id').sort({ in_deck: -1, createdAt: 1 }).lean()
}

async function getUserCardCount(phone) {
  phone = cleanPhone(phone)
  return UserCard.countDocuments({ phone })
}

async function assignCard(phone, cardId) {
  phone = cleanPhone(phone)
  const uc = await UserCard.create({ phone, card_id: cardId })
  return uc.toObject()
}

async function addUserCard(phone, cardId) {
  return assignCard(phone, cardId)
}

async function deleteUserCardById(rowId) {
  await UserCard.deleteOne({ _id: rowId })
}

async function updateUserCardById(rowId, fields) {
  await UserCard.updateOne({ _id: rowId }, { $set: fields })
}

async function getCardOwners(externalId) {
  if (!externalId) return []
  // external_id on Card stores the full image URL; find Card first, then find its UserCards
  const card = await Card.findOne({ external_id: externalId }).lean()
  if (!card) return []
  return UserCard.find({ card_id: card._id }).lean()
}

const RARITY_BY_TIER = {
  T1: 'Common', T2: 'Uncommon', T3: 'Rare', T4: 'Epic',
  T5: 'Legendary', T6: 'Mythic', TS: 'Shadow', TZ: 'Void',
}

async function getOrCreateShoobCard(shoobId, name, tier, series, imageUrl, price) {
  if (shoobId) {
    const existing = await Card.findOne({ external_id: shoobId }).lean()
    if (existing) return existing
  }
  if (imageUrl) {
    const byUrl = await Card.findOne({ image_url: imageUrl }).lean()
    if (byUrl) return byUrl
  }
  const base = {
    name: name || 'Unknown',
    tier: tier || 'T1',
    series: series || 'Unknown Series',
    price: price || 17500,
    image_url: imageUrl || null,
    rarity: RARITY_BY_TIER[tier] || 'Common',
    uploaded_by: 'system',
    external_id: shoobId || undefined,
  }
  try {
    const c = await Card.create(base)
    return c.toObject()
  } catch (err) {
    console.error('getOrCreateShoobCard error:', err.message)
    return null
  }
}

// ── Pokémon functions ──────────────────────────────────────────────────────

async function getUserPokemon(phone) {
  phone = cleanPhone(phone)
  return UserPokemon.find({ phone }).sort({ in_party: -1, slot: 1 }).lean()
}

async function addPokemon(phone, pokemonData) {
  phone = cleanPhone(phone)
  const p = await UserPokemon.create({ phone, ...pokemonData })
  return p.toObject()
}

async function updatePokemon(id, updates) {
  const p = await UserPokemon.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean()
  return p
}

// ── Card-spawn group functions ──────────────────────────────────────────────

// Toggle auto card-spawn for a group. Resets the schedule when enabling.
async function setGroupCardSpawn(groupId, enabled) {
  await getOrCreateGroup(groupId)
  const update = { cardspawn_enabled: enabled }
  if (enabled) {
    // Schedule first spawn 30–120 min from now
    const delay = (30 + Math.floor(Math.random() * 90)) * 60 * 1000
    update.cardspawn_next = new Date(Date.now() + delay)
    update.cardspawn_today = 0
    update.cardspawn_date  = new Date().toISOString().slice(0, 10)
  }
  return Group.findOneAndUpdate({ group_id: groupId }, { $set: update }, { new: true }).lean()
}

// Called each time a group message arrives. Returns true if a spawn should fire NOW.
// Automatically resets daily count at midnight and schedules the next spawn window.
async function tickCardSpawn(groupId) {
  const g = await Group.findOne({ group_id: groupId }).lean()
  if (!g || !g.cardspawn_enabled) return false

  const today = new Date().toISOString().slice(0, 10)
  let todayCount = g.cardspawn_date === today ? (g.cardspawn_today || 0) : 0

  // Hit the daily cap — leave enabled but don't spawn again until tomorrow
  if (todayCount >= 7) return false

  const nextSpawn = g.cardspawn_next ? new Date(g.cardspawn_next) : null
  if (!nextSpawn || Date.now() < nextSpawn.getTime()) return false

  // It's time to spawn — increment count and schedule the next window (30min–5h)
  const delay = (30 + Math.floor(Math.random() * 270)) * 60 * 1000
  await Group.findOneAndUpdate(
    { group_id: groupId },
    { $set: {
      cardspawn_today: todayCount + 1,
      cardspawn_date:  today,
      cardspawn_next:  new Date(Date.now() + delay),
    } }
  )
  return true
}

// ── AI persona functions ────────────────────────────────────────────────────

// Returns the singleton AI persona document (creates it if missing).
async function getAiPersona() {
  let p = await AiBotPersona.findOne({ singleton: 'main' }).lean()
  if (!p) {
    try { p = (await AiBotPersona.create({ singleton: 'main' })).toObject() } catch { p = await AiBotPersona.findOne({ singleton: 'main' }).lean() }
  }
  return p
}

async function setAiPersonaName(name) {
  return AiBotPersona.findOneAndUpdate(
    { singleton: 'main' },
    { $set: { name: name.trim() } },
    { new: true, upsert: true }
  ).lean()
}

async function addAiPersonaFact(fact) {
  return AiBotPersona.findOneAndUpdate(
    { singleton: 'main' },
    { $addToSet: { facts: fact.trim() } },
    { new: true, upsert: true }
  ).lean()
}

async function removeAiPersonaFact(index) {
  const p = await AiBotPersona.findOne({ singleton: 'main' }).lean()
  if (!p || !p.facts?.length) return null
  const facts = [...p.facts]
  facts.splice(index, 1)
  return AiBotPersona.findOneAndUpdate(
    { singleton: 'main' },
    { $set: { facts } },
    { new: true }
  ).lean()
}

async function clearAiPersonaFacts() {
  return AiBotPersona.findOneAndUpdate(
    { singleton: 'main' },
    { $set: { facts: [] } },
    { new: true, upsert: true }
  ).lean()
}

// Returns up to `limit` distinct trainers who own a Pokémon species by its PokeAPI id.
// Joins with the User collection to resolve display names.
async function getPokemonOwnersBySpeciesId(pokemonId, limit = 5) {
  if (!pokemonId) return []
  // Get distinct phones that own this species
  const docs = await UserPokemon.find({ pokemon_id: Number(pokemonId) }, 'phone').lean()
  const phones = [...new Set(docs.map(d => cleanPhone(d.phone)))].slice(0, limit)
  if (!phones.length) return []
  // Batch-fetch user names
  const users = await User.find({ phone: { $in: phones } }, 'phone name').lean()
  const nameMap = {}
  for (const u of users) nameMap[u.phone] = u.name || u.phone
  return phones.map(p => ({ phone: p, name: nameMap[p] || p }))
}

// ── Game functions ─────────────────────────────────────────────────────────

async function getGame(groupId, gameType) {
  return Game.findOne({ group_id: groupId, game_type: gameType, active: true }).lean()
}

async function createGame(groupId, gameType, players, state) {
  const g = await Game.create({ group_id: groupId, game_type: gameType, players, state })
  return g.toObject()
}

async function updateGame(id, updates) {
  const g = await Game.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean()
  return g
}

async function endGame(id) {
  await Game.findByIdAndUpdate(id, { $set: { active: false } })
}

// ── Summer token functions ─────────────────────────────────────────────────

async function getSummerTokens(phone) {
  phone = cleanPhone(phone)
  return SummerToken.findOne({ phone }).lean()
}

async function setSummerTokens(phone, tokens) {
  phone = cleanPhone(phone)
  await SummerToken.findOneAndUpdate(
    { phone },
    { tokens, last_claimed: new Date() },
    { upsert: true }
  )
}

async function getSummerLeaderboard(limit = 10) {
  return SummerToken.find({}).sort({ tokens: -1 }).limit(limit).lean()
}

// ── Guild functions ────────────────────────────────────────────────────────

async function getGuild(name) {
  return Guild.findOne({ name: new RegExp(`^${name}$`, 'i') }).lean()
}
const getGuildByName = getGuild

async function getGuildByMember(phone) {
  phone = cleanPhone(phone)
  const member = await GuildMember.findOne({ phone }).lean()
  if (!member) return null
  const guild = await Guild.findById(member.guild_id).lean()
  if (!guild) return null
  const liveCount = await GuildMember.countDocuments({ guild_id: member.guild_id })
  return { ...guild, member_count: liveCount, guild_id: member.guild_id, is_leader: member.is_leader }
}
const getUserGuild = getGuildByMember

async function createGuild(name, ownerPhone) {
  ownerPhone = cleanPhone(ownerPhone)
  const existing = await getGuild(name)
  if (existing) return null
  const guild = await Guild.create({ name, leader_phone: ownerPhone, member_count: 1 })
  await GuildMember.create({ guild_id: guild._id, phone: ownerPhone, is_leader: true })
  return guild.toObject()
}

async function joinGuild(phone, guildId) {
  phone = cleanPhone(phone)
  try {
    await GuildMember.create({ guild_id: guildId, phone, is_leader: false })
    await Guild.findByIdAndUpdate(guildId, { $inc: { member_count: 1 } })
    return true
  } catch { return false }
}

async function leaveGuild(phone, guildId) {
  phone = cleanPhone(phone)
  await GuildMember.deleteOne({ phone, guild_id: guildId })
  await Guild.findByIdAndUpdate(guildId, { $inc: { member_count: -1 } })
}

async function updateGuild(id, updates) {
  return Guild.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean()
}

async function deleteGuild(id) {
  await GuildMember.deleteMany({ guild_id: id })
  await Guild.findByIdAndDelete(id)
}
const disbandGuild = deleteGuild

async function getAllGuilds() {
  return Guild.find({}).sort({ createdAt: -1 }).lean()
}
const listGuilds = getAllGuilds

// ── Blacklist functions ────────────────────────────────────────────────────

async function getBlacklist(groupId) {
  const docs = await Blacklist.find({ group_id: groupId }).lean()
  return docs.map(d => d.word)
}

async function addBlacklist(groupId, word) {
  await Blacklist.findOneAndUpdate({ group_id: groupId, word }, {}, { upsert: true })
}

async function removeBlacklist(groupId, word) {
  await Blacklist.deleteOne({ group_id: groupId, word })
}

// ── Staff / moderation ─────────────────────────────────────────────────────

async function getMods() {
  return User.find({ role: { $in: ['mod', 'guardian', 'recruit', 'owner'] } }, 'phone name role').lean()
}

async function getBannedUsers() {
  return User.find({ banned: true }, 'phone name').lean()
}

// ── Disabled commands ──────────────────────────────────────────────────────

async function getDisabledCommands() {
  return DisabledCommand.find({}).lean()
}

async function disableCommand(cmd, reason) {
  await DisabledCommand.findOneAndUpdate({ command: cmd }, { reason }, { upsert: true })
}

async function enableCommand(cmd) {
  await DisabledCommand.deleteOne({ command: cmd })
}

// ── Suspension (stub - uses MongoDB) ──────────────────────────────────────
// Kept for backward compat with index.js suspension check
const suspensionSchema = new mongoose.Schema({
  phone:           { type: String, unique: true },
  reason:          String,
  suspended_until: Date,
  suspended_by:    String,
}, { timestamps: true })
const Suspension = mongoose.model('Suspension', suspensionSchema)

async function getSuspension(phone) {
  phone = cleanPhone(phone)
  const doc = await Suspension.findOne({ phone }).lean()
  if (!doc) return null
  if (new Date(doc.suspended_until) < new Date()) {
    await Suspension.deleteOne({ phone })
    return null
  }
  return doc
}

async function addSuspension(phone, reason, hoursOrDate, by) {
  phone = cleanPhone(phone)
  const until = hoursOrDate instanceof Date ? hoursOrDate : new Date(Date.now() + hoursOrDate * 3600000)
  await Suspension.findOneAndUpdate({ phone }, { reason, suspended_until: until, suspended_by: by }, { upsert: true })
}

async function removeSuspension(phone) {
  phone = cleanPhone(phone)
  await Suspension.deleteOne({ phone })
}

async function getSuspensions() {
  return Suspension.find({}).lean()
}

// ── Monkey-patch: provide a `supabase`-compatible shim for any old references
// This avoids crashes in code that still calls db.supabase.from(...)
const supabase = {
  from: () => ({
    select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }), data: null, error: null }) }),
    insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
    update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }) }),
    delete: () => ({ eq: () => ({}) }),
    upsert: () => ({ onConflict: () => ({}) }),
  }),
}

// ── Batch owner count lookup ───────────────────────────────────────────────
async function getOwnerCountsBatch(externalIds) {
  if (!externalIds || !externalIds.length) return {}
  try {
    const cards = await Card.find({ external_id: { $in: externalIds } }).lean()
    if (!cards.length) return {}
    const cardIdMap = {}
    const idToExternal = {}
    for (const c of cards) {
      cardIdMap[c.external_id]       = c._id
      idToExternal[String(c._id)]   = c.external_id
    }
    const counts = await UserCard.aggregate([
      { $match: { card_id: { $in: cards.map(c => c._id) } } },
      { $group: { _id: '$card_id', count: { $sum: 1 } } },
    ])
    const result = {}
    for (const { _id, count } of counts) {
      const extId = idToExternal[String(_id)]
      if (extId) result[extId] = count
    }
    return result
  } catch (err) {
    console.error('getOwnerCountsBatch error:', err.message)
    return {}
  }
}

// ── Get card by external_id ────────────────────────────────────────────────
async function getCardByExternalId(externalId) {
  try {
    return Card.findOne({ external_id: externalId }).lean()
  } catch { return null }
}

// ── Loan functions ─────────────────────────────────────────────────────────

const LOAN_TIERS = {
  Bronze: { max: 5000,   interest: 0.10 },
  Silver: { max: 15000,  interest: 0.08 },
  Gold:   { max: 50000,  interest: 0.06 },
  Shadow: { max: 150000, interest: 0.04 },
}

function getLoanTierForLevel(level) {
  if (level >= 50) return 'Shadow'
  if (level >= 25) return 'Gold'
  if (level >= 10) return 'Silver'
  return 'Bronze'
}

async function getLoan(phone) {
  phone = cleanPhone(phone)
  return Loan.findOne({ phone }).lean()
}

async function createLoan(phone, amount, tier) {
  phone = cleanPhone(phone)
  const tierData = LOAN_TIERS[tier] || LOAN_TIERS.Bronze
  const interest  = tierData.interest
  const total_due = Math.ceil(amount * (1 + interest))
  const due_date  = new Date(Date.now() + 7 * 24 * 3600000)
  const doc = await Loan.findOneAndUpdate(
    { phone },
    { amount, interest, total_due, tier, issued_at: new Date(), due_date },
    { upsert: true, new: true }
  )
  return doc.toObject()
}

async function repayLoan(phone, amount) {
  phone = cleanPhone(phone)
  const loan = await Loan.findOne({ phone }).lean()
  if (!loan) return null
  const remaining = loan.total_due - amount
  if (remaining <= 0) {
    await Loan.deleteOne({ phone })
    return { paid: true, overpay: Math.abs(remaining) }
  }
  await Loan.findOneAndUpdate({ phone }, { total_due: remaining })
  return { paid: false, remaining }
}

async function deleteLoan(phone) {
  phone = cleanPhone(phone)
  await Loan.deleteOne({ phone })
}

// ── Per-user mute within a group (stored in group doc) ────────────────────
async function addMutedUser(groupId, phone) {
  await Group.findOneAndUpdate(
    { group_id: groupId },
    { $addToSet: { muted_users: cleanPhone(phone) } },
    { upsert: true }
  )
}

async function removeMutedUser(groupId, phone) {
  await Group.findOneAndUpdate(
    { group_id: groupId },
    { $pull: { muted_users: cleanPhone(phone) } }
  )
}

async function deleteAllUsers() {
  const result = await User.deleteMany({})
  return result.deletedCount
}

// ── Per-group disabled commands ────────────────────────────────────────────
async function getGroupDisabledCmds(groupJid) {
  const g = await Group.findOne({ group_id: groupJid }).lean()
  return g?.disabled_cmds || []
}

async function setGroupDisabledCmds(groupJid, cmds) {
  await Group.findOneAndUpdate(
    { group_id: groupJid },
    { disabled_cmds: cmds },
    { upsert: true }
  )
}

// ── Get all staff members ──────────────────────────────────────────────────
async function getAllStaff() {
  return User.find({ role: { $nin: ['member', null, ''] } }).lean()
}

// ── WA ↔ Web linking ──────────────────────────────────────────────────────

const waLinkOtpSchema = new mongoose.Schema({
  jid:       { type: String, required: true, unique: true },
  phone:     { type: String, required: true },
  otp:       { type: String, required: true },
  expiresAt: { type: Date, required: true },
})
waLinkOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
const WaLinkOtp = mongoose.model('WaLinkOtp', waLinkOtpSchema)

async function requestWaLink(senderJid, phone) {
  const cleanedPhone = cleanPhone(phone)
  if (!cleanedPhone || cleanedPhone.length < 7) throw new Error('Invalid phone number. Include country code, no + or spaces.')
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
  await WaLinkOtp.findOneAndUpdate(
    { jid: senderJid },
    { phone: cleanedPhone, otp, expiresAt },
    { upsert: true, new: true }
  )
  return otp
}

async function verifyAndLinkJid(senderJid, otp) {
  console.log('[verifyAndLinkJid] ── START ─────────────────────')
  console.log('[verifyAndLinkJid] senderJid:', senderJid, '| otp:', otp)
  console.log('[verifyAndLinkJid] Querying WaLinkOtp WHERE jid =', senderJid)

  const record = await WaLinkOtp.findOne({ jid: senderJid }).lean()
  console.log('[verifyAndLinkJid] OTP record found:', record ? JSON.stringify(record) : 'NULL — no pending request')

  if (!record) throw new Error('No pending link request. Use .reg <phone> first.')
  if (new Date() > record.expiresAt) throw new Error('OTP expired. Use .reg <phone> again.')
  if (record.otp !== String(otp).trim()) {
    console.log('[verifyAndLinkJid] OTP MISMATCH: expected', record.otp, 'got', String(otp).trim())
    throw new Error('Incorrect OTP. Try again.')
  }

  const phone = record.phone
  await WaLinkOtp.deleteOne({ jid: senderJid })
  console.log('[verifyAndLinkJid] OTP verified. Target phone:', phone)

  // Find master record (by phone = web-registered user)
  let master = await User.findOne({ phone }).lean()
  console.log('[verifyAndLinkJid] Querying User WHERE phone =', phone)
  console.log('[verifyAndLinkJid] master record:', master ? `_id=${master._id} name=${master.name}` : 'NULL')

  // Find duplicate (bot-created record for this WA number, different phone stored)
  const senderPhone = cleanPhone(senderJid)
  let duplicate = null
  if (senderPhone && senderPhone !== phone) {
    duplicate = await User.findOne({ phone: senderPhone }).lean()
    console.log('[verifyAndLinkJid] Querying duplicate WHERE phone =', senderPhone, '→', duplicate ? `_id=${duplicate._id}` : 'NULL')
  } else {
    console.log('[verifyAndLinkJid] senderPhone === target phone, no duplicate lookup needed')
  }

  if (!master) {
    const created = await User.create({ phone, jid: senderJid, name: duplicate?.name || phone })
    master = created.toObject()
    console.log('[verifyAndLinkJid] Created new master row _id:', master._id)
  } else {
    await User.updateOne({ phone }, { $set: { jid: senderJid } })
    console.log('[verifyAndLinkJid] Linked jid to existing master _id:', master._id)
  }

  // Merge duplicate bot record into master + migrate all linked collections
  if (duplicate && String(duplicate._id) !== String(master._id)) {
    const merge = {}
    // Take the higher stat from each account (bot is where most activity happens)
    if ((duplicate.xp || 0) > (master.xp || 0))         merge.xp      = duplicate.xp
    if ((duplicate.level || 1) > (master.level || 1))   merge.level   = duplicate.level
    if ((duplicate.wallet || 0) > (master.wallet || 0)) merge.wallet  = duplicate.wallet
    if ((duplicate.bank || 0) > (master.bank || 0))     merge.bank    = duplicate.bank
    if ((duplicate.gems || 0) > (master.gems || 0))     merge.gems    = duplicate.gems
    if ((duplicate.streak || 0) > (master.streak || 0)) merge.streak  = duplicate.streak
    if ((duplicate.pokemon_wins || 0) > (master.pokemon_wins || 0)) merge.pokemon_wins = duplicate.pokemon_wins
    if ((duplicate.pokemon_losses || 0) > (master.pokemon_losses || 0)) merge.pokemon_losses = duplicate.pokemon_losses
    if (duplicate.name && duplicate.name !== duplicate.phone && (!master.name || master.name === master.phone)) {
      merge.name = duplicate.name
    }
    console.log('[verifyAndLinkJid] Merging duplicate _id:', duplicate._id, '→ merge fields:', JSON.stringify(merge))
    if (Object.keys(merge).length) await User.updateOne({ phone }, { $set: merge })

    // ── Migrate all phone-keyed data from duplicate → master ─────────────
    const dupPhone = duplicate.phone
    const [ucRes, upRes, invRes] = await Promise.all([
      UserCard.updateMany({ phone: dupPhone }, { $set: { phone } }),
      UserPokemon.updateMany({ phone: dupPhone }, { $set: { phone } }),
      Inventory.updateMany({ phone: dupPhone }, { $set: { phone } }),
    ])
    console.log(`[verifyAndLinkJid] Migrated: UserCards=${ucRes.modifiedCount} Pokemon=${upRes.modifiedCount} Inventory=${invRes.modifiedCount}`)

    await User.deleteOne({ _id: duplicate._id })
    console.log('[verifyAndLinkJid] Duplicate row DELETED ✓')
  } else {
    console.log('[verifyAndLinkJid] No duplicate to merge (same phone — just JID linked).')
  }

  const final = await User.findOne({ phone }).lean()
  console.log('[verifyAndLinkJid] ── FINAL ROW ─────────────────')
  console.log('[verifyAndLinkJid] phone:', final?.phone, '| jid:', final?.jid)
  console.log('[verifyAndLinkJid] ─────────────────────────────────')
  return final
}

// ── Economy Inflation Tracking ────────────────────────────────────────────────
// Lightweight daily ledger stored in MongoDB.
// Tracks total coins generated (income) and removed (sinks) each calendar day.
// Staff can query this with the .ecostats command to detect inflation.

const econStatsSchema = new mongoose.Schema({
  date:      { type: String, unique: true },  // 'YYYY-MM-DD'
  generated: { type: Number, default: 0 },    // total coins injected today
  removed:   { type: Number, default: 0 },    // total coins removed today
}, { timestamps: false })
const EconStats = mongoose.model('EconStats', econStatsSchema)

function todayKey() {
  return new Date().toISOString().split('T')[0]
}

async function trackCurrencyGenerated(amount) {
  if (!amount || amount <= 0) return
  try {
    await EconStats.findOneAndUpdate(
      { date: todayKey() },
      { $inc: { generated: amount } },
      { upsert: true }
    )
  } catch {}
}

async function trackCurrencyRemoved(amount) {
  if (!amount || amount <= 0) return
  try {
    await EconStats.findOneAndUpdate(
      { date: todayKey() },
      { $inc: { removed: amount } },
      { upsert: true }
    )
  } catch {}
}

async function getEconStats(days = 7) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const dateStr = cutoff.toISOString().split('T')[0]
  return EconStats.find({ date: { $gte: dateStr } }).sort({ date: -1 }).lean()
}

async function getEconTotals() {
  const agg = await EconStats.aggregate([
    { $group: { _id: null, totalGenerated: { $sum: '$generated' }, totalRemoved: { $sum: '$removed' } } },
  ])
  return agg[0] || { totalGenerated: 0, totalRemoved: 0 }
}

// ── Bulk seed all cards from JSON files into MongoDB ──────────────────────────
// Usage: await db.seedAllCards(cardIndex, cardIndex2, cardIndexMazoku)
// cardIndex:    [{tier, title, url}]       — old shoob (numeric tier)
// cardIndex2:   [{name, tier, url, series}] — new shoob (numeric tier)
// cardIndexMazoku: [{id, name, tier, series, url}] — mazoku (C/R/SR/SSR/UR)
async function seedAllCards(cardIndex, cardIndex2, cardIndexMazoku) {
  const LOCAL_TO_LABEL = { '1':'T1','2':'T2','3':'T3','4':'T4','5':'T5','6':'T6','S':'TS','Z':'TZ' }
  const MAZOKU_PRICES  = { C:17500, R:27500, SR:37500, SSR:50000, UR:62500 }
  const TIER_PRICES_S  = { T1:17500, T2:27500, T3:37500, T4:50000, T5:62500, T6:72500, TS:90000, TZ:0 }

  const ops = []

  const pushOp = (imageUrl, name, tier, series, price) => {
    if (!imageUrl) return
    ops.push({
      updateOne: {
        filter: { image_url: imageUrl },
        update: {
          $setOnInsert: {
            name:        name || 'Unknown',
            tier:        tier || 'T1',
            series:      series || '',
            price:       price || 17500,
            image_url:   imageUrl,
            rarity:      RARITY_BY_TIER[tier] || 'Common',
            uploaded_by: 'system',
            external_id: imageUrl,
          },
        },
        upsert: true,
      },
    })
  }

  for (const c of (cardIndex || [])) {
    const tier = LOCAL_TO_LABEL[String(c.tier)] || String(c.tier)
    pushOp(c.url, c.title, tier, '', TIER_PRICES_S[tier] || 17500)
  }
  for (const c of (cardIndex2 || [])) {
    const tier = LOCAL_TO_LABEL[String(c.tier)] || String(c.tier)
    pushOp(c.url, c.name, tier, c.series || '', TIER_PRICES_S[tier] || 17500)
  }
  for (const c of (cardIndexMazoku || [])) {
    pushOp(c.url, c.name, c.tier, c.series || '', MAZOKU_PRICES[c.tier] || 17500)
  }

  if (!ops.length) return { inserted: 0, total: 0 }

  const BATCH = 1000
  let inserted = 0
  for (let i = 0; i < ops.length; i += BATCH) {
    const result = await Card.bulkWrite(ops.slice(i, i + BATCH), { ordered: false })
    inserted += result.upsertedCount || 0
    console.log(`[seedAllCards] batch ${Math.floor(i/BATCH)+1}/${Math.ceil(ops.length/BATCH)} — upserted so far: ${inserted}`)
  }

  const total = await Card.countDocuments()
  console.log(`[seedAllCards] DONE. new inserts: ${inserted}, total cards in DB: ${total}`)
  return { inserted, total }
}

async function getUserByJid(jid) {
  if (!jid) return null
  const cleanedJid = String(jid).includes('@') ? jid : `${jid}@s.whatsapp.net`
  try {
    return await User.findOne({ jid: cleanedJid }).lean()
  } catch {
    return null
  }
}

module.exports = {
  supabase,
  // Users
  getUser, createUser, getOrCreateUser, updateUser, getUserByJid,
  // Groups
  getGroup, getOrCreateGroup, updateGroup,
  // Warnings
  addWarning, getWarnings, resetWarnings,
  // AFK
  setAFK, getAFK, removeAFK, incrementAFKMentions,
  // Messages
  logMessage, getMessageCount, getActiveUsers, getTopUser,
  // Cooldowns
  setCooldown, getCooldown,
  // Inventory
  getInventory, addItem, removeItem,
  // Leaderboard
  getLeaderboard, getRichList, getUserCount, getGroupCount,
  // Cards
  addCard, getCards, getCard, getUserCards, getUserCardCount,
  assignCard, addUserCard, deleteUserCardById, updateUserCardById, getCardOwners, getOrCreateShoobCard,
  getCardByExternalId, getOwnerCountsBatch,
  addMutedUser, removeMutedUser, deleteAllUsers,
  // Card-spawn
  setGroupCardSpawn, tickCardSpawn,
  // AI persona
  getAiPersona, setAiPersonaName, addAiPersonaFact, removeAiPersonaFact, clearAiPersonaFacts,
  // Pokémon
  getUserPokemon, addPokemon, updatePokemon, getPokemonOwnersBySpeciesId,
  // Games
  getGame, createGame, updateGame, endGame,
  // Summer
  getSummerTokens, setSummerTokens, getSummerLeaderboard,
  // Guilds
  getGuild, getGuildByName, getGuildByMember, getUserGuild,
  createGuild, joinGuild, leaveGuild, updateGuild, deleteGuild, disbandGuild, getAllGuilds, listGuilds,
  // Blacklist
  getBlacklist, addBlacklist, removeBlacklist,
  // Staff
  getMods, getBannedUsers,
  // Disabled commands
  getDisabledCommands, disableCommand, enableCommand,
  // Suspensions
  getSuspension, addSuspension, removeSuspension, getSuspensions,
  // Loans
  getLoan, createLoan, repayLoan, deleteLoan, getLoanTierForLevel, LOAN_TIERS,
  // Per-group disabled commands
  getGroupDisabledCmds, setGroupDisabledCmds,
  // All staff
  getAllStaff,
  // WA ↔ Web linking
  requestWaLink, verifyAndLinkJid,
  // Card seeding
  seedAllCards,
  // Economy inflation tracking
  trackCurrencyGenerated, trackCurrencyRemoved, getEconStats, getEconTotals,
  // Mongoose instance
  mongoose,
}
