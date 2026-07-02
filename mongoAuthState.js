const mongoose = require('mongoose')

let baileys
try { baileys = require('@whiskeysockets/baileys') }
catch { baileys = require('baileys') }

const { initAuthCreds, BufferJSON } = baileys
const proto = baileys.proto

// ── Mongoose models (registered once, reused on reconnects) ─────────────────

const CredsSchema = new mongoose.Schema(
  { _id: String, creds: mongoose.Schema.Types.Mixed },
  { _id: false }
)
const KeySchema = new mongoose.Schema(
  { _id: String, value: mongoose.Schema.Types.Mixed },
  { _id: false }
)

const WaCreds = mongoose.models.WaCreds || mongoose.model('WaCreds', CredsSchema, 'wa_auth_creds')
const WaKeys  = mongoose.models.WaKeys  || mongoose.model('WaKeys',  KeySchema,  'wa_auth_keys')

// ── Auth state factory ───────────────────────────────────────────────────────

async function useMongoAuthState(sessionId = 'main') {
  // Load or initialise credentials
  const credsDoc = await WaCreds.findById(sessionId).lean()
  const creds = credsDoc
    ? JSON.parse(JSON.stringify(credsDoc.creds), BufferJSON.reviver)
    : initAuthCreds()

  const saveCreds = async () => {
    const serialized = JSON.parse(JSON.stringify(creds, BufferJSON.replacer))
    await WaCreds.findByIdAndUpdate(
      sessionId,
      { _id: sessionId, creds: serialized },
      { upsert: true }
    )
  }

  const keys = {
    async get(type, ids) {
      const result  = {}
      const docIds  = ids.map(id => `${sessionId}::${type}::${id}`)
      const docs    = await WaKeys.find({ _id: { $in: docIds } }).lean()
      const prefix  = `${sessionId}::${type}::`
      for (const doc of docs) {
        const id  = doc._id.slice(prefix.length)
        let value = JSON.parse(JSON.stringify(doc.value), BufferJSON.reviver)
        if (type === 'app-state-sync-key' && value && proto?.Message?.AppStateSyncKeyData) {
          value = proto.Message.AppStateSyncKeyData.fromObject(value)
        }
        result[id] = value
      }
      return result
    },

    async set(data) {
      const ops = []
      for (const [type, ids] of Object.entries(data || {})) {
        for (const [id, value] of Object.entries(ids || {})) {
          const docId = `${sessionId}::${type}::${id}`
          if (value != null) {
            const serialized = JSON.parse(JSON.stringify(value, BufferJSON.replacer))
            ops.push({
              updateOne: {
                filter: { _id: docId },
                update:  { $set: { _id: docId, value: serialized } },
                upsert:  true,
              },
            })
          } else {
            ops.push({ deleteOne: { filter: { _id: docId } } })
          }
        }
      }
      if (ops.length) await WaKeys.bulkWrite(ops)
    },
  }

  return { state: { creds, keys }, saveCreds }
}

// ── Wipe session from MongoDB (called on logout) ─────────────────────────────

async function clearMongoAuthState(sessionId = 'main') {
  await WaCreds.deleteOne({ _id: sessionId })
  await WaKeys.deleteMany({ _id: new RegExp(`^${sessionId}::`) })
}

module.exports = { useMongoAuthState, clearMongoAuthState }
