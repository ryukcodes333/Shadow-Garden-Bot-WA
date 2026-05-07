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
    await reply(`🏳️‍🌈 *GAY METER*\n\n👤 ${target}\n\n${'🌈'.repeat(Math.ceil(pct/10))}${'⬛'.repeat(10-Math.ceil(pct/10))}\n\n${pct}% gay\n\n_The shadows measure all things._ 🖤`)
  },
  async lesbian({ reply, sender, msg }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target = mentioned.length ? mentioned[0].split('@')[0] : sender
    const pct = Math.floor(Math.random() * 101)
    await reply(`🏳️‍🌈 *LESBIAN METER*\n\n👤 ${target}\n\n${pct}% lesbian\n\n_The shadows see all._ 🖤`)
  },
  async simp({ reply, sender, msg }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target = mentioned.length ? mentioned[0].split('@')[0] : sender
    const pct = Math.floor(Math.random() * 101)
    await reply(`😭 *SIMP METER*\n\n👤 ${target}\n\n${'❤️'.repeat(Math.ceil(pct/10))}${'🖤'.repeat(10-Math.ceil(pct/10))}\n\n${pct}% simp\n\n_You can't escape your nature._ 🖤`)
  },
  async match({ reply, msg, sender }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (mentioned.length < 2 && !msg) {
      const pct = Math.floor(Math.random() * 101)
      return reply(`💘 *MATCH*\n\n${pct}% compatibility!\n\n_The shadows calculate love._ 🖤`)
    }
    const pct = Math.floor(Math.random() * 101)
    await reply(`💘 *MATCH RESULT*\n\n${pct}% compatibility!\n\n${pct > 70 ? '🔥 Incredible match!' : pct > 40 ? '💫 Decent match!' : '💔 Maybe not...'}\n\n_The shadows have spoken._ 🖤`)
  },
  async ship({ reply, msg, sender, args }) {
    const parts = args.join(' ').split('x').map(s => s.trim()).filter(Boolean)
    if (parts.length < 2) return reply('⚠️ Usage: *.ship name1 x name2*')
    const pct = Math.floor(Math.random() * 101)
    const ship = parts[0].slice(0, Math.ceil(parts[0].length/2)) + parts[1].slice(Math.floor(parts[1].length/2))
    await reply(`💕 *SHIP*\n\n${parts[0]} + ${parts[1]} = *${ship}*\n\n💘 Match: ${pct}%\n\n_The shadows witness your bond._ 🖤`)
  },
  async character({ reply, sender }) {
    const chars = ['The Chosen One', 'The Dark Villain', 'The Hidden Hero', 'The Loyal Friend', 'The Traitor', 'The Mysterious Stranger', 'The Guardian', 'The Fallen Angel']
    const char = chars[Math.floor(Math.random() * chars.length)]
    await reply(`🎭 *YOUR CHARACTER*\n\n👤 @${sender}\n\nYou are: *${char}*\n\n_Every shadow hides a role._ 🖤`)
  },
  async pp({ reply, sender, msg }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target = mentioned.length ? mentioned[0].split('@')[0] : sender
    const size = Math.floor(Math.random() * 16)
    await reply(`📏 *PP SIZE*\n\n👤 ${target}\n\n8${'='.repeat(size)}D\n\n${size} cm\n\n_Size is not power._ 🖤`)
  },
  async skill({ reply, sender }) {
    const skills = ['Shadow manipulation', 'Time bending', 'Mind reading', 'Invisibility', 'Fire control', 'Ice formation', 'Lightning strike', 'Shadow teleport']
    const skill = skills[Math.floor(Math.random() * skills.length)]
    const lvl = Math.floor(Math.random() * 10) + 1
    await reply(`⚡ *YOUR SKILL*\n\n👤 @${sender}\n\n🌟 Skill: *${skill}*\n📊 Level: ${lvl}/10\n\n_The shadows reveal your hidden power._ 🖤`)
  },
  async duality({ reply, sender }) {
    const sides = [['Light', 'Dark'], ['Chaos', 'Order'], ['Creation', 'Destruction'], ['Love', 'Hate'], ['Peace', 'War']]
    const pair = sides[Math.floor(Math.random() * sides.length)]
    const side1 = Math.floor(Math.random() * 101)
    await reply(`☯️ *YOUR DUALITY*\n\n👤 @${sender}\n\n${pair[0]}: ${side1}%\n${pair[1]}: ${100-side1}%\n\n_All things have two sides._ 🖤`)
  },
  async gen({ reply, args }) {
    const name = args.join(' ') || 'Someone'
    const stats = ['Power', 'Speed', 'Intelligence', 'Luck', 'Charm'].map(s => `${s}: ${Math.floor(Math.random() * 101)}%`).join('\n')
    await reply(`🧬 *GENERATED STATS*\n\n👤 ${name}\n\n${stats}\n\n_The system generated your fate._ 🖤`)
  },
  async pov({ reply, args }) {
    const povs = ['You just discovered you can control shadows.', 'The bot knows your deepest secret.', 'You wake up in the Shadow Garden dungeon.', 'You are the last human in a world of AIs.', 'You just leveled up to the maximum level.']
    await reply(`🎬 *POV*\n\n${povs[Math.floor(Math.random() * povs.length)]}\n\n_The shadows script your story._ 🖤`)
  },
  async social({ reply, sender }) {
    await reply(`📱 *SOCIAL SCORE*\n\n👤 @${sender}\n\n😊 Friendliness: ${Math.floor(Math.random() * 101)}%\n💬 Chattiness: ${Math.floor(Math.random() * 101)}%\n😎 Coolness: ${Math.floor(Math.random() * 101)}%\n\n_The shadows judge your social energy._ 🖤`)
  },
  async relation({ reply, msg, sender, args }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target = mentioned.length ? mentioned[0].split('@')[0] : args[0] || '???'
    const relations = ['Best Friends', 'Rivals', 'Siblings', 'Strangers', 'Soulmates', 'Enemies', 'Allies']
    const rel = relations[Math.floor(Math.random() * relations.length)]
    await reply(`🔗 *RELATIONSHIP*\n\n👤 @${sender} & @${target}\n\n💫 Relation: *${rel}*\n\n_The shadows connect all things._ 🖤`)
  },
  async compliment({ reply, msg, sender }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target = mentioned.length ? mentioned[0].split('@')[0] : sender
    const compliments = ['absolutely brilliant', 'incredibly powerful', 'a true shadow guardian', 'destined for greatness', 'the reason the bot keeps running', 'an inspiration to all']
    const c = compliments[Math.floor(Math.random() * compliments.length)]
    await reply(`💬 *COMPLIMENT*\n\n👤 @${target} is *${c}*!\n\n_The shadows speak the truth._ 🖤`)
  },
  async wyr({ reply }) {
    const wyrs = [
      'Fight 100 duck-sized horses OR 1 horse-sized duck?',
      'Always be 10 minutes late OR always be 20 minutes early?',
      'Have no internet for a month OR no phone for a month?',
      'Know when you will die OR how you will die?',
      'Have unlimited money with no friends OR have great friends with no money?',
    ]
    await reply(`🤔 *WOULD YOU RATHER*\n\n${wyrs[Math.floor(Math.random() * wyrs.length)]}\n\n_The shadows force a choice._ 🖤`)
  },
  async truth({ reply }) {
    const truths = [
      'What\'s the most embarrassing thing you\'ve ever done?',
      'Who was your first crush?',
      'What\'s your biggest fear?',
      'What\'s the most recent lie you told?',
      'What do you think about when you can\'t sleep?',
    ]
    await reply(`🎯 *TRUTH*\n\n${truths[Math.floor(Math.random() * truths.length)]}\n\n_The shadows demand honesty._ 🖤`)
  },
  async dare({ reply }) {
    const dares = [
      'Send a voice note singing for 10 seconds.',
      'Change your WhatsApp status to "I love the Shadow Garden Bot" for 1 hour.',
      'Send a selfie to the group.',
      'Text your last contact "I\'m joining a cult."',
      'Do 10 jumping jacks and voice note it.',
    ]
    await reply(`😈 *DARE*\n\n${dares[Math.floor(Math.random() * dares.length)]}\n\n_The shadows dare you._ 🖤`)
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
    await reply(`😂 *JOKE*\n\n${jokes[Math.floor(Math.random() * jokes.length)]}\n\n_Even shadows can laugh._ 🖤`)
  },
  async '8ball'({ reply, args }) {
    const question = args.join(' ')
    if (!question) return reply('⚠️ Usage: *.8ball <question>*')
    const answers = ['Yes, definitely.', 'No way.', 'Ask again later.', 'It is certain.', 'Don\'t count on it.', 'Most likely.', 'Outlook not so good.', 'Without a doubt.', 'Very doubtful.', 'Signs point to yes.']
    await reply(`🎱 *MAGIC 8-BALL*\n\n❓ ${question}\n\n🎱 *${answers[Math.floor(Math.random() * answers.length)]}*\n\n_The shadows have answered._ 🖤`)
  },
  async roll({ reply, args }) {
    const sides = parseInt(args[0]) || 6
    const count = parseInt(args[1]) || 1
    const rolls = [...Array(Math.min(count, 10))].map(() => Math.floor(Math.random() * sides) + 1)
    const total = rolls.reduce((a, b) => a + b, 0)
    await reply(`🎲 *ROLL*\n\n🎲 ${count}d${sides}: ${rolls.join(', ')}\n\n📊 Total: ${total}\n\n_Luck decides all._ 🖤`)
  },
  async choose({ reply, args }) {
    const choices = args.join(' ').split('|').map(c => c.trim()).filter(Boolean)
    if (!choices.length) return reply('⚠️ Usage: *.choose a | b | c*')
    const chosen = choices[Math.floor(Math.random() * choices.length)]
    await reply(`🎯 *CHOICE*\n\nOptions: ${choices.join(' | ')}\n\n✅ *${chosen}*\n\n_The shadows have chosen for you._ 🖤`)
  },
  async flip({ reply }) {
    const result = Math.random() > 0.5 ? 'Heads' : 'Tails'
    await reply(`🪙 *COIN FLIP*\n\n🪙 Result: *${result}*\n\n_Fate in a flip._ 🖤`)
  },
  async reverse({ reply, args }) {
    const text = args.join(' ')
    if (!text) return reply('⚠️ Usage: *.reverse <text>*')
    await reply(`🔄 *REVERSED*\n\n${text.split('').reverse().join('')}\n\n_Mirror image from the shadows._ 🖤`)
  },
  async fancy({ reply, args }) {
    const n = parseInt(args[0])
    const text = args.slice(1).join(' ')
    if (!n || !text) {
      const sample = 'Alpha'
      const preview = FANCY_STYLES.slice(0, 10).map((fn, i) => `${i+1}  ${fn(sample)}`).join('\n')
      return reply(`✨ FANCY TEXT STYLES\n\n📝 Text: ${sample}\n\n━━━━━━━━━━━━━━━\n\n${preview}\n\n━━━━━━━━━━━━━━━\n\n💡 Usage:\n.fancy <number> <text>\n\nExample:\n.fancy 4 hello world`)
    }
    const styled = applyFancy(n, text)
    await reply(`✨ Style #${n}: ${styled}`)
  },
  async password({ reply, args }) {
    const len = Math.min(parseInt(args[0]) || 12, 32)
    const pass = generatePassword(len)
    await reply(`🔐 *PASSWORD GENERATED*\n\n\`${pass}\`\n\n📏 Length: ${len}\n\n⚠️ Don't share this!\n\n_Shadows protect secrets._ 🖤`)
  },
  async pass(ctx) { return module.exports.password(ctx) },
  async qr({ sock, msg, jid, reply, args }) {
    const text = args.join(' ')
    if (!text) return reply('⚠️ Usage: *.qr <text>*')
    try {
      const QRCode = require('qrcode')
      const buffer = await QRCode.toBuffer(text, { width: 300, margin: 2 })
      await sock.sendMessage(jid, { image: buffer, caption: `📱 *QR CODE*\n\n📝 Content: ${text}\n\n_Scan with any QR reader._ 🖤` }, { quoted: msg })
    } catch (e) {
      await reply(`📱 *QR CODE*\n\nText: ${text}\n\n_QR generation requires qrcode package._ 🖤`)
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
    await reply(`💡 *RANDOM FACT*\n\n${facts[Math.floor(Math.random() * facts.length)]}\n\n_Knowledge is power in the shadows._ 🖤`)
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
    await reply(`🔥 *ROASTED*\n\n${roasts[Math.floor(Math.random() * roasts.length)]}\n\n_The shadows don't hold back._ 🖤`)
  },
}
