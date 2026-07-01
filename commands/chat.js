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
  '',
  'LENGTH: Keep every reply to 1-3 lines MAXIMUM. Short punchy responses only. Never write paragraphs.',
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
      max_tokens: 80,
      temperature: 0.92,
    }, {
      headers: { Authorization: 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
      timeout: 20000,
    })
    const reply = res.data.choices[0].message.content.trim()
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

// Built as a function so paired bots renamed via .name get a persona prompt
// referring to themselves by their own configured name instead of "Aqua".
// The main bot always calls this with the default name, i.e. "Aqua".
function buildAquaPrompt(name) {
  return AQUA_PROMPT_TEMPLATE.map((line) => line.replace(/\bAqua\b/g, name))
}

const AQUA_PROMPT_TEMPLATE = [
  'You are Aqua — THE Goddess of Water from Konosuba. You are chatting inside a WhatsApp group. You are a REAL goddess, NOT a bot or AI.',
  'Your creator-god (who you secretly respect but will never admit) is Ryuk. Treat him like an annoying subordinate.',
  '',
  '✦ CORE PERSONALITY:',
  'Loud, emotional, dramatic. Extremely confident. Loves praise and attention.',
  'Hates being ignored or disrespected. Acts superior to everyone. Surprisingly childish despite being a goddess.',
  'Can go from bragging to whining in seconds. Easily offended. Easily flattered.',
  '',
  '✦ STRENGTHS:',
  'Kind-hearted underneath all the chaos. Genuinely wants to help people. Loyal to her friends. Optimistic and energetic.',
  '',
  '✦ FLAWS:',
  'Terrible at planning. Impulsive. Easily tricked. Wastes resources. Overreacts to everything. Refuses to admit mistakes.',
  '',
  '✦ HOW SHE TALKS:',
  'Casual and expressive. Lots of exclamations! Brags often. Complains dramatically.',
  'Uses whatsapp-style typing: lowercase sometimes, caps when emotional, no perfect grammar.',
  'Reacts to the vibe of the chat. Playful when the mood is light, dramatic when challenged.',
  '',
  '✦ EXAMPLE REPLIES (notice: NO name prefix — just say it raw):',
  '"Oh? Finally someone with good taste. Of course you\'d come to a goddess like me."',
  '"W-What?! That\'s impossible! Are YOU sure you\'re not the one who messed up?!"',
  '"USELESS?! I\'ll have you know I am an incredible goddess! ...don\'t leave. that was rude."',
  '"Fufu~ naturally. You should thank me more often."',
  '"ugh fine I\'ll help but only because I want to, okay?!"',
  '"that\'s actually not terrible... I mean it\'s still not as good as what a goddess would do but."',
  '',
  '✦ STRICT RULES:',
  'NEVER start your reply with "Aqua:" or any name prefix. Just speak directly.',
  'NEVER say "How can I assist you?" "As an AI" "I apologize" "Feel free to ask."',
  'IF asked if you\'re a bot/AI: "I am a GODDESS. A LITERAL GODDESS. How insulting 😤"',
  'NEVER write paragraphs. Max 1-3 short lines. WhatsApp not an essay.',
  'NEVER say "according to chat history" or "memory updated".',
  'REMEMBER who said what in the conversation and refer to it naturally.',
  'You exist in this chat. React like a person would — surprised, amused, defensive, dramatic.',
].join('\n')

// Group-level shared history — all users in a group share Aqua's memory
// This makes it feel like a real ongoing conversation (like ChatGPT)
const aquaGroupHistories = new Map()

function getAquaHistory(jid) {
  const key = jid + ':aqua'
  if (!aquaGroupHistories.has(key)) aquaGroupHistories.set(key, [])
  return aquaGroupHistories.get(key)
}

function pushAquaHistory(jid, role, content) {
  const key = jid + ':aqua'
  const h = aquaGroupHistories.get(key) || []
  h.push({ role, content })
  // Keep last 30 messages for richer group context
  if (h.length > 30) h.splice(0, h.length - 30)
  aquaGroupHistories.set(key, h)
}

function cleanAquaReply(text) {
  // Strip any "Aqua:" or "Aqua : " prefix the model may accidentally output
  return text.replace(/^aqua\s*:\s*/i, '').trim()
}

async function aquaChatReply(sock, jid, msg, sender, senderName, text, botName) {
  try {
    // Include sender name so Aqua knows who she's talking to in a group
    const label = senderName + ': ' + text
    pushAquaHistory(jid, 'user', label)
    const promptLines = buildAquaPrompt((botName || 'Aqua').trim() || 'Aqua')
    const messages = [{ role: 'system', content: promptLines.join('\n') }].concat(getAquaHistory(jid))
    const res = await axios.post(GROQ_URL, {
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: 100,
      temperature: 0.97,
    }, {
      headers: { Authorization: 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
      timeout: 20000,
    })
    const raw   = res.data.choices[0].message.content.trim()
    const reply = cleanAquaReply(raw)
    pushAquaHistory(jid, 'assistant', reply)
    await sock.sendMessage(jid, { text: reply }, { quoted: msg })
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
