# Shadow Garden Bot - Manual Patches

Apply these changes to files that were too large to include in full.
All line numbers refer to the **original** files in your bot directory.

---

## 1. commands/rpg.js - Dungeon Floor Fix

**Problem:** After clearing a floor, the bot immediately spawns the next monster.
The fix makes it wait - type `.dungeon` again to advance to the next floor.

### Change A: `dungeon` handler (around line 394-406)

**FIND this block:**
```js
  async dungeon({ sock, jid, msg, reply, sender, user }) {
    if (dungeonSessions[sender]) {
      const s = dungeonSessions[sender]
      const cls = getClassForUser(user)
      const abilityList = cls
        ? cls.abilities.map(a => `• *.${a}*`).join('\n')
        : `⚔️ *.attack* | 💥 *.heavy* | 🛡️ *.defend* | 🌟 *.special* | 🧪 *.heal* | 🏃 *.flee*`
      return reply(
        `🏰 *DUNGEON IN PROGRESS*\n\nFloor: ${s.floor}\nHP: ${s.playerHp}/${s.playerMaxHp}\n\n` +
        (cls ? `${cls.emoji} *${cls.name}* Abilities:\n${abilityList}\n\n` : '') +
        `_Or use: *.attack* *.heavy* *.defend* *.special* *.heal* *.flee*_ 🖤`
      )
    }
```

**REPLACE WITH:**
```js
  async dungeon({ sock, jid, msg, reply, sender, user }) {
    if (dungeonSessions[sender]) {
      const s = dungeonSessions[sender]

      // If waiting for player to advance to next floor, do it now
      if (s.waitingForNext) {
        s.waitingForNext = false
        const u = user || await db.getOrCreateUser(sender)
        const cls = getClassForUser(u)
        const zone   = getZoneDesc(s.floor)
        const intro  = ENEMY_INTROS[Math.floor(Math.random() * ENEMY_INTROS.length)]
        const battleText =
          `🏰 *SHADOW DUNGEON - FLOOR ${s.floor}*\n` +
          `${zone}\n\n` +
          `👤 *${u.name || sender}*  •  📊 Lv.${u.level || 1}${cls ? `  •  ${cls.emoji} ${cls.name}` : ''}\n\n` +
          `------------------------\n\n` +
          `💀 *${s.enemy.name}* (Lv.${s.enemy.level}) ${intro}\n` +
          `⚡ Ability: *${s.enemy.ability.name}* - _${s.enemy.ability.desc}_\n\n` +
          `------------------------\n\n` +
          `⚔️  YOU        ${hpBar(s.playerHp, s.playerMaxHp)}  ${s.playerHp}/${s.playerMaxHp}\n` +
          `👾 ${s.enemy.name.padEnd(10)} ${hpBar(s.enemy.hp, s.enemy.hp)}  ${s.enemy.hp}/${s.enemy.hp}\n\n` +
          `------------------------\n\n` +
          (cls ? `${cls.emoji} *Class Moves:*\n${cls.abilities.map(a => `• *.${a}*`).join('  ')}\n\n` : '') +
          `📖 *Basic:*  *.attack*  *.heavy*  *.defend*  *.special*  *.heal*  *.flee*\n\n` +
          `_The darkness watches. Choose wisely._ 🖤`
        try {
          const imgBuffer = await fetchDungeonImage(s.enemy, s.floor)
          if (imgBuffer && imgBuffer.length > 500) {
            await sock.sendMessage(jid, { image: imgBuffer, caption: battleText }, { quoted: msg })
          } else {
            await reply(battleText)
          }
        } catch {
          await reply(battleText)
        }
        return
      }

      const cls = getClassForUser(user)
      const abilityList = cls
        ? cls.abilities.map(a => `• *.${a}*`).join('\n')
        : `⚔️ *.attack* | 💥 *.heavy* | 🛡️ *.defend* | 🌟 *.special* | 🧪 *.heal* | 🏃 *.flee*`
      return reply(
        `🏰 *DUNGEON IN PROGRESS*\n\nFloor: ${s.floor}\nHP: ${s.playerHp}/${s.playerMaxHp}\n\n` +
        (cls ? `${cls.emoji} *${cls.name}* Abilities:\n${abilityList}\n\n` : '') +
        `_Or use: *.attack* *.heavy* *.defend* *.special* *.heal* *.flee*_ 🖤`
      )
    }
```

---

### Change B: `_dungeonWin` function (around line 1000-1073)

**FIND the block that starts:**
```js
    // Advance session to next floor
    session.floor    = nextFloor
    session.enemy    = getEnemy(nextFloor, newLevel)
    session.enemy.currentHp = session.enemy.hp
    session.defending = false
    session.poisonTurns = 0

    await db.setCooldown(sender, 'dungeon', 10 * 60)

    const hpPct    = session.playerHp / session.playerMaxHp
    const hpStatus = hpPct > 0.7 ? '💪 Barely scratched!' : hpPct > 0.4 ? '😤 Bloodied but standing.' : '😰 Barely alive…'
    const nextZone = getZoneDesc(nextFloor)
    const nextIntro = ENEMY_INTROS[Math.floor(Math.random() * ENEMY_INTROS.length)]

    const winText =
      `✅ *FLOOR ${clearedFloor} CLEARED!*${milestone ? '  👑 *MILESTONE BONUS!*' : ''}\n\n` +
      ...
      `🚪 *Descending to Floor ${nextFloor}…*\n` +
      `${nextZone}\n\n` +
      `👾 *${session.enemy.name}* (Lv.${session.enemy.level}) ${nextIntro}\n` +
      ...
      `_The shadows grow thicker with every step._ 🖤`

    // Send loot summary as plain text, then follow with new monster preview
    await reply(winText)
    try {
      const monsterImg = await fetchMonsterImage(session.enemy.name)
      ...
    } catch {}
  },
```

**REPLACE from "// Advance session to next floor" to end of function with:**
```js
    // Set up next floor in session but DON'T show it yet - wait for player to type .dungeon
    session.floor       = nextFloor
    session.enemy       = getEnemy(nextFloor, newLevel)
    session.enemy.currentHp = session.enemy.hp
    session.defending   = false
    session.poisonTurns = 0
    session.waitingForNext = true  // player must type .dungeon to see next monster

    await db.setCooldown(sender, 'dungeon', 10 * 60)

    const hpPct    = session.playerHp / session.playerMaxHp
    const hpStatus = hpPct > 0.7 ? '💪 Barely scratched!' : hpPct > 0.4 ? '😤 Bloodied but standing.' : '😰 Barely alive...'

    const winText =
      `✅ *FLOOR ${clearedFloor} CLEARED!*${milestone ? '  👑 *MILESTONE BONUS!*' : ''}\n\n` +
      `------------------------\n` +
      `👤 *${user.name || sender}*\n` +
      `❤️  HP: ${session.playerHp}/${session.playerMaxHp}  ${hpStatus}\n` +
      `💔 Damage taken: ${damageTaken}\n` +
      `------------------------\n\n` +
      `🎁 *LOOT COLLECTED*\n` +
      `   💰  +$${reward.coins.toLocaleString()}\n` +
      `   💎  +${reward.gems} gems\n` +
      `   ⭐  +${reward.xp} XP\n` +
      (milestone ? `   👑  *MILESTONE BONUS - double loot!*\n` : '') +
      (levelUp   ? `\n🎉 *LEVEL UP!*  ->  Level *${newLevel}*!\n` : '') +
      `\n------------------------\n` +
      `🚪 Floor ${nextFloor} awaits...\n\n` +
      `Type *.dungeon* to face the next enemy! 🖤`

    await reply(winText)
  },
```

---

## 2. commands/pokemon.js - Fix Silent Catch Save Failure

**Problem:** When a Pokemon is caught, the save silently fails with an empty `catch {}`,
so the Pokemon never actually gets stored. Also array fields need to be JSON-safe.

### Change: `catch` command (around line 427-434)

**FIND:**
```js
    try {
      await db.addPokemon(sender, {
        pokemon_id: poke.id, name: poke.name, types: poke.types,
        level: 1, xp: 0, moves: poke.moves || [], abilities: poke.abilities || [],
        ball: ballKey, slot, in_party: true, base_xp: poke.baseXp,
        height: poke.height, weight: poke.weight, location: poke.location,
      })
    } catch {}
```

**REPLACE WITH:**
```js
    const saveResult = await db.addPokemon(sender, {
      pokemon_id: poke.id,
      name: poke.name,
      types: Array.isArray(poke.types) ? JSON.stringify(poke.types) : poke.types || '[]',
      level: 1,
      xp: 0,
      moves: JSON.stringify(poke.moves || []),
      abilities: JSON.stringify(poke.abilities || []),
      ball: ballKey,
      slot,
      in_party: true,
      base_xp: poke.baseXp,
      height: poke.height,
      weight: poke.weight,
      location: poke.location,
    }).catch(err => {
      console.error('[pokemon] addPokemon failed:', err?.message || err)
      return null
    })

    if (!saveResult) {
      console.error('[pokemon] Save returned null for:', poke.name, 'sender:', sender)
    }
```

---

## 3. commands/economy.js - Health Potion Alias Fix

Find the `.use` command in `economy.js` and add this alias normalization near the top of the use handler, before looking up the item:

**FIND the start of the `use` handler:**
```js
  async use({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const itemRaw = args.join(' ').toLowerCase().trim()
```

**REPLACE WITH:**
```js
  async use({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const rawInput = args.join(' ').toLowerCase().trim()

    // Normalize item name aliases
    const ITEM_ALIASES = {
      'health potion': 'potion',
      'healthpotion':  'potion',
      'hp potion':     'potion',
      'hppotion':      'potion',
      'heal potion':   'potion',
      'healpotion':    'potion',
      'hp pot':        'potion',
      'health pot':    'potion',
      'xp boost':      'xpboost',
      'xp booster':    'xpboost',
      'coin boost':    'coinboost',
      'coin booster':  'coinboost',
    }
    const itemRaw = ITEM_ALIASES[rawInput] || rawInput
```

---

## 4. commands/rpg.js - RPG XP separate from normal XP (optional)

If you want dungeon/adventure XP to be stored separately in `rpg_xp` rather than the main `xp` column:

In `_dungeonWin` (after you've applied patch #1), change this line:
```js
    const newXp    = (user.xp || 0) + reward.xp
    const xpNeeded = (user.level || 1) * 1000
    const levelUp  = newXp >= xpNeeded
    const newLevel = levelUp ? (user.level || 1) + 1 : (user.level || 1)

    await db.updateUser(sender, {
      wallet: (user.wallet || 0) + reward.coins,
      gems:   (user.gems   || 0) + reward.gems,
      xp:     levelUp ? newXp - xpNeeded : newXp,
      level:  newLevel,
    })
```

To:
```js
    // RPG XP stored separately - does NOT affect normal xp/level
    const newRpgXp    = (user.rpg_xp || 0) + reward.xp
    const rpgXpNeeded = (user.rpg_level || 1) * 1000
    const rpgLevelUp  = newRpgXp >= rpgXpNeeded
    const newRpgLevel = rpgLevelUp ? (user.rpg_level || 1) + 1 : (user.rpg_level || 1)

    await db.updateUser(sender, {
      wallet:    (user.wallet || 0) + reward.coins,
      gems:      (user.gems   || 0) + reward.gems,
      rpg_xp:    rpgLevelUp ? newRpgXp - rpgXpNeeded : newRpgXp,
      rpg_level: newRpgLevel,
    })

    const levelUp  = rpgLevelUp
    const newLevel = newRpgLevel
```

> Make sure you ran `setup_v3.sql` first to add the `rpg_xp` and `rpg_level` columns.
