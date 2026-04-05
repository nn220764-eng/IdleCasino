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
  coins: 1000,
  coinsPerSec: 0,
  lastActiveTime: Date.now(),
  purchased: [],        // upgrade IDs
  rtp: { bj: [], slots: [], roulette: [] },  // ring buffers (win amounts)
  bets: { bj: [], slots: [], roulette: [] }, // ring buffers (bet amounts)
  rtpIndex: { bj: 0, slots: 0, roulette: 0 },
  rtpBaseline: { bj: null, slots: null, roulette: null }, // snapshot at last upgrade
}

// --- Game params (mutable by upgrades) ---
export const params = {
  bj: { bet: 100, interval: 3000, numDecks: 1 },
  slots: { bet: 10, interval: 1000, paytable: { triple_7: 500, triple_B: 150, triple_C: 80, triple_L: 40, double_C: 20, single_C: 16 } },
  roulette: { bet: 50, interval: 5000, cornerBet: 0 },
}

const gameLoops = { bj: null, slots: null, roulette: null }
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
function bjTick() {
  const result = bjRound({ bet: params.bj.bet, numDecks: params.bj.numDecks })
  // houseNet > 0 = casino wins (coins earned), < 0 = casino loses
  const houseGain = result.playerNet  // playerNet in BJ engine = house's gain
  addCoins(state, houseGain)
  recordRound('bj', houseGain + params.bj.bet, params.bj.bet)  // win = bet+gain for RTP calc

  const won = houseGain > 0
  const label = won ? `BJ WIN +${houseGain}` : houseGain === 0 ? 'BJ PUSH' : `BJ LOSE ${houseGain}`
  appendLog('bj', label, won, calcRTP('bj'), rtpDelta('bj'))

  maybeSave(serializeState())
  render(state, params)
}

const SLOT_EMOJI = { '7': '7️⃣', 'B': '🎰', 'C': '🍒', 'L': '🍋', '_': '⬜' }

function slotsTick() {
  const result = computeSpin({ bet: params.slots.bet, paytable: params.slots.paytable })
  addCoins(state, result.houseNet)
  recordRound('slots', result.payout, params.slots.bet)

  const won = result.houseNet < 0  // house loses = player (slot machine customer) wins = casino still profits from edge over time
  // From house perspective: houseNet > 0 = we collected more than we paid = profit
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
function startGame(game) {
  if (gameLoops[game]) clearInterval(gameLoops[game])

  const tick = { bj: bjTick, slots: slotsTick, roulette: rouletteTick }[game]
  gameLoops[game] = setInterval(tick, params[game === 'bj' ? 'bj' : game].interval)
}

function startAllGames() {
  startGame('bj')
  startGame('slots')
  startGame('roulette')
}

// --- Upgrade purchase ---
export function buyUpgrade(id) {
  if (state.purchased.includes(id)) return false

  const upgrade = UPGRADES.find(u => u.id === id)
  if (!upgrade || state.coins < upgrade.cost) return false

  addCoins(state, -upgrade.cost)
  upgrade.apply(params)
  state.purchased.push(id)

  // Snapshot current RTP as new baseline
  const game = upgrade.game === 'bj' ? 'bj' : upgrade.game
  state.rtpBaseline[game] = calcRTP(game)

  // Restart the affected game loop with new interval
  startGame(upgrade.game === 'bj' ? 'bj' : upgrade.game)

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
    applyPurchased()

    // Offline income
    const earned = calcOfflineIncome(state)
    if (earned > 0) {
      addCoins(state, earned)
      appendLog('system', `オフライン収益: +${earned} coins`, true, 0, null)
    }
  }

  updateCoinsPerSec(state, params)
  startAllGames()

  // Force-save on tab hide, update lastActiveTime
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
