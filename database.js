const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL || 'https://uwpcfhrbffhegfvxmxoa.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cGNmaHJiZmZoZWdmdnhteG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NDUwMTgsImV4cCI6MjA5MzMyMTAxOH0.jvqoR2I0-irG1Xbh36eTMfmHFJYK-6Bo0IxIyVclQmA'
const supabase = createClient(supabaseUrl, supabaseKey)

// ─── USERS ──────────────────────────────────────────────────────────────────

async function getOrCreateUser(phone, name) {
  phone = phone.split('@')[0].split(':')[0]
  const { data: existing } = await supabase.from('users').select('*').eq('phone', phone).single()
  if (existing) return existing
  const { data: created } = await supabase.from('users').insert({ phone, name: name || phone }).select().single()
  return created
}

async function updateUser(phone, updates) {
  phone = phone.split('@')[0].split(':')[0]
  const { data, error } = await supabase.from('users').update(updates).eq('phone', phone).select().single()
  if (error) {
    console.error('[db] updateUser error:', error.message, 'phone:', phone, 'keys:', Object.keys(updates))
    return null
  }
  return data
}

async function getUser(phone) {
  phone = phone.split('@')[0].split(':')[0]
  const { data } = await supabase.from('users').select('*').eq('phone', phone).single()
  return data || null
}

// ─── GROUPS ─────────────────────────────────────────────────────────────────

async function getOrCreateGroup(jid, name) {
  const { data: existing } = await supabase.from('groups').select('*').eq('jid', jid).single()
  if (existing) return existing
  const { data: created } = await supabase.from('groups').insert({ jid, name: name || jid }).select().single()
  return created
}

async function updateGroup(jid, updates) {
  const { data, error } = await supabase.from('groups').update(updates).eq('jid', jid).select().single()
  if (error) {
    // Row might not exist yet
    const existing = await getOrCreateGroup(jid, '')
    if (existing) {
      const { data: retryData } = await supabase.from('groups').update(updates).eq('jid', jid).select().single()
      return retryData
    }
    return null
  }
  return data
}

// ─── ECONOMY ────────────────────────────────────────────────────────────────

async function getCooldown(phone, type) {
  phone = phone.split('@')[0].split(':')[0]
  const { data } = await supabase.from('cooldowns').select('*').eq('phone', phone).eq('type', type).single()
  if (!data) return 0
  const remaining = new Date(data.expires_at).getTime() - Date.now()
  return Math.max(0, remaining)
}

async function setCooldown(phone, type, seconds) {
  phone = phone.split('@')[0].split(':')[0]
  const expiresAt = new Date(Date.now() + seconds * 1000).toISOString()
  await supabase.from('cooldowns').upsert({ phone, type, expires_at: expiresAt })
}

// ─── INVENTORY ──────────────────────────────────────────────────────────────

async function getInventory(phone) {
  phone = phone.split('@')[0].split(':')[0]
  const { data } = await supabase.from('inventory').select('*').eq('phone', phone)
  return data || []
}

async function addItem(phone, item, quantity = 1) {
  phone = phone.split('@')[0].split(':')[0]
  const { data: existing } = await supabase.from('inventory').select('*').eq('phone', phone).eq('item', item).single()
  if (existing) {
    await supabase.from('inventory').update({ quantity: existing.quantity + quantity }).eq('id', existing.id)
  } else {
    await supabase.from('inventory').insert({ phone, item, quantity })
  }
}

async function removeItem(phone, item, quantity = 1) {
  phone = phone.split('@')[0].split(':')[0]
  const { data: existing } = await supabase.from('inventory').select('*').eq('phone', phone).eq('item', item).single()
  if (!existing) return false
  if (existing.quantity <= quantity) {
    await supabase.from('inventory').delete().eq('id', existing.id)
  } else {
    await supabase.from('inventory').update({ quantity: existing.quantity - quantity }).eq('id', existing.id)
  }
  return true
}

// ─── WARNINGS ───────────────────────────────────────────────────────────────

async function addWarning(phone, groupJid, reason, by) {
  phone = phone.split('@')[0].split(':')[0]
  await supabase.from('warnings').insert({ phone, group_jid: groupJid, reason, by })
}

async function getWarnings(phone, groupJid) {
  phone = phone.split('@')[0].split(':')[0]
  const { data } = await supabase.from('warnings').select('*').eq('phone', phone).eq('group_jid', groupJid)
  return data || []
}

async function resetWarnings(phone, groupJid) {
  phone = phone.split('@')[0].split(':')[0]
  await supabase.from('warnings').delete().eq('phone', phone).eq('group_jid', groupJid)
}

// ─── BLACKLIST ───────────────────────────────────────────────────────────────

async function addBlacklist(groupJid, word) {
  await supabase.from('blacklist').upsert({ group_jid: groupJid, word })
}

async function removeBlacklist(groupJid, word) {
  await supabase.from('blacklist').delete().eq('group_jid', groupJid).eq('word', word)
}

async function getBlacklist(groupJid) {
  const { data } = await supabase.from('blacklist').select('word').eq('group_jid', groupJid)
  return (data || []).map(r => r.word)
}

// ─── ACTIVITY ────────────────────────────────────────────────────────────────

async function logMessage(phone, groupJid) {
  phone = phone.split('@')[0].split(':')[0]
  await supabase.from('message_log').insert({ phone, group_jid: groupJid, sent_at: new Date().toISOString() }).catch(() => {})
}

async function getActiveUsers(groupJid, hours) {
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString()
  const { data } = await supabase
    .from('message_log')
    .select('phone')
    .eq('group_jid', groupJid)
    .gte('sent_at', since)
  if (!data) return []
  return [...new Set(data.map(r => r.phone))]
}

async function getMessageCount(groupJid, hours) {
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString()
  const { count } = await supabase
    .from('message_log')
    .select('*', { count: 'exact', head: true })
    .eq('group_jid', groupJid)
    .gte('sent_at', since)
  return count || 0
}

// ─── CARDS ──────────────────────────────────────────────────────────────────

async function getUserCards(phone) {
  phone = phone.split('@')[0].split(':')[0]
  const { data } = await supabase
    .from('user_cards')
    .select('*, cards(*)')
    .eq('phone', phone)
    .gt('quantity', 0)
  return data || []
}

async function getUserCardCount(phone) {
  phone = phone.split('@')[0].split(':')[0]
  const { data } = await supabase.from('user_cards').select('quantity').eq('phone', phone).gt('quantity', 0)
  return (data || []).reduce((sum, r) => sum + (r.quantity || 1), 0)
}

async function addUserCard(phone, cardId, quantity = 1) {
  phone = phone.split('@')[0].split(':')[0]
  const { data: existing } = await supabase
    .from('user_cards')
    .select('*')
    .eq('phone', phone)
    .eq('card_id', cardId)
    .single()
  if (existing) {
    await supabase.from('user_cards').update({ quantity: existing.quantity + quantity }).eq('id', existing.id)
  } else {
    await supabase.from('user_cards').insert({ phone, card_id: cardId, quantity })
  }
}

async function removeUserCard(phone, cardId, quantity = 1) {
  phone = phone.split('@')[0].split(':')[0]
  const { data: existing } = await supabase
    .from('user_cards')
    .select('*')
    .eq('phone', phone)
    .eq('card_id', cardId)
    .single()
  if (!existing) return false
  if (existing.quantity <= quantity) {
    await supabase.from('user_cards').delete().eq('id', existing.id)
  } else {
    await supabase.from('user_cards').update({ quantity: existing.quantity - quantity }).eq('id', existing.id)
  }
  return true
}

// ─── POKEMON ─────────────────────────────────────────────────────────────────

async function getUserPokemon(phone) {
  phone = phone.split('@')[0].split(':')[0]
  const { data } = await supabase.from('user_pokemon').select('*').eq('phone', phone)
  return data || []
}

async function addPokemon(phone, pokemonData) {
  phone = phone.split('@')[0].split(':')[0]
  const { data, error } = await supabase
    .from('user_pokemon')
    .insert({ phone, ...pokemonData })
    .select()
    .single()
  if (error) {
    console.error('[db] addPokemon failed:', error.message, 'phone:', phone, 'name:', pokemonData.name)
    return null
  }
  return data
}

async function updatePokemon(id, updates) {
  const { data, error } = await supabase.from('user_pokemon').update(updates).eq('id', id).select().single()
  if (error) console.error('[db] updatePokemon error:', error.message)
  return data || null
}

// ─── LEADERBOARD ─────────────────────────────────────────────────────────────

async function getLeaderboard(field = 'wallet', limit = 10) {
  const { data } = await supabase
    .from('users')
    .select('phone, name, wallet, gems, xp, level')
    .order(field, { ascending: false })
    .limit(limit)
  return data || []
}

// ─── BANK TRANSACTIONS ───────────────────────────────────────────────────────

async function logTransaction(phone, type, amount, note = '') {
  phone = phone.split('@')[0].split(':')[0]
  await supabase.from('transactions').insert({ phone, type, amount, note }).catch(() => {})
}

async function getTransactionHistory(phone, limit = 10) {
  phone = phone.split('@')[0].split(':')[0]
  const { data } = await supabase
    .from('transactions')
    .select('*')
    .eq('phone', phone)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data || []
}

// ─── ROLES ───────────────────────────────────────────────────────────────────

async function setRole(phone, role) {
  phone = phone.split('@')[0].split(':')[0]
  return updateUser(phone, { role })
}

async function getRole(phone) {
  phone = phone.split('@')[0].split(':')[0]
  const u = await getUser(phone)
  return u?.role || 'member'
}

async function getStaffList() {
  const { data } = await supabase
    .from('users')
    .select('phone, name, role')
    .in('role', ['owner', 'mod', 'guardian', 'admin'])
    .order('role')
  return data || []
}

// ─── EXPORT ──────────────────────────────────────────────────────────────────

module.exports = {
  supabase,
  getOrCreateUser,
  updateUser,
  getUser,
  getOrCreateGroup,
  updateGroup,
  getCooldown,
  setCooldown,
  getInventory,
  addItem,
  removeItem,
  addWarning,
  getWarnings,
  resetWarnings,
  addBlacklist,
  removeBlacklist,
  getBlacklist,
  logMessage,
  getActiveUsers,
  getMessageCount,
  getUserCards,
  getUserCardCount,
  addUserCard,
  removeUserCard,
  getUserPokemon,
  addPokemon,
  updatePokemon,
  getLeaderboard,
  logTransaction,
  getTransactionHistory,
  setRole,
  getRole,
  getStaffList,
}
