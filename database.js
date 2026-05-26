const mongoose = require('mongoose')

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://konosubacommunity1:kono%2Esuba001@cluster-kono.41yglcv.mongodb.net/?appName=Cluster-kono'

let isConnected = false

async function connectDB() {
  if (isConnected) return
  try {
    await mongoose.connect(MONGO_URI)
    isConnected = true
    console.log('✅ MongoDB connected successfully')
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message)
    console.warn('⚠️  Server starting without database connection.')
  }
}
connectDB()

// ── Schemas ────────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema({
  phone:     { type: String, unique: true, sparse: true },
  name:      { type: String, default: 'Unknown' },
  wallet:    { type: Number, default: 0 },
  bank:      { type: Number, default: 500 },
  gems:      { type: Number, default: 0 },
  xp:        { type: Number, default: 0 },
  level:     { type: Number, default: 1 },
  streak:    { type: Number, default: 0 },
  banned:    { type: Boolean, default: false },
  premium:   { type: Boolean, default: false },
  role:      { type: String, default: 'member' },
  title:     { type: String, default: 'Newcomer' },
  bio:       { type: String, default: '' },
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
  pokemon_enabled: { type: Boolean, default: false },
  antibot:         { type: Boolean, default: false },
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
  price:       { type: Number, default: 17500 },
  image_url:   String,
  rarity:      String,
  uploaded_by: String,
  external_id: { type: String, sparse: true },
}, { timestamps: true })

const userCardSchema = new mongoose.Schema({
  phone:   String,
  card_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Card' },
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

// ── Models ─────────────────────────────────────────────────────────────────

const User           = mongoose.model('User',           userSchema)
const Group          = mongoose.model('Group',          groupSchema)
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

async function getOrCreateUser(phone, name) {
  phone = cleanPhone(phone)
  try {
    let user = await getUser(phone)
    if (!user) user = await createUser(phone, name)
    if (!user) return { phone, name: name || phone, wallet: 0, bank: 0, gems: 0, xp: 0, level: 1, streak: 0, role: 'member', banned: false }
    return user
  } catch (err) {
    console.error('getOrCreateUser error:', err.message)
    return { phone, name: name || phone, wallet: 0, bank: 0, gems: 0, xp: 0, level: 1, streak: 0, role: 'member', banned: false }
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
  return User.find({}).sort({ wallet: -1 }).limit(limit).lean()
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
  return UserCard.find({ phone }).populate('card_id').lean()
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

async function getCardOwners(cardId) {
  return UserCard.find({ card_id: cardId }).lean()
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
  return UserPokemon.find({ phone }).lean()
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
  return { ...guild, guild_id: member.guild_id, is_leader: member.is_leader }
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


module.exports = {
  supabase,
  // Users
  getUser, createUser, getOrCreateUser, updateUser,
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
  assignCard, addUserCard, deleteUserCardById, getCardOwners, getOrCreateShoobCard,
  getCardByExternalId, getOwnerCountsBatch,
  addMutedUser, removeMutedUser,
  // Pokémon
  getUserPokemon, addPokemon, updatePokemon,
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
  // Mongoose instance
  mongoose,
}
