// Coin management and offline income calculation

export function addCoins(state, amount) {
  state.coins += amount
}

// coinsPerSec: sum of (expectedCoinPerRound / intervalSec) across all games
// Called on tab focus to calculate offline earnings
export function calcOfflineIncome(state) {
  const now = Date.now()
  if (!state.lastActiveTime) {
    state.lastActiveTime = now
    return 0
  }

  const elapsedSec = Math.min((now - state.lastActiveTime) / 1000, 14400) // 4-hour cap
  const earned = Math.floor(elapsedSec * state.coinsPerSec)

  state.lastActiveTime = now
  return earned
}

// Update coinsPerSec whenever params change (called after each upgrade)
export function updateCoinsPerSec(state, params) {
  const bjEV = params.bj.bet * 0.005  // BJ house edge ~0.5%
  const slotEV = params.slots.bet * 0.05  // Slot house edge ~5%
  const rouEV = params.roulette.bet * 0.027  // Roulette house edge ~2.7%
    + params.roulette.cornerBet * 0.027

  const bjRate = bjEV / (params.bj.interval / 1000)
  const slotRate = slotEV / (params.slots.interval / 1000)
  const rouRate = rouEV / (params.roulette.interval / 1000)

  state.coinsPerSec = bjRate + slotRate + rouRate
}
