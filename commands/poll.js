const { generateWAMessageFromContent } = require('@whiskeysockets/baileys')

async function sendPollResult(sock, jid, name, votes) {
  const msg = generateWAMessageFromContent(jid, {
    pollResultSnapshotMessage: {
      name,
      pollVotes: votes,
    },
  }, {})
  await sock.relayMessage(jid, msg.message, { messageId: msg.key.id })
}

const pollCmds = {
  async pollresult(ctx) {
    const { sock, jid, args, reply } = ctx

    if (args.length < 3) {
      return reply(
        `📊 *POLL RESULT*\n\n` +
        `*Usage:* _.pollresult <question> | <option1:votes> | <option2:votes> ..._\n\n` +
        `*Example:*\n` +
        `_.pollresult Best Arc | Marineford:420 | Wano:369 | Enies Lobby:666_\n\n` +
        `_Separate the question and options with |_`
      )
    }

    const full = args.join(' ')
    const parts = full.split('|').map(p => p.trim()).filter(Boolean)
    if (parts.length < 2) {
      return reply(`⚠️ Need at least a question and one option.\n\n_Format: .pollresult Question | Option1:Votes | Option2:Votes_`)
    }

    const question = parts[0]
    const pollVotes = []

    for (const part of parts.slice(1)) {
      const colonIdx = part.lastIndexOf(':')
      if (colonIdx === -1) {
        pollVotes.push({ optionName: part, optionVoteCount: 0 })
      } else {
        const optionName = part.slice(0, colonIdx).trim()
        const optionVoteCount = parseInt(part.slice(colonIdx + 1).trim(), 10) || 0
        pollVotes.push({ optionName, optionVoteCount })
      }
    }

    try {
      await ctx.react('📊')
      await sendPollResult(sock, jid, question, pollVotes)
    } catch (err) {
      await reply(`❌ Failed to send poll result: ${err.message}`)
    }
  },

  async poll(ctx) {
    const { sock, jid, args, reply } = ctx

    if (args.length < 2) {
      return reply(
        `📊 *CREATE POLL*\n\n` +
        `*Usage:* _.poll <question> | <option1> | <option2> ..._\n\n` +
        `*Example:*\n` +
        `_.poll Best One Piece Arc? | Marineford | Wano | Enies Lobby_\n\n` +
        `_Up to 12 options supported_`
      )
    }

    const full = args.join(' ')
    const parts = full.split('|').map(p => p.trim()).filter(Boolean)
    if (parts.length < 2) {
      return reply(`⚠️ Need at least a question and one option.\n\n_Format: .poll Question | Option1 | Option2_`)
    }

    const question = parts[0]
    const options = parts.slice(1).slice(0, 12)

    try {
      await ctx.react('📊')
      await sock.sendMessage(jid, {
        poll: {
          name: question,
          values: options,
          selectableCount: 1,
        },
      })
    } catch (err) {
      await reply(`❌ Failed to create poll: ${err.message}`)
    }
  },
}

module.exports = pollCmds
