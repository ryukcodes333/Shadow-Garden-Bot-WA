const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidBroadcast,
  Browsers,
} = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const pino = require('pino')
const path = require('path')
const fs = require('fs')
const readline = require('readline')

require('./web')

const handleMessage = require('./commands/index')

const PREFIX = '.'
const OWNER_LID = process.env.OWNER_LID || '259683117985842@lid'
const BOT_NAME = 'Alpha'
const START_TIME = Date.now()
const AUTH_DIR = path.join(__dirname, `auth_info_${process.env.PORT || '5000'}`)

global.botStartTime = START_TIME
global.botName = BOT_NAME
global.prefix = PREFIX
global.ownerLid = OWNER_LID
global.sock = null
global.pairingCode = null
global.pairingCodeRequested = false
global.pendingPairingPhone = null
global.botConnected = false
global.latestBaileysVersion = null
global.latestBaileysIsLatest = false

let reconnectAttempts = 0
let isRestarting = false

function hasExistingSession() {
  try {
    if (!fs.existsSync(AUTH_DIR)) return false
    const files = fs.readdirSync(AUTH_DIR)
    return files.some(f => f.includes('creds') || f.endsWith('.json'))
  } catch {
    return false
  }
}

function clearSession() {
  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true })
      console.log('🗑️  Session cleared.')
    }
  } catch (e) {
    console.error('Error clearing session:', e.message)
  }
  global.pairingCode = null
  global.pairingCodeRequested = false
  global.botConnected = false
  global.sock = null
}

function scheduleRestart(delayMs, label) {
  if (isRestarting) return
  isRestarting = true
  console.log(`🔄 ${label} — restarting in ${delayMs / 1000}s…`)
  setTimeout(() => {
    isRestarting = false
    startBot().catch(err => {
      console.error('Restart error:', err.message)
      isRestarting = false
      scheduleRestart(5000, 'Retry after error')
    })
  }, delayMs)
}

function askForPhoneNumber() {
  return new Promise((resolve) => {
    // Auto-resolve after 90s (Render / non-interactive environments)
    const timeout = setTimeout(() => { try { rl.close() } catch {} resolve('') }, 90000)
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.on('close', () => { clearTimeout(timeout); resolve('') })
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📱  SHADOW GARDEN BOT — PAIR A NEW DEVICE')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('Enter your WhatsApp number with country code.')
    console.log('Example: 27821234567  (no + sign, no spaces)')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    rl.question('📞 Phone number: ', (answer) => {
      clearTimeout(timeout)
      rl.close()
      resolve(answer.trim().replace(/\D/g, ''))
    })
  })
}

async function startBot() {
  reconnectAttempts++
  global.pairingCodeRequested = false

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)

  // Only ask for phone number if there is no existing session
  if (!state.creds.registered) {
    // Use env var if set (fastest option — set PHONE_NUMBER on Render)
    const envPhone = (process.env.PHONE_NUMBER || '').replace(/\D/g, '')
    if (envPhone) {
      global.pendingPairingPhone = envPhone
      console.log('📱 Using PHONE_NUMBER from environment:', envPhone)
    } else {
      // Ask in console (works locally); on Render use the web panel instead
      const phone = await askForPhoneNumber()
      if (phone) {
        global.pendingPairingPhone = phone
      } else {
        console.log('\n📱 No number entered — use the web panel at your service URL to pair.\n')
      }
    }
  } else {
    console.log('🔐 Session found — reconnecting to', state.creds.me?.id || 'WhatsApp', '…')
  }

  const { version, isLatest } = await fetchLatestBaileysVersion()
  global.latestBaileysVersion = version
  global.latestBaileysIsLatest = isLatest
  console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`)

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: false,
  })

  global.sock = sock
  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr && !sock.authState.creds.registered && !global.pairingCodeRequested) {
      const phone = global.pendingPairingPhone
      if (!phone) return
      global.pairingCodeRequested = true
      try {
        await new Promise(r => setTimeout(r, 1500))
        console.log(`\n📱 Requesting pairing code for ${phone}…`)
        const code = await sock.requestPairingCode(phone)
        const fmt = code?.match(/.{1,4}/g)?.join('-') ?? code
        global.pairingCode = fmt

        console.log('\n╔══════════════════════════════════════════╗')
        console.log('║       🔑  YOUR PAIRING CODE              ║')
        console.log('╠══════════════════════════════════════════╣')
        console.log(`║          ${fmt.padEnd(34)} ║`)
        console.log('╚══════════════════════════════════════════╝')
        console.log('\n📲 HOW TO PAIR:')
        console.log('   1. Open WhatsApp on your phone')
        console.log('   2. Tap ⋮ (three dots) → Linked Devices')
        console.log('   3. Tap "Link a Device"')
        console.log('   4. Tap "Link with phone number instead"')
        console.log(`   5. Enter code: ${fmt}`)
        console.log('\n🔔 WhatsApp will send you a notification to')
        console.log('   confirm the device pairing. Tap CONFIRM.')
        console.log('⏳ Code expires in 60 seconds.\n')
      } catch (err) {
        global.pairingCodeRequested = false
        console.error('❌ Pairing code error:', err.message)
        scheduleRestart(3000, 'Retry pairing')
      }
    }

    if (connection === 'open') {
      reconnectAttempts = 0
      global.pairingCode = null
      global.pairingCodeRequested = false
      global.pendingPairingPhone = null
      global.botConnected = true
      const botNum = sock.user?.id?.split(':')[0] || sock.user?.id || 'Unknown'
      console.log(`\n✅ Shadow Garden Bot (${BOT_NAME}) is ONLINE! 🌑`)
      console.log(`📱 Bot Number: ${botNum}`)
      console.log(`💡 If this number is admin in a group, the bot can kick/manage members.\n`)
    }

    if (connection === 'connecting') {
      global.botConnected = false
      console.log('🔗 Connecting to WhatsApp…')
    }

    if (connection === 'close') {
      global.botConnected = false
      global.pairingCode = null
      global.pairingCodeRequested = false

      const statusCode = (new Boom(lastDisconnect?.error))?.output?.statusCode
      console.log(`⚠️  Connection closed — status: ${statusCode}`)

      const loggedOut = statusCode === DisconnectReason.loggedOut
      const forbidden = statusCode === 401 || statusCode === 403
      const replaced  = statusCode === DisconnectReason.connectionReplaced
      const timedOut  = statusCode === DisconnectReason.timedOut
      const lost      = statusCode === DisconnectReason.connectionLost
      const closed    = statusCode === DisconnectReason.connectionClosed

      if (loggedOut || forbidden) {
        console.log('🔴 Logged out / rejected. Clearing session…')
        clearSession()
        scheduleRestart(3000, 'Fresh session after logout')
      } else if (replaced) {
        console.log('⚠️  Session replaced by another device.')
        scheduleRestart(5000, 'Reconnect after replace')
      } else if (timedOut) {
        scheduleRestart(2000, 'Reconnect after timeout')
      } else if (lost || closed) {
        const delay = Math.min(reconnectAttempts * 3000, 20000)
        scheduleRestart(delay, `Reconnect after ${statusCode}`)
      } else {
        const delay = Math.min(reconnectAttempts * 3000, 20000)
        scheduleRestart(delay, `Reconnect after close`)
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      try {
        if (msg.key.fromMe) continue
        if (isJidBroadcast(msg.key.remoteJid || '')) continue
        await handleMessage(sock, msg)
      } catch (err) {
        console.error('Message handler error:', err.message)
      }
    }
  })

  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    try {
      const db = require('./database')
      const groupMeta = await sock.groupMetadata(id).catch(() => null)
      if (!groupMeta) return
      const groupSettings = await db.getGroup(id)
      if (!groupSettings) return
      for (const participant of participants) {
        const pushName = participant.split('@')[0]
        if (action === 'add' && groupSettings.welcome) {
          const text = (groupSettings.welcome_msg ||
            `Welcome @${pushName} to *${groupMeta.subject}*! 🌑\n\nType *.menu* to see what Shadow Garden can do.`)
            .replace('<user>', `@${pushName}`).replace('<group>', groupMeta.subject)
          await sock.sendMessage(id, { text, mentions: [participant] })
        } else if (action === 'remove' && groupSettings.leave) {
          const text = (groupSettings.leave_msg || `*${pushName}* has left the group. 👋`).replace('<user>', pushName)
          await sock.sendMessage(id, { text })
        }
      }
    } catch (e) {
      console.error('Group participant update error:', e.message)
    }
  })
}

console.log('🌑 Shadow Garden Bot starting…')

if (hasExistingSession()) {
  console.log('🔐 Existing session found — resuming without clearing.')
  console.log('💡 Session is preserved across restarts.')
  console.log('   To re-pair, delete the auth_info folder manually.\n')
} else {
  console.log('📱 No session found — will ask for phone number to pair.\n')
}

startBot().catch(err => {
  console.error('Fatal startup error:', err.message)
  process.exit(1)
})
