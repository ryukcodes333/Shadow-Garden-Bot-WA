const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uwpcfhrbffhegfvxmxoa.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cGNmaHJiZmZoZWdmdnhteG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NDUwMTgsImV4cCI6MjA5MzMyMTAxOH0.jvqoR2I0-irG1Xbh36eTMfmHFJYK-6Bo0IxIyVclQmA'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
module.exports.supabase = supabase

async function getUser(phone) {
  phone = phone.split('@')[0]
  const { data, error } = await supabase.from('users').select('*').eq('phone', phone).single()
  if (error && error.code === 'PGRST116') return null
  return data
}

async function createUser(phone, name) {
  phone = phone.split('@')[0]
  const { data, error } = await supabase.from('users').insert({
    phone, name: name || phone,
    wallet: 0, bank: 500, gems: 0, xp: 0, level: 1,
    streak: 0, banned: false, premium: false, role: 'member',
    title: 'Newcomer', bio: ''
  }).select().single()
  if (error) { console.error('createUser error:', error.message); return null }
  return data
}

async function getOrCreateUser(phone, name) {
  phone = phone.split('@')[0]
  let user = await getUser(phone)
  if (!user) user = await createUser(phone, name)
  return user
}

async function updateUser(phone, updates) {
  phone = phone.split('@')[0]
  const { data, error } = await supabase.from('users').update(updates).eq('phone', phone).select().single()
  if (error) { console.error('updateUser error:', error.message); return null }
  return data
}

async function getGroup(groupId) {
  const { data, error } = await supabase.from('groups').select('*').eq('group_id', groupId).single()
  if (error && error.code === 'PGRST116') return null
  return data
}

async function getOrCreateGroup(groupId, name) {
  let group = await getGroup(groupId)
  if (!group) {
    const { data } = await supabase.from('groups').insert({
      group_id: groupId, name: name || groupId,
      antilink: false, antilink_action: 'warn', antispam: false,
      welcome: false, leave: false, muted: false, pokemon_enabled: false
    }).select().single()
    group = data
  }
  return group
}

async function updateGroup(groupId, updates) {
  const { data, error } = await supabase.from('groups').update(updates).eq('group_id', groupId).select().single()
  if (error) { console.error('updateGroup error:', error.message); return null }
  return data
}

async function addWarning(phone, groupId, reason, byPhone) {
  phone = phone.split('@')[0]; byPhone = byPhone.split('@')[0]
  const { data } = await supabase.from('warnings').insert({ user_phone: phone, group_id: groupId, reason, by_phone: byPhone }).select().single()
  return data
}

async function getWarnings(phone, groupId) {
  phone = phone.split('@')[0]
  const { data } = await supabase.from('warnings').select('*').eq('user_phone', phone).eq('group_id', groupId)
  return data || []
}

async function resetWarnings(phone, groupId) {
  phone = phone.split('@')[0]
  await supabase.from('warnings').delete().eq('user_phone', phone).eq('group_id', groupId)
}

async function setAFK(phone, reason) {
  phone = phone.split('@')[0]
  await supabase.from('afk').upsert({ phone, reason, since: new Date().toISOString(), mentions: 0 }, { onConflict: 'phone' })
}

async function getAFK(phone) {
  phone = phone.split('@')[0]
  const { data } = await supabase.from('afk').select('*').eq('phone', phone).single()
  return data
}

async function removeAFK(phone) {
  phone = phone.split('@')[0]
  await supabase.from('afk').delete().eq('phone', phone)
}

async function incrementAFKMentions(phone) {
  phone = phone.split('@')[0]
  const { data } = await supabase.from('afk').select('mentions').eq('phone', phone).single()
  if (data) await supabase.from('afk').update({ mentions: (data.mentions || 0) + 1 }).eq('phone', phone)
}

async function logMessage(phone, groupId) {
  phone = phone.split('@')[0]
  await supabase.from('messages').insert({ user_phone: phone, group_id: groupId })
}

async function getMessageCount(groupId, hours = 24) {
  const since = new Date(Date.now() - hours * 3600000).toISOString()
  const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true })
    .eq('group_id', groupId).gte('created_at', since)
  return count || 0
}

async function getActiveUsers(groupId, hours = 24) {
  const since = new Date(Date.now() - hours * 3600000).toISOString()
  const { data } = await supabase.from('messages').select('user_phone').eq('group_id', groupId).gte('created_at', since)
  if (!data) return []
  const unique = [...new Set(data.map(m => m.user_phone))]
  return unique
}

async function getTopUser(groupId, hours = 24) {
  const since = new Date(Date.now() - hours * 3600000).toISOString()
  const { data } = await supabase.from('messages').select('user_phone').eq('group_id', groupId).gte('created_at', since)
  if (!data || !data.length) return null
  const counts = {}
  for (const m of data) counts[m.user_phone] = (counts[m.user_phone] || 0) + 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
}

async function setCooldown(phone, command, seconds) {
  phone = phone.split('@')[0]
  const expires = new Date(Date.now() + seconds * 1000).toISOString()
  await supabase.from('cooldowns').upsert({ phone, command, expires_at: expires }, { onConflict: 'phone,command' })
}

async function getCooldown(phone, command) {
  phone = phone.split('@')[0]
  const { data } = await supabase.from('cooldowns').select('expires_at').eq('phone', phone).eq('command', command).single()
  if (!data) return 0
  const remaining = new Date(data.expires_at).getTime() - Date.now()
  return remaining > 0 ? remaining : 0
}

async function getInventory(phone) {
  phone = phone.split('@')[0]
  const { data } = await supabase.from('inventory').select('*').eq('phone', phone)
  return data || []
}

async function addItem(phone, item, qty = 1) {
  phone = phone.split('@')[0]
  const { data: existing } = await supabase.from('inventory').select('*').eq('phone', phone).eq('item', item).single()
  if (existing) {
    await supabase.from('inventory').update({ quantity: existing.quantity + qty }).eq('phone', phone).eq('item', item)
  } else {
    await supabase.from('inventory').insert({ phone, item, quantity: qty })
  }
}

async function removeItem(phone, item, qty = 1) {
  phone = phone.split('@')[0]
  const { data: existing } = await supabase.from('inventory').select('*').eq('phone', phone).eq('item', item).single()
  if (!existing) return false
  if (existing.quantity <= qty) {
    await supabase.from('inventory').delete().eq('phone', phone).eq('item', item)
  } else {
    await supabase.from('inventory').update({ quantity: existing.quantity - qty }).eq('phone', phone).eq('item', item)
  }
  return true
}

async function getLeaderboard(limit = 10) {
  const { data } = await supabase.from('users').select('phone,name,wallet,bank,gems,xp,level')
    .order('wallet', { ascending: false }).limit(limit)
  return data || []
}

async function getRichList(limit = 10) {
  const { data } = await supabase.from('users').select('phone,name,wallet,bank')
    .order('wallet', { ascending: false }).limit(limit)
  return data || []
}

async function getUserCount() {
  const { count } = await supabase.from('users').select('*', { count: 'exact', head: true })
  return count || 0
}

async function getGroupCount() {
  const { count } = await supabase.from('groups').select('*', { count: 'exact', head: true })
  return count || 0
}

async function addCard(name, tier, series, price, imageUrl, rarity, uploadedBy) {
  const { data } = await supabase.from('cards').insert({ name, tier, series, price, image_url: imageUrl, rarity, uploaded_by: uploadedBy }).select().single()
  return data
}

async function getCards(filters = {}) {
  let query = supabase.from('cards').select('*')
  if (filters.tier) query = query.eq('tier', filters.tier)
  if (filters.series) query = query.ilike('series', `%${filters.series}%`)
  if (filters.name) query = query.ilike('name', `%${filters.name}%`)
  const { data } = await query.limit(50)
  return data || []
}

async function getCard(id) {
  const { data } = await supabase.from('cards').select('*').eq('id', id).single()
  return data
}

async function getUserCards(phone) {
  phone = phone.split('@')[0]
  const { data } = await supabase.from('user_cards').select('*, cards(*)').eq('phone', phone)
  return data || []
}

async function assignCard(phone, cardId) {
  phone = phone.split('@')[0]
  const { data } = await supabase.from('user_cards').insert({ phone, card_id: cardId }).select().single()
  return data
}

async function addUserCard(phone, cardId) {
  return assignCard(phone, cardId)
}

async function deleteUserCardById(rowId) {
  await supabase.from('user_cards').delete().eq('id', rowId)
}

async function getUserPokemon(phone) {
  phone = phone.split('@')[0]
  const { data } = await supabase.from('user_pokemon').select('*').eq('phone', phone)
  return data || []
}

async function addPokemon(phone, pokemonData) {
  phone = phone.split('@')[0]
  const { data } = await supabase.from('user_pokemon').insert({ phone, ...pokemonData }).select().single()
  return data
}

async function updatePokemon(id, updates) {
  const { data } = await supabase.from('user_pokemon').update(updates).eq('id', id).select().single()
  return data
}

async function getGame(groupId, gameType) {
  const { data } = await supabase.from('games').select('*').eq('group_id', groupId).eq('game_type', gameType).eq('active', true).single()
  return data
}

async function createGame(groupId, gameType, players, state) {
  const { data } = await supabase.from('games').insert({ group_id: groupId, game_type: gameType, players, state, active: true }).select().single()
  return data
}

async function updateGame(id, updates) {
  const { data } = await supabase.from('games').update(updates).eq('id', id).select().single()
  return data
}

async function endGame(id) {
  await supabase.from('games').update({ active: false }).eq('id', id)
}

async function getSummerTokens(phone) {
  phone = phone.split('@')[0]
  const { data } = await supabase.from('summer_tokens').select('*').eq('phone', phone).single()
  return data
}

async function setSummerTokens(phone, tokens) {
  phone = phone.split('@')[0]
  await supabase.from('summer_tokens').upsert({ phone, tokens, last_claimed: new Date().toISOString() }, { onConflict: 'phone' })
}

async function getSummerLeaderboard(limit = 10) {
  const { data } = await supabase.from('summer_tokens').select('phone,tokens').order('tokens', { ascending: false }).limit(limit)
  return data || []
}

async function getGuild(name) {
  const { data } = await supabase.from('guilds').select('*').ilike('name', name).single()
  return data
}

async function getGuildByName(name) {
  return getGuild(name)
}

async function getGuildByMember(phone) {
  phone = phone.split('@')[0]
  const { data: member } = await supabase.from('guild_members').select('*, guilds(*)').eq('phone', phone).single()
  if (!member) return null
  return { ...member.guilds, guild_id: member.guild_id, is_leader: member.is_leader }
}

async function getUserGuild(phone) {
  return getGuildByMember(phone)
}

async function createGuild(name, ownerPhone) {
  ownerPhone = ownerPhone.split('@')[0]
  const existing = await getGuild(name)
  if (existing) return null
  const { data: guild, error } = await supabase.from('guilds')
    .insert({ name, leader_phone: ownerPhone, member_count: 1 })
    .select().single()
  if (error || !guild) return null
  await supabase.from('guild_members').insert({ guild_id: guild.id, phone: ownerPhone, is_leader: true })
  return guild
}

async function joinGuild(phone, guildId) {
  phone = phone.split('@')[0]
  const { error } = await supabase.from('guild_members').insert({ guild_id: guildId, phone, is_leader: false })
  if (!error) {
    const guild = await supabase.from('guilds').select('member_count').eq('id', guildId).single()
    await supabase.from('guilds').update({ member_count: (guild.data?.member_count || 0) + 1 }).eq('id', guildId)
  }
  return !error
}

async function leaveGuild(phone, guildId) {
  phone = phone.split('@')[0]
  await supabase.from('guild_members').delete().eq('phone', phone).eq('guild_id', guildId)
  const guild = await supabase.from('guilds').select('member_count').eq('id', guildId).single()
  await supabase.from('guilds').update({ member_count: Math.max(0, (guild.data?.member_count || 1) - 1) }).eq('id', guildId)
}

async function updateGuild(id, updates) {
  const { data } = await supabase.from('guilds').update(updates).eq('id', id).select().single()
  return data
}

async function deleteGuild(id) {
  await supabase.from('guild_members').delete().eq('guild_id', id)
  await supabase.from('guilds').delete().eq('id', id)
}

async function disbandGuild(id) {
  return deleteGuild(id)
}

async function getAllGuilds() {
  const { data } = await supabase.from('guilds').select('*').order('created_at', { ascending: false })
  return data || []
}

async function listGuilds() {
  return getAllGuilds()
}

async function getBlacklist(groupId) {
  const { data } = await supabase.from('blacklist').select('word').eq('group_id', groupId)
  return (data || []).map(r => r.word)
}

async function addBlacklist(groupId, word) {
  await supabase.from('blacklist').upsert({ group_id: groupId, word }, { onConflict: 'group_id,word' })
}

async function removeBlacklist(groupId, word) {
  await supabase.from('blacklist').delete().eq('group_id', groupId).eq('word', word)
}

async function getMods() {
  const { data } = await supabase.from('users').select('phone,name,role').in('role', ['mod', 'guardian', 'recruit', 'owner'])
  return data || []
}

async function getBannedUsers() {
  const { data } = await supabase.from('users').select('phone,name').eq('banned', true)
  return data || []
}

async function getDisabledCommands() {
  const { data } = await supabase.from('disabled_commands').select('*')
  return data || []
}

async function disableCommand(cmd, reason) {
  await supabase.from('disabled_commands').upsert({ command: cmd, reason }, { onConflict: 'command' })
}

async function enableCommand(cmd) {
  await supabase.from('disabled_commands').delete().eq('command', cmd)
}

async function getUserCardCount(phone) {
  phone = phone.split('@')[0]
  const { count } = await supabase
    .from('user_cards')
    .select('*', { count: 'exact', head: true })
    .eq('phone', phone)
  return count || 0
}

async function getCardOwners(cardId) {
  const { data } = await supabase
    .from('user_cards')
    .select('id, phone, card_id')
    .eq('card_id', cardId)
    .order('id', { ascending: true })
  return data || []
}


const RARITY_BY_TIER = {
  T1: 'Common', T2: 'Uncommon', T3: 'Rare', T4: 'Epic',
  T5: 'Legendary', T6: 'Mythic', TS: 'Shadow', TZ: 'Void',
}

async function getOrCreateShoobCard(shoobId, name, tier, series, imageUrl, price) {
  // Try to find existing card by external_id
  const { data: existing } = await supabase
    .from('cards')
    .select('id')
    .eq('external_id', shoobId)
    .single()
  if (existing) return existing

  // Insert new card entry
  const { data, error } = await supabase
    .from('cards')
    .insert({
      name: name || 'Unknown',
      tier: tier || 'T1',
      series: series || 'Unknown Series',
      price: price || 17500,
      image_url: imageUrl || null,
      rarity: RARITY_BY_TIER[tier] || 'Common',
      uploaded_by: 'system',
      external_id: shoobId,
    })
    .select('id')
    .single()
  if (error) { console.error('getOrCreateShoobCard error:', error.message); return null }
  return data
}

module.exports = {
  supabase,
  getUser, createUser, getOrCreateUser, updateUser,
  getGroup, getOrCreateGroup, updateGroup,
  addWarning, getWarnings, resetWarnings,
  setAFK, getAFK, removeAFK, incrementAFKMentions,
  logMessage, getMessageCount, getActiveUsers, getTopUser,
  setCooldown, getCooldown,
  getInventory, addItem, removeItem,
  getLeaderboard, getRichList, getUserCount, getGroupCount,
  addCard, getCards, getCard, getUserCards, getUserCardCount, assignCard, addUserCard, deleteUserCardById, getOrCreateShoobCard,
  getCardOwners,
  getUserPokemon, addPokemon, updatePokemon,
  getGame, createGame, updateGame, endGame,
  getSummerTokens, setSummerTokens, getSummerLeaderboard,
  getGuild, getGuildByName, getGuildByMember, getUserGuild,
  createGuild, joinGuild, leaveGuild, updateGuild, deleteGuild, disbandGuild, getAllGuilds, listGuilds,
  getBlacklist, addBlacklist, removeBlacklist,
  getMods, getBannedUsers,
  getDisabledCommands, disableCommand, enableCommand,
}
