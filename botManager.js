// Multi-bot pairing manager.
//
// Lets the owner connect ADDITIONAL bot instances via ".pair <number>" using
// a real Baileys pairing code, independent from the main bot's own
// file/web-paired socket (see index.js / web.js). Each paired bot:
//   - reuses commands/index.js's handleMessage() for command handling
//   - can have its own profile picture (.pfp), menu image (.img) and
//     display name (.name) that only affects that specific paired bot
//   - reconnects automatically and is restored on process restart
//
// The main bot's socket is never touched by this file.
const {
  makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  isJidBroadcast,
  Browsers,
} = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const pino = require('pino')
const path = require('path')
const fs = require('fs')
const db = require('./database')
const { applyBotName } = require('./botNameHelper')

const BOTS_AUTH_ROOT = path.join(__dirname, 'auth_info_paired')
if (!fs.existsSync(BOTS_AUTH_ROOT)) fs.mkdirSync(BOTS_AUTH_ROOT, { recursive: true })

// phone -> { sock, name, menuImage, menuImageMime, pairingCode, reconnectAttempts }
const activeBots = new Map()

const silentLogger = { level: () => {}, info: () => {}, warn: () => {}, error: () => {} }

// Wraps sendMessage so every outgoing text/caption for THIS paired bot has
// "Aqua" replaced with its configured name. Never applied to the main bot.
function wrapSendForName(sock, entry) {
  const original = sock.sendMessage.bind(sock)
  sock.sendMessage = (jid, content, options) => {
    try {
      const name = entry.name || 'Aqua'
      if (content && typeof content === 'object') {
        if (typeof content.text === 'string') content = { ...content, text: applyBotName(content.text, name) }
        if (typeof content.caption === 'string') content = { ...content, caption: applyBotName(content.caption, name) }
      }
    } catch {
      // never let name-substitution break message sending
    }
    return original(jid, content, options)
  }
}

async function startPairedBot(phone, { pairedBy, onCode, onStatus } = {}) {
  if (activeBots.has(phone)) {
    const existing = activeBots.get(phone)
    if (existing.pairingCode && onCode) onCode(existing.pairingCode)
    return existing
  }

  await db.addPairedBot(phone, pairedBy)
  const authFolder = path.join(BOTS_AUTH_ROOT, phone)
  if (!fs.existsSync(authFolder)) fs.mkdirSync(authFolder, { recursive: true })

  const record = await db.getPairedBot(phone).catch(() => null)
  const entry = {
    phone,
    sock: null,
    name: record?.name || 'Aqua',
    menuImage: record?.menuImage || null,
    menuImageMime: record?.menuImageMime || null,
    pairingCode: null,
    reconnectAttempts: 0,
    codeRequested: false,
  }
  activeBots.set(phone, entry)

  async function boot() {
    const { state, saveCreds } = await useMultiFileAuthState(authFolder)
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: Browsers.ubuntu('Chrome'),
      markOnlineOnConnect: false,
      connectTimeoutMs: 30000,
      keepAliveIntervalMs: 15000,
      retryRequestDelayMs: 2000,
    })

    entry.sock = sock
    wrapSendForName(sock, entry)
    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
      const { connection, qr } = update

      if (qr && !sock.authState.creds.registered && !entry.codeRequested) {
        entry.codeRequested = true
        try {
          await new Promise((r) => setTimeout(r, 1500))
          const code = await sock.requestPairingCode(phone)
          const formatted = code?.match(/.{1,4}/g)?.join('-') ?? code
          entry.pairingCode = formatted
          if (onCode) onCode(formatted)
        } catch (err) {
          entry.codeRequested = false
          if (onCode) onCode(null, err)
        }
      }

      if (connection === 'open') {
        entry.reconnectAttempts = 0
        entry.pairingCode = null
        entry.codeRequested = false
        await db.updatePairedBot(phone, { connected: true, jid: sock.user?.id || null }).catch(() => {})
        if (onStatus) onStatus('connected')
      }

      if (connection === 'close') {
        await db.updatePairedBot(phone, { connected: false }).catch(() => {})
        const statusCode = new Boom(update.lastDisconnect?.error)?.output?.statusCode
        if (statusCode === DisconnectReason.loggedOut) {
          activeBots.delete(phone)
          if (onStatus) onStatus('logged_out')
          return
        }
        entry.reconnectAttempts++
        const delay = Math.min(entry.reconnectAttempts * 3000, 20000)
        setTimeout(() => {
          boot().catch((err) => console.error(`[paired bot ${phone}] reconnect error`, err.message))
        }, delay)
      }
    })

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return
      const handleMessage = require('./commands/index')
      for (const m of messages) {
        try {
          if (m.key.fromMe) continue
          if (isJidBroadcast(m.key.remoteJid || '')) continue
          await handleMessage(sock, m, {
            isMainBot: false,
            phone,
            name: entry.name || 'Aqua',
            menuImage: entry.menuImage || null,
            menuImageMime: entry.menuImageMime || null,
          })
        } catch (err) {
          console.error('[paired bot message error]', err.message)
        }
      }
    })
  }

  await boot()
  return entry
}

async function restoreAllPairedBots() {
  const bots = await db.getPairedBots().catch(() => [])
  for (const bot of bots) {
    try {
      await startPairedBot(bot.phone, { pairedBy: bot.pairedBy })
    } catch (err) {
      console.error(`[restore paired bot ${bot.phone}]`, err.message)
    }
  }
}

async function stopPairedBot(phone) {
  const entry = activeBots.get(phone)
  if (!entry) return false
  try {
    await entry.sock?.logout().catch(() => {})
  } catch {}
  activeBots.delete(phone)
  await db.removePairedBot(phone).catch(() => {})
  return true
}

function getActiveBot(phone) {
  return activeBots.get(phone)
}

function listActiveBots() {
  return [...activeBots.values()]
}

// Refreshes an active bot's in-memory identity (used by .name/.img so
// changes apply immediately without needing a reconnect).
function updateActiveBotIdentity(phone, updates) {
  const entry = activeBots.get(phone)
  if (!entry) return false
  Object.assign(entry, updates)
  return true
}

module.exports = {
  startPairedBot,
  restoreAllPairedBots,
  stopPairedBot,
  getActiveBot,
  listActiveBots,
  updateActiveBotIdentity,
}
