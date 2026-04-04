// DOM rendering — direct textContent / classList updates
// Called after every game tick and after upgrades

import { UPGRADES } from '../game/upgrades.js'
import { buyUpgrade } from '../game/idle-loop.js'
import { updateRTPMeter } from './rtp-meter.js'

const LOG_MAX = 10
const logEntries = []

export function render(state, params) {
  // Coin counter
  const el = document.getElementById('coins')
  if (el) el.textContent = formatCoins(state.coins)

  // Income per second
  const ips = document.getElementById('income-per-sec')
  if (ips) ips.textContent = `+${state.coinsPerSec.toFixed(1)} /s`

  // RTP meters (only update if we have data)
  // Meters are updated via appendLog which calls updateRTPMeter directly

  // Upgrades
  renderUpgrades(state)
}

function formatCoins(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}K`
  return Math.floor(n).toLocaleString()
}

function renderUpgrades(state) {
  const panel = document.getElementById('upgrade-list')
  if (!panel) return

  panel.innerHTML = ''
  for (const upg of UPGRADES) {
    const purchased = state.purchased.includes(upg.id)
    const canAfford = state.coins >= upg.cost

    const div = document.createElement('div')
    div.className = 'upgrade-item' + (purchased ? ' purchased' : !canAfford ? ' disabled' : '')
    div.innerHTML = `
      <div class="upgrade-name">${upg.name}${purchased ? ' ✓' : ''}</div>
      <div class="upgrade-desc">${upg.desc}</div>
      <div class="upgrade-effect">${upg.effect}</div>
      ${purchased ? '' : `<div class="upgrade-cost">🪙 ${upg.cost.toLocaleString()}</div>`}
    `

    if (!purchased) {
      div.addEventListener('click', () => {
        buyUpgrade(upg.id)
      })
    }

    panel.appendChild(div)
  }
}

export function appendLog(game, message, won, rtpValue, rtpDelta) {
  const container = document.getElementById('log-entries')
  if (!container) return

  // Update RTP meter for this game
  if (rtpValue > 0 && game !== 'system') {
    updateRTPMeter(game, rtpValue)

    // Show RTP delta in the game card
    const deltaEl = document.getElementById(`rtp-delta-${game}`)
    if (deltaEl && rtpDelta !== null) {
      const d = parseFloat(rtpDelta)
      deltaEl.textContent = d >= 0 ? `+${rtpDelta}%` : `${rtpDelta}%`
      deltaEl.style.color = d >= 0 ? '#4caf50' : '#f44336'
    }
  }

  const entry = { game, message, won, rtpValue, rtpDelta, ts: Date.now() }
  logEntries.unshift(entry)
  if (logEntries.length > LOG_MAX) logEntries.pop()

  container.innerHTML = logEntries.map(e => {
    const cls = e.won ? 'win' : 'lose'
    const rtpStr = e.rtpValue > 0 ? ` | RTP ${e.rtpValue.toFixed(1)}%` : ''
    const deltaStr = e.rtpDelta !== null && e.rtpDelta !== undefined
      ? ` (${parseFloat(e.rtpDelta) >= 0 ? '+' : ''}${e.rtpDelta}%)`
      : ''
    return `<div class="log-entry"><span class="${cls}">${e.message}</span>${rtpStr}${deltaStr}</div>`
  }).join('')
}
