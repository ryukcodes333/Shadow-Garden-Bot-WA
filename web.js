const express = require('express')
const path    = require('path')
const app     = express()
const PORT    = process.env.PORT || 3000

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, '../public')))

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Shadow Garden Bot</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0a0f; color: #e2e8f0; font-family: 'Segoe UI', sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .container { background: #13131a; border: 1px solid #2d2d3d; border-radius: 16px; padding: 36px 32px; max-width: 520px; width: 100%; text-align: center; box-shadow: 0 0 40px rgba(139,92,246,0.18); }
  .logo { font-size: 2.8rem; margin-bottom: 8px; }
  h1 { font-size: 1.7rem; font-weight: 700; color: #a78bfa; margin-bottom: 6px; }
  .subtitle { color: #64748b; font-size: 0.9rem; margin-bottom: 28px; }

  .status-wrap { margin-bottom: 22px; }
  .status { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 0.83rem; font-weight: 600; }
  .status.online     { background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.3); }
  .status.offline    { background: rgba(239,68,68,0.15);  color: #ef4444; border: 1px solid rgba(239,68,68,0.3); }
  .status.waiting    { background: rgba(99,102,241,0.15); color: #818cf8; border: 1px solid rgba(99,102,241,0.3); }
  .online-msg { color: #34d399; font-size: 0.88rem; margin-top: 8px; }

  /* Form */
  .form-section { text-align: left; margin-bottom: 18px; }
  .form-section label { color: #94a3b8; font-size: 0.82rem; display: block; margin-bottom: 6px; }
  .form-section input { width: 100%; background: #0f0f1c; border: 1px solid #2d2d3d; border-radius: 8px; padding: 11px 14px; color: #e2e8f0; font-size: 1rem; outline: none; transition: border 0.2s; }
  .form-section input:focus { border-color: #7c3aed; }
  .form-section button { width: 100%; margin-top: 10px; background: #7c3aed; color: #fff; border: none; border-radius: 8px; padding: 12px; font-size: 0.95rem; font-weight: 700; cursor: pointer; transition: background 0.2s; }
  .form-section button:hover { background: #6d28d9; }
  .form-section button:disabled { background: #3d2070; cursor: not-allowed; }

  /* Pairing Code Display */
  #codeCard { display: none; background: #0f0f1c; border: 2px solid #7c3aed; border-radius: 14px; padding: 22px 20px; margin-bottom: 16px; }
  #codeCard h2 { color: #c4b5fd; font-size: 1rem; margin-bottom: 8px; }
  #pairingCode { font-size: 2.8rem; font-weight: 800; letter-spacing: 12px; color: #f0e6ff; font-family: 'Courier New', monospace; background: #1a0a2e; border-radius: 10px; padding: 16px 20px; display: block; margin: 0 auto 14px; border: 1px solid #5b21b6; min-width: 220px; }
  .steps { text-align: left; font-size: 0.8rem; color: #94a3b8; line-height: 1.8; background: #13131f; border-radius: 8px; padding: 12px 16px; }
  .steps b { color: #c4b5fd; }
  .steps .note { color: #6366f1; font-size: 0.76rem; margin-top: 8px; display: block; }

  #msg { margin: 10px 0; font-size: 0.84rem; min-height: 20px; }
  .success { color: #34d399; }
  .error   { color: #f87171; }
  .info    { color: #818cf8; }

  .divider { border: none; border-top: 1px solid #1e1e2e; margin: 22px 0; }
  .foot { color: #2d2d3d; font-size: 0.72rem; }
</style>
</head>
<body>
<div class="container">
  <div class="logo">🌑</div>
  <h1>Shadow Garden Bot</h1>
  <p class="subtitle">Alpha &bull; Powered by Baileys</p>

  <div class="status-wrap">
    <span class="status waiting" id="statusBadge">⏳ Connecting…</span>
    <div class="online-msg" id="onlineMsg"></div>
  </div>

  <div id="codeCard">
    <h2>🔑 Pairing Code</h2>
    <span id="pairingCode">— — — —</span>
    <div class="steps">
      <b>Steps on your phone:</b><br>
      1. Open <b>WhatsApp</b><br>
      2. Tap <b>⋮ Menu</b> (Android) or <b>Settings</b> (iPhone)<br>
      3. Tap <b>Linked Devices → Link a Device</b><br>
      4. When the camera opens, tap <b>"Link with phone number instead"</b> at the bottom<br>
      5. Type the code shown above ⬆️
      <span class="note">⚡ WhatsApp will send a notification to your phone when the pairing code is requested.</span>
    </div>
  </div>

  <div id="pairedMsg" style="display:none; color:#34d399; font-size:0.9rem; margin-bottom:16px;">✅ Bot is connected and active!</div>

  <div id="formSection" class="form-section">
    <label>Your WhatsApp number — include country code, no + or spaces</label>
    <input type="tel" id="phoneInput" placeholder="e.g. 447466159480 or 2348012345678" />
    <button id="pairBtn" onclick="requestCode()">📲 Get Pairing Code</button>
  </div>

  <div id="msg"></div>

  <hr class="divider">
  <div class="foot">Shadow Garden Bot Panel</div>
</div>

<script>
let lastCode = null;
let lastConnected = false;

function setMsg(text, cls) {
  const el = document.getElementById('msg');
  el.innerHTML = '<p class="' + cls + '">' + text + '</p>';
}

async function requestCode() {
  const phone = document.getElementById('phoneInput').value.trim().replace(/\\D/g, '');
  if (!phone || phone.length < 7) {
    setMsg('Enter a valid number with country code (no + or spaces).', 'error');
    return;
  }
  const btn = document.getElementById('pairBtn');
  btn.disabled = true;
  btn.textContent = 'Requesting…';
  setMsg('Contacting WhatsApp — your phone will receive a notification…', 'info');

  try {
    const res = await fetch('request-pairing-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await res.json();
    if (data.ok) {
      setMsg('Code requested! It will appear below in a few seconds.', 'info');
    } else {
      setMsg(data.error || 'Failed to request code. Try again.', 'error');
      btn.disabled = false;
      btn.textContent = '📲 Get Pairing Code';
    }
  } catch (e) {
    setMsg('Network error — is the bot running?', 'error');
    btn.disabled = false;
    btn.textContent = '📲 Get Pairing Code';
  }
}

async function checkStatus() {
  try {
    const res = await fetch('status');
    const data = await res.json();

    const badge   = document.getElementById('statusBadge');
    const codeCard = document.getElementById('codeCard');
    const formSection = document.getElementById('formSection');
    const pairedMsg = document.getElementById('pairedMsg');

    if (data.connected) {
      badge.className = 'status online';
      badge.textContent = '● Online';
      document.getElementById('onlineMsg').textContent = '';
      codeCard.style.display = 'none';
      formSection.style.display = 'none';
      pairedMsg.style.display = 'block';
      if (!lastConnected) setMsg('✅ Successfully linked!', 'success');
      lastConnected = true;
      return;
    }

    lastConnected = false;
    pairedMsg.style.display = 'none';
    formSection.style.display = 'block';

    if (data.pairingCode) {
      badge.className = 'status waiting';
      badge.textContent = '⏳ Awaiting pairing…';
      codeCard.style.display = 'block';
      if (data.pairingCode !== lastCode) {
        lastCode = data.pairingCode;
        document.getElementById('pairingCode').textContent = data.pairingCode;
        document.getElementById('pairBtn').textContent = 'Get New Code';
        document.getElementById('pairBtn').disabled = false;
        setMsg('Enter this code in WhatsApp within 60 seconds.', 'info');
      }
    } else {
      badge.className = 'status waiting';
      badge.textContent = '⏳ Ready to pair';
      codeCard.style.display = 'none';
      lastCode = null;
    }
  } catch (e) {
    document.getElementById('statusBadge').className = 'status offline';
    document.getElementById('statusBadge').textContent = '● Panel unreachable';
  }
}

checkStatus();
setInterval(checkStatus, 3000);
</script>
</body>
</html>`)
})

// Status endpoint
app.get('/status', (req, res) => {
  res.json({
    connected:   global.botConnected  || false,
    pairingCode: global.pairingCode   || null,
    sockReady:   !!global.sock,
    waVersion:   global.latestBaileysVersion ? global.latestBaileysVersion.join('.') : null,
    uptime:      process.uptime(),
  })
})

// Request pairing code via phone number
app.post('/request-pairing-code', async (req, res) => {
  const phone = (req.body.phone || '').replace(/\D/g, '')
  if (!phone || phone.length < 7) {
    return res.json({ ok: false, error: 'Invalid phone number' })
  }
  if (global.botConnected) {
    return res.json({ ok: false, error: 'Bot is already connected' })
  }

  const sock = global.sock
  if (!sock) {
    return res.json({ ok: false, error: 'Bot not ready yet — wait a moment and try again' })
  }

  // Store phone and reset so the connection.update qr handler picks it up
  global.pendingPairingPhone = phone
  global.pairingCodeRequested = false
  global.pairingCode = null

  // If the socket is already waiting (qr already fired), request immediately
  try {
    await new Promise(r => setTimeout(r, 800))
    console.log(`📱 Requesting pairing code for ${phone}…`)
    const code = await sock.requestPairingCode(phone)
    const fmt = code?.match(/.{1,4}/g)?.join('-') ?? code
    global.pairingCode = fmt
    global.pairingCodeRequested = true
    console.log(`\n🔑 PAIRING CODE : ${fmt}`)
    console.log(`📲 WhatsApp → Linked Devices → Link a Device → Link with phone number → ${fmt}\n`)
    return res.json({ ok: true, code: fmt })
  } catch (err) {
    global.pairingCodeRequested = false
    console.error('Pairing code error:', err.message)
    return res.json({ ok: false, error: 'Bot not in pairing mode yet. Wait for it to fully start, then try again.' })
  }
})

app.get('/ping', (req, res) => res.json({ status: 'alive', ts: Date.now() }))

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🌐 Shadow Garden Web Panel → http://localhost:${PORT}\n`)
})

// Keep-alive ping for Render free tier (every 5 min)
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`
const SHOOB_URL  = (process.env.SHOOB_API_URL || '').replace(/\/$/, '')

function keepAlivePing(url, label) {
  try {
    const httpLib = url.startsWith('https') ? require('https') : require('http')
    httpLib.get(`${url}/ping`, (r) => r.resume()).on('error', () => {
      // Silent — expected when service cold-starts
    })
  } catch {}
}

setInterval(() => {
  keepAlivePing(RENDER_URL, 'bot')
  if (SHOOB_URL) keepAlivePing(SHOOB_URL, 'shoob-api')
}, 5 * 60 * 1000)

module.exports = app
