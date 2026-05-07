// Universal lottery — one active lottery across ALL groups at once
let globalLottery = null

const { generateWAMessageFromContent } = require('@whiskeysockets/baileys')

const DEFAULT_REQUIRED = 20

function buildBar(current, total, len = 12) {
  const filled = Math.round((Math.min(current, total) / total) * len)
  return `[` + `█`.repeat(filled) + `░`.repeat(len - filled) + `] ${current}/${total}`
}

async function sendPollResult(sock, jid, name, votes) {
  try {
    const msg = generateWAMessageFromContent(jid, {
      pollResultSnapshotMessage: {
        name,
        pollVotes: votes,
      },
    }, {})
    await sock.relayMessage(jid, msg.message, { messageId: msg.key.id })
  } catch {
    // fallback: send as text if poll result fails
    const lines = votes.map(v => `• ${v.optionName}: ${v.optionVoteCount}`).join('\n')
    await sock.sendMessage(jid, { text: `📊 *${name}*\n\n${lines}` })
  }
}

async function autoDraw(sock, jid) {
  if (!globalLottery) return
  const entries = [...globalLottery.entries.entries()]
  if (!entries.length) return
  const [winnerJid, winner] = entries[Math.floor(Math.random() * entries.length)]
  const title = globalLottery.title
  const total = entries.length
  const sourceGroup = globalLottery.startedByGroup
  globalLottery = null

  const resultText =
    `🎰 *SHADOW GARDEN LOTTERY — RESULTS*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🏆 *Prize:* ${title}\n` +
    `👥 *Total Participants:* ${total}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🎉 *WINNER: @${winner.phone}*\n\n` +
    `🎊 Congratulations *${winner.name}*!\n` +
    `You have won: *${title}* 🏆\n\n` +
    `_The shadows have chosen… 🖤_`

  await sock.sendMessage(jid, { text: resultText, mentions: [winnerJid] })
  if (sourceGroup && sourceGroup !== jid) {
    await sock.sendMessage(sourceGroup, { text: resultText, mentions: [winnerJid] }).catch(() => {})
  }
}

module.exports = {
  async lotterystart(ctx) {
    const { sock, jid, args, senderJid, isGroup, isOwner, reply, react } = ctx
    if (!isGroup) return reply('⚠️ This command only works in groups.')

    const groupMeta = await sock.groupMetadata(jid).catch(() => null)
    const admins = (groupMeta?.participants || []).filter(p => p.admin).map(p => p.id)
    if (!isOwner && !admins.includes(senderJid)) {
      return reply('⚠️ Only admins can start a lottery.')
    }

    if (globalLottery) {
      const needed = Math.max(0, globalLottery.required - globalLottery.entries.size)
      return reply(
        `⚠️ A lottery is already running!\n\n` +
        `🏆 *Prize:* ${globalLottery.title}\n` +
        `📋 *Required:* ${globalLottery.required} participants\n` +
        `👥 *Joined:* ${globalLottery.entries.size}/${globalLottery.required}\n` +
        `⏳ *Still needed:* ${needed}\n\n` +
        `_Use *.lotterydraw* to draw or *.lotteryend* to cancel._`
      )
    }

    let required = DEFAULT_REQUIRED
    let titleArgs = [...args]
    const lastArg = titleArgs[titleArgs.length - 1]
    if (lastArg && /^\d+$/.test(lastArg) && parseInt(lastArg) >= 2) {
      required = parseInt(lastArg)
      titleArgs = titleArgs.slice(0, -1)
    }

    const title = titleArgs.join(' ').trim()
    if (!title) {
      return reply(
        `⚠️ Usage: *.lotterystart <prize> [required]*\n\n` +
        `Example: _.lotterystart PlayStation 5_\n` +
        `Example with custom count: _.lotterystart PlayStation 5 30_\n\n` +
        `Default required participants: *${DEFAULT_REQUIRED}*`
      )
    }

    globalLottery = {
      title, required,
      entries: new Map(),
      startedBy: senderJid,
      startedByGroup: jid,
      startedAt: Date.now(),
    }

    await react('🎰')
    await sock.sendMessage(jid, {
      poll: {
        name: `🎰 SHADOW GARDEN LOTTERY: ${title}`,
        values: ['🎟️ I\'m joining! (.lottery)', '👀 Just watching'],
        selectableCount: 1,
      },
    })
    await sock.sendMessage(jid, {
      text:
        `🎰 *SHADOW GARDEN LOTTERY — NOW OPEN!*\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏆 *Prize:* ${title}\n` +
        `🌍 *Type:* Universal (all groups can join!)\n` +
        `📋 *Required:* ${required} participants\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📋 *How to enter:*\nType *.lottery* in ANY group\n\n` +
        `📊 *Commands:*\n` +
        `• *.lottery* — Enter the draw\n` +
        `• *.ll* — Live status (poll result)\n` +
        `• *.lotterydraw* — Draw winner (admin only)\n` +
        `• *.lotteryend* — Cancel (admin only)\n\n` +
        `_May the shadows choose you… 🖤_`,
    })
  },

  async lotteryjoin(ctx) {
    const { jid, senderJid, sender, pushName, isGroup, reply, react, sock } = ctx
    if (!isGroup) return reply('⚠️ This command only works in groups.')

    if (!globalLottery) {
      return reply('⚠️ No active lottery right now.\n\n_An admin can start one with *.lotterystart <prize>*_')
    }

    if (globalLottery.entries.has(senderJid)) {
      const needed = Math.max(0, globalLottery.required - globalLottery.entries.size)
      return reply(
        `⚠️ You already entered! 🎟️\n\n` +
        `📋 *Required:* ${globalLottery.required}\n` +
        `👥 *Participants:* ${globalLottery.entries.size}/${globalLottery.required}\n` +
        `⏳ *Still needed:* ${needed}\n\n` +
        `_Wait for the draw… 🖤_`
      )
    }

    globalLottery.entries.set(senderJid, { phone: sender, name: pushName || sender, group: jid })
    await react('🎟️')

    const count = globalLottery.entries.size
    const needed = Math.max(0, globalLottery.required - count)

    await reply(`🎉 You have successfully entered this drawing. Good luck ✨`)

    if (count >= globalLottery.required) {
      await sock.sendMessage(jid, {
        text:
          `🎰 *MINIMUM REACHED!*\n\n` +
          `✅ ${count} participants have joined!\n` +
          `🏆 *Prize:* ${globalLottery.title}\n\n` +
          `🎲 *Auto-drawing winner now…*\n\n` +
          `_The shadows are choosing…_ 🖤`
      })
      await autoDraw(sock, jid)
    }
  },

  async lottery(ctx) { return module.exports.lotteryjoin(ctx) },

  async lotterystatus(ctx) {
    const { sock, jid, reply } = ctx

    if (!globalLottery) {
      return reply('⚠️ No active lottery right now.\n\n_An admin can start one with *.lotterystart <prize>*_')
    }

    const count    = globalLottery.entries.size
    const required = globalLottery.required
    const needed   = Math.max(0, required - count)
    const pct      = Math.round((count / required) * 100)
    const status   = needed === 0 ? 'READY TO DRAW ✅' : `${needed} more needed`
    const bar      = buildBar(count, required)

    await reply(
      `🎰 *LOTTERY STATUS*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `🏆 *Prize:* ${globalLottery.title}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📋 *REQUIRED:* ${required}\n` +
      `👥 *CURRENT PARTICIPANTS:* ${count}\n\n` +
      `${bar}\n\n` +
      `⏳ *Status:* ${status}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n\n` +
      (needed === 0 ? `✅ *Minimum reached! Draw can happen now.*\n\n` : '') +
      `_Type *.lottery* to join!_ 🖤`
    )
  },

  // .ll — Lottery status as poll result
  async ll(ctx) {
    const { sock, jid, reply } = ctx

    if (!globalLottery) {
      return reply('⚠️ No active lottery right now.\n\n_An admin can start one with *.lotterystart <prize>*_')
    }

    const count    = globalLottery.entries.size
    const required = globalLottery.required

    await sendPollResult(sock, jid, `🎰 Lottery Pools In Shadow Garden`, [
      { optionName: `Required`,             optionVoteCount: required },
      { optionName: `Current Participants`, optionVoteCount: count },
    ])
  },

  async lotterydraw(ctx) {
    const { sock, jid, senderJid, isGroup, isOwner, reply, react } = ctx
    if (!isGroup) return reply('⚠️ This command only works in groups.')

    const groupMeta = await sock.groupMetadata(jid).catch(() => null)
    const admins = (groupMeta?.participants || []).filter(p => p.admin).map(p => p.id)
    if (!isOwner && !admins.includes(senderJid)) {
      return reply('⚠️ Only admins can draw a winner.')
    }

    if (!globalLottery) return reply('⚠️ No active lottery to draw from.')
    if (globalLottery.entries.size === 0) return reply('⚠️ No one entered the lottery yet!')

    if (globalLottery.entries.size < globalLottery.required) {
      const needed = globalLottery.required - globalLottery.entries.size
      const bar = buildBar(globalLottery.entries.size, globalLottery.required)
      return reply(
        `⛔ *Cannot draw yet!*\n\n` +
        `📋 *Required:* ${globalLottery.required} participants\n` +
        `👥 *Current:* ${globalLottery.entries.size}/${globalLottery.required}\n` +
        `${bar}\n` +
        `⏳ *Still need:* ${needed} more people\n\n` +
        `_Keep sharing *.lottery* until the minimum is reached._ 🖤`
      )
    }

    await react('🎉')
    await autoDraw(sock, jid)
  },

  async lotteryend(ctx) {
    const { sock, jid, senderJid, isGroup, isOwner, reply, react } = ctx
    if (!isGroup) return reply('⚠️ This command only works in groups.')

    const groupMeta = await sock.groupMetadata(jid).catch(() => null)
    const admins = (groupMeta?.participants || []).filter(p => p.admin).map(p => p.id)
    if (!isOwner && !admins.includes(senderJid)) {
      return reply('⚠️ Only admins can end a lottery.')
    }

    if (!globalLottery) return reply('⚠️ No active lottery to end.')

    const { title, entries, required } = globalLottery
    globalLottery = null
    await react('❌')
    await reply(
      `❌ *LOTTERY CANCELLED*\n\n` +
      `🏆 *Prize:* ${title}\n` +
      `📋 *Required was:* ${required}\n` +
      `👥 *Entries collected:* ${entries.size}\n\n` +
      `_The lottery has been cancelled by an admin._ 🖤`
    )
  },
}
