const fs   = require('fs')
const path = require('path')

const RESPONSES_FILE = path.join(__dirname, 'responses.json')

function load() {
  try { return JSON.parse(fs.readFileSync(RESPONSES_FILE, 'utf8')) }
  catch { return {} }
}

function save(data) {
  fs.writeFileSync(RESPONSES_FILE, JSON.stringify(data, null, 2), 'utf8')
}

/**
 * getResponse(command, outcome?)
 * Returns a random entry from responses.json for the given command + outcome.
 * Returns null when no entry exists so callers can fall back to hardcoded text.
 */
function getResponse(command, outcome = null) {
  const all   = load()
  const entry = all[command]
  if (entry == null) return null

  let pool
  if (outcome && typeof entry === 'object' && !Array.isArray(entry)) {
    pool = entry[outcome]
  } else if (Array.isArray(entry)) {
    pool = entry
  } else if (typeof entry === 'string') {
    return entry
  } else {
    return null
  }

  if (!Array.isArray(pool) || pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * fillTemplate(template, data)
 * Replaces {placeholder} tokens with values from the data object.
 */
function fillTemplate(template, data = {}) {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(data, key) ? String(data[key]) : match
  )
}

/**
 * editResponse(command, outcome, text)
 * Persists a new response string for a command+outcome into responses.json.
 * Called by the owner-only .edit command.
 */
function editResponse(command, outcome, text) {
  const all = load()
  if (outcome) {
    if (typeof all[command] !== 'object' || Array.isArray(all[command])) {
      all[command] = {}
    }
    all[command][outcome] = [text]
  } else {
    all[command] = [text]
  }
  save(all)
}

module.exports = { getResponse, fillTemplate, editResponse }
