// ─── WORLD MAPS — Town: Axel ─────────────────────────────────────
// Each map is a 9-row x 9-col grid of strings.
// ⚲ = player spawn point (center). ￪￬❮❯ = exits. Special tiles listed in legend.

const MAPS = {
  green_plains: {
    name: 'Green Plains',
    emoji: '🌿',
    desc: 'A vast open field bathed in golden sunlight near the town of Axel.',
    grid: [
      ['-',   '-',   '-',   '-',   '￪',   '-',   '-',   '-',   '-'],
      ['-',   '🌻',  '-',   '-',   '-',   '-',   '🌻',  '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['❮',   '-',   '🐇',  '-',   '-',   '-',   '🚜',  '-',   '❯'],
      ['-',   '-',   '-',   '-',   '⚲',   '-',   '-',   '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['-',   '🌾',  '-',   '-',   '-',   '-',   '🌾',  '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['-',   '-',   '-',   '-',   '￬',   '-',   '-',   '-',   '-'],
    ],
    exits: { '￪': 'mushroom_grove', '❮': 'wolf_woods', '❯': 'abandoned_farm', '￬': 'whispering_woods' },
    legend: {
      '🌻': { name: 'Sunflower Patch', type: 'scenery', desc: 'Fields of bright sunflowers sway in the breeze.' },
      '🐇': { name: 'Bunny Field', type: 'mob', mob: 'Wild Rabbit', level: 1, xp: 10, coins: 15 },
      '🚜': { name: 'Abandoned Farm Entrance', type: 'location', desc: 'An old rusted gate leads to an overgrown farm.' },
      '🌾': { name: 'Open Grasslands', type: 'scenery', desc: 'Tall golden grass stretches to the horizon.' },
    },
    spawnRow: 4, spawnCol: 4,
    monsters: [
      { name: 'Wild Rabbit', level: 1, hp: 20, atk: 4, xp: 10, coins: 15, emoji: '🐇' },
      { name: 'Field Rat',   level: 2, hp: 30, atk: 6, xp: 18, coins: 25, emoji: '🐀' },
    ],
  },

  whispering_woods: {
    name: 'Whispering Woods',
    emoji: '🌲',
    desc: 'A dense forest where shadows dance between ancient trees.',
    grid: [
      ['🌲',  '🌲',  '🌲',  '🌲',  '￪',   '🌲',  '🌲',  '🌲',  '🌲'],
      ['🌲',  '-',   '-',   '-',   '-',   '-',   '-',   '-',   '🌲'],
      ['🌲',  '-',   '🍄',  '-',   '-',   '-',   '🍄',  '-',   '🌲'],
      ['❮',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '❯'],
      ['🌲',  '-',   '🏕',  '-',   '⚲',   '-',   '🐺',  '-',   '🌲'],
      ['🌲',  '-',   '-',   '-',   '-',   '-',   '-',   '-',   '🌲'],
      ['🌲',  '-',   '🕸',  '-',   '-',   '-',   '🌺',  '-',   '🌲'],
      ['🌲',  '-',   '-',   '-',   '-',   '-',   '-',   '-',   '🌲'],
      ['🌲',  '🌲',  '🌲',  '🌲',  '￬',   '🌲',  '🌲',  '🌲',  '🌲'],
    ],
    exits: { '￪': 'green_plains', '❮': 'hunter_camp', '❯': 'fairy_grove', '￬': 'goblin_territory' },
    legend: {
      '🍄': { name: 'Mushroom Grove', type: 'mob', mob: 'Giant Mushroom', level: 3, xp: 30, coins: 40 },
      '🏕': { name: 'Hunter Camp', type: 'location', desc: 'A warm camp fire glows amid hunting trophies.' },
      '🐺': { name: 'Wolf Den', type: 'mob', mob: 'Shadow Wolf', level: 5, xp: 60, coins: 80 },
      '🕸': { name: 'Spider Nest', type: 'mob', mob: 'Forest Spider', level: 4, xp: 45, coins: 55 },
      '🌺': { name: 'Enchanted Flowers', type: 'scenery', desc: 'Flowers that glow faintly with magic.' },
    },
    spawnRow: 4, spawnCol: 4,
    monsters: [
      { name: 'Shadow Wolf',    level: 5,  hp: 70,  atk: 14, xp: 60,  coins: 80,  emoji: '🐺' },
      { name: 'Giant Mushroom', level: 3,  hp: 45,  atk: 9,  xp: 30,  coins: 40,  emoji: '🍄' },
      { name: 'Forest Spider',  level: 4,  hp: 55,  atk: 11, xp: 45,  coins: 55,  emoji: '🕷' },
    ],
  },

  goblin_territory: {
    name: 'Goblin Territory',
    emoji: '👺',
    desc: 'Dangerous lands controlled by goblin clans. Tread carefully.',
    grid: [
      ['-',   '-',   '-',   '-',   '￪',   '-',   '-',   '-',   '-'],
      ['-',   '🪵',  '-',   '-',   '-',   '-',   '🪵',  '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['❮',   '-',   '👺',  '-',   '-',   '-',   '🔥',  '-',   '❯'],
      ['-',   '-',   '-',   '-',   '⚲',   '-',   '-',   '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['-',   '⚔',  '-',   '-',   '-',   '-',   '👑',  '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['-',   '-',   '-',   '-',   '￬',   '-',   '-',   '-',   '-'],
    ],
    exits: { '￪': 'whispering_woods', '❮': 'training_grounds', '❯': 'hidden_cave', '￬': 'crystal_mine' },
    legend: {
      '🪵': { name: 'Goblin Huts', type: 'scenery', desc: 'Crude wooden huts where goblins sleep.' },
      '👺': { name: 'Goblin Scouts', type: 'mob', mob: 'Goblin Scout', level: 7, xp: 90, coins: 120 },
      '🔥': { name: 'Bonfire Camp', type: 'mob', mob: 'Goblin Warrior', level: 8, xp: 110, coins: 140 },
      '⚔': { name: 'Training Grounds', type: 'location', desc: 'A dirt arena where goblins practice combat.' },
      '👑': { name: 'Goblin Chief', type: 'boss', mob: 'Goblin Chief', level: 10, xp: 200, coins: 300 },
    },
    spawnRow: 4, spawnCol: 4,
    monsters: [
      { name: 'Goblin Scout',   level: 7,  hp: 90,  atk: 18, xp: 90,  coins: 120, emoji: '👺' },
      { name: 'Goblin Warrior', level: 8,  hp: 110, atk: 22, xp: 110, coins: 140, emoji: '⚔' },
      { name: 'Goblin Chief',   level: 10, hp: 180, atk: 35, xp: 200, coins: 300, emoji: '👑' },
    ],
  },

  crystal_mine: {
    name: 'Crystal Mine',
    emoji: '💎',
    desc: 'Deep caverns glittering with precious crystals and lurking creatures.',
    grid: [
      ['-',   '-',   '-',   '-',   '￪',   '-',   '-',   '-',   '-'],
      ['-',   '⛏',  '-',   '-',   '-',   '-',   '💎',  '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['❮',   '-',   '🦇',  '-',   '-',   '-',   '🌊',  '-',   '❯'],
      ['-',   '-',   '-',   '-',   '⚲',   '-',   '-',   '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['-',   '🪨',  '-',   '-',   '-',   '-',   '💰',  '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['-',   '-',   '-',   '-',   '￬',   '-',   '-',   '-',   '-'],
    ],
    exits: { '￪': 'goblin_territory', '❮': 'bat_caverns', '❯': 'underground_lake', '￬': 'ancient_ruins' },
    legend: {
      '⛏': { name: 'Mining Site', type: 'location', desc: 'Abandoned pickaxes litter the ground here.' },
      '💎': { name: 'Crystal Vein', type: 'loot', desc: 'Glowing crystals embedded in the cave wall.', loot: { gems: 3 } },
      '🦇': { name: 'Bat Caverns', type: 'mob', mob: 'Cave Bat', level: 11, xp: 140, coins: 180 },
      '🌊': { name: 'Underground Lake', type: 'location', desc: 'A calm underground lake that reflects crystal light.' },
      '🪨': { name: 'Collapsed Tunnel', type: 'scenery', desc: 'A blocked passage — something used to live here.' },
      '💰': { name: 'Treasure Chamber', type: 'loot', desc: 'Ancient coins scattered across the floor.', loot: { coins: 500 } },
    },
    spawnRow: 4, spawnCol: 4,
    monsters: [
      { name: 'Cave Bat',      level: 11, hp: 130, atk: 25, xp: 140, coins: 180, emoji: '🦇' },
      { name: 'Crystal Golem', level: 13, hp: 170, atk: 30, xp: 175, coins: 220, emoji: '💎' },
    ],
  },

  ancient_ruins: {
    name: 'Ancient Ruins',
    emoji: '🗿',
    desc: 'Crumbling stone structures hiding forgotten secrets of a lost civilization.',
    grid: [
      ['-',   '-',   '-',   '-',   '￪',   '-',   '-',   '-',   '-'],
      ['-',   '🗿',  '-',   '-',   '-',   '-',   '📚',  '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['❮',   '-',   '⚙',  '-',   '-',   '-',   '🧩',  '-',   '❯'],
      ['-',   '-',   '-',   '-',   '⚲',   '-',   '-',   '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['-',   '🏺',  '-',   '-',   '-',   '-',   '👻',  '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['-',   '-',   '-',   '-',   '￬',   '-',   '-',   '-',   '-'],
    ],
    exits: { '￪': 'crystal_mine', '❮': 'machine_hall', '❯': 'puzzle_hall', '￬': 'forgotten_temple' },
    legend: {
      '🗿': { name: 'Ruined Courtyard', type: 'scenery', desc: 'Stone statues worn by centuries of wind and rain.' },
      '📚': { name: 'Lost Library', type: 'location', desc: 'Tomes of forgotten knowledge in an ancient language.' },
      '⚙': { name: 'Ancient Machine Room', type: 'mob', mob: 'Construct Guardian', level: 14, xp: 190, coins: 250 },
      '🧩': { name: 'Puzzle Chamber', type: 'location', desc: 'Glyphs on the floor form an unsolved puzzle.' },
      '🏺': { name: 'Relic Vault', type: 'loot', desc: 'Ancient relics worth a fortune.', loot: { coins: 800, gems: 2 } },
      '👻': { name: 'Ancient Spirit', type: 'boss', mob: 'Ancient Spirit', level: 16, xp: 300, coins: 400 },
    },
    spawnRow: 4, spawnCol: 4,
    monsters: [
      { name: 'Construct Guardian', level: 14, hp: 180, atk: 32, xp: 190, coins: 250, emoji: '⚙' },
      { name: 'Ancient Spirit',     level: 16, hp: 220, atk: 40, xp: 300, coins: 400, emoji: '👻' },
      { name: 'Ruin Crawler',       level: 13, hp: 150, atk: 28, xp: 160, coins: 200, emoji: '🗿' },
    ],
  },

  forgotten_temple: {
    name: 'Forgotten Temple',
    emoji: '⛪',
    desc: 'A sacred temple abandoned by its gods — or was it abandoned by its worshippers?',
    grid: [
      ['-',   '-',   '-',   '-',   '￪',   '-',   '-',   '-',   '-'],
      ['-',   '⛪',  '-',   '-',   '-',   '-',   '📜',  '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['❮',   '-',   '🕯',  '-',   '-',   '-',   '🔔',  '-',   '❯'],
      ['-',   '-',   '-',   '-',   '⚲',   '-',   '-',   '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['-',   '👻',  '-',   '-',   '-',   '-',   '✨',  '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['-',   '-',   '-',   '-',   '￬',   '-',   '-',   '-',   '-'],
    ],
    exits: { '￪': 'ancient_ruins', '❮': 'prayer_hall', '❯': 'sacred_archive', '￬': 'dragon_mountain' },
    legend: {
      '⛪': { name: 'Main Sanctuary', type: 'scenery', desc: 'A grand hall where prayers once echoed.' },
      '📜': { name: 'Sacred Archive', type: 'location', desc: 'Scrolls containing divine laws.' },
      '🕯': { name: 'Prayer Hall', type: 'mob', mob: 'Temple Shade', level: 17, xp: 240, coins: 320 },
      '🔔': { name: 'Temple Bell', type: 'location', desc: 'A massive bell. If you ring it, something answers.' },
      '👻': { name: 'Temple Spirit', type: 'boss', mob: 'Temple Spirit', level: 19, xp: 380, coins: 500 },
      '✨': { name: 'Blessed Altar', type: 'loot', desc: 'The altar pulses with divine energy.', loot: { gems: 5, coins: 600 } },
    },
    spawnRow: 4, spawnCol: 4,
    monsters: [
      { name: 'Temple Shade',  level: 17, hp: 240, atk: 42, xp: 240, coins: 320, emoji: '🕯' },
      { name: 'Temple Spirit', level: 19, hp: 300, atk: 55, xp: 380, coins: 500, emoji: '👻' },
    ],
  },

  dragon_mountain: {
    name: 'Dragon Mountain',
    emoji: '⛰',
    desc: 'A volcanic mountain range where ancient dragons make their lair.',
    grid: [
      ['⛰',  '⛰',  '⛰',  '⛰',  '￪',   '⛰',  '⛰',  '⛰',  '⛰'],
      ['⛰',  '🔥',  '-',   '-',   '-',   '-',   '🔥',  '-',   '⛰'],
      ['⛰',  '-',   '-',   '-',   '-',   '-',   '-',   '-',   '⛰'],
      ['❮',   '-',   '🌋',  '-',   '-',   '-',   '🐲',  '-',   '❯'],
      ['⛰',  '-',   '-',   '-',   '⚲',   '-',   '-',   '-',   '⛰'],
      ['⛰',  '-',   '-',   '-',   '-',   '-',   '-',   '-',   '⛰'],
      ['⛰',  '💎',  '-',   '-',   '-',   '-',   '🦴',  '-',   '⛰'],
      ['⛰',  '-',   '-',   '-',   '-',   '-',   '-',   '-',   '⛰'],
      ['⛰',  '⛰',  '⛰',  '⛰',  '￬',   '⛰',  '⛰',  '⛰',  '⛰'],
    ],
    exits: { '￪': 'forgotten_temple', '❮': 'lava_cliffs', '❯': 'dragon_nest', '￬': 'shadow_fortress' },
    legend: {
      '🔥': { name: 'Lava Pools', type: 'mob', mob: 'Fire Drake', level: 22, xp: 500, coins: 650 },
      '🌋': { name: 'Volcanic Crater', type: 'mob', mob: 'Magma Elemental', level: 24, xp: 600, coins: 800 },
      '🐲': { name: 'Dragon Nest', type: 'boss', mob: 'Young Dragon', level: 28, xp: 1000, coins: 1500 },
      '💎': { name: 'Dragon Hoard', type: 'loot', desc: 'Piles of gold and gems beneath dragon scales.', loot: { coins: 2000, gems: 8 } },
      '🦴': { name: 'Dragon Graveyard', type: 'scenery', desc: 'Massive dragon bones bleached white by volcanic heat.' },
    },
    spawnRow: 4, spawnCol: 4,
    monsters: [
      { name: 'Fire Drake',       level: 22, hp: 350, atk: 60, xp: 500,  coins: 650,  emoji: '🔥' },
      { name: 'Magma Elemental',  level: 24, hp: 400, atk: 70, xp: 600,  coins: 800,  emoji: '🌋' },
      { name: 'Young Dragon',     level: 28, hp: 550, atk: 90, xp: 1000, coins: 1500, emoji: '🐲' },
    ],
  },

  shadow_fortress: {
    name: 'Shadow Fortress',
    emoji: '🏰',
    desc: 'The ultimate stronghold of darkness — only the mightiest dare enter.',
    grid: [
      ['-',   '-',   '-',   '-',   '￪',   '-',   '-',   '-',   '-'],
      ['-',   '⚔',  '-',   '-',   '-',   '-',   '🔒',  '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['❮',   '-',   '🌑',  '-',   '-',   '-',   '👹',  '-',   '❯'],
      ['-',   '-',   '-',   '-',   '⚲',   '-',   '-',   '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['-',   '🏰',  '-',   '-',   '-',   '-',   '💀',  '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['-',   '-',   '-',   '-',   '￬',   '-',   '-',   '-',   '-'],
    ],
    exits: { '￪': 'dragon_mountain', '❮': 'shadow_hall', '❯': 'demon_general', '￬': 'demon_throne' },
    legend: {
      '⚔': { name: 'War Courtyard', type: 'mob', mob: 'Shadow Soldier', level: 30, xp: 800, coins: 1000 },
      '🔒': { name: 'Prison Wing', type: 'location', desc: 'Cells filled with forgotten heroes.' },
      '🌑': { name: 'Shadow Hall', type: 'mob', mob: 'Void Wraith', level: 33, xp: 1000, coins: 1300 },
      '👹': { name: 'Demon General', type: 'boss', mob: 'Demon General', level: 38, xp: 2000, coins: 2500 },
      '🏰': { name: 'Fortress Core', type: 'location', desc: 'The beating dark heart of the fortress.' },
      '💀': { name: 'Fallen Heroes Memorial', type: 'scenery', desc: 'Names carved in black stone — heroes who tried.' },
    },
    spawnRow: 4, spawnCol: 4,
    monsters: [
      { name: 'Shadow Soldier', level: 30, hp: 500,  atk: 80,  xp: 800,  coins: 1000, emoji: '⚔' },
      { name: 'Void Wraith',    level: 33, hp: 600,  atk: 95,  xp: 1000, coins: 1300, emoji: '🌑' },
      { name: 'Demon General',  level: 38, hp: 900,  atk: 130, xp: 2000, coins: 2500, emoji: '👹' },
    ],
  },

  // ── Extra Maps ───────────────────────────────────────────────────

  mushroom_grove: {
    name: 'Mushroom Grove',
    emoji: '🍄',
    desc: 'A magical grove where giant mushrooms pulse with soft bioluminescence.',
    grid: [
      ['-',   '-',   '-',   '-',   '￪',   '-',   '-',   '-',   '-'],
      ['-',   '🍄',  '-',   '-',   '-',   '-',   '🍄',  '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['❮',   '-',   '🌿',  '-',   '-',   '-',   '🌸',  '-',   '❯'],
      ['-',   '-',   '-',   '-',   '⚲',   '-',   '-',   '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['-',   '🦊',  '-',   '-',   '-',   '-',   '💊',  '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['-',   '-',   '-',   '-',   '￬',   '-',   '-',   '-',   '-'],
    ],
    exits: { '￪': 'sky_bridge', '❮': 'green_plains', '❯': 'fairy_grove', '￬': 'green_plains' },
    legend: {
      '🍄': { name: 'Giant Mushroom', type: 'mob', mob: 'Mushroom Sprite', level: 3, xp: 28, coins: 38 },
      '🌿': { name: 'Herb Garden', type: 'loot', desc: 'Rare herbs grow here in abundance.', loot: { coins: 100 } },
      '🌸': { name: 'Bloom Clearing', type: 'scenery', desc: 'A clearing filled with pink blossoms.' },
      '🦊': { name: 'Fox Den', type: 'mob', mob: 'Forest Fox', level: 4, xp: 40, coins: 50 },
      '💊': { name: 'Healing Spores', type: 'loot', desc: 'Healing spores float through the air.', loot: { hp: 30 } },
    },
    spawnRow: 4, spawnCol: 4,
    monsters: [
      { name: 'Mushroom Sprite', level: 3, hp: 40,  atk: 8,  xp: 28, coins: 38, emoji: '🍄' },
      { name: 'Forest Fox',      level: 4, hp: 55,  atk: 11, xp: 40, coins: 50, emoji: '🦊' },
    ],
  },

  wolf_woods: {
    name: 'Wolf Woods',
    emoji: '🐺',
    desc: 'A dark patch of forest ruled by a ruthless wolf pack.',
    grid: [
      ['🌲',  '🌲',  '🌲',  '🌲',  '￪',   '🌲',  '🌲',  '🌲',  '🌲'],
      ['🌲',  '-',   '-',   '-',   '-',   '-',   '-',   '-',   '🌲'],
      ['🌲',  '-',   '🐺',  '-',   '-',   '-',   '🦌',  '-',   '🌲'],
      ['❮',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '❯'],
      ['🌲',  '-',   '🏚',  '-',   '⚲',   '-',   '🐗',  '-',   '🌲'],
      ['🌲',  '-',   '-',   '-',   '-',   '-',   '-',   '-',   '🌲'],
      ['🌲',  '-',   '🌕',  '-',   '-',   '-',   '💀',  '-',   '🌲'],
      ['🌲',  '-',   '-',   '-',   '-',   '-',   '-',   '-',   '🌲'],
      ['🌲',  '🌲',  '🌲',  '🌲',  '￬',   '🌲',  '🌲',  '🌲',  '🌲'],
    ],
    exits: { '￪': 'hunter_camp', '❮': 'dark_bog', '❯': 'green_plains', '￬': 'whispering_woods' },
    legend: {
      '🐺': { name: 'Wolf Pack', type: 'mob', mob: 'Alpha Wolf', level: 6, xp: 75, coins: 100 },
      '🦌': { name: 'Stag Clearing', type: 'mob', mob: 'Forest Stag', level: 4, xp: 45, coins: 60 },
      '🏚': { name: 'Ruined Shack', type: 'location', desc: 'An old hunter\'s shack, long since abandoned.' },
      '🐗': { name: 'Wild Boar', type: 'mob', mob: 'Savage Boar', level: 5, xp: 60, coins: 80 },
      '🌕': { name: 'Moonlit Altar', type: 'location', desc: 'An altar to the wolf spirit, soaked in moonlight.' },
      '💀': { name: 'Bone Pile', type: 'scenery', desc: 'Remains of those who underestimated the wolves.' },
    },
    spawnRow: 4, spawnCol: 4,
    monsters: [
      { name: 'Alpha Wolf',   level: 6, hp: 85,  atk: 16, xp: 75,  coins: 100, emoji: '🐺' },
      { name: 'Forest Stag',  level: 4, hp: 60,  atk: 10, xp: 45,  coins: 60,  emoji: '🦌' },
      { name: 'Savage Boar',  level: 5, hp: 70,  atk: 13, xp: 60,  coins: 80,  emoji: '🐗' },
    ],
  },

  abandoned_farm: {
    name: 'Abandoned Farm',
    emoji: '🚜',
    desc: 'What was once a thriving homestead is now overrun by monsters.',
    grid: [
      ['-',   '-',   '-',   '-',   '￪',   '-',   '-',   '-',   '-'],
      ['-',   '🌾',  '-',   '-',   '-',   '-',   '🌾',  '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['❮',   '-',   '🐀',  '-',   '-',   '-',   '🚜',  '-',   '❯'],
      ['-',   '-',   '-',   '-',   '⚲',   '-',   '-',   '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['-',   '🐝',  '-',   '-',   '-',   '-',   '🏚',  '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['-',   '-',   '-',   '-',   '￬',   '-',   '-',   '-',   '-'],
    ],
    exits: { '￪': 'green_plains', '❮': 'green_plains', '❯': 'scarecrow_fields', '￬': 'dark_bog' },
    legend: {
      '🌾': { name: 'Overgrown Fields', type: 'scenery', desc: 'Crops left to rot in the sun.' },
      '🐀': { name: 'Rat Nest', type: 'mob', mob: 'Giant Rat', level: 2, xp: 20, coins: 28 },
      '🚜': { name: 'Broken Tractor', type: 'scenery', desc: 'A rusted tractor half-buried in weeds.' },
      '🐝': { name: 'Bee Swarm', type: 'mob', mob: 'Giant Bee', level: 3, xp: 30, coins: 40 },
      '🏚': { name: 'Farmhouse', type: 'location', desc: 'The old farmhouse creaks in the wind.' },
    },
    spawnRow: 4, spawnCol: 4,
    monsters: [
      { name: 'Giant Rat', level: 2, hp: 30, atk: 6, xp: 20, coins: 28, emoji: '🐀' },
      { name: 'Giant Bee',  level: 3, hp: 40, atk: 9, xp: 30, coins: 40, emoji: '🐝' },
    ],
  },

  fairy_grove: {
    name: 'Fairy Grove',
    emoji: '🧚',
    desc: 'An enchanted woodland glade where fairies and pixies dance by night.',
    grid: [
      ['-',   '-',   '-',   '-',   '￪',   '-',   '-',   '-',   '-'],
      ['-',   '✨',  '-',   '-',   '-',   '-',   '🌈',  '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['❮',   '-',   '🧚',  '-',   '-',   '-',   '🍯',  '-',   '❯'],
      ['-',   '-',   '-',   '-',   '⚲',   '-',   '-',   '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['-',   '🌸',  '-',   '-',   '-',   '-',   '🫧',  '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['-',   '-',   '-',   '-',   '￬',   '-',   '-',   '-',   '-'],
    ],
    exits: { '￪': 'sky_bridge', '❮': 'whispering_woods', '❯': 'moonlit_lake', '￬': 'mushroom_grove' },
    legend: {
      '✨': { name: 'Fairy Ring', type: 'loot', desc: 'Step inside the glowing ring for a blessing.', loot: { gems: 2, hp: 50 } },
      '🌈': { name: 'Rainbow Falls', type: 'scenery', desc: 'A miniature waterfall lit by perpetual rainbow light.' },
      '🧚': { name: 'Fairy Queen', type: 'boss', mob: 'Corrupted Fairy', level: 12, xp: 180, coins: 240 },
      '🍯': { name: 'Honey Cache', type: 'loot', desc: 'Fairy honey with magical restorative properties.', loot: { hp: 60, coins: 200 } },
      '🌸': { name: 'Petal Meadow', type: 'scenery', desc: 'Pink petals drift endlessly through the air.' },
      '🫧': { name: 'Bubble Spring', type: 'location', desc: 'Iridescent bubbles rise from a clear spring.' },
    },
    spawnRow: 4, spawnCol: 4,
    monsters: [
      { name: 'Corrupted Fairy', level: 12, hp: 140, atk: 28, xp: 180, coins: 240, emoji: '🧚' },
      { name: 'Pixie Trickster', level: 10, hp: 110, atk: 22, xp: 140, coins: 190, emoji: '✨' },
    ],
  },

  sky_bridge: {
    name: 'Sky Bridge',
    emoji: '🌉',
    desc: 'A magical floating bridge connecting the highlands above the clouds.',
    grid: [
      ['☁',  '☁',  '☁',  '☁',  '￪',   '☁',  '☁',  '☁',  '☁'],
      ['☁',  '🌤', '-',   '-',   '-',   '-',   '🌤',  '-',   '☁'],
      ['☁',  '-',   '-',   '-',   '-',   '-',   '-',   '-',   '☁'],
      ['❮',   '-',   '🦅',  '-',   '-',   '-',   '⚡',  '-',   '❯'],
      ['☁',  '-',   '-',   '-',   '⚲',   '-',   '-',   '-',   '☁'],
      ['☁',  '-',   '-',   '-',   '-',   '-',   '-',   '-',   '☁'],
      ['☁',  '🌟',  '-',   '-',   '-',   '-',   '🔭',  '-',   '☁'],
      ['☁',  '-',   '-',   '-',   '-',   '-',   '-',   '-',   '☁'],
      ['☁',  '☁',  '☁',  '☁',  '￬',   '☁',  '☁',  '☁',  '☁'],
    ],
    exits: { '￪': 'celestial_spire', '❮': 'mushroom_grove', '❯': 'fairy_grove', '￬': 'green_plains' },
    legend: {
      '🌤': { name: 'Cloud Platform', type: 'scenery', desc: 'A solid chunk of cloud enchanted to bear weight.' },
      '🦅': { name: 'Sky Eagle', type: 'mob', mob: 'Storm Eagle', level: 15, xp: 210, coins: 280 },
      '⚡': { name: 'Lightning Rod', type: 'mob', mob: 'Thunder Sprite', level: 13, xp: 180, coins: 240 },
      '🌟': { name: 'Star Fragment', type: 'loot', desc: 'A fallen piece of a star.', loot: { gems: 4, coins: 400 } },
      '🔭': { name: 'Sky Observatory', type: 'location', desc: 'An ancient telescope aimed at distant worlds.' },
    },
    spawnRow: 4, spawnCol: 4,
    monsters: [
      { name: 'Storm Eagle',    level: 15, hp: 200, atk: 35, xp: 210, coins: 280, emoji: '🦅' },
      { name: 'Thunder Sprite', level: 13, hp: 160, atk: 28, xp: 180, coins: 240, emoji: '⚡' },
    ],
  },

  dark_bog: {
    name: 'Dark Bog',
    emoji: '🌫',
    desc: 'A murky swampland where toxic vapours cloud your vision.',
    grid: [
      ['-',   '-',   '-',   '-',   '￪',   '-',   '-',   '-',   '-'],
      ['-',   '💀',  '-',   '-',   '-',   '-',   '🐸',  '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['❮',   '-',   '🐊',  '-',   '-',   '-',   '🌿',  '-',   '❯'],
      ['-',   '-',   '-',   '-',   '⚲',   '-',   '-',   '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['-',   '🧟',  '-',   '-',   '-',   '-',   '⚗',  '-',   '-'],
      ['-',   '-',   '-',   '-',   '-',   '-',   '-',   '-',   '-'],
      ['-',   '-',   '-',   '-',   '￬',   '-',   '-',   '-',   '-'],
    ],
    exits: { '￪': 'abandoned_farm', '❮': 'wolf_woods', '❯': 'sunken_ruins', '￬': 'goblin_territory' },
    legend: {
      '💀': { name: 'Bone Marsh', type: 'mob', mob: 'Bog Wraith', level: 9, xp: 120, coins: 160 },
      '🐸': { name: 'Toad Pool', type: 'mob', mob: 'Poison Toad', level: 7, xp: 85, coins: 110 },
      '🐊': { name: 'Croc Pit', type: 'mob', mob: 'Swamp Croc', level: 10, xp: 140, coins: 185 },
      '🌿': { name: 'Poison Herb Patch', type: 'loot', desc: 'Useful if you know alchemy.', loot: { coins: 150 } },
      '🧟': { name: 'Zombie Marsh', type: 'mob', mob: 'Bog Zombie', level: 8, xp: 100, coins: 135 },
      '⚗': { name: 'Witch\'s Cauldron', type: 'location', desc: 'A bubbling cauldron left by an old witch.' },
    },
    spawnRow: 4, spawnCol: 4,
    monsters: [
      { name: 'Bog Wraith',   level: 9,  hp: 115, atk: 20, xp: 120, coins: 160, emoji: '💀' },
      { name: 'Poison Toad',  level: 7,  hp: 85,  atk: 15, xp: 85,  coins: 110, emoji: '🐸' },
      { name: 'Swamp Croc',   level: 10, hp: 140, atk: 26, xp: 140, coins: 185, emoji: '🐊' },
      { name: 'Bog Zombie',   level: 8,  hp: 100, atk: 18, xp: 100, coins: 135, emoji: '🧟' },
    ],
  },
}

// ── Quest definitions per level range ────────────────────────────
const QUESTS = [
  // Level 1–5
  {
    id: 'q_bunny_hunt',
    name: 'Bunny Trouble',
    level: 1, maxLevel: 4,
    desc: 'Wild rabbits are destroying the Axel market gardens. Head to Green Plains and deal with them.',
    objective: 'Defeat 3 Wild Rabbits in Green Plains',
    map: 'green_plains',
    spawnRow: 4, spawnCol: 2,
    targetMob: 'Wild Rabbit', targetCount: 3,
    reward: { coins: 300, xp: 80, gems: 0 },
    emoji: '🐇',
    difficulty: '⭐',
  },
  {
    id: 'q_mushroom_collect',
    name: 'Rare Spores',
    level: 1, maxLevel: 5,
    desc: 'A potion maker in Axel needs mushroom spores. Visit the Mushroom Grove.',
    objective: 'Reach the Herb Garden in Mushroom Grove',
    map: 'mushroom_grove',
    spawnRow: 4, spawnCol: 4,
    targetTile: '🌿', targetCount: 1,
    reward: { coins: 250, xp: 60, gems: 1 },
    emoji: '🍄',
    difficulty: '⭐',
  },
  {
    id: 'q_farm_rats',
    name: 'Rat Infestation',
    level: 2, maxLevel: 5,
    desc: 'The Abandoned Farm is overrun with rats. Clear them out for a reward.',
    objective: 'Defeat 3 Giant Rats in Abandoned Farm',
    map: 'abandoned_farm',
    spawnRow: 4, spawnCol: 4,
    targetMob: 'Giant Rat', targetCount: 3,
    reward: { coins: 350, xp: 100, gems: 0 },
    emoji: '🐀',
    difficulty: '⭐',
  },
  // Level 5–10
  {
    id: 'q_wolf_den',
    name: 'Wolf Menace',
    level: 5, maxLevel: 10,
    desc: 'Alpha Wolves have been attacking travellers on the road near Axel. Stop them.',
    objective: 'Defeat 3 Alpha Wolves in Wolf Woods',
    map: 'wolf_woods',
    spawnRow: 4, spawnCol: 4,
    targetMob: 'Alpha Wolf', targetCount: 3,
    reward: { coins: 800, xp: 280, gems: 2 },
    emoji: '🐺',
    difficulty: '⭐⭐',
  },
  {
    id: 'q_spider_nest',
    name: 'Web of Danger',
    level: 5, maxLevel: 10,
    desc: 'Travellers are getting caught in massive spider webs in Whispering Woods.',
    objective: 'Defeat 3 Forest Spiders in Whispering Woods',
    map: 'whispering_woods',
    spawnRow: 6, spawnCol: 2,
    targetMob: 'Forest Spider', targetCount: 3,
    reward: { coins: 750, xp: 260, gems: 2 },
    emoji: '🕷',
    difficulty: '⭐⭐',
  },
  {
    id: 'q_bog_patrol',
    name: 'Bog Cleanse',
    level: 6, maxLevel: 11,
    desc: 'The Dark Bog is spreading corruption. Clear the monsters festering within.',
    objective: 'Defeat 3 Bog Zombies in Dark Bog',
    map: 'dark_bog',
    spawnRow: 4, spawnCol: 4,
    targetMob: 'Bog Zombie', targetCount: 3,
    reward: { coins: 900, xp: 300, gems: 2 },
    emoji: '🧟',
    difficulty: '⭐⭐',
  },
  // Level 10–15
  {
    id: 'q_goblin_chief',
    name: 'Goblin Uprising',
    level: 10, maxLevel: 15,
    desc: 'The Goblin Chief is rallying an army to march on Axel. Take him down.',
    objective: 'Defeat the Goblin Chief in Goblin Territory',
    map: 'goblin_territory',
    spawnRow: 6, spawnCol: 6,
    targetMob: 'Goblin Chief', targetCount: 1,
    reward: { coins: 2000, xp: 600, gems: 5 },
    emoji: '👑',
    difficulty: '⭐⭐⭐',
  },
  {
    id: 'q_crystal_gems',
    name: 'Crystal Hunt',
    level: 10, maxLevel: 15,
    desc: 'A gem merchant needs crystals from the Crystal Mine. Retrieve the Dragon Hoard.',
    objective: 'Reach the Treasure Chamber in Crystal Mine',
    map: 'crystal_mine',
    spawnRow: 4, spawnCol: 4,
    targetTile: '💰', targetCount: 1,
    reward: { coins: 1500, xp: 500, gems: 8 },
    emoji: '💎',
    difficulty: '⭐⭐⭐',
  },
  {
    id: 'q_fairy_corruption',
    name: 'The Corrupted Grove',
    level: 11, maxLevel: 16,
    desc: 'Dark energy has corrupted the Fairy Queen. The fairies beg for help.',
    objective: 'Defeat the Corrupted Fairy Queen in Fairy Grove',
    map: 'fairy_grove',
    spawnRow: 4, spawnCol: 4,
    targetMob: 'Corrupted Fairy', targetCount: 1,
    reward: { coins: 2200, xp: 650, gems: 6 },
    emoji: '🧚',
    difficulty: '⭐⭐⭐',
  },
  // Level 15–20
  {
    id: 'q_ancient_spirit',
    name: 'Ancient Awakening',
    level: 15, maxLevel: 22,
    desc: 'An ancient evil spirit has awakened in the ruins outside Axel. Put it to rest.',
    objective: 'Defeat the Ancient Spirit in Ancient Ruins',
    map: 'ancient_ruins',
    spawnRow: 6, spawnCol: 6,
    targetMob: 'Ancient Spirit', targetCount: 1,
    reward: { coins: 4000, xp: 1200, gems: 10 },
    emoji: '👻',
    difficulty: '⭐⭐⭐⭐',
  },
  {
    id: 'q_sky_eagle',
    name: 'Sky Hunter',
    level: 14, maxLevel: 20,
    desc: 'Storm Eagles on the Sky Bridge are disrupting supply lines to mountain villages.',
    objective: 'Defeat 2 Storm Eagles on Sky Bridge',
    map: 'sky_bridge',
    spawnRow: 3, spawnCol: 2,
    targetMob: 'Storm Eagle', targetCount: 2,
    reward: { coins: 3500, xp: 1000, gems: 8 },
    emoji: '🦅',
    difficulty: '⭐⭐⭐⭐',
  },
  {
    id: 'q_temple_spirit',
    name: 'Sacred Silence',
    level: 16, maxLevel: 23,
    desc: 'The Forgotten Temple has been desecrated. The Temple Spirit must be purified.',
    objective: 'Defeat the Temple Spirit in Forgotten Temple',
    map: 'forgotten_temple',
    spawnRow: 6, spawnCol: 2,
    targetMob: 'Temple Spirit', targetCount: 1,
    reward: { coins: 5000, xp: 1500, gems: 12 },
    emoji: '⛪',
    difficulty: '⭐⭐⭐⭐',
  },
  // Level 20+
  {
    id: 'q_young_dragon',
    name: 'Dragon Slayer',
    level: 22, maxLevel: 30,
    desc: 'A Young Dragon has made its nest on Dragon Mountain and terrorises the villages below.',
    objective: 'Defeat the Young Dragon on Dragon Mountain',
    map: 'dragon_mountain',
    spawnRow: 4, spawnCol: 4,
    targetMob: 'Young Dragon', targetCount: 1,
    reward: { coins: 10000, xp: 3000, gems: 20 },
    emoji: '🐲',
    difficulty: '⭐⭐⭐⭐⭐',
  },
  {
    id: 'q_demon_general',
    name: 'Into the Darkness',
    level: 28, maxLevel: 99,
    desc: 'The Demon General commands the Shadow Fortress army. You must break him.',
    objective: 'Defeat the Demon General in Shadow Fortress',
    map: 'shadow_fortress',
    spawnRow: 3, spawnCol: 6,
    targetMob: 'Demon General', targetCount: 1,
    reward: { coins: 20000, xp: 6000, gems: 35 },
    emoji: '👹',
    difficulty: '⭐⭐⭐⭐⭐',
  },
]

// Get quests available for a given player level (3–4 choices)
function getQuestsForLevel(level) {
  const available = QUESTS.filter(q => level >= q.level && level <= (q.maxLevel || 99))
  if (available.length <= 4) return available
  // Shuffle and pick 4
  const shuffled = available.sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 4)
}

function getMap(mapKey) {
  return MAPS[mapKey] || null
}

function getAllMaps() {
  return MAPS
}

function getQuestById(id) {
  return QUESTS.find(q => q.id === id) || null
}

// Render a 9x9 map with the player at (row, col)
function renderMap(mapKey, playerRow, playerCol) {
  const map = MAPS[mapKey]
  if (!map) return null
  const rows = map.grid.map((row, r) =>
    row.map((cell, c) => {
      if (r === playerRow && c === playerCol) return '📍'
      return cell
    }).join('  ')
  )
  return rows.join('\n')
}


// Alias MAPS as WORLD_MAPS for rpg.js compatibility
const WORLD_MAPS = MAPS

// Move player on a map grid — returns { ok, row, col, msg }
function movePlayer(mapKey, row, col, direction) {
  const map = MAPS[mapKey]
  if (!map) return { ok: false, msg: `Map not found: ${mapKey}` }
  const grid = map.grid
  const rows = grid.length
  const cols = grid[0].length
  let nr = row, nc = col
  if (direction === 'north') nr = row - 1
  else if (direction === 'south') nr = row + 1
  else if (direction === 'east') nc = col + 1
  else if (direction === 'west') nc = col - 1
  else return { ok: false, msg: `Unknown direction: ${direction}` }
  if (nr < 0 || nr >= rows || nc < 0 || nc >= cols)
    return { ok: false, msg: `You've hit the edge of the map! (Row ${row+1}, Col ${col+1})` }
  const tile = grid[nr][nc]
  if (tile === '#') return { ok: false, msg: `A wall blocks your path! Try a different direction.` }
  return { ok: true, row: nr, col: nc }
}

module.exports = { MAPS, WORLD_MAPS, QUESTS, getQuestsForLevel, getMap, getAllMaps, getQuestById, renderMap, movePlayer }

