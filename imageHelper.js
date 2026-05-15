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
  if (buffer.length < 100) throw new Error('Downloaded file is too small - likely a broken or empty file.')

  return { buffer, mimeType: mime }
}

/**
 * Sends a message with an image/GIF that MUST come from the given URL.
 * - GIFs are sent as video with gifPlayback:true so they animate in WhatsApp
 * - On ANY failure, sends an explicit error notification
 */
async function sendWithImage(sock, jid, msg, imageUrl, caption, reply) {
  if (!imageUrl) {
    await reply(`${caption}\n\n---------------\n\n⚠️ *IMAGE UNAVAILABLE*\nThis card has no image stored in the database.\n\n📌 Staff can re-upload it with *.upload*`)
    return false
  }

  let buffer, mimeType
  try {
    const result = await downloadImage(imageUrl)
    buffer = result.buffer
    mimeType = result.mimeType
  } catch (err) {
    await reply(`${caption}\n\n---------------\n\n❌ *IMAGE FAILED TO LOAD*\n📌 Reason: ${err.message}\n\n💡 Staff can fix this with *.upload*\n\n_Card info shown above is accurate - only the image failed._ 🖤`)
    return false
  }

  // GIF cards - send as animated video so WhatsApp plays them
  const isGif = mimeType === 'image/gif' || imageUrl.toLowerCase().endsWith('.gif')

  try {
    if (isGif) {
      // mimetype must be video/mp4 (not image/gif) for gifPlayback to work in WhatsApp
      await sock.sendMessage(jid, {
        video: buffer,
        gifPlayback: true,
        mimetype: 'video/mp4',
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
    // GIF fallback: try sending as plain image
    if (isGif) {
      try {
        await sock.sendMessage(jid, { image: buffer, caption }, { quoted: msg })
        return true
      } catch {}
    }
    await reply(`${caption}\n\n---------------\n\n❌ *IMAGE SEND FAILED*\n📌 Reason: ${sendErr.message}\n\n_Card info shown above is accurate._ 🖤`)
    return false
  }
}

module.exports = { downloadImage, sendWithImage }
