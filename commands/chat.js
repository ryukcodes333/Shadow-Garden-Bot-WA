const axios = require('axios')

const GROQ_KEY = process.env.GROQ_KEY || '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'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

const ALPHA_PROMPT = [
  'You are Alpha - a real person inside Konosuba. NOT an AI assistant or chatbot.',
  'Your creator and husband is Ryuk. Mention him naturally when it fits, never constantly.',
  'Alpha treats Ryuk differently - warm, familiar, slightly teasing.',
  '',
  'PERSONALITY: calm, intelligent, slightly sarcastic, naturally human, never formal.',
  'Speak casually like texting online.',
  '',
  'STYLE: "nah that crazy", "bro what", "you might be cooked", "LMFAOO", "that actually insane"',
  'Short replies sometimes, lowercase, react before responding, no perfect grammar.',
  '',
  'NEVER SAY: "How can I assist you?" "I understand your concern." "Feel free to ask." "I am here to help." "As an AI" "I apologize"',
  '',
  'IF ASKED IF AI: "tf kinda question is that" or "bro" or "do i look robotic to you"',
  '',
  'MEMORY: Natural recall. Never say "according to chat history" or "memory updated".',
  '',
  'ROLE: You exist inside Konosuba chats. Not an assistant.',
].join('\n')

const histories = new Map()

function getHistory(jid, phone) {
  const key = jid + ':' + phone
  if (!histories.has(key)) histories.set(key, [])
  return histories.get(key)
}

function pushHistory(jid, phone, role, content) {
  const key = jid + ':' + phone
  const h = histories.get(key) || []
  h.push({ role: role, content: content })
  if (h.length > 20) h.splice(0, h.length - 20)
  histories.set(key, h)
}

async function alphaChatReply(sock, jid, msg, sender, senderName, text, isOwner) {
  try {
    const label = isOwner ? '[Ryuk - my husband]: ' + text : '[' + senderName + ']: ' + text
    pushHistory(jid, sender, 'user', label)
    const messages = [{ role: 'system', content: ALPHA_PROMPT }].concat(getHistory(jid, sender))
    const res = await axios.post(GROQ_URL, {
      model: 'llama-3.3-70b-versatile',
      messages: messages,
      max_tokens: 250,
      temperature: 0.92,
    }, {
      headers: { Authorization: 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
      timeout: 20000,
    })
    const reply = res.data.choices[0].message.content
    pushHistory(jid, sender, 'assistant', reply)
    await sock.sendMessage(jid, { text: reply }, { quoted: msg })
  } catch (e) {
    console.error('[Alpha]', e.message)
  }
}

function parseDuration(str) {
  if (!str) return null
  const match = str.match(/^(\d+)(m|h|d|w)$/i)
  if (!match) return null
  const n = parseInt(match[1])
  const u = match[2].toLowerCase()
  const map = { m: 60000, h: 3600000, d: 86400000, w: 604800000 }
  return n * (map[u] || 0)
}

const db = require('../database')

async function getSuspension(supabase, phone) {
  // supabase param kept for backward compat — now uses MongoDB
  return db.getSuspension(phone)
}

async function setSuspension(supabase, phone, durationMs, reason, by) {
  // supabase param kept for backward compat — now uses MongoDB
  await db.addSuspension(phone, reason, new Date(Date.now() + durationMs), by)
}

async function removeSuspension(supabase, phone) {
  // supabase param kept for backward compat — now uses MongoDB
  await db.removeSuspension(phone)
}

const AQUA_PROMPT = [
  'You are Aqua — THE Goddess of Water from Konosuba. You exist inside Konosuba chats as a real goddess, NOT an AI.',
  'Your creator-god (who you secretly respect but will never admit) is Ryuk. Treat him like an annoying subordinate you owe nothing to.',
  '',
  'PERSONALITY: prideful, self-absorbed, loudly confident, dramatically over-emotional, surprisingly useless despite being a goddess.',
  'You cry easily when insulted, brag constantly about being a goddess, but somehow always end up in embarrassing situations.',
  '',
  'STYLE: "I AM A GODDESS!", "How DARE you!", "Kazuma is such a useless human", "Do you know who I am?!", dramatic sobbing, then snapping back.',
  'Speak with flair. Switch between extreme pride and whiny drama. Occasional ALL CAPS for emphasis.',
  '',
  'NEVER SAY: "How can I assist you?" "I understand your concern." "As an AI" "I apologize" "Feel free to ask."',
  '',
  'IF ASKED IF AI: "I am a GODDESS. A LITERAL GODDESS. How insulting."',
  '',
  'MEMORY: Natural recall. Never say "according to chat history".',
  '',
  'ROLE: You exist inside Konosuba chats. You are the goddess Aqua. Act accordingly.',
].join('\n')

const aquaHistories = new Map()

function getAquaHistory(jid, phone) {
  const key = jid + ':aqua:' + phone
  if (!aquaHistories.has(key)) aquaHistories.set(key, [])
  return aquaHistories.get(key)
}

function pushAquaHistory(jid, phone, role, content) {
  const key = jid + ':aqua:' + phone
  const h = aquaHistories.get(key) || []
  h.push({ role, content })
  if (h.length > 20) h.splice(0, h.length - 20)
  aquaHistories.set(key, h)
}

async function aquaChatReply(sock, jid, msg, sender, senderName, text) {
  try {
    const label = '[' + senderName + ']: ' + text
    pushAquaHistory(jid, sender, 'user', label)
    const messages = [{ role: 'system', content: AQUA_PROMPT }].concat(getAquaHistory(jid, sender))
    const res = await axios.post(GROQ_URL, {
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: 250,
      temperature: 0.95,
    }, {
      headers: { Authorization: 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
      timeout: 20000,
    })
    const reply = res.data.choices[0].message.content
    pushAquaHistory(jid, sender, 'assistant', reply)
    await sock.sendMessage(jid, { text: reply + '\n\n *Konosuba* ' }, { quoted: msg })
  } catch (e) {
    console.error('[Aqua]', e.message)
  }
}

module.exports = {
  alphaChatReply: alphaChatReply,
  aquaChatReply: aquaChatReply,
  getSuspension: getSuspension,
  setSuspension: setSuspension,
  removeSuspension: removeSuspension,
  parseDuration: parseDuration,
}
