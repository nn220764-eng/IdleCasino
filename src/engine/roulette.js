// Roulette engine — European single-zero (RTP 97.3%)
// Default bet: red/black even-money bet

// 0 = green, 1-36: alternating red/black per standard layout
const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36])

function spin() {
  return Math.floor(Math.random() * 37) // 0..36
}

// Corner bet: covers 4 adjacent numbers, pays 8:1
// We pick a fixed group that's always valid: 1,2,4,5
const CORNER_NUMBERS = new Set([1, 2, 4, 5])

// Returns { number, color, result, houseNet }
// houseNet: coins gained by the casino
export function computeRound(params = {}) {
  const { bet = 50, cornerBet = 0 } = params

  const number = spin()
  const color = number === 0 ? 'green' : RED_NUMBERS.has(number) ? 'red' : 'black'

  // Main bet: red/black (even-money, pays 1:1)
  // Casino always bets the opposite side — we bet on black, casino hopes for red/zero
  // Simpler: player AI always bets red. 0 means house wins.
  let mainNet = 0
  if (number === 0) {
    mainNet = bet  // house wins
  } else if (RED_NUMBERS.has(number)) {
    mainNet = -bet // player wins, house loses
  } else {
    mainNet = bet  // black → house wins (player bet red)
  }

  // Corner bet (4 numbers, pays 8:1 if hit)
  let cornerNet = 0
  if (cornerBet > 0) {
    if (CORNER_NUMBERS.has(number)) {
      cornerNet = -cornerBet * 8  // player wins 8:1, house loses
    } else {
      cornerNet = cornerBet  // house collects corner bet
    }
  }

  const houseNet = mainNet + cornerNet

  return { number, color, houseNet, mainNet, cornerNet }
}
