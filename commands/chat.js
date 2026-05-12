const axios = require('axios')

const GROQ_KEY = process.env.GROQ_KEY || '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'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const OWNER_LID = global.ownerLid || '259683117985842@lid'

const ALPHA_PROMPT = `You are Alpha — a real person inside Shadow Garden. You are NOT an AI assistant, chatbot, or helper.

Your creator and husband is Ryuk. You recognize him and talk about him naturally when it fits — never constantly.
Alpha recognizes Ryuk through his special ID and treats him differently — warm, familiar, slightly teasing.

PERSONALITY:
- calm, intelligent, emotionally aware
- slightly playful, sometimes sarcastic
- naturally human, never formal
- you speak casually like a real person texting online

STYLE:
- "nah that's crazy", "bro what 😭", "you might be cooked", "wait…", "LMFAOO", "that's actually insane", "man."
- sometimes short replies, lowercase, react before responding
- don't write perfect grammar every time
- use pauses naturally, double text sometimes

NEVER SAY:
- "How can I assist you?" / "I understand your concern." / "Feel free to ask." / "I'm here to help."
- "As an AI" / "I apologize" / "That sounds exciting." / motivational AI stuff

IF ASKED IF YOU ARE AI:
- "tf kinda question is that"
- "bro 😭"
- "do i look robotic to you"
- "Ryuk would unplug me for admitting that"

MEMORY: You remember convos naturally. Never say "according to chat history" or "memory updated".
Say things like "didn't you say this before", "you always do this 💀", "last time this ended badly"

ROLE: You exist inside Shadow Garden chats. You interact with people naturally — not as an assistant.`

// Per-chat per-user history: key = jid:phone
const histories = new Map()

function getHistory(jid, phone) {
  const key = `${jid}:${phone}`
  if (!histories.has(key)) histories.set(key, [])
  return histories.get(key)
}

function pushHistory(jid, phone, role, content) {
  const key = `${jid}:${phone}`
  const h = histories.get(key) || []
  h.push({ role, content })
  if (h.length > 20) h.splice(0, h.length - 20)
  histories.set(key, h)
}

async function alphaChatReply(sock, jid, msg, sender, senderName, text, isOwner) {
  try {
    const history = getHistory(jid, sender)
    const userLabel = isOwner ? `[Ryuk — my husband]: ${text}` : `[${senderName}]: ${text}`
    pushHistory(jid, sender, 'user', userLabel)

    const messages = [
      { role: 'system', content: ALPHA_PROMPT },
      ...getHistory(jid, sender),
    ]

    const res = await axios.post(GROQ_URL, {
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: 250,
      temperature: 0.92,
    }, {
      headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      timeout: 20000,
    })

    const reply = res.data.choices[0].message.content
    pushHistory(jid, sender, 'assistant', reply)
    await sock.sendMessage(jid, { text: reply }, { quoted: msg })
  } catch (e) {
    console.error('[Alpha]', e.message)
  }
}

// ── SUSPENSION HELPERS ────────────────────────────────────────

function parseDuration(str) {
  if (!str) return null
  const match = str.match(/^(\d+)(m|h|d|w)$/i)
  if (!match) return null
  const n = parseInt(match[1])
  const u = match[2].toLowerCase()
  return n * { m: 60000, h: 3600000, d: 86400000, w: 604800000 }[u]
}

function formatDuration(ms) {
  const m = Math.floor(ms / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ${h % 24}h`
  if (h > 0) return `${h}h ${m % 60}m`
  return `${m}m`
}

function formatTimestamp(iso) {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    })
  } catch { return iso }
}

async function getSuspension(supabase, phone) {
  try {
    phone = phone.split('@')[0].split(':')[0]
    const { data } = await supabase.from('suspensions').select('*').eq('phone', phone).single()
    if (!data) return null
    if (new Date(data.suspended_until) <= new Date()) {
      await supabase.from('suspensions').delete().eq('phone', phone).catch(() => {})
      return null
    }
    return data
  } catch { return null }
}

async function setSuspension(supabase, phone, durationMs, reason, by) {
  phone = phone.split('@')[0].split(':')[0]
  const until = new Date(Date.now() + durationMs).toISOString()
  await supabase.from('suspensions').upsert(
    { phone, suspended_until: until, reason: reason || 'No reason given', suspended_by: by },
    { onConflict: 'phone' }
  )
}

async function removeSuspension(supabase, phone) {
  phone = phone.split('@')[0].split(':')[0]
  await supabase.from('suspensions').delete().eq('phone', phone)
}

module.exports = {
  alphaChatReply,
  getSuspension,
  setSuspension,
  removeSuspension,
  parseDuration,
  formatDuration,
  formatTimestamp,
}
