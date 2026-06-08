const mongoose = require('mongoose')
const { BufferJSON, initAuthCreds, proto } = require('@whiskeysockets/baileys')

// ══════════════════════════════════════════════════════════════
// MONGO AUTH — reuses mongoose connection from database.js
// Collection: bot_auth  Fields: key (string), value (string)
// ══════════════════════════════════════════════════════════════

async function _col() {
    let attempts = 0
    while (mongoose.connection.readyState !== 1) {
        if (attempts++ > 20) throw new Error('[Auth] MongoDB not ready after 10s')
        await new Promise(r => setTimeout(r, 500))
    }
    return mongoose.connection.db.collection('bot_auth')
}

async function _readAuth(key) {
    try {
        const col = await _col()
        const doc = await col.findOne({ key })
        if (!doc) return null
        return JSON.parse(doc.value, BufferJSON.reviver)
    } catch { return null }
}

async function _writeAuth(key, value) {
    try {
        const col = await _col()
        await col.updateOne(
            { key },
            { $set: { key, value: JSON.stringify(value, BufferJSON.replacer) } },
            { upsert: true }
        )
    } catch (e) { console.error('[Auth] Write failed:', e.message) }
}

async function _deleteAuth(key) {
    try {
        const col = await _col()
        await col.deleteOne({ key })
    } catch {}
}

async function clearMongoAuth() {
    try {
        const col = await _col()
        await col.deleteMany({})
        console.log('🗑️ MongoDB auth cleared.')
    } catch (e) { console.error('🗑️ Clear failed:', e.message) }
}

async function useMongoAuthState() {
    let creds = await _readAuth('creds')
    if (!creds) creds = initAuthCreds()

    const keys = {}

    const state = {
        creds,
        keys: {
            get: async (type, ids) => {
                const data = {}
                for (const id of ids) {
                    let value = keys[`${type}-${id}`]
                    if (!value) value = await _readAuth(`key-${type}-${id}`)
                    if (value) {
                        if (type === 'app-state-sync-key') {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value)
                            if (value.keyData && !Buffer.isBuffer(value.keyData))
                                value.keyData = Buffer.from(Object.values(value.keyData))
                            if (value.timestamp && typeof value.timestamp === 'object')
                                value.timestamp = value.timestamp
                        }
                        data[id] = value
                    }
                }
                return data
            },
            set: async (data) => {
                const tasks = []
                for (const category of Object.keys(data)) {
                    for (const id of Object.keys(data[category])) {
                        const value = data[category][id]
                        const dbKey = `key-${category}-${id}`
                        if (value) {
                            keys[`${category}-${id}`] = value
                            tasks.push(_writeAuth(dbKey, value))
                        } else {
                            delete keys[`${category}-${id}`]
                            tasks.push(_deleteAuth(dbKey))
                        }
                    }
                }
                await Promise.all(tasks)
            },
        },
    }

    const saveCreds = async () => { await _writeAuth('creds', state.creds) }

    return { state, saveCreds }
}

module.exports = { useMongoAuthState, clearMongoAuth }
