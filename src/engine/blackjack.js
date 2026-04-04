// Blackjack engine — US standard rules
// Dealer stands on soft 17, BJ pays 3:2, no split/double (MVP)

const SUITS = ['♠', '♥', '♦', '♣']
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

export function createDeck(numDecks = 1) {
  const deck = []
  for (let d = 0; d < numDecks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ rank, suit })
      }
    }
  }
  return shuffle(deck)
}

function shuffle(deck) {
  const d = [...deck]
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

function cardValue(rank) {
  if (rank === 'A') return 11
  if (['J', 'Q', 'K'].includes(rank)) return 10
  return parseInt(rank, 10)
}

// Returns { value, soft } — soft=true means at least one ace counted as 11
export function handValue(cards) {
  let value = 0
  let aces = 0
  for (const card of cards) {
    value += cardValue(card.rank)
    if (card.rank === 'A') aces++
  }
  while (value > 21 && aces > 0) {
    value -= 10
    aces--
  }
  return { value, soft: aces > 0 }
}

export function isBlackjack(cards) {
  return cards.length === 2 && handValue(cards).value === 21
}

export function isBust(cards) {
  return handValue(cards).value > 21
}

// Player AI: simplified basic strategy
// hard 17+ → stand, hard 16- → hit
// soft 18+ → stand, soft 17- → hit
export function playerDecision(hand) {
  const { value, soft } = handValue(hand)
  if (soft) return value >= 18 ? 'stand' : 'hit'
  return value >= 17 ? 'stand' : 'hit'
}

// Dealer AI: stands on all 17s (including soft 17, US standard for this game)
function dealerDecision(hand) {
  const { value } = handValue(hand)
  return value >= 17 ? 'stand' : 'hit'
}

// Returns { playerNet, result, playerHand, dealerHand }
// playerNet: coins won/lost from the perspective of the casino owner
//   casino owner = "house", so player win = casino loses → negative net for us
//   casino net is always the opposite of player net
// bet: wager amount per round
export function computeRound(params = {}) {
  const { bet = 100, numDecks = 1 } = params

  const deck = createDeck(numDecks)
  let cursor = 0
  function deal() { return deck[cursor++] }

  // Initial deal
  const playerHand = [deal(), deal()]
  const dealerHand = [deal(), deal()]

  // Check naturals first
  const playerBJ = isBlackjack(playerHand)
  const dealerBJ = isBlackjack(dealerHand)

  if (playerBJ && dealerBJ) {
    return { playerNet: 0, result: 'push', playerHand, dealerHand }
  }
  if (dealerBJ) {
    // Casino (house) wins — but we ARE the house, so house gets +bet
    return { playerNet: bet, result: 'dealer_blackjack', playerHand, dealerHand }
  }
  if (playerBJ) {
    // Player wins 3:2, house loses 1.5×bet
    return { playerNet: -Math.floor(bet * 1.5), result: 'player_blackjack', playerHand, dealerHand }
  }

  // Player AI plays
  while (playerDecision(playerHand) === 'hit') {
    playerHand.push(deal())
    if (isBust(playerHand)) {
      return { playerNet: bet, result: 'player_bust', playerHand, dealerHand }
    }
  }

  // Dealer plays
  while (dealerDecision(dealerHand) === 'hit') {
    dealerHand.push(deal())
    if (isBust(dealerHand)) {
      return { playerNet: -bet, result: 'dealer_bust', playerHand, dealerHand }
    }
  }

  // Compare
  const pv = handValue(playerHand).value
  const dv = handValue(dealerHand).value

  if (pv > dv) return { playerNet: -bet, result: 'player_wins', playerHand, dealerHand }
  if (dv > pv) return { playerNet: bet, result: 'dealer_wins', playerHand, dealerHand }
  return { playerNet: 0, result: 'push', playerHand, dealerHand }
}
