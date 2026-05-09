const db = require('../database')

const FANCY_STYLES = [
  t => [...t].map(c => '𝓪𝓫𝓬𝓭𝓮𝓯𝓰𝓱𝓲𝓳𝓴𝓵𝓶𝓷𝓸𝓹𝓺𝓻𝓼𝓽𝓾𝓿𝔀𝔁𝔂𝔃'.split('')[c.toLowerCase().charCodeAt(0)-97] || c).join(''),
  t => [...t].map(c => '𝒂𝒃𝒄𝒅𝒆𝒇𝒈𝒉𝒊𝒋𝒌𝒍𝒎𝒏𝒐𝒑𝒒𝒓𝒔𝒕𝒖𝒗𝒘𝒙𝒚𝒛'.split('')[c.toLowerCase().charCodeAt(0)-97] || c).join(''),
  t => [...t].map(c => '𝕒𝕓𝕔𝕕𝕖𝕗𝕘𝕙𝕚𝕛𝕜𝕝𝕞𝕟𝕠𝕡𝕢𝕣𝕤𝕥𝕦𝕧𝕨𝕩𝕪𝕫'.split('')[c.toLowerCase().charCodeAt(0)-97] || c).join(''),
  t => [...t].map(c => '𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳'.split('')[c.toLowerCase().charCodeAt(0)-97] || c).join(''),
  t => [...t].map(c => '𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇'.split('')[c.toLowerCase().charCodeAt(0)-97] || c).join(''),
  t => [...t].map(c => '𝘢𝘣𝘤𝘥𝘦𝘧𝘨𝘩𝘪𝘫𝘬𝘭𝘮𝘯𝘰𝘱𝘲𝘳𝘴𝘵𝘶𝘷𝘸𝘹𝘺𝘻'.split('')[c.toLowerCase().charCodeAt(0)-97] || c).join(''),
  t => [...t].map(c => '𝔞𝔟𝔠𝔡𝔢𝔣𝔤𝔥𝔦𝔧𝔨𝔩𝔪𝔫𝔬𝔭𝔮𝔯𝔰𝔱𝔲𝔳𝔴𝔵𝔶𝔷'.split('')[c.toLowerCase().charCodeAt(0)-97] || c).join(''),
  t => [...t].map(c => { const box = '🅐🅑🅒🅓🅔🅕🅖🅗🅘🅙🅚🅛🅜🅝🅞🅟🅠🅡🅢🅣🅤🅥🅦🅧🅨🅩'.split(''); return box[c.toLowerCase().charCodeAt(0)-97] || c }).join(''),
  t => [...t].map(c => 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘqʀꜱᴛᴜᴠᴡxʏᴢ'.split('')[c.toLowerCase().charCodeAt(0)-97] || c).join(''),
  t => [...t].map(c => c + '\u0336').join(''),
]

function applyFancy(style, text) {
  const fn = FANCY_STYLES[(style - 1) % FANCY_STYLES.length]
  return fn ? fn(text) : text
}

function generatePassword(length = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  return [...Array(length)].map(() => chars[Math.floor(Math.random() * chars.length)]).join('')
}

module.exports = {
  async gay({ reply, sender, msg }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target = mentioned.length ? mentioned[0].split('@')[0] : sender
    const pct = Math.floor(Math.random() * 101)
    await reply(`🏳️‍🌈 *Gay Meter*\n\n👤 ${target}\n\n${'🌈'.repeat(Math.ceil(pct/10))}${'⬛'.repeat(10-Math.ceil(pct/10))}\n\n${pct}% gay`)
  },
  async lesbian({ reply, sender, msg }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target = mentioned.length ? mentioned[0].split('@')[0] : sender
    const pct = Math.floor(Math.random() * 101)
    await reply(`🏳️‍🌈 *Lesbian Meter*\n\n👤 ${target}\n\n${pct}% lesbian`)
  },
  async simp({ reply, sender, msg }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target = mentioned.length ? mentioned[0].split('@')[0] : sender
    const pct = Math.floor(Math.random() * 101)
    await reply(`😭 *Simp Meter*\n\n👤 ${target}\n\n${'❤️'.repeat(Math.ceil(pct/10))}${'🖤'.repeat(10-Math.ceil(pct/10))}\n\n${pct}% simp`)
  },
  async match({ reply, msg, sender }) {
    const pct = Math.floor(Math.random() * 101)
    await reply(`💘 *Match*\n\n${pct}% compatibility!\n\n${pct > 70 ? '🔥 Incredible match!' : pct > 40 ? '💫 Decent match!' : '💔 Maybe not...'}`)
  },
  async ship({ reply, msg, sender, args }) {
    const parts = args.join(' ').split('x').map(s => s.trim()).filter(Boolean)
    if (parts.length < 2) return reply('⚠️ Usage: .ship name1 x name2')
    const pct = Math.floor(Math.random() * 101)
    const ship = parts[0].slice(0, Math.ceil(parts[0].length/2)) + parts[1].slice(Math.floor(parts[1].length/2))
    await reply(`💕 *Ship*\n\n${parts[0]} + ${parts[1]} = *${ship}*\n💘 ${pct}% match`)
  },
  async character({ reply, sender }) {
    const chars = ['The Chosen One', 'The Dark Villain', 'The Hidden Hero', 'The Loyal Friend', 'The Traitor', 'The Mysterious Stranger', 'The Guardian', 'The Fallen Angel']
    const char = chars[Math.floor(Math.random() * chars.length)]
    await reply(`🎭 *Your Character*\n\n👤 @${sender}\n\n*${char}*`)
  },
  async pp({ reply, sender, msg }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target = mentioned.length ? mentioned[0].split('@')[0] : sender
    const size = Math.floor(Math.random() * 16)
    await reply(`📏 *PP Size*\n\n👤 ${target}\n\n8${'='.repeat(size)}D\n\n${size} cm`)
  },
  async skill({ reply, sender }) {
    const skills = ['Shadow manipulation', 'Time bending', 'Mind reading', 'Invisibility', 'Fire control', 'Ice formation', 'Lightning strike', 'Shadow teleport']
    const skill = skills[Math.floor(Math.random() * skills.length)]
    const lvl = Math.floor(Math.random() * 10) + 1
    await reply(`⚡ *Your Skill*\n\n👤 @${sender}\n\n🌟 ${skill} — Lv.${lvl}/10`)
  },
  async duality({ reply, sender }) {
    const sides = [['Light', 'Dark'], ['Chaos', 'Order'], ['Creation', 'Destruction'], ['Love', 'Hate'], ['Peace', 'War']]
    const pair = sides[Math.floor(Math.random() * sides.length)]
    const side1 = Math.floor(Math.random() * 101)
    await reply(`☯️ *Your Duality*\n\n👤 @${sender}\n\n${pair[0]}: ${side1}%\n${pair[1]}: ${100-side1}%`)
  },
  async gen({ reply, args }) {
    const name = args.join(' ') || 'Someone'
    const stats = ['Power', 'Speed', 'Intelligence', 'Luck', 'Charm'].map(s => `${s}: ${Math.floor(Math.random() * 101)}%`).join('\n')
    await reply(`🧬 *Generated Stats*\n\n👤 ${name}\n\n${stats}`)
  },
  async pov({ reply, args }) {
    const povs = ['You just discovered you can control shadows.', 'The bot knows your deepest secret.', 'You wake up in the Shadow Garden dungeon.', 'You are the last human in a world of AIs.', 'You just leveled up to the maximum level.']
    await reply(`🎬 *POV*\n\n${povs[Math.floor(Math.random() * povs.length)]}`)
  },
  async social({ reply, sender }) {
    await reply(`📱 *Social Score*\n\n👤 @${sender}\n\n😊 Friendliness: ${Math.floor(Math.random() * 101)}%\n💬 Chattiness: ${Math.floor(Math.random() * 101)}%\n😎 Coolness: ${Math.floor(Math.random() * 101)}%`)
  },
  async relation({ reply, msg, sender, args }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target = mentioned.length ? mentioned[0].split('@')[0] : args[0] || '???'
    const relations = ['Best Friends', 'Rivals', 'Siblings', 'Strangers', 'Soulmates', 'Enemies', 'Allies']
    const rel = relations[Math.floor(Math.random() * relations.length)]
    await reply(`🔗 *Relationship*\n\n👤 @${sender} & @${target}\n\n💫 *${rel}*`)
  },
  async compliment({ reply, msg, sender }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target = mentioned.length ? mentioned[0].split('@')[0] : sender
    const compliments = ['absolutely brilliant', 'incredibly powerful', 'a true shadow guardian', 'destined for greatness', 'the reason the bot keeps running', 'an inspiration to all']
    const c = compliments[Math.floor(Math.random() * compliments.length)]
    await reply(`💬 @${target} is *${c}*!`)
  },
  async wyr({ reply }) {
    const wyrs = [
      'Fight 100 duck-sized horses OR 1 horse-sized duck?',
      'Always be 10 minutes late OR always be 20 minutes early?',
      'Have no internet for a month OR no phone for a month?',
      'Know when you will die OR how you will die?',
      'Have unlimited money with no friends OR have great friends with no money?',
    ]
    await reply(`🤔 *Would You Rather*\n\n${wyrs[Math.floor(Math.random() * wyrs.length)]}`)
  },
  async truth({ reply }) {
    const truths = [
      'What\'s the most embarrassing thing you\'ve ever done?',
      'Who was your first crush?',
      'What\'s your biggest fear?',
      'What\'s the most recent lie you told?',
      'What do you think about when you can\'t sleep?',
    ]
    await reply(`🎯 *Truth*\n\n${truths[Math.floor(Math.random() * truths.length)]}`)
  },
  async dare({ reply }) {
    const dares = [
      'Send a voice note singing for 10 seconds.',
      'Change your WhatsApp status to "I love the Shadow Garden Bot" for 1 hour.',
      'Send a selfie to the group.',
      'Text your last contact "I\'m joining a cult."',
      'Do 10 jumping jacks and voice note it.',
    ]
    await reply(`😈 *Dare*\n\n${dares[Math.floor(Math.random() * dares.length)]}`)
  },
  async td({ reply }) {
    const both = Math.random() > 0.5
    return both ? module.exports.truth({ reply }) : module.exports.dare({ reply })
  },
  async joke({ reply }) {
    const jokes = [
      'Why don\'t scientists trust atoms? Because they make up everything! 😂',
      'What do you call a fake noodle? An impasta! 🍝',
      'Why did the scarecrow win an award? Because he was outstanding in his field! 🌾',
      'Why don\'t eggs tell jokes? They\'d crack each other up! 🥚',
      'What do you call cheese that isn\'t yours? Nacho cheese! 🧀',
    ]
    await reply(`😂 ${jokes[Math.floor(Math.random() * jokes.length)]}`)
  },
  async '8ball'({ reply, args }) {
    const question = args.join(' ')
    if (!question) return reply('⚠️ Usage: .8ball <question>')
    const answers = ['Yes, definitely.', 'No way.', 'Ask again later.', 'It is certain.', 'Don\'t count on it.', 'Most likely.', 'Outlook not so good.', 'Without a doubt.', 'Very doubtful.', 'Signs point to yes.']
    await reply(`🎱 *${question}*\n\n${answers[Math.floor(Math.random() * answers.length)]}`)
  },
  async roll({ reply, args }) {
    const sides = parseInt(args[0]) || 6
    const count = parseInt(args[1]) || 1
    const rolls = [...Array(Math.min(count, 10))].map(() => Math.floor(Math.random() * sides) + 1)
    const total = rolls.reduce((a, b) => a + b, 0)
    await reply(`🎲 ${count}d${sides}: *${rolls.join(', ')}* — Total: ${total}`)
  },
  async choose({ reply, args }) {
    const choices = args.join(' ').split('|').map(c => c.trim()).filter(Boolean)
    if (!choices.length) return reply('⚠️ Usage: .choose a | b | c')
    const chosen = choices[Math.floor(Math.random() * choices.length)]
    await reply(`🎯 *${chosen}*`)
  },
  async flip({ reply }) {
    await reply(`🪙 *${Math.random() > 0.5 ? 'Heads' : 'Tails'}*`)
  },
  async reverse({ reply, args }) {
    const text = args.join(' ')
    if (!text) return reply('⚠️ Usage: .reverse <text>')
    await reply(text.split('').reverse().join(''))
  },
  async fancy({ reply, args }) {
    const n = parseInt(args[0])
    const text = args.slice(1).join(' ')
    if (!n || !text) {
      const sample = 'Alpha'
      const preview = FANCY_STYLES.slice(0, 10).map((fn, i) => `${i+1}  ${fn(sample)}`).join('\n')
      return reply(`✨ FANCY TEXT STYLES\n\n📝 Text: ${sample}\n\n━━━━━━━━━━━━━━━\n\n${preview}\n\n━━━━━━━━━━━━━━━\n\n💡 Usage:\n.fancy <number> <text>\n\nExample:\n.fancy 4 hello world`)
    }
    await reply(`✨ Style #${n}: ${applyFancy(n, text)}`)
  },
  async password({ reply, args }) {
    const len = Math.min(parseInt(args[0]) || 12, 32)
    const pass = generatePassword(len)
    await reply(`🔐 \`${pass}\`\n\n📏 Length: ${len} — Don't share this!`)
  },
  async pass(ctx) { return module.exports.password(ctx) },
  async qr({ sock, msg, jid, reply, args }) {
    const text = args.join(' ')
    if (!text) return reply('⚠️ Usage: .qr <text>')
    try {
      const QRCode = require('qrcode')
      const buffer = await QRCode.toBuffer(text, { width: 300, margin: 2 })
      await sock.sendMessage(jid, { image: buffer, caption: `📱 *QR Code*\n\n📝 ${text}` }, { quoted: msg })
    } catch (e) {
      await reply(`📱 QR Code for: ${text}`)
    }
  },
  async fact({ reply }) {
    const facts = [
      'A group of flamingos is called a flamboyance.',
      'Honey never spoils. Archaeologists have found 3000-year-old honey in Egyptian tombs.',
      'A day on Venus is longer than a year on Venus.',
      'The shortest war in history lasted only 38-45 minutes.',
      'Bananas are berries, but strawberries are not.',
    ]
    await reply(`💡 ${facts[Math.floor(Math.random() * facts.length)]}`)
  },
  async roast({ reply, msg, sender }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target = mentioned.length ? mentioned[0].split('@')[0] : sender
    const roasts = [
      `@${target}, your Wi-Fi password is longer than your attention span.`,
      `@${target} is like a software update — nobody wants them, but they keep showing up.`,
      `@${target}'s brain cell count rivals a rock. Impressive for a rock.`,
      `@${target} Googles "how to tie shoes" every morning.`,
      `@${target} is the reason we don't clone people.`,
    ]
    await reply(`🔥 ${roasts[Math.floor(Math.random() * roasts.length)]}`)
  },
}
