const db = require('../database')

const FANCY_STYLES = [
  t => [...t].map(c => '\u{1D41A}\u{1D41B}\u{1D41C}\u{1D41D}\u{1D41E}\u{1D41F}\u{1D420}\u{1D421}\u{1D422}\u{1D423}\u{1D424}\u{1D425}\u{1D426}\u{1D427}\u{1D428}\u{1D429}\u{1D42A}\u{1D42B}\u{1D42C}\u{1D42D}\u{1D42E}\u{1D42F}\u{1D430}\u{1D431}\u{1D432}\u{1D433}'.split('').find((_, i) => i === c.toLowerCase().charCodeAt(0)-97) || c).join(''),
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
    const ctx = msg.message?.extendedTextMessage?.contextInfo
    const mentioned = ctx?.mentionedJid || []
    const quotedParticipant = ctx?.participant
    const target = mentioned.length
      ? mentioned[0].split('@')[0].split(':')[0]
      : quotedParticipant
        ? quotedParticipant.split('@')[0].split(':')[0]
        : sender
    const pct = Math.floor(Math.random() * 101)
    await reply(`🏳️‍🌈 *Gay Meter*\n\n👤 @${target}\n\n${'🌈'.repeat(Math.ceil(pct/10))}${'⬛'.repeat(10-Math.ceil(pct/10))}\n\n*${pct}%*`)
  },
  async howgay(ctx) { return module.exports.gay(ctx) },
  async lesbian({ reply, sender, msg }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target = mentioned.length ? mentioned[0].split('@')[0] : sender
    const pct = Math.floor(Math.random() * 101)
    await reply(`🌸 *Lesbian Meter*\n\n👤 @${target}\n\n*${pct}%*`)
  },
  async simp({ reply, sender, msg }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target = mentioned.length ? mentioned[0].split('@')[0] : sender
    const pct = Math.floor(Math.random() * 101)
    await reply(`😭 *Simp Meter*\n\n👤 @${target}\n\n${'❤️'.repeat(Math.ceil(pct/10))}${'🖤'.repeat(10-Math.ceil(pct/10))}\n\n*${pct}%*`)
  },
  async match({ reply }) {
    const pct = Math.floor(Math.random() * 101)
    await reply(`💘 *Match Score*\n\n*${pct}%*\n\n${pct > 70 ? '🔥 Perfect match!' : pct > 40 ? '💫 Decent match' : '💔 Not really...'}`)
  },
  async ship({ reply, args }) {
    const parts = args.join(' ').split('x').map(s => s.trim()).filter(Boolean)
    if (parts.length < 2) return reply('⚠️ Usage: `.ship name1 x name2`')
    const pct = Math.floor(Math.random() * 101)
    const ship = parts[0].slice(0, Math.ceil(parts[0].length/2)) + parts[1].slice(Math.floor(parts[1].length/2))
    await reply(`💕 *Ship Name:* *${ship}*\n\n${parts[0]} + ${parts[1]}\n💘 *${pct}%* compatibility`)
  },
  async character({ reply, sender }) {
    const chars = ['The Chosen One', 'The Dark Villain', 'The Hidden Hero', 'The Loyal Friend', 'The Traitor', 'The Mysterious Stranger', 'The Guardian', 'The Fallen Angel']
    await reply(`🎭 *Character Role*\n\n@${sender} is...\n\n*${chars[Math.floor(Math.random() * chars.length)]}*`)
  },
  async pp({ reply, sender, msg }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target = mentioned.length ? mentioned[0].split('@')[0] : sender
    const size = Math.floor(Math.random() * 16)
    await reply(`📏 *PP Size*\n\n👤 @${target}\n\n8${'='.repeat(size)}D\n\n*${size} cm*`)
  },
  async skill({ reply, sender }) {
    const skills = ['Shadow manipulation', 'Time bending', 'Mind reading', 'Invisibility', 'Fire control', 'Ice formation', 'Lightning strike', 'Shadow teleport']
    const lvl = Math.floor(Math.random() * 10) + 1
    await reply(`⚡ *Skill Check*\n\n@${sender}\n\n*${skills[Math.floor(Math.random() * skills.length)]}* - Lv.${lvl}/10`)
  },
  async duality({ reply, sender }) {
    const sides = [['Light', 'Dark'], ['Chaos', 'Order'], ['Creation', 'Destruction'], ['Love', 'Hate'], ['Peace', 'War']]
    const pair  = sides[Math.floor(Math.random() * sides.length)]
    const side1 = Math.floor(Math.random() * 101)
    await reply(`☯️ *Duality*\n\n@${sender}\n\n${pair[0]}: *${side1}%*\n${pair[1]}: *${100-side1}%*`)
  },
  async gen({ reply, args }) {
    const name  = args.join(' ') || 'Someone'
    const stats = ['Power', 'Speed', 'Intelligence', 'Luck', 'Charm'].map(s => `${s}: *${Math.floor(Math.random() * 101)}%*`).join('\n')
    await reply(`🧬 *${name}'s Stats*\n\n${stats}`)
  },
  async pov({ reply }) {
    const povs = [
      'You just discovered you can control shadows.',
      'The bot knows your deepest secret.',
      'You wake up in the Konosuba dungeon.',
      'You are the last human in a world of AIs.',
      'You just leveled up to the maximum level.',
    ]
    await reply(`🎬 *POV*\n\n${povs[Math.floor(Math.random() * povs.length)]}`)
  },
  async social({ reply, sender }) {
    await reply(`📱 *Social Stats*\n\n@${sender}\n\n😊 Friendliness: *${Math.floor(Math.random() * 101)}%*\n💬 Chattiness: *${Math.floor(Math.random() * 101)}%*\n😎 Coolness: *${Math.floor(Math.random() * 101)}%*`)
  },
  async relation({ reply, msg, sender, args }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target    = mentioned.length ? mentioned[0].split('@')[0] : args[0] || '???'
    const relations = ['Best Friends', 'Rivals', 'Siblings', 'Strangers', 'Soulmates', 'Enemies', 'Allies']
    await reply(`🔗 *Relationship*\n\n@${sender} & @${target}\n\n💫 *${relations[Math.floor(Math.random() * relations.length)]}*`)
  },
  async compliment({ reply, msg, sender }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target    = mentioned.length ? mentioned[0].split('@')[0] : sender
    const compliments = ['absolutely brilliant', 'incredibly powerful', 'a true shadow guardian', 'destined for greatness', 'an inspiration to all']
    await reply(`✨ @${target}, ${compliments[Math.floor(Math.random() * compliments.length)]}`)
  },
  async wyr({ reply }) {
    const wyrs = [
      'Fight 100 duck-sized horses OR 1 horse-sized duck?',
      'Always be 10 minutes late OR always be 20 minutes early?',
      'Have no internet for a month OR no phone for a month?',
      'Know when you will die OR how you will die?',
      'Unlimited money with no friends OR great friends with no money?',
    ]
    await reply(`🤔 *Would You Rather?*\n\n${wyrs[Math.floor(Math.random() * wyrs.length)]}`)
  },
  async truth({ reply }) {
    const truths = [
      "What's the most embarrassing thing you've ever done?",
      'Who was your first crush?',
      "What's your biggest fear?",
      "What's the most recent lie you told?",
      "What do you think about when you can't sleep?",
    ]
    await reply(`🎯 *Truth*\n\n${truths[Math.floor(Math.random() * truths.length)]}`)
  },
  async dare({ reply }) {
    const dares = [
      'Send a voice note singing for 10 seconds.',
      'Change your WA status to "I love Konosuba Bot" for 1 hour.',
      'Send a selfie to the group.',
      "Text your last contact \"I'm joining a cult.\"",
      'Do 10 jumping jacks and voice note it.',
    ]
    await reply(`😈 *Dare*\n\n${dares[Math.floor(Math.random() * dares.length)]}`)
  },
  async td({ reply }) {
    return Math.random() > 0.5 ? module.exports.truth({ reply }) : module.exports.dare({ reply })
  },
  async joke({ reply }) {
    const jokes = [
      "Why don't scientists trust atoms? Because they make up everything! 😂",
      "What do you call a fake noodle? An impasta! 🍝",
      "Why did the scarecrow win an award? Outstanding in his field! 🌾",
      "Why don't eggs tell jokes? They'd crack each other up! 🥚",
      "What do you call cheese that isn't yours? Nacho cheese! 🧀",
    ]
    await reply(`😂 *Joke!*\n\n${jokes[Math.floor(Math.random() * jokes.length)]}`)
  },
  async '8ball'({ reply, args }) {
    const question = args.join(' ')
    if (!question) return reply('⚠️ Usage: `.8ball <question>`')
    const answers = ['Yes, definitely.', 'No way.', 'Ask again later.', 'It is certain.', "Don't count on it.", 'Most likely.', 'Outlook not so good.', 'Without a doubt.', 'Very doubtful.', 'Signs point to yes.']
    await reply(`🎱 *${question}*\n\n_${answers[Math.floor(Math.random() * answers.length)]}_`)
  },
  async roll({ reply, args }) {
    const sides = parseInt(args[0]) || 6
    const count = parseInt(args[1]) || 1
    const rolls = [...Array(Math.min(count, 10))].map(() => Math.floor(Math.random() * sides) + 1)
    const total = rolls.reduce((a, b) => a + b, 0)
    await reply(`🎲 *Dice Roll*\n\n${count}d${sides}: *${rolls.join(', ')}*\nTotal: *${total}*`)
  },
  async choose({ reply, args }) {
    const choices = args.join(' ').split('|').map(c => c.trim()).filter(Boolean)
    if (!choices.length) return reply('⚠️ Usage: `.choose a | b | c`')
    await reply(`🎯 *The answer is...*\n\n*${choices[Math.floor(Math.random() * choices.length)]}*`)
  },
  async flip({ reply }) {
    await reply(`🪙 *Coin Flip!*\n\n*${Math.random() > 0.5 ? 'Heads' : 'Tails'}*`)
  },
  async reverse({ reply, args }) {
    const text = args.join(' ')
    if (!text) return reply('⚠️ Usage: `.reverse <text>`')
    await reply(`🔄 ${text.split('').reverse().join('')}`)
  },
  async fancy({ reply, args }) {
    const n    = parseInt(args[0])
    const text = args.slice(1).join(' ')
    if (!n || !text) {
      return reply('✨ *Fancy Styles*\n\nUsage: `.fancy <1-10> <text>`\n\nStyles: 1=Script 2=Italic 3=Double 4=Bold 5=SansBold 6=SansItalic 7=Fraktur 8=Circles 9=SmallCaps 10=Strike')
    }
    await reply(`✨ ${applyFancy(n, text)}`)
  },
  async password({ reply, args }) {
    const len  = Math.min(parseInt(args[0]) || 12, 32)
    const pass = generatePassword(len)
    await reply(`🔐 *Generated Password*\n\n\`${pass}\`\n\n📏 Length: ${len}`)
  },
  async pass(ctx) { return module.exports.password(ctx) },
  async qr({ sock, msg, jid, reply, args }) {
    const text = args.join(' ')
    if (!text) return reply('❌ Usage: `.qr <text>`')
    try {
      const QRCode = require('qrcode')
      const buffer = await QRCode.toBuffer(text, { width: 300, margin: 2 })
      await sock.sendMessage(jid, { image: buffer, caption: `📱 *QR Code*\n\n${text}` }, { quoted: msg })
    } catch (e) {
      await reply(`📱 QR for: ${text}`)
    }
  },
  async fact({ reply }) {
    const facts = [
      'A group of flamingos is called a flamboyance.',
      'Honey never spoils - archaeologists found 3000-year-old honey in Egypt.',
      'A day on Venus is longer than a year on Venus.',
      'The shortest war in history lasted 38-45 minutes.',
      'Bananas are berries, but strawberries are not.',
    ]
    await reply(`💡 *Random Fact*\n\n${facts[Math.floor(Math.random() * facts.length)]}`)
  },
  async roast({ reply, msg, sender }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target = mentioned.length ? mentioned[0].split('@')[0] : sender
    const roasts = [
      `@${target}, your Wi-Fi password is longer than your attention span.`,
      `@${target} is like a software update - nobody wants them but they keep showing up.`,
      `@${target}'s brain cell count rivals a rock. Impressive for a rock.`,
      `@${target} Googles "how to tie shoes" every morning.`,
      `@${target} is the reason we don't clone people.`,
    ]
    await reply(`🔥 ${roasts[Math.floor(Math.random() * roasts.length)]}`)
  },
  async trivia({ reply }) {
    const questions = [
      { q: 'What is the capital of France?', a: 'Paris', choices: 'A) London\nB) Paris\nC) Berlin\nD) Rome' },
      { q: 'What is 7 × 8?', a: '56', choices: 'A) 54\nB) 56\nC) 63\nD) 48' },
      { q: 'Which planet is closest to the Sun?', a: 'Mercury', choices: 'A) Venus\nB) Earth\nC) Mercury\nD) Mars' },
      { q: 'Who wrote Romeo and Juliet?', a: 'Shakespeare', choices: 'A) Dickens\nB) Shakespeare\nC) Austen\nD) Twain' },
      { q: 'What is H2O commonly known as?', a: 'Water', choices: 'A) Hydrogen\nB) Oxygen\nC) Water\nD) Helium' },
      { q: 'How many sides does a hexagon have?', a: '6', choices: 'A) 5\nB) 6\nC) 7\nD) 8' },
      { q: 'What is the largest ocean?', a: 'Pacific', choices: 'A) Atlantic\nB) Indian\nC) Arctic\nD) Pacific' },
    ]
    const q = questions[Math.floor(Math.random() * questions.length)]
    await reply(`🧠 *Trivia!*\n\n${q.q}\n\n${q.choices}\n\n_Answer: ||${q.a}||_`)
  },

  // ── VIBE commands ──────────────────────────────────────────────────────────

  async hornycheck({ reply, sender, msg }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target    = mentioned.length ? mentioned[0].split('@')[0].split(':')[0] : sender
    const pct       = Math.floor(Math.random() * 101)
    const filled    = Math.ceil(pct / 10)
    const bar       = '🔥'.repeat(filled) + '⬛'.repeat(10 - filled)
    await reply(`🌡️ *Horny Meter*\n\n👤 @${target}\n\n${bar}\n\n*${pct}%*`)
  },

  async rizz({ reply, sender, msg }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target    = mentioned.length ? mentioned[0].split('@')[0].split(':')[0] : sender
    const pct       = Math.floor(Math.random() * 101)
    const levels    = ['No rizz at all 💀', 'Low rizz 😬', 'Mid rizz 😐', 'Some rizz 😏', 'High rizz 🔥', 'Max rizz 👑']
    const level     = levels[Math.min(Math.floor(pct / 20), 5)]
    await reply(`😏 *Rizz Check*\n\n👤 @${target}\n\n*${pct}% rizz*\n${level}`)
  },

  async pickupline({ reply }) {
    const lines = [
      'Are you a shadow? Because I can\'t get you out of my head.',
      'Do you have a map? I keep getting lost in your eyes.',
      'Are you a parking ticket? Because you\'ve got "fine" written all over you.',
      'Is your name Google? Because you have everything I\'ve been searching for.',
      'Do you believe in love at first sight, or should I walk by again?',
      'Are you a magician? Because whenever I look at you, everyone else disappears.',
      'Is your name Wi-Fi? Because I\'m feeling a connection.',
      'Do you have a Band-Aid? I just scraped my knee falling for you.',
      'Are you a camera? Because every time I look at you, I smile.',
      'Do you like raisins? How about a date?',
    ]
    await reply(`💬 *Pick-up Line*\n\n_"${lines[Math.floor(Math.random() * lines.length)]}"_`)
  },

  async confess({ reply, args }) {
    const message = args.join(' ')
    if (!message) return reply('⚠️ Usage: `.confess <message>`')
    await reply(`💌 *Anonymous Confession*\n\n_"${message}"_\n\n> Submitted anonymously 🖤`)
  },

  async waifu({ reply }) {
    const waifus = ['Aqua', 'Megumin', 'Darkness', 'Zero Two', 'Rem', 'Emilia', 'Asuna', 'Kurumi', 'Nezuko', 'Mikasa', 'Rias Gremory', 'Tohka', 'Raphtalia', 'Albedo']
    await reply(`💕 *Your Waifu is...*\n\n💖 *${waifus[Math.floor(Math.random() * waifus.length)]}*`)
  },

  async husbando({ reply }) {
    const husbandos = ['Kazuma', 'Kirito', 'Levi', 'Gojo', 'Itachi', 'Guts', 'Killua', 'Todoroki', 'Vegeta', 'Naruto', 'Ainz', 'Subaru', 'Rimuru', 'Anos']
    await reply(`💙 *Your Husbando is...*\n\n💙 *${husbandos[Math.floor(Math.random() * husbandos.length)]}*`)
  },

  async relationship({ reply, msg, sender, args }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target    = mentioned.length ? mentioned[0].split('@')[0].split(':')[0] : (args[0] || '???')
    const relations = ['Best Friends 💛', 'Rivals ⚔️', 'Siblings 👫', 'Strangers 😶', 'Soulmates 💞', 'Enemies 💢', 'Allies 🤝', 'Secret Crushes 🫣', 'Power Couple 👑', 'Frenemies 😤']
    await reply(`🔗 *Relationship Status*\n\n@${sender} & @${target}\n\n💫 *${relations[Math.floor(Math.random() * relations.length)]}*`)
  },
}
