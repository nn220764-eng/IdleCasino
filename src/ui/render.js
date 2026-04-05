// DOM rendering — direct textContent / classList updates
// Called after every game tick and after upgrades/table purchases

import { UPGRADES } from '../game/upgrades.js'
import { buyUpgrade, buyTable } from '../game/idle-loop.js'
import { updateRTPMeter } from './rtp-meter.js'

const LOG_MAX = 10
const logEntries = []

// Unlock conditions per game (slots/roulette only; bj is always unlocked)
const UNLOCK_CONDITIONS = {
  slots:    (state) => state.tables.bj >= 3    || state.coins >= 3000,
  roulette: (state) => state.tables.slots >= 2 || state.coins >= 5000,
}

// Keys to avoid unnecessary DOM rebuilds
let lastUpgradeKey = ''
let lastTableKey = ''

export function render(state, params) {
  // Coin counter
  const el = document.getElementById('coins')
  if (el) el.textContent = formatCoins(state.coins)

  // Income per second (header + panel)
  const ips = document.getElementById('income-per-sec')
  if (ips) ips.textContent = `+${state.coinsPerSec.toFixed(2)} /s`
  const ipsPanel = document.getElementById('income-per-sec-panel')
  if (ipsPanel) ipsPanel.textContent = `+${state.coinsPerSec.toFixed(2)} /s`

  renderTables(state, params)
  renderUpgrades(state)
}

function formatCoins(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}K`
  return Math.floor(n).toLocaleString()
}

// --- Table cards ---

function renderTables(state, params) {
  // Recompute key: rebuild only when table counts, costs, or affordability changes
  const affordKey = ['bj', 'slots', 'roulette'].map(g =>
    state.coins >= state.tableCosts[g] ? 'a' : 'd'
  ).join('')
  const tableKey = JSON.stringify(state.tables) + JSON.stringify(state.tableCosts) + affordKey
  if (tableKey === lastTableKey) return
  lastTableKey = tableKey

  for (const game of ['bj', 'slots', 'roulette']) {
    updateTableCard(game, state)
  }
}

function updateTableCard(game, state) {
  const card = document.getElementById(`card-${game}`)
  if (!card) return

  const count    = state.tables[game]
  const cost     = state.tableCosts[game]
  const isLocked = count === 0
  const canUnlock = isLocked && (UNLOCK_CONDITIONS[game]?.(state) ?? true)
  const canAfford = state.coins >= cost

  // Table count badge
  const countEl = document.getElementById(`table-count-${game}`)
  if (countEl) countEl.textContent = count > 0 ? `${count}台` : ''

  // Card locked opacity
  card.classList.toggle('locked', isLocked && !canUnlock)

  // Game status label
  const statusEl = card.querySelector('.game-status')
  if (statusEl) {
    if (!isLocked) {
      statusEl.textContent = '● AUTO'
      statusEl.className = 'game-status running'
    } else if (canUnlock) {
      statusEl.textContent = 'UNLOCK'
      statusEl.className = 'game-status unlockable'
    } else {
      statusEl.textContent = 'LOCKED'
      statusEl.className = 'game-status locked-status'
    }
  }

  // Action button area
  const actionsEl = document.getElementById(`table-actions-${game}`)
  if (!actionsEl) return

  if (!isLocked) {
    actionsEl.innerHTML = `
      <button class="table-buy-btn${canAfford ? '' : ' disabled'}" data-game="${game}">
        テーブル増設 <span class="btn-cost">🪙 ${cost.toLocaleString()}</span>
      </button>
    `
    if (canAfford) {
      actionsEl.querySelector('.table-buy-btn').addEventListener('click', () => buyTable(game))
    }
  } else if (canUnlock) {
    actionsEl.innerHTML = `
      <button class="table-buy-btn unlock-btn" data-game="${game}">
        アンロック <span class="btn-cost">🪙 ${cost.toLocaleString()}</span>
      </button>
    `
    actionsEl.querySelector('.table-buy-btn').addEventListener('click', () => buyTable(game))
  } else {
    const hints = {
      slots:    'BJ 3台 または 3,000c',
      roulette: 'Slots 2台 または 5,000c',
    }
    actionsEl.innerHTML = `<div class="locked-hint">🔒 ${hints[game] ?? ''}</div>`
  }
}

// --- Upgrade panel ---

function renderUpgrades(state) {
  const panel = document.getElementById('upgrade-list')
  if (!panel) return

  // Only rebuild when affordability or purchase state changes
  const key = UPGRADES.map(u =>
    state.purchased.includes(u.id) ? 'p' : state.coins >= u.cost ? 'a' : 'd'
  ).join('')
  if (key === lastUpgradeKey) return
  lastUpgradeKey = key

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
      div.addEventListener('click', () => { buyUpgrade(upg.id) })
    }

    panel.appendChild(div)
  }
}

// --- Activity log ---

export function appendLog(game, message, won, rtpValue, rtpDelta) {
  const container = document.getElementById('log-entries')
  if (!container) return

  if (rtpValue > 0 && game !== 'system') {
    updateRTPMeter(game, rtpValue)

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
