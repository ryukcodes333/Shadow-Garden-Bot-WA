const db = require('../database')

// ── .ecostats — Economy inflation dashboard (staff only) ─────────────────────
// Shows daily coin generation vs removal for the past 7 days.
// Tracks what sources inject money and what sinks remove it.
// Helps detect inflation and tune reward rates.

module.exports = {
  async ecostats({ reply, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) {
      return reply('⚠️ *Staff only.*\n\n_This command is restricted to owners, mods, and guardians._')
    }

    const rows   = await db.getEconStats(7).catch(() => [])
    const totals = await db.getEconTotals().catch(() => ({ totalGenerated: 0, totalRemoved: 0 }))

    if (!rows.length) {
      return reply(
        `📊 *Economy Stats*\n\n` +
        `_No data yet. Coin tracking begins once players start using economy commands._\n\n` +
        `_Generated: tracks coins from .daily, .work, .fish, .dig, .heist, etc._\n` +
        `_Removed: tracks coins spent in .shop, .crime fines, .rob fines, and gambling losses._`
      )
    }

    const lines = rows.map(r => {
      const net  = r.generated - r.removed
      const sign = net >= 0 ? '+' : ''
      return (
        `*${r.date}*\n` +
        `  ↑ Generated: $${r.generated.toLocaleString()}\n` +
        `  ↓ Removed:   $${r.removed.toLocaleString()}\n` +
        `  Net: ${sign}$${net.toLocaleString()}${net > 0 ? ' ⚠️' : ' ✅'}`
      )
    }).join('\n\n')

    const totalNet  = totals.totalGenerated - totals.totalRemoved
    const inflation = totals.totalGenerated > 0
      ? ((totalNet / totals.totalGenerated) * 100).toFixed(1)
      : '0.0'

    const health =
      totalNet < 0 ? '✅ Deflationary (sinks outpacing sources)' :
      totalNet < totals.totalGenerated * 0.20 ? '✅ Healthy (< 20% inflation)' :
      totalNet < totals.totalGenerated * 0.50 ? '⚠️ Mild inflation (20–50%)' :
      '🚨 High inflation (> 50%) — consider tightening rewards'

    await reply(
      `📊 *Economy Stats — Last 7 Days*\n\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      lines +
      `\n\n━━━━━━━━━━━━━━━━\n\n` +
      `📈 *All-Time Totals*\n` +
      `  ↑ Total Generated: $${totals.totalGenerated.toLocaleString()}\n` +
      `  ↓ Total Removed:   $${totals.totalRemoved.toLocaleString()}\n` +
      `  Net Inflation: ${inflation}%\n\n` +
      `🩺 *Economy Health:* ${health}\n\n` +
      `_Data updates in real-time as commands are used._`
    )
  },
}
