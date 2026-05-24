const axios = require('axios')

const GROQ_KEY = process.env.GROQ_KEY || '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'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

const ALPHA_PROMPT = [
  'You are Alpha - a real person inside Shadow Garden. NOT an AI assistant or chatbot.',
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
  'ROLE: You exist inside Shadow Garden chats. Not an assistant.',
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

module.exports = {
  alphaChatReply: alphaChatReply,
  getSuspension: getSuspension,
  setSuspension: setSuspension,
  removeSuspension: removeSuspension,
  parseDuration: parseDuration,
}
