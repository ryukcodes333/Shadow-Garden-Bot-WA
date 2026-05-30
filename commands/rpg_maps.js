'use strict'

// ═══════════════════════════════════════════════════════════════════════════
//  AXEL WORLD MAP SYSTEM — Shadow Garden Bot
// ═══════════════════════════════════════════════════════════════════════════
//  Town: Axel  |  9×9 ASCII maps  |  Arrow exits: ￪ ￬ ❮ ❯
//  Player position tracked in memory.  Move with .move n/s/e/w
// ═══════════════════════════════════════════════════════════════════════════

const MAPS = {

  // ─── TIER 0 — AXEL TOWN (hub) ────────────────────────────────────────────
  'Axel Town': {
    display:
`🏠    🏠    🏠    🏠    ￪    🏠    🏠    🏠    🏠
🏠    -     -     -     -     -     -     -    🏠
🏠    -    🏪   -     -     -    🏥   -    🏠
❮     -     -     -     -     -     -     -    ❯
🏠    -    🏦   -     ⚲    -    ⚔️   -    🏠
🏠    -     -     -     -     -     -     -    🏠
🏠    -    📋   -     -     -    🍺   -    🏠
🏠    -     -     -     -     -     -     -    🏠
🏠    🏠    🏠    🏠    ￬    🏠    🏠    🏠    🏠`,
    exits: { north: 'Mushroom Grove', south: 'Green Plains', west: 'Training Grounds', east: 'Hunter Camp' },
    desc: '🏘️ *Axel Town* — The bustling adventurer hub of the region.',
    levelReq: 1,
    tiles: {
      '🏪': { name: 'Item Shop', desc: 'A cramped shop packed with potions and supplies.', type: 'shop' },
      '🏥': { name: 'Healing House', desc: 'A healer tends to wounded adventurers here.', type: 'heal' },
      '🏦': { name: 'Adventurers Bank', desc: 'Store your hard-earned coin safely.', type: 'bank' },
      '⚔️': { name: 'Weapon Stall', desc: 'Blades, bows, and staves line the rack.', type: 'shop' },
      '📋': { name: 'Quest Board', desc: 'Requests from townspeople pinned to a board.', type: 'quest' },
      '🍺': { name: 'The Broken Sword Tavern', desc: 'Adventurers trade stories over cheap ale.', type: 'rest' },
    },
    enemies: [],
  },

  // ─── TIER 1 ───────────────────────────────────────────────────────────────
  'Green Plains': {
    display:
` -     -     -     -     ￪    -     -     -     -
 -    🌻   -     -     -     -    🌻   -     -
 -     -     -     -     -     -     -     -     -
❮    -    🐇   -     -     -    🚜   -    ❯
 -     -     -     -     ⚲    -     -     -     -
 -     -     -     -     -     -     -     -     -
 -    🌾   -     -     -     -    🌾   -     -
 -     -     -     -     -     -     -     -     -
 -     -     -     -     ￬    -     -     -     -`,
    exits: { north: 'Axel Town', west: 'Wolf Woods', east: 'Abandoned Farm', south: 'Whispering Woods' },
    desc: '🌿 *Green Plains* — Rolling open grasslands just outside Axel.',
    levelReq: 1,
    tiles: {
      '🌻': { name: 'Sunflower Patch', desc: 'Golden flowers sway gently in the breeze.', type: 'gather', item: 'Sunflower' },
      '🐇': { name: 'Bunny Field', desc: 'Fluffy critters hop between the grass tufts.', type: 'enemy' },
      '🚜': { name: 'Abandoned Farm Entrance', desc: 'A rusted gate leads into a forgotten farmstead.', type: 'explore' },
      '🌾': { name: 'Open Grasslands', desc: 'A wide expanse ideal for training.', type: 'gather', item: 'Wheat' },
    },
    enemies: [
      { name: 'Forest Bunny',    hp: 25,  atk: 4,  xp: 8,   coins: 15,  level: 1 },
      { name: 'Plains Wolf Pup', hp: 40,  atk: 7,  xp: 14,  coins: 25,  level: 2 },
      { name: 'Wild Boar',       hp: 60,  atk: 10, xp: 20,  coins: 40,  level: 3 },
    ],
  },

  'Whispering Woods': {
    display:
`🌲    🌲    🌲    🌲    ￪    🌲    🌲    🌲    🌲
🌲    -     -     -     -     -     -     -    🌲
🌲    -    🍄   -     -     -    🍄   -    🌲
❮     -     -     -     -     -     -     -    ❯
🌲    -    🏕   -     ⚲    -    🐺   -    🌲
🌲    -     -     -     -     -     -     -    🌲
🌲    -    🕸   -     -     -    🌺   -    🌲
🌲    -     -     -     -     -     -     -    🌲
🌲    🌲    🌲    🌲    ￬    🌲    🌲    🌲    🌲`,
    exits: { north: 'Green Plains', west: 'Hunter Camp', east: 'Fairy Grove', south: 'Goblin Territory' },
    desc: '🌲 *Whispering Woods* — Ancient trees murmur secrets to those who listen.',
    levelReq: 3,
    tiles: {
      '🍄': { name: 'Mushroom Grove', desc: 'Giant glowing mushrooms pulse with faint magic.', type: 'gather', item: 'Magic Mushroom' },
      '🏕': { name: 'Hunter Camp', desc: 'Embers still warm from last night\'s fire.', type: 'rest' },
      '🐺': { name: 'Wolf Den', desc: 'Howls echo from behind the twisted roots.', type: 'enemy' },
      '🕸': { name: 'Spider Nest', desc: 'Thick webs stretch between the oaks.', type: 'enemy' },
      '🌺': { name: 'Enchanted Flowers', desc: 'Petals shimmer with residual magic energy.', type: 'gather', item: 'Enchanted Petal' },
    },
    enemies: [
      { name: 'Shadow Wolf',     hp: 80,  atk: 18, xp: 40,  coins: 60,  level: 4 },
      { name: 'Forest Spider',   hp: 65,  atk: 14, xp: 30,  coins: 45,  level: 3 },
      { name: 'Dark Treant',     hp: 110, atk: 22, xp: 55,  coins: 80,  level: 5 },
    ],
  },

  // ─── TIER 2 ───────────────────────────────────────────────────────────────
  'Goblin Territory': {
    display:
` -     -     -     -     ￪    -     -     -     -
 -    🪵   -     -     -     -    🪵   -     -
 -     -     -     -     -     -     -     -     -
❮    -    👺   -     -     -    🔥   -    ❯
 -     -     -     -     ⚲    -     -     -     -
 -     -     -     -     -     -     -     -     -
 -    ⚔    -     -     -     -    👑   -     -
 -     -     -     -     -     -     -     -     -
 -     -     -     -     ￬    -     -     -     -`,
    exits: { north: 'Whispering Woods', west: 'Training Grounds', east: 'Hidden Cave', south: 'Crystal Mine' },
    desc: '👺 *Goblin Territory* — Crude huts and campfires mark goblin land.',
    levelReq: 5,
    tiles: {
      '🪵': { name: 'Goblin Huts', desc: 'Ramshackle shelters made of stolen wood and bone.', type: 'explore' },
      '👺': { name: 'Goblin Scouts', desc: 'Small green figures clutch rusty spears.', type: 'enemy' },
      '🔥': { name: 'Bonfire Camp', desc: 'A large fire where goblins feast on stolen food.', type: 'enemy' },
      '⚔': { name: 'Training Grounds', desc: 'Goblins practice combat on straw dummies.', type: 'explore' },
      '👑': { name: 'Goblin Chief', desc: 'A massive goblin wearing a dented crown paces angrily.', type: 'boss' },
    },
    enemies: [
      { name: 'Goblin Scout',    hp: 90,  atk: 22, xp: 60,  coins: 90,  level: 5 },
      { name: 'Goblin Warrior',  hp: 130, atk: 30, xp: 90,  coins: 130, level: 7 },
      { name: 'Goblin Shaman',   hp: 100, atk: 35, xp: 80,  coins: 110, level: 6 },
      { name: 'Goblin Chief',    hp: 250, atk: 50, xp: 200, coins: 400, level: 8, isBoss: true },
    ],
  },

  'Crystal Mine': {
    display:
` -     -     -     -     ￪    -     -     -     -
 -    ⛏   -     -     -     -    💎   -     -
 -     -     -     -     -     -     -     -     -
❮    -    🦇   -     -     -    🌊   -    ❯
 -     -     -     -     ⚲    -     -     -     -
 -     -     -     -     -     -     -     -     -
 -    🪨   -     -     -     -    💰   -     -
 -     -     -     -     -     -     -     -     -
 -     -     -     -     ￬    -     -     -     -`,
    exits: { north: 'Goblin Territory', west: 'Bat Caverns', east: 'Underground Lake', south: 'Ancient Ruins' },
    desc: '⛏️ *Crystal Mine* — Jewel-lit tunnels carved deep into the earth.',
    levelReq: 8,
    tiles: {
      '⛏': { name: 'Mining Site', desc: 'Pickaxes lean against glittering walls.', type: 'gather', item: 'Raw Crystal' },
      '💎': { name: 'Crystal Vein', desc: 'A massive cluster of pure blue crystal.', type: 'gather', item: 'Gem Shard' },
      '🦇': { name: 'Bat Caverns', desc: 'A deafening screech fills the dark passage.', type: 'enemy' },
      '🌊': { name: 'Underground Lake', desc: 'Black water hides creatures beneath.', type: 'enemy' },
      '🪨': { name: 'Collapsed Tunnel', desc: 'Rubble blocks the old path — but something moves.', type: 'enemy' },
      '💰': { name: 'Treasure Chamber', desc: 'Glittering coins spill from a cracked chest.', type: 'gather', item: 'Ancient Coin' },
    },
    enemies: [
      { name: 'Crystal Bat',     hp: 120, atk: 35, xp: 100, coins: 150, level: 9 },
      { name: 'Stone Golem',     hp: 200, atk: 45, xp: 140, coins: 200, level: 11 },
      { name: 'Cave Serpent',    hp: 160, atk: 50, xp: 120, coins: 170, level: 10 },
    ],
  },

  // ─── TIER 3 ───────────────────────────────────────────────────────────────
  'Ancient Ruins': {
    display:
` -     -     -     -     ￪    -     -     -     -
 -    🗿   -     -     -     -    📚   -     -
 -     -     -     -     -     -     -     -     -
❮    -    ⚙   -     -     -    🧩   -    ❯
 -     -     -     -     ⚲    -     -     -     -
 -     -     -     -     -     -     -     -     -
 -    🏺   -     -     -     -    👻   -     -
 -     -     -     -     -     -     -     -     -
 -     -     -     -     ￬    -     -     -     -`,
    exits: { north: 'Crystal Mine', west: 'Machine Hall', east: 'Puzzle Hall', south: 'Forgotten Temple' },
    desc: '🗿 *Ancient Ruins* — Crumbling stone hides the secrets of a lost age.',
    levelReq: 12,
    tiles: {
      '🗿': { name: 'Ruined Courtyard', desc: 'Moss-covered statues watch silently.', type: 'explore' },
      '📚': { name: 'Lost Library', desc: 'Tomes written in a language no one speaks anymore.', type: 'gather', item: 'Ancient Tome' },
      '⚙': { name: 'Ancient Machine Room', desc: 'Gears still turn, defying centuries.', type: 'explore' },
      '🧩': { name: 'Puzzle Chamber', desc: 'Shifting floor tiles form a deadly pattern.', type: 'boss' },
      '🏺': { name: 'Relic Vault', desc: 'Sealed urns line the walls, thrumming with magic.', type: 'gather', item: 'Ancient Relic' },
      '👻': { name: 'Ancient Spirit', desc: 'A translucent figure drifts toward you.', type: 'enemy' },
    },
    enemies: [
      { name: 'Ruin Specter',    hp: 180, atk: 60, xp: 180, coins: 260, level: 13 },
      { name: 'Stone Guardian',  hp: 280, atk: 70, xp: 220, coins: 320, level: 15 },
      { name: 'Ancient Mage',    hp: 200, atk: 80, xp: 260, coins: 380, level: 14 },
    ],
  },

  'Forgotten Temple': {
    display:
` -     -     -     -     ￪    -     -     -     -
 -    ⛪   -     -     -     -    📜   -     -
 -     -     -     -     -     -     -     -     -
❮    -    🕯   -     -     -    🔔   -    ❯
 -     -     -     -     ⚲    -     -     -     -
 -     -     -     -     -     -     -     -     -
 -    👻   -     -     -     -    ✨   -     -
 -     -     -     -     -     -     -     -     -
 -     -     -     -     ￬    -     -     -     -`,
    exits: { north: 'Ancient Ruins', west: 'Prayer Hall', east: 'Sacred Archive', south: 'Dragon Mountain' },
    desc: '⛪ *Forgotten Temple* — Holy ground twisted by forgotten dark rituals.',
    levelReq: 15,
    tiles: {
      '⛪': { name: 'Main Sanctuary', desc: 'Shattered stained glass crunches underfoot.', type: 'explore' },
      '📜': { name: 'Sacred Archive', desc: 'Forbidden texts sealed behind runed glass.', type: 'gather', item: 'Sacred Scroll' },
      '🕯': { name: 'Prayer Hall', desc: 'Candles burn on their own in the dark.', type: 'rest' },
      '🔔': { name: 'Temple Bell', desc: 'Its ring banishes and summons in equal measure.', type: 'explore' },
      '👻': { name: 'Temple Spirit', desc: 'A wailing guardian spirit blocks the path.', type: 'enemy' },
      '✨': { name: 'Blessed Altar', desc: 'Resting here restores your strength.', type: 'heal' },
    },
    enemies: [
      { name: 'Corrupted Priest', hp: 240, atk: 85, xp: 300, coins: 450, level: 16 },
      { name: 'Temple Wraith',    hp: 200, atk: 95, xp: 280, coins: 400, level: 15 },
      { name: 'Undead Knight',    hp: 320, atk: 90, xp: 360, coins: 520, level: 18 },
    ],
  },

  // ─── TIER 4 ───────────────────────────────────────────────────────────────
  'Dragon Mountain': {
    display:
`⛰    ⛰    ⛰    ⛰    ￪    ⛰    ⛰    ⛰    ⛰
⛰    🔥   -     -     -     -    🔥   -    ⛰
⛰    -     -     -     -     -     -     -    ⛰
❮     -    🌋   -     -     -    🐲   -    ❯
⛰    -     -     -     ⚲    -     -     -    ⛰
⛰    -     -     -     -     -     -     -    ⛰
⛰    💎   -     -     -     -    🦴   -    ⛰
⛰    -     -     -     -     -     -     -    ⛰
⛰    ⛰    ⛰    ⛰    ￬    ⛰    ⛰    ⛰    ⛰`,
    exits: { north: 'Forgotten Temple', west: 'Lava Cliffs', east: 'Dragon Nest', south: 'Shadow Fortress' },
    desc: '⛰️ *Dragon Mountain* — The peak where dragons rule the scorching sky.',
    levelReq: 18,
    tiles: {
      '🔥': { name: 'Lava Pools', desc: 'Molten rock bubbles across the path.', type: 'danger' },
      '🌋': { name: 'Volcanic Crater', desc: 'Heat waves distort everything you see.', type: 'enemy' },
      '🐲': { name: 'Dragon Nest', desc: 'Three juvenile dragons circle a cracked egg.', type: 'boss' },
      '💎': { name: 'Dragon Hoard', desc: 'Mountains of stolen gold and gems.', type: 'gather', item: 'Dragon Scale' },
      '🦴': { name: 'Dragon Graveyard', desc: 'Ancient dragon bones as large as houses.', type: 'explore' },
    },
    enemies: [
      { name: 'Young Dragon',    hp: 400, atk: 120, xp: 500, coins: 800,  level: 20 },
      { name: 'Lava Elemental',  hp: 350, atk: 110, xp: 420, coins: 650,  level: 19 },
      { name: 'Dragon Whelp',    hp: 280, atk: 100, xp: 380, coins: 600,  level: 18 },
      { name: 'Elder Dragon',    hp: 700, atk: 150, xp: 900, coins: 1500, level: 23, isBoss: true },
    ],
  },

  'Shadow Fortress': {
    display:
` -     -     -     -     ￪    -     -     -     -
 -    ⚔   -     -     -     -    🔒   -     -
 -     -     -     -     -     -     -     -     -
❮    -    🌑   -     -     -    👹   -    ❯
 -     -     -     -     ⚲    -     -     -     -
 -     -     -     -     -     -     -     -     -
 -    🏰   -     -     -     -    💀   -     -
 -     -     -     -     -     -     -     -     -
 -     -     -     -     ￬    -     -     -     -`,
    exits: { north: 'Dragon Mountain', west: 'Shadow Hall', east: 'Demon General', south: "Demon King's Throne" },
    desc: '🏰 *Shadow Fortress* — The seat of darkness. Few return.',
    levelReq: 22,
    tiles: {
      '⚔': { name: 'War Courtyard', desc: 'Demon soldiers drill in endless formation.', type: 'enemy' },
      '🔒': { name: 'Prison Wing', desc: 'Captured adventurers reach through the bars.', type: 'explore' },
      '🌑': { name: 'Shadow Hall', desc: 'Darkness so thick you can feel it pressing in.', type: 'enemy' },
      '👹': { name: 'Demon General', desc: 'A towering demon in black armour awaits.', type: 'boss' },
      '🏰': { name: 'Fortress Core', desc: 'The beating dark heart of the stronghold.', type: 'enemy' },
      '💀': { name: 'Fallen Heroes Memorial', desc: 'Names carved into black stone — all who failed.', type: 'explore' },
    },
    enemies: [
      { name: 'Shadow Demon',    hp: 500, atk: 140, xp: 700,  coins: 1100, level: 23 },
      { name: 'Demon Soldier',   hp: 450, atk: 130, xp: 600,  coins: 950,  level: 22 },
      { name: 'Dark Warlord',    hp: 600, atk: 160, xp: 900,  coins: 1400, level: 25 },
      { name: 'Demon General',   hp: 900, atk: 190, xp: 1500, coins: 2500, level: 27, isBoss: true },
    ],
  },

  // ─── SIDE ZONES ──────────────────────────────────────────────────────────
  'Wolf Woods': {
    display:
`🌲    🌲    🌲    🌲    ￪    🌲    🌲    🌲    🌲
🌲    -     -     -     -     -     -     -    🌲
🌲    -    🐺   -     -     -    🐾   -    🌲
❮     -     -     -     -     -     -     -    ❯
🌲    -    🦌   -     ⚲    -    🌙   -    🌲
🌲    -     -     -     -     -     -     -    🌲
🌲    -    🪶   -     -     -    🌿   -    🌲
🌲    -     -     -     -     -     -     -    🌲
🌲    🌲    🌲    🌲    ￬    🌲    🌲    🌲    🌲`,
    exits: { north: 'Training Grounds', east: 'Green Plains', south: 'Hunter Camp', west: null },
    desc: '🐺 *Wolf Woods* — A dense forest where wolves hunt in packs.',
    levelReq: 2,
    tiles: {
      '🐺': { name: 'Wolf Pack', desc: 'A group of shadowy wolves circles you.', type: 'enemy' },
      '🐾': { name: 'Wolf Tracks', desc: 'Fresh prints lead deeper into the wood.', type: 'explore' },
      '🦌': { name: 'Deer Grove', desc: 'Peaceful deer graze, unaware of you.', type: 'gather', item: 'Deer Antler' },
      '🌙': { name: 'Moonlit Clearing', desc: 'A silvery glow bathes the open ground.', type: 'rest' },
      '🪶': { name: 'Raven Perch', desc: 'Black ravens watch you with unsettling intelligence.', type: 'explore' },
      '🌿': { name: 'Herb Patch', desc: 'Medicinal herbs grow in abundance here.', type: 'gather', item: 'Healing Herb' },
    },
    enemies: [
      { name: 'Shadow Wolf',     hp: 70,  atk: 16, xp: 35,  coins: 55,  level: 3 },
      { name: 'Alpha Wolf',      hp: 120, atk: 25, xp: 70,  coins: 100, level: 5 },
      { name: 'Dire Wolf',       hp: 160, atk: 32, xp: 95,  coins: 140, level: 6 },
    ],
  },

  'Abandoned Farm': {
    display:
` -     -     -     -     ￪    -     -     -     -
 -    🌾   -     -     -     -    🌾   -     -
 -     -     -     -     -     -     -     -     -
❮    -    🐓   -     -     -    🏚   -    ❯
 -     -     -     -     ⚲    -     -     -     -
 -     -     -     -     -     -     -     -     -
 -    🐀   -     -     -     -    🌫   -     -
 -     -     -     -     -     -     -     -     -
 -     -     -     -     ￬    -     -     -     -`,
    exits: { north: 'Fairy Grove', west: 'Green Plains', east: null, south: 'Hidden Cave' },
    desc: '🏚️ *Abandoned Farm* — Overgrown fields and collapsed barns hide dangers.',
    levelReq: 2,
    tiles: {
      '🌾': { name: 'Overgrown Fields', desc: 'Weeds have consumed what was once farmland.', type: 'gather', item: 'Wild Grain' },
      '🐓': { name: 'Feral Rooster', desc: 'An unnaturally large rooster guards the barn.', type: 'enemy' },
      '🏚': { name: 'Collapsed Barn', desc: 'Something large moved inside the rubble.', type: 'enemy' },
      '🐀': { name: 'Rat Nest', desc: 'Dozens of rats pour from holes in the floor.', type: 'enemy' },
      '🌫': { name: 'Foggy Corner', desc: 'A strange mist that doesn\'t lift.', type: 'explore' },
    },
    enemies: [
      { name: 'Giant Rat',       hp: 45,  atk: 9,  xp: 16,  coins: 28,  level: 2 },
      { name: 'Feral Rooster',   hp: 70,  atk: 15, xp: 28,  coins: 45,  level: 3 },
      { name: 'Scarecrow Golem', hp: 100, atk: 20, xp: 45,  coins: 70,  level: 4 },
    ],
  },

  'Training Grounds': {
    display:
` -     -     -     -     ￪    -     -     -     -
 -    🎯   -     -     -     -    🎯   -     -
 -     -     -     -     -     -     -     -     -
❮    -    ⚔️   -     -     -    🛡   -    ❯
 -     -     -     -     ⚲    -     -     -     -
 -     -     -     -     -     -     -     -     -
 -    🏋   -     -     -     -    📖   -     -
 -     -     -     -     -     -     -     -     -
 -     -     -     -     ￬    -     -     -     -`,
    exits: { north: 'Wolf Woods', east: 'Axel Town', south: 'Goblin Territory', west: null },
    desc: '⚔️ *Training Grounds* — Where adventurers sharpen their blades and resolve.',
    levelReq: 1,
    tiles: {
      '🎯': { name: 'Target Range', desc: 'Archers practice at hay-stuffed dummies.', type: 'explore' },
      '⚔️': { name: 'Sparring Ring', desc: 'Two warriors clash in a blur of steel.', type: 'enemy' },
      '🛡': { name: 'Shield Wall', desc: 'Knights train in defensive formation.', type: 'explore' },
      '🏋': { name: 'Strength Course', desc: 'Weights and obstacle courses for endurance.', type: 'gather', item: 'Strength Crystal' },
      '📖': { name: 'Tactics Library', desc: 'Battle strategies from veteran adventurers.', type: 'gather', item: 'Skill Manual' },
    },
    enemies: [
      { name: 'Training Dummy',  hp: 50,  atk: 8,  xp: 12,  coins: 20,  level: 1 },
      { name: 'Rookie Fighter',  hp: 75,  atk: 14, xp: 25,  coins: 35,  level: 2 },
    ],
  },

  'Hunter Camp': {
    display:
` -     -     -     -     ￪    -     -     -     -
 -    🏕   -     -     -     -    🏹   -     -
 -     -     -     -     -     -     -     -     -
❮    -    🔥   -     -     -    🎣   -    ❯
 -     -     -     -     ⚲    -     -     -     -
 -     -     -     -     -     -     -     -     -
 -    🪤   -     -     -     -    🗺   -     -
 -     -     -     -     -     -     -     -     -
 -     -     -     -     ￬    -     -     -     -`,
    exits: { north: 'Axel Town', west: 'Whispering Woods', east: null, south: 'Wolf Woods' },
    desc: '🏕️ *Hunter Camp* — A gathering of skilled hunters sharing lore and technique.',
    levelReq: 2,
    tiles: {
      '🏕': { name: 'Main Camp', desc: 'Hunters rest around a crackling fire.', type: 'rest' },
      '🏹': { name: 'Archery Post', desc: 'A master archer teaches his craft.', type: 'explore' },
      '🔥': { name: 'Cook Fire', desc: 'A hunter is preparing wild game for supper.', type: 'heal' },
      '🎣': { name: 'Stream Fishing Spot', desc: 'A quick stream winds through the camp.', type: 'gather', item: 'River Fish' },
      '🪤': { name: 'Trap Field', desc: 'Snares and pitfalls dot the ground.', type: 'explore' },
      '🗺': { name: 'Map Table', desc: 'A crude map of surrounding territories.', type: 'explore' },
    },
    enemies: [
      { name: 'Rogue Hunter',    hp: 80,  atk: 20, xp: 40,  coins: 60,  level: 3 },
    ],
  },

  'Fairy Grove': {
    display:
`✨    ✨    ✨    ✨    ￪    ✨    ✨    ✨    ✨
✨    -     -     -     -     -     -     -    ✨
✨    -    🧚   -     -     -    🌸   -    ✨
❮     -     -     -     -     -     -     -    ❯
✨    -    🌈   -     ⚲    -    🦋   -    ✨
✨    -     -     -     -     -     -     -    ✨
✨    -    🍯   -     -     -    🌟   -    ✨
✨    -     -     -     -     -     -     -    ✨
✨    ✨    ✨    ✨    ￬    ✨    ✨    ✨    ✨`,
    exits: { north: null, west: 'Whispering Woods', east: null, south: 'Abandoned Farm' },
    desc: '✨ *Fairy Grove* — A magical place where fairies dance in moonlight.',
    levelReq: 3,
    tiles: {
      '🧚': { name: 'Fairy Circle', desc: 'Tiny wings beat the air as fairies swirl.', type: 'explore' },
      '🌸': { name: 'Blossom Field', desc: 'Cherry blossoms drift in an eternal gentle wind.', type: 'gather', item: 'Fairy Blossom' },
      '🌈': { name: 'Rainbow Spring', desc: 'Drinking this water restores vitality.', type: 'heal' },
      '🦋': { name: 'Butterfly Meadow', desc: 'Giant magical butterflies flutter around you.', type: 'gather', item: 'Magic Dust' },
      '🍯': { name: 'Honey Hive', desc: 'Giant bees guard a hive of enchanted honey.', type: 'enemy' },
      '🌟': { name: 'Star Fragment', desc: 'A shard of fallen starlight pulses with power.', type: 'gather', item: 'Star Shard' },
    },
    enemies: [
      { name: 'Giant Bee',       hp: 55,  atk: 12, xp: 20,  coins: 35,  level: 3 },
      { name: 'Dark Fairy',      hp: 70,  atk: 18, xp: 32,  coins: 50,  level: 4 },
    ],
  },

  'Hidden Cave': {
    display:
`🪨    🪨    🪨    🪨    ￪    🪨    🪨    🪨    🪨
🪨    -     -     -     -     -     -     -    🪨
🪨    -    💎   -     -     -    🦎   -    🪨
❮     -     -     -     -     -     -     -    ❯
🪨    -    🌑   -     ⚲    -    🍄   -    🪨
🪨    -     -     -     -     -     -     -    🪨
🪨    -    👣   -     -     -    ⛓   -    🪨
🪨    -     -     -     -     -     -     -    🪨
🪨    🪨    🪨    🪨    ￬    🪨    🪨    🪨    🪨`,
    exits: { north: 'Abandoned Farm', west: 'Goblin Territory', east: null, south: 'Bat Caverns' },
    desc: '🪨 *Hidden Cave* — A damp cavern rarely found by outsiders.',
    levelReq: 5,
    tiles: {
      '💎': { name: 'Gem Deposit', desc: 'Rough gems embedded in the cave wall.', type: 'gather', item: 'Rough Gem' },
      '🦎': { name: 'Lizard Colony', desc: 'Dozens of large lizards cling to the ceiling.', type: 'enemy' },
      '🌑': { name: 'Dark Pool', desc: 'Pitch-black water with no visible bottom.', type: 'explore' },
      '🍄': { name: 'Cave Mushrooms', desc: 'Glowing fungi illuminate the passage.', type: 'gather', item: 'Cave Mushroom' },
      '👣': { name: 'Strange Tracks', desc: 'Footprints too large to be human.', type: 'explore' },
      '⛓': { name: 'Rusty Chains', desc: 'Old shackles — someone was kept here.', type: 'explore' },
    },
    enemies: [
      { name: 'Cave Lizard',     hp: 90,  atk: 22, xp: 55,  coins: 80,  level: 5 },
      { name: 'Rock Troll',      hp: 160, atk: 38, xp: 100, coins: 150, level: 7 },
      { name: 'Shadow Crawler',  hp: 110, atk: 30, xp: 75,  coins: 110, level: 6 },
    ],
  },

  'Bat Caverns': {
    display:
`🪨    🪨    🪨    🪨    ￪    🪨    🪨    🪨    🪨
🪨    -     -     -     -     -     -     -    🪨
🪨    -    🦇   -     -     -    🦇   -    🪨
❮     -     -     -     -     -     -     -    ❯
🪨    -    💀   -     ⚲    -    🕷   -    🪨
🪨    -     -     -     -     -     -     -    🪨
🪨    -    🌑   -     -     -    🪙   -    🪨
🪨    -     -     -     -     -     -     -    🪨
🪨    🪨    🪨    🪨    ￬    🪨    🪨    🪨    🪨`,
    exits: { north: 'Hidden Cave', east: 'Crystal Mine', south: 'Underground Lake', west: null },
    desc: '🦇 *Bat Caverns* — The shrieking darkness is home to thousands of bats.',
    levelReq: 7,
    tiles: {
      '🦇': { name: 'Bat Colony', desc: 'The ceiling writhes with hanging bats.', type: 'enemy' },
      '💀': { name: 'Bone Pile', desc: 'Remains of adventurers who didn\'t make it.', type: 'explore' },
      '🕷': { name: 'Shadow Spider', desc: 'A web-spinner larger than a horse lurks here.', type: 'enemy' },
      '🌑': { name: 'Dark Shrine', desc: 'Something dark was worshipped here.', type: 'explore' },
      '🪙': { name: 'Old Coins', desc: 'Scattered coins from a forgotten era.', type: 'gather', item: 'Old Coin' },
    },
    enemies: [
      { name: 'Giant Bat',       hp: 100, atk: 28, xp: 70,  coins: 100, level: 7 },
      { name: 'Shadow Spider',   hp: 140, atk: 38, xp: 100, coins: 150, level: 9 },
      { name: 'Vampire Bat',     hp: 120, atk: 33, xp: 85,  coins: 125, level: 8 },
    ],
  },

  'Underground Lake': {
    display:
`🌊    🌊    🌊    🌊    ￪    🌊    🌊    🌊    🌊
🌊    -     -     -     -     -     -     -    🌊
🌊    -    🐊   -     -     -    🦑   -    🌊
❮     -     -     -     -     -     -     -    ❯
🌊    -    ⛵   -     ⚲    -    🐙   -    🌊
🌊    -     -     -     -     -     -     -    🌊
🌊    -    💎   -     -     -    🌿   -    🌊
🌊    -     -     -     -     -     -     -    🌊
🌊    🌊    🌊    🌊    ￬    🌊    🌊    🌊    🌊`,
    exits: { north: 'Bat Caverns', west: 'Crystal Mine', south: null, east: null },
    desc: '🌊 *Underground Lake* — A massive subterranean sea teeming with aquatic horrors.',
    levelReq: 9,
    tiles: {
      '🐊': { name: 'Cave Crocodile', desc: 'A pale, eyeless croc blocks the shore.', type: 'enemy' },
      '🦑': { name: 'Shadow Squid', desc: 'Tentacles slap against the stone.', type: 'enemy' },
      '⛵': { name: 'Abandoned Boat', desc: 'A tiny rowboat, still intact somehow.', type: 'explore' },
      '🐙': { name: 'Lake Octopus', desc: 'Eight arms reach from the black water.', type: 'enemy' },
      '💎': { name: 'Lakebed Crystals', desc: 'Crystals grow on the exposed rock shore.', type: 'gather', item: 'Lake Crystal' },
      '🌿': { name: 'Cave Seaweed', desc: 'Phosphorescent seaweed glows softly.', type: 'gather', item: 'Cave Seaweed' },
    },
    enemies: [
      { name: 'Cave Crocodile',  hp: 150, atk: 42, xp: 110, coins: 160, level: 9 },
      { name: 'Shadow Squid',    hp: 130, atk: 38, xp: 95,  coins: 140, level: 8 },
      { name: 'Lake Serpent',    hp: 180, atk: 50, xp: 140, coins: 200, level: 11 },
    ],
  },

  'Machine Hall': {
    display:
`⚙    ⚙    ⚙    ⚙    ￪    ⚙    ⚙    ⚙    ⚙
⚙    -     -     -     -     -     -     -    ⚙
⚙    -    🤖   -     -     -    🔧   -    ⚙
❮     -     -     -     -     -     -     -    ❯
⚙    -    💡   -     ⚲    -    🔩   -    ⚙
⚙    -     -     -     -     -     -     -    ⚙
⚙    -    📡   -     -     -    ⚡   -    ⚙
⚙    -     -     -     -     -     -     -    ⚙
⚙    ⚙    ⚙    ⚙    ￬    ⚙    ⚙    ⚙    ⚙`,
    exits: { north: null, east: 'Ancient Ruins', south: null, west: null },
    desc: '⚙️ *Machine Hall* — Automatons whirr in this ancient mechanical complex.',
    levelReq: 12,
    tiles: {
      '🤖': { name: 'Ancient Automaton', desc: 'A mechanical knight, still functional after centuries.', type: 'enemy' },
      '🔧': { name: 'Workshop', desc: 'Tools for an unknown purpose line the shelves.', type: 'gather', item: 'Cog Fragment' },
      '💡': { name: 'Power Core', desc: 'Electrical energy crackles in a glass sphere.', type: 'explore' },
      '🔩': { name: 'Assembly Line', desc: 'Parts still move on ancient conveyor belts.', type: 'explore' },
      '📡': { name: 'Signal Tower', desc: 'Pulses at a regular interval to an unknown receiver.', type: 'explore' },
      '⚡': { name: 'Energy Node', desc: 'Touching it fills you with power — and pain.', type: 'danger' },
    },
    enemies: [
      { name: 'Clockwork Golem', hp: 200, atk: 65, xp: 200, coins: 300, level: 13 },
      { name: 'Steam Knight',    hp: 240, atk: 75, xp: 240, coins: 360, level: 14 },
      { name: 'Spark Drone',     hp: 160, atk: 55, xp: 160, coins: 240, level: 12 },
    ],
  },

  'Puzzle Hall': {
    display:
`🧩    🧩    🧩    🧩    ￪    🧩    🧩    🧩    🧩
🧩    -     -     -     -     -     -     -    🧩
🧩    -    🔮   -     -     -    📐   -    🧩
❮     -     -     -     -     -     -     -    ❯
🧩    -    🗝   -     ⚲    -    🚪   -    🧩
🧩    -     -     -     -     -     -     -    🧩
🧩    -    🌀   -     -     -    💎   -    🧩
🧩    -     -     -     -     -     -     -    🧩
🧩    🧩    🧩    🧩    ￬    🧩    🧩    🧩    🧩`,
    exits: { north: null, west: 'Ancient Ruins', south: null, east: null },
    desc: '🧩 *Puzzle Hall* — Cryptic riddles and shifting floors test the mind.',
    levelReq: 13,
    tiles: {
      '🔮': { name: 'Prophecy Stone', desc: 'Visions of possible futures flicker within.', type: 'explore' },
      '📐': { name: 'Geometric Chamber', desc: 'Shapes on the floor must be aligned correctly.', type: 'explore' },
      '🗝': { name: 'Key Altar', desc: 'A golden key rests on a pressure plate.', type: 'gather', item: 'Rune Key' },
      '🚪': { name: 'Sealed Gateway', desc: 'A door that won\'t open — yet.', type: 'explore' },
      '🌀': { name: 'Warp Circle', desc: 'Step on it and you\'ll be somewhere else entirely.', type: 'explore' },
      '💎': { name: 'Reward Chest', desc: 'A chest for those who solve the hall\'s riddles.', type: 'gather', item: 'Puzzle Gem' },
    },
    enemies: [
      { name: 'Riddle Golem',    hp: 190, atk: 68, xp: 210, coins: 320, level: 13 },
      { name: 'Phantom Guard',   hp: 170, atk: 72, xp: 195, coins: 290, level: 13 },
    ],
  },

  'Prayer Hall': {
    display:
`⛪    ⛪    ⛪    ⛪    ￪    ⛪    ⛪    ⛪    ⛪
⛪    -     -     -     -     -     -     -    ⛪
⛪    -    🕯   -     -     -    🙏   -    ⛪
❮     -     -     -     -     -     -     -    ❯
⛪    -    📿   -     ⚲    -    🌺   -    ⛪
⛪    -     -     -     -     -     -     -    ⛪
⛪    -    💧   -     -     -    ✨   -    ⛪
⛪    -     -     -     -     -     -     -    ⛪
⛪    ⛪    ⛪    ⛪    ￬    ⛪    ⛪    ⛪    ⛪`,
    exits: { north: null, east: 'Forgotten Temple', south: null, west: null },
    desc: '🙏 *Prayer Hall* — Holy silence, broken only by dripping water and distant chanting.',
    levelReq: 15,
    tiles: {
      '🕯': { name: 'Eternal Candles', desc: 'They\'ve never gone out in a thousand years.', type: 'explore' },
      '🙏': { name: 'Offering Altar', desc: 'Leave something behind, receive a blessing.', type: 'heal' },
      '📿': { name: 'Prayer Beads', desc: 'A relic of immense spiritual power.', type: 'gather', item: 'Holy Beads' },
      '🌺': { name: 'Sacred Garden', desc: 'Flowers bloom despite the darkness.', type: 'gather', item: 'Sacred Bloom' },
      '💧': { name: 'Holy Water Font', desc: 'Bathing wounds in this water heals them.', type: 'heal' },
      '✨': { name: 'Blessed Relic', desc: 'A glowing object of divine origin.', type: 'gather', item: 'Divine Shard' },
    },
    enemies: [
      { name: 'Cursed Devotee',  hp: 220, atk: 80, xp: 270, coins: 400, level: 16 },
      { name: 'Shadow Monk',     hp: 200, atk: 88, xp: 290, coins: 430, level: 16 },
    ],
  },

  'Sacred Archive': {
    display:
`📚    📚    📚    📚    ￪    📚    📚    📚    📚
📚    -     -     -     -     -     -     -    📚
📚    -    📜   -     -     -    🔍   -    📚
❮     -     -     -     -     -     -     -    ❯
📚    -    🗃   -     ⚲    -    🔐   -    📚
📚    -     -     -     -     -     -     -    📚
📚    -    🕰   -     -     -    💡   -    📚
📚    -     -     -     -     -     -     -    📚
📚    📚    📚    📚    ￬    📚    📚    📚    📚`,
    exits: { north: null, west: 'Forgotten Temple', south: null, east: null },
    desc: '📚 *Sacred Archive* — The accumulated forbidden knowledge of ages.',
    levelReq: 16,
    tiles: {
      '📜': { name: 'Prophecy Scrolls', desc: 'Futures written before they happened.', type: 'gather', item: 'Prophecy Scroll' },
      '🔍': { name: 'Research Desk', desc: 'Still warm, as if someone was just here.', type: 'explore' },
      '🗃': { name: 'Forbidden Files', desc: 'Records sealed by divine decree.', type: 'explore' },
      '🔐': { name: 'Locked Vault', desc: 'The most dangerous knowledge is behind this door.', type: 'explore' },
      '🕰': { name: 'Time Record', desc: 'This clock has never been wound.', type: 'explore' },
      '💡': { name: 'Illuminated Manuscript', desc: 'A tome that glows and whispers.', type: 'gather', item: 'Magic Tome' },
    },
    enemies: [
      { name: 'Knowledge Keeper', hp: 230, atk: 85, xp: 280, coins: 420, level: 16 },
      { name: 'Ink Wraith',       hp: 210, atk: 90, xp: 295, coins: 440, level: 17 },
    ],
  },

  'Lava Cliffs': {
    display:
`🌋    🌋    🌋    🌋    ￪    🌋    🌋    🌋    🌋
🌋    -     -     -     -     -     -     -    🌋
🌋    -    🔥   -     -     -    🪨   -    🌋
❮     -     -     -     -     -     -     -    ❯
🌋    -    💀   -     ⚲    -    🐉   -    🌋
🌋    -     -     -     -     -     -     -    🌋
🌋    -    💎   -     -     -    🌊   -    🌋
🌋    -     -     -     -     -     -     -    🌋
🌋    🌋    🌋    🌋    ￬    🌋    🌋    🌋    🌋`,
    exits: { north: null, east: 'Dragon Mountain', south: null, west: null },
    desc: '🌋 *Lava Cliffs* — Sheer volcanic rock drops into rivers of molten fire.',
    levelReq: 19,
    tiles: {
      '🔥': { name: 'Fire Vents', desc: 'Geysers of fire erupt without warning.', type: 'danger' },
      '🪨': { name: 'Obsidian Outcrop', desc: 'Razor-sharp volcanic glass juts from the cliff.', type: 'gather', item: 'Obsidian Shard' },
      '💀': { name: 'Charred Bones', desc: 'Former adventurers, petrified by lava.', type: 'explore' },
      '🐉': { name: 'Cliff Dragon', desc: 'A dragon sunning itself on the hot rock.', type: 'boss' },
      '💎': { name: 'Lava Gems', desc: 'Rare gems cooled from molten stone.', type: 'gather', item: 'Lava Gem' },
      '🌊': { name: 'Lava River', desc: 'Not water — rivers of slow molten rock.', type: 'danger' },
    },
    enemies: [
      { name: 'Fire Drake',      hp: 380, atk: 115, xp: 480, coins: 750, level: 19 },
      { name: 'Lava Golem',      hp: 420, atk: 125, xp: 520, coins: 820, level: 20 },
      { name: 'Magma Serpent',   hp: 350, atk: 108, xp: 440, coins: 700, level: 19 },
    ],
  },

  'Dragon Nest': {
    display:
`🐲    🐲    🐲    🐲    ￪    🐲    🐲    🐲    🐲
🐲    -     -     -     -     -     -     -    🐲
🐲    -    🥚   -     -     -    💎   -    🐲
❮     -     -     -     -     -     -     -    ❯
🐲    -    🔥   -     ⚲    -    🐉   -    🐲
🐲    -     -     -     -     -     -     -    🐲
🐲    -    🦴   -     -     -    👑   -    🐲
🐲    -     -     -     -     -     -     -    🐲
🐲    🐲    🐲    🐲    ￬    🐲    🐲    🐲    🐲`,
    exits: { north: null, west: 'Dragon Mountain', south: null, east: null },
    desc: '🐉 *Dragon Nest* — The sacred birthing ground of the dragons.',
    levelReq: 20,
    tiles: {
      '🥚': { name: 'Dragon Egg', desc: 'Warm to the touch and humming with power.', type: 'gather', item: 'Dragon Egg Shard' },
      '💎': { name: 'Hoard Fragment', desc: 'Part of the main dragon hoard.', type: 'gather', item: 'Dragon Gold' },
      '🔥': { name: 'Nest Flames', desc: 'Fire keeps the eggs warm — and intruders burned.', type: 'danger' },
      '🐉': { name: 'Mother Dragon', desc: 'She protects the nest with everything she has.', type: 'boss' },
      '🦴': { name: 'Prey Remains', desc: 'What\'s left of the dragon\'s last meal.', type: 'explore' },
      '👑': { name: 'Dragon Crown', desc: 'A legendary artifact resting atop a treasure pile.', type: 'gather', item: 'Dragon Crown' },
    },
    enemies: [
      { name: 'Nest Guardian',   hp: 450, atk: 130, xp: 580, coins: 900,  level: 21 },
      { name: 'Dragon Whelp',    hp: 300, atk: 105, xp: 410, coins: 650,  level: 19 },
      { name: 'Mother Dragon',   hp: 850, atk: 170, xp: 1200, coins: 2000, level: 25, isBoss: true },
    ],
  },

  'Shadow Hall': {
    display:
`🌑    🌑    🌑    🌑    ￪    🌑    🌑    🌑    🌑
🌑    -     -     -     -     -     -     -    🌑
🌑    -    👁   -     -     -    🗡   -    🌑
❮     -     -     -     -     -     -     -    ❯
🌑    -    🌑   -     ⚲    -    💀   -    🌑
🌑    -     -     -     -     -     -     -    🌑
🌑    -    ⛓   -     -     -    🔥   -    🌑
🌑    -     -     -     -     -     -     -    🌑
🌑    🌑    🌑    🌑    ￬    🌑    🌑    🌑    🌑`,
    exits: { north: null, east: 'Shadow Fortress', south: null, west: null },
    desc: '🌑 *Shadow Hall* — Pure darkness made manifest. Light dies here.',
    levelReq: 22,
    tiles: {
      '👁': { name: 'Watching Eye', desc: 'An enormous eye opens in the dark wall.', type: 'enemy' },
      '🗡': { name: 'Shadow Armory', desc: 'Blades forged from solidified darkness.', type: 'gather', item: 'Shadow Blade' },
      '🌑': { name: 'Void Rift', desc: 'A tear in reality that whispers your name.', type: 'danger' },
      '💀': { name: 'Champion\'s Skull', desc: 'The best of the best — and they failed.', type: 'explore' },
      '⛓': { name: 'Dark Bindings', desc: 'Chains that hold something very old.', type: 'explore' },
      '🔥': { name: 'Black Flame', desc: 'A fire that gives no warmth and no light.', type: 'danger' },
    },
    enemies: [
      { name: 'Shadow Fiend',    hp: 480, atk: 145, xp: 680, coins: 1050, level: 23 },
      { name: 'Void Wraith',     hp: 420, atk: 155, xp: 720, coins: 1100, level: 24 },
      { name: 'Dark Shade',      hp: 520, atk: 138, xp: 650, coins: 1000, level: 22 },
    ],
  },

  'Demon General': {
    display:
`👹    👹    👹    👹    ￪    👹    👹    👹    👹
👹    -     -     -     -     -     -     -    👹
👹    -    ⚔   -     -     -    🔱   -    👹
❮     -     -     -     -     -     -     -    ❯
👹    -    💀   -     ⚲    -    👿   -    👹
👹    -     -     -     -     -     -     -    👹
👹    -    🌑   -     -     -    💎   -    👹
👹    -     -     -     -     -     -     -    👹
👹    👹    👹    👹    ￬    👹    👹    👹    👹`,
    exits: { north: null, west: 'Shadow Fortress', south: "Demon King's Throne", east: null },
    desc: '👹 *Demon General\'s Lair* — The commander of shadow armies awaits.',
    levelReq: 24,
    tiles: {
      '⚔': { name: 'Demon Armory', desc: 'Weapons beyond human craftsmanship.', type: 'gather', item: 'Demon Blade Shard' },
      '🔱': { name: 'Command Throne', desc: 'From here the general directed countless battles.', type: 'explore' },
      '💀': { name: 'Fallen Champions', desc: 'Heroes who reached this far — and no further.', type: 'explore' },
      '👿': { name: 'Elite Guard', desc: 'Demon captains in full battle regalia.', type: 'enemy' },
      '🌑': { name: 'Shadow Portal', desc: 'A one-way door to somewhere worse.', type: 'danger' },
      '💎': { name: 'General\'s Hoard', desc: 'Tribute paid by defeated kingdoms.', type: 'gather', item: 'Demon Gem' },
    },
    enemies: [
      { name: 'Demon Captain',   hp: 550, atk: 155, xp: 750,  coins: 1200, level: 24 },
      { name: 'Shadow Elite',    hp: 600, atk: 165, xp: 820,  coins: 1300, level: 25 },
      { name: 'Demon General',   hp: 1100, atk: 200, xp: 2000, coins: 3500, level: 28, isBoss: true },
    ],
  },

  "Demon King's Throne": {
    display:
`💀    💀    💀    💀    ￪    💀    💀    💀    💀
💀    -     -     -     -     -     -     -    💀
💀    -    👑   -     -     -    🌑   -    💀
❮     -     -     -     -     -     -     -    ❯
💀    -    🔥   -     ⚲    -    👺   -    💀
💀    -     -     -     -     -     -     -    💀
💀    -    ⚡   -     -     -    💎   -    💀
💀    -     -     -     -     -     -     -    💀
💀    💀    💀    💀    ￬    💀    💀    💀    💀`,
    exits: { north: 'Demon General', west: null, south: null, east: null },
    desc: '👑 *Demon King\'s Throne* — The absolute darkness. The end of all paths.',
    levelReq: 27,
    tiles: {
      '👑': { name: 'Dark Throne', desc: 'A seat carved from the bones of gods.', type: 'explore' },
      '🌑': { name: 'Void Abyss', desc: 'Looking into it, you feel it look back.', type: 'danger' },
      '🔥': { name: 'Hellfire Pit', desc: 'The flames of another world burn here.', type: 'danger' },
      '👺': { name: 'Demon King', desc: 'The source of all shadow. He rises.', type: 'boss' },
      '⚡': { name: 'Dark Lightning', desc: 'Arcs across the ceiling with each breath the King takes.', type: 'danger' },
      '💎': { name: 'King\'s Treasure', desc: 'The wealth of conquered worlds.', type: 'gather', item: 'Void Crystal' },
    },
    enemies: [
      { name: 'King\'s Guard',   hp: 700, atk: 175, xp: 950,  coins: 1600, level: 27 },
      { name: 'Demon King',      hp: 2000, atk: 250, xp: 5000, coins: 10000, level: 30, isBoss: true },
    ],
  },

  'Mushroom Grove': {
    display:
`🍄    🍄    🍄    🍄    ￪    🍄    🍄    🍄    🍄
🍄    -     -     -     -     -     -     -    🍄
🍄    -    🌟   -     -     -    🐛   -    🍄
❮     -     -     -     -     -     -     -    ❯
🍄    -    🌿   -     ⚲    -    💊   -    🍄
🍄    -     -     -     -     -     -     -    🍄
🍄    -    🦎   -     -     -    🌺   -    🍄
🍄    -     -     -     -     -     -     -    🍄
🍄    🍄    🍄    🍄    ￬    🍄    🍄    🍄    🍄`,
    exits: { north: null, south: 'Axel Town', west: null, east: null },
    desc: '🍄 *Mushroom Grove* — Towering glowing mushrooms form a labyrinth.',
    levelReq: 1,
    tiles: {
      '🌟': { name: 'Spore Burst', desc: 'Clouds of luminous spores drift lazily.', type: 'gather', item: 'Glowing Spore' },
      '🐛': { name: 'Caterpillar Colony', desc: 'Giant caterpillars munch on the mushroom caps.', type: 'enemy' },
      '🌿': { name: 'Herb Patch', desc: 'Rare mushroom-based medicines grow here.', type: 'gather', item: 'Healing Shroom' },
      '💊': { name: 'Potion Mushroom', desc: 'Eating this restores a little health.', type: 'heal' },
      '🦎': { name: 'Mushroom Lizard', desc: 'A lizard that feeds on the giant fungi.', type: 'enemy' },
      '🌺': { name: 'Bloom Flower', desc: 'Only blooms in the spore-rich air here.', type: 'gather', item: 'Spore Bloom' },
    },
    enemies: [
      { name: 'Giant Caterpillar', hp: 35, atk: 6,  xp: 10,  coins: 18, level: 1 },
      { name: 'Mushroom Lizard',   hp: 50, atk: 10, xp: 18,  coins: 30, level: 2 },
      { name: 'Spore Fiend',       hp: 70, atk: 15, xp: 28,  coins: 45, level: 3 },
    ],
  },
}

// ═══════════════════════════════════════════════════════════════════════════
//  DUNGEON FLOOR MAPS — each zone covers a range of floors
// ═══════════════════════════════════════════════════════════════════════════

const DUNGEON_MAPS = {
  'Mist Corridors': {
    floors: [1, 3],
    display:
`🌫    🌫    🌫    🌫    🌫    🌫    🌫    🌫    🌫
🌫    -     -    🚪   -    🚪   -     -    🌫
🌫    -    💀   -     -     -    💀   -    🌫
🌫   🚪   -     -    ⚲    -     -   🚪   🌫
🌫    -     -    💀   -    💀   -     -    🌫
🌫    -   🚪   -     -     -   🚪   -    🌫
🌫    -     -     -    👹   -     -     -    🌫
🌫    -     -     -     -     -     -     -    🌫
🌫    🌫    🌫   🚪   ⬇    🚪   🌫    🌫    🌫`,
    desc: '🌫️ *Mist Corridors* — Shadowy fog muffles every sound. Something breathes nearby.',
  },
  'Dark Halls': {
    floors: [4, 6],
    display:
`🕯    🕯    🕯    🕯    🕯    🕯    🕯    🕯    🕯
🕯    -     -    👹   -    👹   -     -    🕯
🕯    -    🚪   -     -     -   🚪   -    🕯
🕯   💀   -     -    ⚲    -     -   💀   🕯
🕯    -    🚪   -     -     -   🚪   -    🕯
🕯    -     -    💎   -    💎   -     -    🕯
🕯    -     -     -    👺   -     -     -    🕯
🕯    -     -     -     -     -     -     -    🕯
🕯    🕯    🕯   🚪   ⬇    🚪   🕯    🕯    🕯`,
    desc: '🕯️ *Dark Halls* — Flickering torches cast long, dancing shadows across the stone.',
  },
  'Burning Depths': {
    floors: [7, 10],
    display:
`🔥    🔥    🔥    🔥    🔥    🔥    🔥    🔥    🔥
🔥    -    💎   -     -     -   💎   -    🔥
🔥    -     -   🐲   -    🐲   -     -    🔥
🔥   💀   -     -    ⚲    -     -   💀   🔥
🔥    -     -   🌋   -    🌋   -     -    🔥
🔥    -    🔥   -     -     -   🔥   -    🔥
🔥    -     -     -    👹   -     -     -    🔥
🔥    -     -     -     -     -     -     -    🔥
🔥    🔥    🔥   🚪   ⬇    🚪   🔥    🔥    🔥`,
    desc: '🔥 *Burning Depths* — Scorched stone and ember heat. Lava drips from the ceiling.',
  },
  'Frost Vaults': {
    floors: [11, 15],
    display:
`❄    ❄    ❄    ❄    ❄    ❄    ❄    ❄    ❄
❄    -    💎   -     -     -   💎   -    ❄
❄    -     -   🐺   -    🐺   -     -    ❄
❄   💀   -     -    ⚲    -     -   💀   ❄
❄    -     -   ❄    -    ❄    -     -    ❄
❄    -    🧊   -     -     -   🧊   -    ❄
❄    -     -     -    👻   -     -     -    ❄
❄    -     -     -     -     -     -     -    ❄
❄    ❄    ❄   🚪   ⬇    🚪   ❄    ❄    ❄`,
    desc: '❄️ *Frost Vaults* — Ice formations crack beneath your feet. Your breath is mist.',
  },
  'Storm Chambers': {
    floors: [16, 20],
    display:
`⚡    ⚡    ⚡    ⚡    ⚡    ⚡    ⚡    ⚡    ⚡
⚡    -    💎   -     -     -   💎   -    ⚡
⚡    -     -   🌪   -    🌪   -     -    ⚡
⚡   💀   -     -    ⚲    -     -   💀   ⚡
⚡    -     -   ⚡    -    ⚡    -     -    ⚡
⚡    -    🌩   -     -     -   🌩   -    ⚡
⚡    -     -     -    🤖   -     -     -    ⚡
⚡    -     -     -     -     -     -     -    ⚡
⚡    ⚡    ⚡   🚪   ⬇    🚪   ⚡    ⚡    ⚡`,
    desc: '⚡ *Storm Chambers* — Lightning arcs across the walls. The air itself crackles.',
  },
  'Void Core': {
    floors: [21, 99],
    display:
`🌑    🌑    🌑    🌑    🌑    🌑    🌑    🌑    🌑
🌑    -    💀   -     -     -   💀   -    🌑
🌑    -     -   👿   -    👿   -     -    🌑
🌑   💎   -     -    ⚲    -     -   💎   🌑
🌑    -     -   🌑   -    🌑   -     -    🌑
🌑    -    🔥   -     -     -   🔥   -    🌑
🌑    -     -     -    👹   -     -     -    🌑
🌑    -     -     -     -     -     -     -    🌑
🌑    🌑    🌑   🚪   ⬇    🚪   🌑    🌑    🌑`,
    desc: '🌑 *The Void Core* — Reality fractures. You are below the world now.',
  },
}

// ═══════════════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getMapData(mapName) {
  return MAPS[mapName] || null
}

function getDungeonMap(floor) {
  for (const [zoneName, zone] of Object.entries(DUNGEON_MAPS)) {
    if (floor >= zone.floors[0] && floor <= zone.floors[1]) {
      return { zoneName, ...zone }
    }
  }
  return { zoneName: 'The Abyss', ...DUNGEON_MAPS['Void Core'] }
}

function getAdjacentMaps(mapName) {
  const m = MAPS[mapName]
  if (!m) return {}
  return m.exits || {}
}

function listAllMaps() {
  return Object.keys(MAPS)
}

function renderMapWithPlayer(mapName, note) {
  const m = MAPS[mapName]
  if (!m) return '❌ Unknown map.'
  const noteStr = note ? `\n🔔 ${note}` : ''
  return `${m.display}\n\n${m.desc}${noteStr}\n\n` +
    `📍 *Exits:*\n` +
    Object.entries(m.exits || {})
      .filter(([, v]) => v)
      .map(([dir, dest]) => {
        const arrow = { north: '￪', south: '￬', west: '❮', east: '❯' }[dir] || dir
        const req = MAPS[dest]?.levelReq > 1 ? ` (Lv.${MAPS[dest].levelReq}+)` : ''
        return `  ${arrow} *${dest}*${req}`
      })
      .join('\n')
}

function getMapEnemies(mapName) {
  return MAPS[mapName]?.enemies || []
}

function getRandomMapEnemy(mapName, playerLevel) {
  const enemies = getMapEnemies(mapName)
  if (!enemies.length) return null
  // Filter to enemies near player level (within ±4 levels)
  const suitable = enemies.filter(e => Math.abs(e.level - playerLevel) <= 4)
  const pool = suitable.length ? suitable : enemies
  return { ...pool[Math.floor(Math.random() * pool.length)] }
}

function getMapLandmarks(mapName) {
  return Object.entries(MAPS[mapName]?.tiles || {}).map(([emoji, data]) => ({
    emoji, ...data
  }))
}

module.exports = {
  MAPS,
  DUNGEON_MAPS,
  getMapData,
  getDungeonMap,
  getAdjacentMaps,
  listAllMaps,
  renderMapWithPlayer,
  getMapEnemies,
  getRandomMapEnemy,
  getMapLandmarks,
}
