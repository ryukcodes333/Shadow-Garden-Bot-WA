const axios = require('axios')

const UNITS = {
  length: {
    mm: 0.001, cm: 0.01, m: 1, km: 1000,
    inch: 0.0254, ft: 0.3048, yard: 0.9144, mile: 1609.344,
  },
  weight: {
    mg: 0.000001, g: 0.001, kg: 1, ton: 1000,
    oz: 0.028349, lb: 0.453592,
  },
  temperature: { c: true, f: true, k: true },
  data: {
    b: 1, kb: 1024, mb: 1048576, gb: 1073741824, tb: 1099511627776,
  },
  speed: {
    'km/h': 1, 'mph': 1.60934, 'ms': 3.6, knot: 1.852,
  },
  time: {
    s: 1, min: 60, hr: 3600, day: 86400, week: 604800,
  },
}

function convertTemp(val, from, to) {
  let celsius
  switch (from) {
    case 'c': celsius = val; break
    case 'f': celsius = (val - 32) * 5 / 9; break
    case 'k': celsius = val - 273.15; break
  }
  switch (to) {
    case 'c': return celsius
    case 'f': return celsius * 9 / 5 + 32
    case 'k': return celsius + 273.15
  }
}

function convertUnit(val, from, to, category) {
  if (category === 'temperature') return convertTemp(val, from.toLowerCase(), to.toLowerCase())
  const cat = UNITS[category]
  if (!cat) return null
  const fromFactor = cat[from.toLowerCase()]
  const toFactor = cat[to.toLowerCase()]
  if (!fromFactor || !toFactor) return null
  return val * fromFactor / toFactor
}

function detectCategory(from) {
  const f = from.toLowerCase()
  for (const [cat, units] of Object.entries(UNITS)) {
    if (f in units) return cat
  }
  return null
}

module.exports = {
  async convert({ reply, args }) {
    const amount = parseFloat(args[0])
    const from = args[1]
    const to = args[3] || args[2]

    if (isNaN(amount) || !from || !to) {
      return reply(`🔁 *UNIT CONVERTER*\n\nUsage: *.convert <value> <from> to <to>*\n\n📐 *Length:*  mm cm m km inch ft yard mile\n⚖️ *Weight:*  mg g kg ton oz lb\n🌡️ *Temp:*   C F K\n💾 *Data:*   B KB MB GB TB\n🚀 *Speed:*  km/h mph ms knot\n⏱️ *Time:*   s min hr day week\n\n*Examples:*\n• .convert 100 km to mile\n• .convert 98.6 F to C\n• .convert 500 mb to gb\n\n_The system measures all._ 🖤`)
    }

    const category = detectCategory(from)
    if (!category) return reply(`❌ Unit "*${from}*" not recognised.\n\n💡 Use *.convert* with no args to see all units.`)

    const result = convertUnit(amount, from, to, category)
    if (result === null) return reply(`❌ Cannot convert *${from}* to *${to}*.\n\nBoth units must be in the same category.\n\n💡 Use *.convert* to see all valid units.`)

    const precision = result % 1 === 0 ? 0 : 4
    await reply(`🔁 *UNIT CONVERSION*\n\n📐 *Category:* ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n${amount} ${from.toUpperCase()} =\n\n*${result.toFixed(precision)} ${to.toUpperCase()}*\n\n_Precision from the shadows._ 🖤`)
  },

  async calc({ reply, args }) {
    const expr = args.join(' ').replace(/[^0-9+\-*/().%\s]/g, '')
    if (!expr) return reply('⚠️ Usage: *.calc <expression>*\n\nExample: *.calc 100 * 3.5 / 2*')
    try {
      const result = Function(`"use strict"; return (${expr})`)()
      if (!isFinite(result)) return reply(`❌ Result is not finite (division by zero?)`)
      await reply(`🧮 *CALCULATOR*\n\n📝 ${expr}\n\n= *${result}*\n\n_Numbers reveal truth._ 🖤`)
    } catch (e) {
      await reply(`❌ Invalid expression: ${expr}\n\n_Check your maths._ 🖤`)
    }
  },

  async math(ctx) { return module.exports.calc(ctx) },

  async time({ reply, args }) {
    const tz = args.join(' ') || 'UTC'
    try {
      const now = new Date()
      const formatted = now.toLocaleString('en-US', { timeZone: tz, dateStyle: 'full', timeStyle: 'long' })
      await reply(`🕐 *TIME — ${tz.toUpperCase()}*\n\n${formatted}\n\n_Time flows through the shadows._ 🖤`)
    } catch (e) {
      await reply(`❌ Unknown timezone: *${tz}*\n\nExamples: UTC, Africa/Lagos, America/New_York, Asia/Tokyo\n\n_Check your timezone name._ 🖤`)
    }
  },

  async currency({ reply, args }) {
    const amount = parseFloat(args[0])
    const from = args[1]?.toUpperCase()
    const to = (args[3] || args[2])?.toUpperCase()

    if (!amount || !from || !to) {
      return reply(`💱 *CURRENCY CONVERTER*\n\nUsage: *.currency <amount> <from> to <to>*\n\nExample: *.currency 100 USD to NGN*\n\n_Currencies flow like shadows._ 🖤`)
    }

    try {
      const res = await axios.get(`https://open.er-api.com/v6/latest/${from}`, { timeout: 8000 })
      const rate = res.data?.rates?.[to]
      if (!rate) return reply(`❌ Rate for *${to}* not available.\n\nCheck currency code and try again.`)
      const result = (amount * rate).toFixed(2)
      await reply(`💱 *CURRENCY CONVERSION*\n\n${amount} *${from}* =\n\n*${result} ${to}*\n\n📊 Rate: 1 ${from} = ${rate.toFixed(4)} ${to}\n\n_Exchange rates shift like shadows._ 🖤`)
    } catch (e) {
      await reply(`❌ Currency lookup failed: ${e.message}\n\nTry again shortly.`)
    }
  },

  async fx(ctx) { return module.exports.currency(ctx) },

  async bmi({ reply, args }) {
    const weight = parseFloat(args[0])
    const height = parseFloat(args[1])
    if (!weight || !height) return reply('⚠️ Usage: *.bmi <weight_kg> <height_m>*\n\nExample: *.bmi 70 1.75*')
    const bmi = weight / (height * height)
    let category
    if (bmi < 18.5) category = 'Underweight'
    else if (bmi < 25) category = 'Normal weight'
    else if (bmi < 30) category = 'Overweight'
    else category = 'Obese'
    await reply(`⚖️ *BMI CALCULATOR*\n\n⚖️ Weight: ${weight} kg\n📏 Height: ${height} m\n\n🔢 *BMI: ${bmi.toFixed(2)}*\n📊 Category: *${category}*\n\n_Know your shadow's weight._ 🖤`)
  },

  async age({ reply, args }) {
    const dateStr = args.join(' ')
    if (!dateStr) return reply('⚠️ Usage: *.age <YYYY-MM-DD>*\n\nExample: *.age 2000-05-15*')
    const birth = new Date(dateStr)
    if (isNaN(birth)) return reply('❌ Invalid date. Use format: YYYY-MM-DD')
    const now = new Date()
    let years = now.getFullYear() - birth.getFullYear()
    let months = now.getMonth() - birth.getMonth()
    let days = now.getDate() - birth.getDate()
    if (days < 0) { months--; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate() }
    if (months < 0) { years--; months += 12 }
    const totalDays = Math.floor((now - birth) / 86400000)
    await reply(`🎂 *AGE CALCULATOR*\n\n📅 Birthday: ${dateStr}\n\n🕐 Age: *${years} years, ${months} months, ${days} days*\n📊 Total Days: ${totalDays.toLocaleString()}\n\n_Time reveals all._ 🖤`)
  },

  async encode({ reply, args }) {
    const text = args.join(' ')
    if (!text) return reply('⚠️ Usage: *.encode <text>*')
    const encoded = Buffer.from(text).toString('base64')
    await reply(`🔐 *BASE64 ENCODE*\n\n📝 Input: ${text}\n\n🔒 Encoded:\n${encoded}\n\n_Shadows can encrypt._ 🖤`)
  },

  async decode({ reply, args }) {
    const text = args.join(' ')
    if (!text) return reply('⚠️ Usage: *.decode <base64>*')
    try {
      const decoded = Buffer.from(text, 'base64').toString('utf-8')
      await reply(`🔓 *BASE64 DECODE*\n\n🔒 Input: ${text}\n\n📝 Decoded:\n${decoded}\n\n_The shadows reveal all secrets._ 🖤`)
    } catch (e) {
      await reply('❌ Invalid base64 string.')
    }
  },

  async color({ reply, args }) {
    const hex = args[0]?.replace('#', '')
    if (!hex || hex.length !== 6) return reply('⚠️ Usage: *.color <hex>*\n\nExample: *.color FF5733*')
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    const hsl = rgbToHsl(r, g, b)
    await reply(`🎨 *COLOR INFO*\n\n🎨 Hex: #${hex.toUpperCase()}\n🔴 R: ${r}\n🟢 G: ${g}\n🔵 B: ${b}\n🌈 HSL: hsl(${hsl[0]}°, ${hsl[1]}%, ${hsl[2]}%)\n\n_Every color casts a shadow._ 🖤`)
  },

  async roman({ reply, args }) {
    const num = parseInt(args[0])
    if (!num || num < 1 || num > 3999) return reply('⚠️ Usage: *.roman <1-3999>*')
    const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1]
    const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I']
    let roman = ''
    let n = num
    for (let i = 0; i < vals.length; i++) {
      while (n >= vals[i]) { roman += syms[i]; n -= vals[i] }
    }
    await reply(`🏛️ *ROMAN NUMERALS*\n\n🔢 ${num} = *${roman}*\n\n_Ancient number from the shadows._ 🖤`)
  },

  async binary({ reply, args }) {
    const input = args.join(' ')
    if (!input) return reply('⚠️ Usage: *.binary <number or text>*')
    const num = parseInt(input)
    if (!isNaN(num)) {
      return reply(`💻 *BINARY*\n\n🔢 ${num} = *${num.toString(2)}*\n\n_Digital shadows._ 🖤`)
    }
    const bin = [...input].map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ')
    await reply(`💻 *TEXT → BINARY*\n\n📝 "${input}"\n\n${bin}\n\n_Reduced to the most fundamental shadows._ 🖤`)
  },

  async hex({ reply, args }) {
    const input = args.join(' ')
    if (!input) return reply('⚠️ Usage: *.hex <number or text>*')
    const num = parseInt(input)
    if (!isNaN(num)) {
      return reply(`🔢 *HEX*\n\n${num} = *0x${num.toString(16).toUpperCase()}*\n\n_Hexadecimal truth._ 🖤`)
    }
    const hexStr = [...input].map(c => c.charCodeAt(0).toString(16).padStart(2,'0')).join(' ')
    await reply(`🔢 *TEXT → HEX*\n\n📝 "${input}"\n\n${hexStr}\n\n_The shadow of the code._ 🖤`)
  },
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h, s, l = (max + min) / 2
  if (max === min) { h = s = 0 } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}
