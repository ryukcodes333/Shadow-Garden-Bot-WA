const axios = require('axios')

/**
 * Downloads an image URL to a Buffer.
 * Returns { buffer, mimeType } on success, throws with a clear message on failure.
 */
async function downloadImage(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    throw new Error('Invalid or missing image URL stored for this card.')
  }
  let res
  try {
    res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ShadowGardenBot/1.0)',
      },
    })
  } catch (err) {
    if (err.code === 'ECONNABORTED') throw new Error('Image download timed out (15s). The server took too long.')
    if (err.response?.status === 404) throw new Error(`Image not found (404). The file may have been deleted from its host.`)
    if (err.response?.status === 403) throw new Error(`Image access denied (403). The host is blocking bot requests.`)
    throw new Error(`Image download failed: ${err.message}`)
  }

  const mime = res.headers['content-type'] || 'image/jpeg'
  if (!mime.startsWith('image/') && !mime.startsWith('video/')) {
    throw new Error(`URL did not return an image (got "${mime}"). The stored URL may be broken.`)
  }

  const buffer = Buffer.from(res.data)
  if (buffer.length < 100) throw new Error('Downloaded file is too small — likely a broken or empty file.')

  return { buffer, mimeType: mime }
}

/**
 * Sends a message with an image that MUST come from the given URL.
 * - Downloads the image to a buffer first (reliable)
 * - Sends as image with caption, quoting the trigger message
 * - On ANY failure, sends an explicit error notification — never silent fallback
 *
 * @param {object} sock - Baileys socket
 * @param {string} jid - Chat JID
 * @param {object} msg - Original trigger message (for quoting)
 * @param {string} imageUrl - The card image URL
 * @param {string} caption - The text caption to send with the image
 * @param {function} reply - The ctx.reply function (for error reporting)
 * @returns {boolean} true if image was sent, false if it failed (error was reported)
 */
async function sendWithImage(sock, jid, msg, imageUrl, caption, reply) {
  if (!imageUrl) {
    await reply(`${caption}\n\n━━━━━━━━━━━━━━━\n\n⚠️ *IMAGE UNAVAILABLE*\nThis card has no image stored in the database.\n\n📌 Staff can re-upload it with *.upload*`)
    return false
  }

  let buffer, mimeType
  try {
    const result = await downloadImage(imageUrl)
    buffer = result.buffer
    mimeType = result.mimeType
  } catch (err) {
    await reply(`${caption}\n\n━━━━━━━━━━━━━━━\n\n❌ *IMAGE FAILED TO LOAD*\n📌 Reason: ${err.message}\n\n💡 Staff can fix this with *.upload*\n\n_Card info shown above is accurate — only the image failed._ 🖤`)
    return false
  }

  // GIF cards (stored as image/gif) — send as animated video
  const isGif = mimeType === 'image/gif' || imageUrl.endsWith('.gif')

  try {
    if (isGif) {
      await sock.sendMessage(jid, {
        video: buffer,
        gifPlayback: true,
        mimetype: 'image/gif',
        caption,
      }, { quoted: msg })
    } else {
      await sock.sendMessage(jid, {
        image: buffer,
        mimetype: mimeType,
        caption,
      }, { quoted: msg })
    }
    return true
  } catch (sendErr) {
    await reply(`${caption}\n\n━━━━━━━━━━━━━━━\n\n❌ *IMAGE SEND FAILED*\n📌 Reason: ${sendErr.message}\n\n_Card info shown above is accurate._ 🖤`)
    return false
  }
}

module.exports = { downloadImage, sendWithImage }
