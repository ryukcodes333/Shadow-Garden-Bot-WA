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
<title>Shadow Garden — Bot Panel</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #06060d;
    --surface:   #0d0d18;
    --surface2:  #12121f;
    --border:    rgba(139,92,246,0.18);
    --border2:   rgba(139,92,246,0.35);
    --purple:    #8b5cf6;
    --purple2:   #6d28d9;
    --purple3:   #4c1d95;
    --glow:      rgba(139,92,246,0.45);
    --text:      #e2e8f0;
    --muted:     #64748b;
    --muted2:    #94a3b8;
    --green:     #10b981;
    --red:       #ef4444;
    --gold:      #f59e0b;
  }

  html { scroll-behavior: smooth; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Inter', sans-serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    overflow-x: hidden;
    position: relative;
  }

  /* ── Background particles ── */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 50% at 20% 20%, rgba(109,40,217,0.12) 0%, transparent 60%),
      radial-gradient(ellipse 60% 40% at 80% 80%, rgba(139,92,246,0.08) 0%, transparent 60%),
      radial-gradient(ellipse 40% 60% at 50% 50%, rgba(76,29,149,0.06) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  .orb {
    position: fixed;
    border-radius: 50%;
    filter: blur(80px);
    pointer-events: none;
    z-index: 0;
    animation: float 8s ease-in-out infinite;
  }
  .orb1 { width: 300px; height: 300px; background: rgba(109,40,217,0.12); top: -80px; left: -80px; animation-delay: 0s; }
  .orb2 { width: 200px; height: 200px; background: rgba(139,92,246,0.08); bottom: -60px; right: -60px; animation-delay: 3s; }
  .orb3 { width: 150px; height: 150px; background: rgba(76,29,149,0.10); top: 40%; left: 60%; animation-delay: 5s; }

  @keyframes float {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33%       { transform: translate(20px, -20px) scale(1.05); }
    66%       { transform: translate(-10px, 15px) scale(0.97); }
  }

  /* ── Card ── */
  .card {
    position: relative;
    z-index: 1;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 24px;
    padding: 44px 40px;
    max-width: 480px;
    width: 100%;
    box-shadow:
      0 0 0 1px rgba(139,92,246,0.06),
      0 4px 6px rgba(0,0,0,0.4),
      0 20px 60px rgba(0,0,0,0.5),
      0 0 80px rgba(109,40,217,0.08);
    animation: cardIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes cardIn {
    from { opacity: 0; transform: translateY(32px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* Subtle top border glow */
  .card::before {
    content: '';
    position: absolute;
    top: 0; left: 10%; right: 10%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(139,92,246,0.7), transparent);
    border-radius: 1px;
  }

  /* ── Header ── */
  .header {
    text-align: center;
    margin-bottom: 32px;
  }

  .brand-icon {
    width: 72px;
    height: 72px;
    margin: 0 auto 16px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .brand-icon-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 1.5px solid rgba(139,92,246,0.4);
    animation: spin 12s linear infinite;
  }
  .brand-icon-ring::after {
    content: '';
    position: absolute;
    top: -3px; left: 50%;
    transform: translateX(-50%);
    width: 6px; height: 6px;
    background: var(--purple);
    border-radius: 50%;
    box-shadow: 0 0 8px var(--purple);
  }

  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  .brand-icon-inner {
    font-size: 2rem;
    position: relative;
    z-index: 1;
    filter: drop-shadow(0 0 12px rgba(139,92,246,0.8));
    animation: pulse-icon 3s ease-in-out infinite;
  }

  @keyframes pulse-icon {
    0%, 100% { filter: drop-shadow(0 0 10px rgba(139,92,246,0.7)); }
    50%       { filter: drop-shadow(0 0 20px rgba(139,92,246,1)) drop-shadow(0 0 40px rgba(109,40,217,0.5)); }
  }

  .brand-name {
    font-size: 1.65rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    background: linear-gradient(135deg, #c4b5fd 0%, #8b5cf6 50%, #6d28d9 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 4px;
  }

  .brand-sub {
    font-size: 0.78rem;
    color: var(--muted);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-weight: 500;
  }

  /* ── Status badge ── */
  .status-wrap {
    display: flex;
    justify-content: center;
    margin-bottom: 28px;
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 18px;
    border-radius: 100px;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    transition: all 0.4s ease;
  }

  .status-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status.online  { background: rgba(16,185,129,0.12); color: #34d399; border: 1px solid rgba(16,185,129,0.3); }
  .status.online  .status-dot { background: #10b981; box-shadow: 0 0 6px #10b981; animation: blink 2s ease-in-out infinite; }

  .status.offline { background: rgba(239,68,68,0.1);  color: #fca5a5; border: 1px solid rgba(239,68,68,0.25); }
  .status.offline .status-dot { background: #ef4444; }

  .status.waiting { background: rgba(139,92,246,0.1); color: #c4b5fd; border: 1px solid rgba(139,92,246,0.25); }
  .status.waiting .status-dot { background: var(--purple); box-shadow: 0 0 6px var(--purple); animation: blink 1.2s ease-in-out infinite; }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }

  /* ── Connected panel ── */
  #pairedPanel {
    display: none;
    text-align: center;
    padding: 24px;
    background: rgba(16,185,129,0.06);
    border: 1px solid rgba(16,185,129,0.2);
    border-radius: 16px;
    margin-bottom: 0;
    animation: fadeIn 0.5s ease both;
  }

  .paired-icon { font-size: 2.5rem; margin-bottom: 10px; display: block; }
  .paired-title { font-size: 1.1rem; font-weight: 700; color: #34d399; margin-bottom: 6px; }
  .paired-sub { font-size: 0.82rem; color: var(--muted2); }

  /* ── Form ── */
  #pairPanel { animation: fadeIn 0.4s ease both; }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .input-wrap {
    position: relative;
    margin-bottom: 12px;
  }

  .input-icon {
    position: absolute;
    left: 14px; top: 50%;
    transform: translateY(-50%);
    font-size: 1rem;
    pointer-events: none;
    opacity: 0.5;
  }

  .input-wrap input {
    width: 100%;
    background: var(--surface2);
    border: 1px solid rgba(139,92,246,0.2);
    border-radius: 12px;
    padding: 13px 16px 13px 40px;
    color: var(--text);
    font-size: 0.95rem;
    font-family: 'Inter', sans-serif;
    outline: none;
    transition: border-color 0.25s, box-shadow 0.25s;
  }

  .input-wrap input::placeholder { color: var(--muted); }

  .input-wrap input:focus {
    border-color: var(--purple);
    box-shadow: 0 0 0 3px rgba(139,92,246,0.15);
  }

  .btn {
    width: 100%;
    padding: 14px;
    border-radius: 12px;
    border: none;
    font-size: 0.95rem;
    font-weight: 700;
    font-family: 'Inter', sans-serif;
    cursor: pointer;
    transition: all 0.25s;
    position: relative;
    overflow: hidden;
    letter-spacing: 0.01em;
  }

  .btn-primary {
    background: linear-gradient(135deg, #7c3aed, #5b21b6);
    color: #fff;
    box-shadow: 0 4px 20px rgba(109,40,217,0.4);
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 28px rgba(109,40,217,0.55);
    background: linear-gradient(135deg, #8b5cf6, #6d28d9);
  }

  .btn-primary:active:not(:disabled) { transform: translateY(0); }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  /* Ripple effect on button */
  .btn::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(255,255,255,0.07) 0%, transparent 100%);
    border-radius: inherit;
  }

  /* ── Pairing code card ── */
  #codeCard {
    display: none;
    background: var(--surface2);
    border: 1px solid var(--border2);
    border-radius: 18px;
    padding: 24px;
    margin-bottom: 16px;
    position: relative;
    overflow: hidden;
    animation: fadeIn 0.4s ease both;
  }

  #codeCard::before {
    content: '';
    position: absolute;
    top: 0; left: 15%; right: 15%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(139,92,246,0.6), transparent);
  }

  .code-label {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 14px;
    text-align: center;
  }

  #pairingCode {
    display: block;
    text-align: center;
    font-family: 'JetBrains Mono', monospace;
    font-size: 2.6rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    color: #f0e6ff;
    background: rgba(139,92,246,0.08);
    border: 1px solid rgba(139,92,246,0.25);
    border-radius: 12px;
    padding: 16px 20px;
    margin-bottom: 6px;
    text-shadow: 0 0 20px rgba(139,92,246,0.5);
    animation: glow-code 2.5s ease-in-out infinite;
  }

  @keyframes glow-code {
    0%, 100% { text-shadow: 0 0 16px rgba(139,92,246,0.4); }
    50%       { text-shadow: 0 0 28px rgba(139,92,246,0.8), 0 0 50px rgba(109,40,217,0.3); }
  }

  .code-expiry {
    text-align: center;
    font-size: 0.74rem;
    color: var(--muted);
    margin-bottom: 18px;
  }

  .steps {
    background: rgba(0,0,0,0.2);
    border-radius: 10px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .step {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 0.8rem;
    color: var(--muted2);
    line-height: 1.4;
  }

  .step-num {
    min-width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(139,92,246,0.2);
    border: 1px solid rgba(139,92,246,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.68rem;
    font-weight: 700;
    color: #c4b5fd;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .step strong { color: #e2e8f0; }

  /* ── Toast messages ── */
  #msg {
    min-height: 24px;
    margin: 12px 0 0;
    font-size: 0.82rem;
    text-align: center;
    transition: all 0.3s ease;
  }

  .toast {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 100px;
    font-weight: 500;
  }

  .toast.success { background: rgba(16,185,129,0.12); color: #34d399; }
  .toast.error   { background: rgba(239,68,68,0.12);  color: #fca5a5; }
  .toast.info    { background: rgba(139,92,246,0.12); color: #c4b5fd; }

  /* ── Divider ── */
  .divider {
    border: none;
    border-top: 1px solid rgba(255,255,255,0.05);
    margin: 28px 0 20px;
  }

  /* ── Footer ── */
  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.72rem;
    color: rgba(255,255,255,0.15);
  }

  .footer span { letter-spacing: 0.04em; }

  .version-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: rgba(139,92,246,0.4);
    display: inline-block;
    margin: 0 6px;
    vertical-align: middle;
  }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.3); border-radius: 4px; }

  /* ── Input label ── */
  .field-label {
    font-size: 0.75rem;
    color: var(--muted2);
    font-weight: 500;
    margin-bottom: 7px;
    display: block;
    letter-spacing: 0.02em;
  }

  /* ── Responsive ── */
  @media (max-width: 520px) {
    .card { padding: 32px 24px; }
    #pairingCode { font-size: 2rem; letter-spacing: 0.12em; }
  }
</style>
</head>
<body>
<div class="orb orb1"></div>
<div class="orb orb2"></div>
<div class="orb orb3"></div>

<div class="card">

  <!-- Header -->
  <div class="header">
    <div class="brand-icon">
      <div class="brand-icon-ring"></div>
      <span class="brand-icon-inner">🌑</span>
    </div>
    <div class="brand-name">Shadow Garden</div>
    <div class="brand-sub">Bot Control Panel</div>
  </div>

  <!-- Status -->
  <div class="status-wrap">
    <div class="status waiting" id="statusBadge">
      <span class="status-dot"></span>
      <span id="statusText">Connecting…</span>
    </div>
  </div>

  <!-- Connected panel -->
  <div id="pairedPanel">
    <span class="paired-icon">✅</span>
    <div class="paired-title">Bot is Online</div>
    <div class="paired-sub">Shadow Garden is active and listening to messages.</div>
  </div>

  <!-- Pairing code display -->
  <div id="codeCard">
    <div class="code-label">🔑 Your Pairing Code</div>
    <span id="pairingCode">— — — —</span>
    <div class="code-expiry">⏳ Enter this code in WhatsApp within 60 seconds</div>
    <div class="steps">
      <div class="step"><span class="step-num">1</span><span>Open <strong>WhatsApp</strong> on your phone</span></div>
      <div class="step"><span class="step-num">2</span><span>Tap <strong>⋮ Menu</strong> (Android) or <strong>Settings</strong> (iPhone)</span></div>
      <div class="step"><span class="step-num">3</span><span>Go to <strong>Linked Devices → Link a Device</strong></span></div>
      <div class="step"><span class="step-num">4</span><span>Tap <strong>"Link with phone number instead"</strong> at the bottom</span></div>
      <div class="step"><span class="step-num">5</span><span>Type the code shown above ⬆️</span></div>
    </div>
  </div>

  <!-- Pair form -->
  <div id="pairPanel">
    <label class="field-label" for="phoneInput">WhatsApp number — country code, no + or spaces</label>
    <div class="input-wrap">
      <span class="input-icon">📱</span>
      <input type="tel" id="phoneInput" placeholder="e.g. 2348012345678 or 447466159480"
             onkeydown="if(event.key==='Enter') requestCode()" />
    </div>
    <button class="btn btn-primary" id="pairBtn" onclick="requestCode()">
      Get Pairing Code
    </button>
  </div>

  <div id="msg"></div>

  <hr class="divider">

  <div class="footer">
    <span>Shadow Garden Bot</span>
    <span><span class="version-dot"></span>Alpha v2.0<span class="version-dot"></span></span>
  </div>

</div>

<script>
let lastCode = null;
let lastConnected = false;

function setMsg(text, type) {
  const el = document.getElementById('msg');
  const icons = { success: '✓', error: '✕', info: '◈' };
  el.innerHTML = '<span class="toast ' + type + '">' + (icons[type] || '') + ' ' + text + '</span>';
  setTimeout(() => {
    if (el.innerHTML.includes(text)) el.innerHTML = '';
  }, 5000);
}

async function requestCode() {
  const phone = document.getElementById('phoneInput').value.trim().replace(/\\D/g, '');
  if (!phone || phone.length < 7) {
    setMsg('Enter a valid number with country code — no + or spaces.', 'error');
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
      setMsg('Code incoming — appears below in a few seconds.', 'info');
    } else {
      setMsg(data.error || 'Failed to request code. Try again.', 'error');
      btn.disabled = false;
      btn.textContent = 'Get Pairing Code';
    }
  } catch (e) {
    setMsg('Network error — is the bot running?', 'error');
    btn.disabled = false;
    btn.textContent = 'Get Pairing Code';
  }
}

async function checkStatus() {
  try {
    const res  = await fetch('status');
    const data = await res.json();

    const badge      = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');
    const dot        = badge.querySelector('.status-dot');
    const codeCard   = document.getElementById('codeCard');
    const pairPanel  = document.getElementById('pairPanel');
    const pairedPanel= document.getElementById('pairedPanel');

    if (data.connected) {
      badge.className = 'status online';
      statusText.textContent = 'Online';
      codeCard.style.display = 'none';
      pairPanel.style.display = 'none';
      pairedPanel.style.display = 'block';
      if (!lastConnected) setMsg('Successfully linked!', 'success');
      lastConnected = true;
      return;
    }

    lastConnected = false;
    pairedPanel.style.display = 'none';
    pairPanel.style.display = 'block';

    if (data.pairingCode) {
      badge.className = 'status waiting';
      statusText.textContent = 'Awaiting Pairing…';
      codeCard.style.display = 'block';
      if (data.pairingCode !== lastCode) {
        lastCode = data.pairingCode;
        document.getElementById('pairingCode').textContent = data.pairingCode;
        const btn = document.getElementById('pairBtn');
        btn.textContent = 'Request New Code';
        btn.disabled = false;
        setMsg('Enter this code in WhatsApp now.', 'info');
      }
    } else {
      badge.className = 'status waiting';
      statusText.textContent = 'Ready to Pair';
      codeCard.style.display = 'none';
      lastCode = null;
    }
  } catch (e) {
    const badge = document.getElementById('statusBadge');
    badge.className = 'status offline';
    document.getElementById('statusText').textContent = 'Panel Unreachable';
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

  global.pendingPairingPhone = phone
  global.pairingCodeRequested = false
  global.pairingCode = null

  try {
    await new Promise(r => setTimeout(r, 800))
    console.log(`📱 Requesting pairing code for \${phone}…`)
    const code = await sock.requestPairingCode(phone)
    const fmt = code?.match(/.{1,4}/g)?.join('-') ?? code
    global.pairingCode = fmt
    global.pairingCodeRequested = true
    console.log(`\\n🔑 PAIRING CODE : \${fmt}`)
    console.log(`📲 WhatsApp → Linked Devices → Link a Device → Link with phone number → \${fmt}\\n`)
    return res.json({ ok: true, code: fmt })
  } catch (err) {
    global.pairingCodeRequested = false
    console.error('Pairing code error:', err.message)
    return res.json({ ok: false, error: 'Bot not in pairing mode yet. Wait for it to fully start, then try again.' })
  }
})

app.get('/ping', (req, res) => res.json({ status: 'alive', ts: Date.now() }))

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\\n🌐 Shadow Garden Web Panel → http://localhost:\${PORT}\\n`)
})

// Keep-alive ping for Render free tier (every 5 min)
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:\${PORT}`
const SHOOB_URL  = (process.env.SHOOB_API_URL || '').replace(/\/$/, '')

function keepAlivePing(url, label) {
  try {
    const httpLib = url.startsWith('https') ? require('https') : require('http')
    httpLib.get(`\${url}/ping`, (r) => r.resume()).on('error', () => {})
  } catch {}
}

setInterval(() => {
  keepAlivePing(RENDER_URL, 'bot')
  if (SHOOB_URL) keepAlivePing(SHOOB_URL, 'shoob-api')
}, 5 * 60 * 1000)

module.exports = app
