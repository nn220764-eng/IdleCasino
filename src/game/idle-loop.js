// Central game loop coordinator
// Owns all setInterval IDs — prevents double-interval accumulation on upgrades

import { computeRound as bjRound } from '../engine/blackjack.js'
import { computeSpin } from '../engine/slots.js'
import { computeRound as rouRound } from '../engine/roulette.js'
import { addCoins, calcOfflineIncome, updateCoinsPerSec } from './economy.js'
import { maybeSave, forceSave, loadState } from './save.js'
import { UPGRADES } from './upgrades.js'
import { render, appendLog } from '../ui/render.js'
import { updateRTPMeter } from '../ui/rtp-meter.js'

// --- State ---
export const state = {
  coins: 500,
  coinsPerSec: 0,
  lastActiveTime: Date.now(),
  purchased: [],        // upgrade IDs
  rtp: { bj: [], slots: [], roulette: [] },  // ring buffers (win amounts)
  bets: { bj: [], slots: [], roulette: [] }, // ring buffers (bet amounts)
  rtpIndex: { bj: 0, slots: 0, roulette: 0 },
  rtpBaseline: { bj: null, slots: null, roulette: null },
  tables: { bj: 1, slots: 0, roulette: 0 },
  tableCosts: { bj: 1000, slots: 3000, roulette: 5000 },
}

// --- Game params (mutable by upgrades) ---
export const params = {
  bj: { bet: 100, interval: 3000, numDecks: 1 },
  slots: { bet: 10, interval: 1000, paytable: { triple_7: 500, triple_B: 150, triple_C: 80, triple_L: 40, double_C: 20, single_C: 16 } },
  roulette: { bet: 50, interval: 5000, cornerBet: 0 },
}

const GAMES = ['bj', 'slots', 'roulette']
const gameLoops = { bj: [], slots: [], roulette: [] }
const RTP_WINDOW = 100

// --- RTP ring buffer ---
function recordRound(game, win, bet) {
  const idx = state.rtpIndex[game] % RTP_WINDOW
  state.rtp[game][idx] = win
  state.bets[game][idx] = bet
  state.rtpIndex[game]++
}

function calcRTP(game) {
  const wins = state.rtp[game]
  const bets = state.bets[game]
  if (wins.length === 0) return 0
  const sumWin = wins.reduce((a, b) => a + (b ?? 0), 0)
  const sumBet = bets.reduce((a, b) => a + (b ?? 0), 0)
  return sumBet > 0 ? (sumWin / sumBet) * 100 : 0
}

function rtpDelta(game) {
  const current = calcRTP(game)
  const baseline = state.rtpBaseline[game]
  if (baseline === null) return null
  return (current - baseline).toFixed(1)
}

// --- Game tick handlers ---
const RED_SUITS = new Set(['♥', '♦'])

function renderBjCards(playerHand, dealerHand) {
  const playerEl = document.getElementById('player-cards')
  const dealerEl = document.getElementById('dealer-cards')
  if (playerEl) {
    playerEl.innerHTML = playerHand.map(c => {
      const red = RED_SUITS.has(c.suit) ? ' red' : ''
      return `<div class="card${red}">${c.rank}</div>`
    }).join('')
  }
  if (dealerEl) {
    dealerEl.innerHTML = dealerHand.map((c, i) => {
      if (i === 1) return `<div class="card face-down">?</div>`
      const red = RED_SUITS.has(c.suit) ? ' red' : ''
      return `<div class="card${red}">${c.rank}</div>`
    }).join('')
  }
}

function bjTick() {
  const result = bjRound({ bet: params.bj.bet, numDecks: params.bj.numDecks })
  const houseGain = result.playerNet
  addCoins(state, houseGain)
  recordRound('bj', houseGain + params.bj.bet, params.bj.bet)

  const won = houseGain > 0
  const label = won ? `BJ WIN +${houseGain}` : houseGain === 0 ? 'BJ PUSH' : `BJ LOSE ${houseGain}`
  appendLog('bj', label, won, calcRTP('bj'), rtpDelta('bj'))

  renderBjCards(result.playerHand, result.dealerHand)

  maybeSave(serializeState())
  render(state, params)
}

const SLOT_EMOJI = { '7': '7️⃣', 'B': '🎰', 'C': '🍒', 'L': '🍋', '_': '⬜' }

function slotsTick() {
  const result = computeSpin({ bet: params.slots.bet, paytable: params.slots.paytable })
  addCoins(state, result.houseNet)
  recordRound('slots', result.payout, params.slots.bet)

  const houseWon = result.houseNet >= 0
  const label = houseWon
    ? `SLOTS +${result.houseNet} | ${result.reels.join('')}`
    : `SLOTS ${result.houseNet} | ${result.reels.join('')}`
  appendLog('slots', label, houseWon, calcRTP('slots'), rtpDelta('slots'))

  result.reels.forEach((id, i) => {
    const el = document.getElementById(`reel-${i}`)
    if (el) el.textContent = SLOT_EMOJI[id] ?? id
  })

  maybeSave(serializeState())
  render(state, params)
}

function rouletteTick() {
  const result = rouRound({ bet: params.roulette.bet, cornerBet: params.roulette.cornerBet })
  addCoins(state, result.houseNet)
  const totalBet = params.roulette.bet + params.roulette.cornerBet
  recordRound('roulette', totalBet + result.houseNet, totalBet)

  const houseWon = result.houseNet >= 0
  const label = houseWon
    ? `ROULETTE WIN +${result.houseNet} | ${result.number} ${result.color.toUpperCase()}`
    : `ROULETTE LOSE ${result.houseNet} | ${result.number} ${result.color.toUpperCase()}`
  appendLog('roulette', label, houseWon, calcRTP('roulette'), rtpDelta('roulette'))

  const lastEl = document.getElementById('roulette-last')
  if (lastEl) {
    lastEl.innerHTML = `Last: <span class="${result.color.toLowerCase()}">${result.number} ${result.color.toUpperCase()}</span>`
  }

  maybeSave(serializeState())
  render(state, params)
}

// --- Loop management ---
const TICKS = { bj: bjTick, slots: slotsTick, roulette: rouletteTick }

function startTable(game, _tableIndex) {
  const id = setInterval(TICKS[game], params[game].interval)
  gameLoops[game].push(id)
  return id
}

function stopAllTables(game) {
  gameLoops[game].forEach(id => clearInterval(id))
  gameLoops[game] = []
}

function startAllTables(game) {
  stopAllTables(game)
  for (let i = 0; i < state.tables[game]; i++) {
    startTable(game, i)
  }
}

function startAllGames() {
  for (const game of GAMES) {
    startAllTables(game)
  }
}

// --- Table purchase ---
export function buyTable(game) {
  const cost = state.tableCosts[game]
  if (state.coins < cost) return false
  addCoins(state, -cost)
  state.tables[game]++
  state.tableCosts[game] = Math.floor(cost * 1.8)
  startTable(game, state.tables[game] - 1)
  updateCoinsPerSec(state, params)
  forceSave(serializeState())
  render(state, params)
  return true
}

// --- Upgrade purchase ---
export function buyUpgrade(id) {
  if (state.purchased.includes(id)) return false

  const upgrade = UPGRADES.find(u => u.id === id)
  if (!upgrade || state.coins < upgrade.cost) return false

  addCoins(state, -upgrade.cost)
  upgrade.apply(params)
  state.purchased.push(id)

  const game = upgrade.game
  state.rtpBaseline[game] = calcRTP(game)

  // Restart all tables for this game with the new interval
  startAllTables(game)

  updateCoinsPerSec(state, params)
  forceSave(serializeState())
  render(state, params)
  return true
}

// --- State serialization ---
function serializeState() {
  return {
    coins: state.coins,
    coinsPerSec: state.coinsPerSec,
    lastActiveTime: Date.now(),
    purchased: state.purchased,
    rtp: state.rtp,
    bets: state.bets,
    rtpIndex: state.rtpIndex,
    rtpBaseline: state.rtpBaseline,
    tables: state.tables,
    tableCosts: state.tableCosts,
  }
}

function applyPurchased() {
  for (const id of state.purchased) {
    const upgrade = UPGRADES.find(u => u.id === id)
    if (upgrade) upgrade.apply(params)
  }
}

// --- Init ---
export function init() {
  const saved = loadState()
  if (saved) {
    Object.assign(state, saved)
    // Backwards-compatibility: old saves have no tables field
    if (!saved.tables) {
      state.tables = { bj: 1, slots: 0, roulette: 0 }
      state.tableCosts = { bj: 1000, slots: 3000, roulette: 5000 }
    }
    applyPurchased()

    const earned = calcOfflineIncome(state)
    if (earned > 0) {
      addCoins(state, earned)
      appendLog('system', `オフライン収益: +${earned} coins`, true, 0, null)
    }
  }

  updateCoinsPerSec(state, params)
  startAllGames()

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      state.lastActiveTime = Date.now()
      forceSave(serializeState())
    } else {
      const earned = calcOfflineIncome(state)
      if (earned > 0) {
        addCoins(state, earned)
        appendLog('system', `復帰ボーナス: +${earned} coins`, true, 0, null)
        render(state, params)
      }
    }
  })

  render(state, params)
}
