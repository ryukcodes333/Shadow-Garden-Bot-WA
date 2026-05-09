const db = require('../database')
const path = require('path')
const fs = require('fs')

const guildRaidSessions = {}

const GUILD_RAID_IMAGE = path.join(__dirname, '../assets/guild-raid.jpg')

const RAID_FLOORS = [
  {
    floor: 1, name: 'Shadow Sentinel', hp: 500, attack: 40,
    ability: 'Shadow Slam — deals 60 flat damage to all raiders',
    emoji: '🌑',
    reward: { coins: 300, xp: 100, gems: 2 },
  },
  {
    floor: 2, name: 'Void Colossus', hp: 900, attack: 65,
    ability: 'Void Crush — reduces all raider HP by 20%',
    emoji: '💜',
    reward: { coins: 600, xp: 200, gems: 5 },
  },
  {
    floor: 3, name: 'Dark Warlord', hp: 1400, attack: 90,
    ability: 'War Cry — negates next attack from everyone',
    emoji: '🩸',
    reward: { coins: 1000, xp: 400, gems: 10 },
  },
  {
    floor: 4, name: 'Shadow Titan', hp: 2000, attack: 120,
    ability: 'Titan Stomp — 50% chance to stun a random raider (1 turn skip)',
    emoji: '🖤',
    reward: { coins: 1500, xp: 600, gems: 15 },
  },
  {
    floor: 5, name: 'Void God', hp: 3000, attack: 160,
    ability: 'Void Annihilation — kills the raider with lowest HP instantly',
    emoji: '☠️',
    reward: { coins: 3000, xp: 1200, gems: 30 },
  },
]

function hpBar(current, max, len = 12) {
  const filled = Math.max(0, Math.round((current / max) * len))
  return '█'.repeat(filled) + '░'.repeat(len - filled)
}

async function processRaidFloor(sock, jid, session) {
  const floor = RAID_FLOORS[session.currentFloor]
  if (!floor) return endRaid(sock, jid, session, true)

  const raiders = session.raiders
  const mentions = raiders.map(r => r.jid)

  let totalDmg = 0
  const attackLines = []
  for (const raider of raiders) {
    if (raider.hp <= 0) { attackLines.push(`💀 @${raider.phone} — defeated (0 HP)`); continue }
    const dmg = Math.floor((raider.atk || 50) * (0.8 + Math.random() * 0.4))
    totalDmg += dmg
    attackLines.push(`⚔️ @${raider.phone} — *${dmg}* dmg`)
  }

  session.bossHp = Math.max(0, session.bossHp - totalDmg)

  const abilityTriggered = Math.random() < 0.45
  let bossText = `🗡️ *${floor.name}* attacks!`
  if (abilityTriggered) {
    bossText = `⚡ *${floor.ability}*`
    if (floor.floor === 1) {
      for (const r of raiders) r.hp = Math.max(0, (r.hp || 200) - 60)
    } else if (floor.floor === 2) {
      for (const r of raiders) r.hp = Math.max(0, Math.floor((r.hp || 200) * 0.8))
    } else if (floor.floor === 5) {
      const alive = raiders.filter(r => r.hp > 0)
      if (alive.length > 0) {
        const lowest = alive.sort((a, b) => (a.hp || 0) - (b.hp || 0))[0]
        lowest.hp = 0
        bossText += `\n💀 @${lowest.phone} was annihilated!`
      }
    } else {
      for (const r of raiders) r.hp = Math.max(0, (r.hp || 200) - floor.attack)
    }
  } else {
    for (const r of raiders) {
      const dmg = Math.floor(floor.attack * (0.6 + Math.random() * 0.6) / Math.max(1, raiders.length / 2))
      r.hp = Math.max(0, (r.hp || 200) - dmg)
    }
  }

  const aliveRaiders = raiders.filter(r => r.hp > 0)
  const raidersText = raiders.map(r =>
    `${r.hp > 0 ? '❤️' : '💀'} @${r.phone}: ${hpBar(r.hp, r.maxHp)} ${r.hp}/${r.maxHp}`
  ).join('\n')

  if (session.bossHp <= 0) {
    const floorReward = floor.reward
    const floorText =
      `🏆 *FLOOR ${floor.floor} CLEARED!*\n\n` +
      `${floor.emoji} *${floor.name}* has fallen!\n\n` +
      `━━━━━━━━━━━━━━━\n\n` +
      `🎁 *Floor Rewards:*\n` +
      `💰 +${floorReward.coins} coins each\n` +
      `⭐ +${floorReward.xp} XP each\n` +
      `💎 +${floorReward.gems} gems each\n\n` +
      `━━━━━━━━━━━━━━━\n\n` +
      `👥 *Raider Status:*\n${raidersText}\n\n`

    for (const raider of aliveRaiders) {
      try {
        const u = await db.getOrCreateUser(raider.phone)
        await db.updateUser(raider.phone, {
          wallet: (u.wallet || 0) + floorReward.coins,
          xp: (u.xp || 0) + floorReward.xp,
          gems: (u.gems || 0) + floorReward.gems,
        })
      } catch {}
    }

    if (aliveRaiders.length === 0) {
      delete guildRaidSessions[jid]
      await sock.sendMessage(jid, {
        text: floorText + `💀 All raiders defeated on Floor ${floor.floor}. Raid failed!`,
        mentions,
      })
      return
    }

    session.currentFloor++
    session.bossHp = RAID_FLOORS[session.currentFloor]?.hp || 0

    if (session.currentFloor >= RAID_FLOORS.length) {
      delete guildRaidSessions[jid]
      await sock.sendMessage(jid, {
        text: floorText + `🎉 *ALL FLOORS CLEARED!*\n\n🏆 Guild Raid Complete!`,
        mentions,
      })
      return
    }

    const nextFloor = RAID_FLOORS[session.currentFloor]
    await sock.sendMessage(jid, {
      text:
        floorText +
        `⬆️ *ADVANCING TO FLOOR ${nextFloor.floor}!*\n\n` +
        `${nextFloor.emoji} *${nextFloor.name}* — ${nextFloor.hp} HP\n` +
        `⚡ Ability: *${nextFloor.ability}*\n\n` +
        `Use *.raidattack* to fight!`,
      mentions,
    })
    return
  }

  const bossMaxHp = RAID_FLOORS[session.currentFloor]?.hp || floor.hp
  await sock.sendMessage(jid, {
    text:
      `⚔️ *GUILD RAID — FLOOR ${floor.floor}*\n\n` +
      `${floor.emoji} *${floor.name}*\n` +
      `💀 Boss HP: ${hpBar(session.bossHp, bossMaxHp)} \`${session.bossHp}/${bossMaxHp}\`\n\n` +
      `━━━━━━━━━━━━━━━\n\n` +
      `🗡️ *Raider Attacks:*\n${attackLines.join('\n')}\n\n` +
      `📊 *Total Damage:* ${totalDmg}\n\n` +
      `━━━━━━━━━━━━━━━\n\n` +
      `${bossText}\n\n` +
      `👥 *Raider Status:*\n${raidersText}\n\n` +
      (aliveRaiders.length > 0
        ? `Use *.raidattack* to continue!`
        : `💀 All raiders defeated! Raid failed.`),
    mentions,
  })

  if (aliveRaiders.length === 0) {
    delete guildRaidSessions[jid]
  }
}

module.exports = {
  async guild({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const action = args[0]?.toLowerCase()
    if (!action) {
      const myGuild = await db.getUserGuild(sender)
      if (!myGuild) {
        return reply(`⚔️ *GUILD SYSTEM*\n\n👤 ${u.name || sender}\n\n❌ You are not in a guild.\n\n━━━━━━━━━━━━━━━\n\n🎮 *Commands:*\n• *.guild create <name>*\n• *.guild join <name>*\n• *.guild list*\n• *.guild info*\n• *.guild leave*\n• *.guildraid*\n• *.guildbattle*\n• *.guildleaderboard*`)
      }
      return reply(`⚔️ *GUILD INFO*\n\n👤 ${u.name || sender}\n🏰 Guild: ${myGuild.name}\n🎖️ Role: ${myGuild.is_leader ? 'Guild Leader 👑' : 'Member'}\n\n👥 Members: ${myGuild.member_count || 1}\n⭐ Level: ${myGuild.level || 1}\n💰 Treasury: ${myGuild.treasury || 0} coins\n💎 Gems: ${myGuild.gems || 0}`)
    }

    if (action === 'create') {
      const name = args.slice(1).join(' ')
      if (!name) return reply('⚠️ Usage: .guild create <name>')
      const existing = await db.getUserGuild(sender)
      if (existing) return reply('❌ You are already in a guild! Leave first.')
      const cost = 1000
      if ((u.wallet || 0) < cost) return reply(`❌ Need ${cost} coins. You have: ${u.wallet || 0}`)
      const guild = await db.createGuild(name, sender)
      if (!guild) return reply('❌ Failed — name may be taken.')
      await db.updateUser(sender, { wallet: (u.wallet || 0) - cost })
      return reply(`⚔️ *GUILD CREATED*\n\n🏰 *${name}*\n👑 Leader: ${u.name || sender}\n💰 Cost: ${cost} coins\n\nInvite others with *.guild join ${name}*`)
    }

    if (action === 'join') {
      const name = args.slice(1).join(' ')
      if (!name) return reply('⚠️ Usage: .guild join <name>')
      const existing = await db.getUserGuild(sender)
      if (existing) return reply('❌ Leave your current guild first.')
      const guild = await db.getGuildByName(name)
      if (!guild) return reply('❌ Guild not found.')
      await db.joinGuild(sender, guild.id)
      return reply(`✅ *JOINED GUILD*\n\n🏰 ${guild.name}`)
    }

    if (action === 'leave') {
      const myGuild = await db.getUserGuild(sender)
      if (!myGuild) return reply('❌ You are not in a guild.')
      if (myGuild.is_leader) return reply('❌ Leaders cannot leave! Use *.guild disband* or transfer leadership.')
      await db.leaveGuild(sender, myGuild.guild_id)
      return reply(`👋 Left *${myGuild.name}*.`)
    }

    if (action === 'list') {
      const guilds = await db.listGuilds()
      if (!guilds.length) return reply('📋 No guilds yet. Create one with *.guild create <name>*')
      const list = guilds.slice(0, 10).map((g, i) => `${i + 1}. ${g.name} (Lv.${g.level || 1}) — ${g.member_count || 0} members`).join('\n')
      return reply(`🏰 *GUILD LIST*\n\n${list}`)
    }

    if (action === 'info') {
      const name = args.slice(1).join(' ')
      const myGuild = name ? await db.getGuildByName(name) : await db.getUserGuild(sender)
      if (!myGuild) return reply('❌ Guild not found.')
      return reply(`🏰 *${myGuild.name}*\n\n⭐ Level: ${myGuild.level || 1}\n👥 Members: ${myGuild.member_count || 0}/50\n💰 Treasury: ${myGuild.treasury || 0} coins\n💎 Gems: ${myGuild.gems || 0}\n🏆 Wins: ${myGuild.wins || 0} | ❌ Losses: ${myGuild.losses || 0}`)
    }

    if (action === 'disband') {
      const myGuild = await db.getUserGuild(sender)
      if (!myGuild?.is_leader) return reply('❌ Only guild leaders can disband.')
      await db.disbandGuild(myGuild.guild_id)
      return reply(`💀 *${myGuild.name}* has been disbanded.`)
    }

    await reply('⚠️ Unknown action. Use *.guild* to see commands.')
  },

  async guildraid({ sock, jid, msg, reply, sender, user, isGroup }) {
    if (!isGroup) return reply('❌ Guild raids must be started in a group chat!')

    const myGuild = await db.getUserGuild(sender)
    if (!myGuild) return reply('❌ You must be in a guild to start a raid!')
    if (!myGuild.is_leader) return reply('❌ Only the guild leader can start a raid!')

    if (guildRaidSessions[jid]) {
      const s = guildRaidSessions[jid]
      const floor = RAID_FLOORS[s.currentFloor]
      const mentions = s.raiders.map(r => r.jid)
      await sock.sendMessage(jid, {
        text: `⚔️ *RAID IN PROGRESS*\n\n🏰 ${myGuild.name}\n${floor?.emoji || '🌑'} Floor ${s.currentFloor + 1} — ${floor?.name || 'Unknown'}\nBoss HP: ${s.bossHp} | Raiders: ${s.raiders.length}\n\nUse *.raidattack* to fight!`,
        mentions,
      }, { quoted: msg })
      return
    }

    guildRaidSessions[jid] = {
      guildId: myGuild.guild_id,
      guildName: myGuild.name,
      leaderId: sender,
      raiders: [],
      currentFloor: 0,
      bossHp: RAID_FLOORS[0].hp,
      started: false,
      joinWindowOpen: true,
    }

    const u = user || await db.getOrCreateUser(sender)
    const leaderHp = 150 + (u.level || 1) * 15
    guildRaidSessions[jid].raiders.push({
      phone: sender,
      jid: `${sender}@s.whatsapp.net`,
      hp: leaderHp,
      maxHp: leaderHp,
      atk: 40 + (u.level || 1) * 5,
    })

    const firstFloor = RAID_FLOORS[0]

    const raidText =
      `🏰 *GUILD RAID STARTING!*\n\n` +
      `👑 *${myGuild.name}* — Led by @${sender}\n\n` +
      `━━━━━━━━━━━━━━━\n\n` +
      `${firstFloor.emoji} *Floor 1 Boss: ${firstFloor.name}*\n` +
      `💀 HP: ${firstFloor.hp}\n` +
      `⚡ Ability: *${firstFloor.ability}*\n\n` +
      `━━━━━━━━━━━━━━━\n\n` +
      `📣 Use *.raidjoin* to join!\n` +
      `⏳ Join window: *60 seconds*`

    if (fs.existsSync(GUILD_RAID_IMAGE)) {
      await sock.sendMessage(jid, {
        image: { url: GUILD_RAID_IMAGE },
        caption: raidText,
        mentions: [`${sender}@s.whatsapp.net`],
      }, { quoted: msg })
    } else {
      await sock.sendMessage(jid, {
        text: raidText,
        mentions: [`${sender}@s.whatsapp.net`],
      }, { quoted: msg })
    }

    setTimeout(async () => {
      const s = guildRaidSessions[jid]
      if (!s || s.started) return
      s.joinWindowOpen = false
      s.started = true

      if (s.raiders.length < 1) {
        delete guildRaidSessions[jid]
        await sock.sendMessage(jid, {
          text: `❌ *RAID CANCELLED*\n\nNot enough members joined.`,
        })
        return
      }

      const mentions = s.raiders.map(r => r.jid)
      const floor = RAID_FLOORS[0]

      await sock.sendMessage(jid, {
        text:
          `⚔️ *RAID BEGINS!*\n\n` +
          `🏰 *${s.guildName}*\n` +
          `👥 *${s.raiders.length} Raiders:*\n${s.raiders.map(r => `• @${r.phone}`).join('\n')}\n\n` +
          `━━━━━━━━━━━━━━━\n\n` +
          `${floor.emoji} *FLOOR 1: ${floor.name}*\n` +
          `💀 Boss HP: ${floor.hp}\n` +
          `⚡ Ability: *${floor.ability}*\n\n` +
          `⚔️ Use *.raidattack* to fight!`,
        mentions,
      })
    }, 60000)
  },

  async raidjoin({ sock, jid, msg, reply, sender, user, isGroup }) {
    if (!isGroup) return reply('❌ Use this in the group where the raid was started!')

    const s = guildRaidSessions[jid]
    if (!s) return reply('❌ No raid is active here. The guild leader must use *.guildraid* first.')
    if (!s.joinWindowOpen) return reply('❌ The join window has closed. Wait for the next raid!')
    if (s.started) return reply('❌ Raid already started. You cannot join now.')

    const alreadyIn = s.raiders.find(r => r.phone === sender)
    if (alreadyIn) return reply('✅ You are already in the raid!')

    const myGuild = await db.getUserGuild(sender)
    const u = user || await db.getOrCreateUser(sender)
    const raiderHp = 150 + (u.level || 1) * 15
    s.raiders.push({
      phone: sender,
      jid: `${sender}@s.whatsapp.net`,
      hp: raiderHp,
      maxHp: raiderHp,
      atk: 40 + (u.level || 1) * 5,
    })

    const guildTag = myGuild ? `[${myGuild.name}]` : ''
    await sock.sendMessage(jid, {
      text:
        `✅ *RAIDER JOINED!*\n\n` +
        `⚔️ @${sender} ${guildTag}\n` +
        `❤️ HP: ${raiderHp} | ⚔️ ATK: ${40 + (u.level || 1) * 5}\n\n` +
        `👥 Total Raiders: ${s.raiders.length}`,
      mentions: [`${sender}@s.whatsapp.net`],
    }, { quoted: msg })
  },

  async raidattack({ sock, jid, msg, reply, sender, isGroup }) {
    if (!isGroup) return reply('❌ Use this in the raid group!')

    const s = guildRaidSessions[jid]
    if (!s) return reply('❌ No raid active here. Start one with *.guildraid*')
    if (!s.started) return reply('❌ The raid hasn\'t started yet — wait for the join window to close.')
    if (!s.joinWindowOpen && s.started) {
      const raider = s.raiders.find(r => r.phone === sender)
      if (!raider) return reply('❌ You are not in this raid.')
      if (raider.hp <= 0) return reply('💀 You have been defeated! Watch your guildmates fight.')
    }

    await processRaidFloor(sock, jid, s)
  },

  async guildbattle({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const myGuild = await db.getUserGuild(sender)
    if (!myGuild) return reply('❌ You need to be in a guild to battle!')
    if (!myGuild.is_leader) return reply('❌ Only guild leaders can initiate battles!')
    const targetName = args.join(' ')
    if (!targetName) return reply('⚠️ Usage: .guildbattle <guild name>')
    const targetGuild = await db.getGuildByName(targetName)
    if (!targetGuild) return reply(`❌ Guild "${targetName}" not found.`)
    if (targetGuild.id === myGuild.guild_id) return reply('❌ You can\'t battle your own guild!')
    const myScore = (myGuild.level || 1) * 100 + (myGuild.member_count || 1) * 50 + Math.random() * 200
    const theirScore = (targetGuild.level || 1) * 100 + (targetGuild.member_count || 1) * 50 + Math.random() * 200
    const won = myScore > theirScore
    const reward = 500
    if (won) {
      await db.updateGuild(myGuild.guild_id, { wins: (myGuild.wins || 0) + 1, treasury: (myGuild.treasury || 0) + reward })
      await db.updateGuild(targetGuild.id, { losses: (targetGuild.losses || 0) + 1 })
    } else {
      await db.updateGuild(myGuild.guild_id, { losses: (myGuild.losses || 0) + 1 })
      await db.updateGuild(targetGuild.id, { wins: (targetGuild.wins || 0) + 1, treasury: (targetGuild.treasury || 0) + reward })
    }
    await reply(`⚔️ *GUILD BATTLE*\n\n🏰 *${myGuild.name}* vs *${targetGuild.name}*\n\n💥 Score:\n${myGuild.name}: ${Math.floor(myScore)}\n${targetGuild.name}: ${Math.floor(theirScore)}\n\n🏆 Winner: *${won ? myGuild.name : targetGuild.name}*\n💰 +${reward} coins to treasury`)
  },

  async guildleaderboard({ reply }) {
    const guilds = await db.listGuilds()
    if (!guilds.length) return reply('📊 No guilds yet.')
    const sorted = guilds.sort((a, b) => (b.wins || 0) - (a.wins || 0)).slice(0, 10)
    const list = sorted.map((g, i) => `${i + 1}. ${g.name} — ${g.wins || 0}W/${g.losses || 0}L (Lv.${g.level || 1})`).join('\n')
    await reply(`🏆 *GUILD LEADERBOARD*\n\n${list}`)
  },

  async glb(ctx) { return module.exports.guildleaderboard(ctx) },

  async guilddonation({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('⚠️ Usage: .guilddonation <amount>')
    const myGuild = await db.getUserGuild(sender)
    if (!myGuild) return reply('❌ You are not in a guild.')
    if ((u.wallet || 0) < amount) return reply('❌ Not enough coins!')
    await db.updateUser(sender, { wallet: (u.wallet || 0) - amount })
    await db.updateGuild(myGuild.guild_id, { treasury: (myGuild.treasury || 0) + amount })
    await reply(`💰 *GUILD DONATION*\n\n🏰 ${myGuild.name}\n💸 Donated: ${amount} coins`)
  },

  async guildinvite({ sock, msg, jid, reply, sender }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: .guildinvite @user')
    const myGuild = await db.getUserGuild(sender)
    if (!myGuild) return reply('❌ You are not in a guild.')
    if (!myGuild.is_leader) return reply('❌ Only leaders can invite members.')
    const target = mentioned[0].split('@')[0]
    await sock.sendMessage(jid, {
      text: `⚔️ *GUILD INVITE*\n\n👤 @${sender} invited @${target} to *${myGuild.name}*!\n\n💡 Use *.guild join ${myGuild.name}* to accept.`,
      mentions: [msg.key.participant || msg.key.remoteJid, mentioned[0]]
    }, { quoted: msg })
  },
}
