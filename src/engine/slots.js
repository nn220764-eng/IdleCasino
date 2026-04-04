// Slots engine — 3 reels, 5 symbols, partial cherry matches
// Theoretical RTP ~95% (tuned via paytable values)

// Symbol weights per reel (out of 100)
const BASE_SYMBOLS = [
  { id: '7',  emoji: '7️⃣',  weight: 5  },
  { id: 'B',  emoji: '🎰',  weight: 10 },
  { id: 'C',  emoji: '🍒',  weight: 20 },
  { id: 'L',  emoji: '🍋',  weight: 25 },
  { id: '_',  emoji: '⬜',  weight: 40 },
]

// Paytable — payout added ON TOP of bet (bet is always lost first)
// partial cherry rules bring RTP from ~5% to ~95%
const BASE_PAYTABLE = {
  triple_7:     500,  // 7️⃣-7️⃣-7️⃣
  triple_B:     150,  // 🎰-🎰-🎰
  triple_C:      80,  // 🍒-🍒-🍒
  triple_L:      40,  // 🍋-🍋-🍋
  double_C:      20,  // any 2 cherries
  single_C:      16,  // any 1 cherry
}

function buildWeightedPool(symbols) {
  const pool = []
  for (const s of symbols) {
    for (let i = 0; i < s.weight; i++) pool.push(s.id)
  }
  return pool
}

function spinReel(pool) {
  return pool[Math.floor(Math.random() * pool.length)]
}

function countSymbol(reels, id) {
  return reels.filter(r => r === id).length
}

function calcPayout(reels, paytable) {
  const [a, b, c] = reels

  if (a === b && b === c) {
    if (a === '7') return paytable.triple_7
    if (a === 'B') return paytable.triple_B
    if (a === 'C') return paytable.triple_C
    if (a === 'L') return paytable.triple_L
  }

  const cherries = countSymbol(reels, 'C')
  if (cherries === 2) return paytable.double_C
  if (cherries === 1) return paytable.single_C

  return 0
}

// Returns { reels, payout, houseNet }
// houseNet: coins gained by the casino (positive = casino wins)
export function computeSpin(params = {}) {
  const { bet = 10, paytable = BASE_PAYTABLE, symbols = BASE_SYMBOLS } = params
  const pool = buildWeightedPool(symbols)

  const reels = [spinReel(pool), spinReel(pool), spinReel(pool)]
  const payout = calcPayout(reels, paytable)

  // Casino always collects the bet, then pays out winnings
  const houseNet = bet - payout

  return { reels, payout, houseNet }
}

// Snapshot of current symbol emojis for rendering
export function getSymbolEmoji(symbols = BASE_SYMBOLS) {
  return Object.fromEntries(symbols.map(s => [s.id, s.emoji]))
}

export { BASE_SYMBOLS, BASE_PAYTABLE }
