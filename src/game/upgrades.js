// Upgrade definitions and apply logic

export const UPGRADES = [
  {
    id: 'bj_speed',
    name: 'ディーラー高速化',
    desc: 'ラウンド間隔 3s → 2s',
    effect: '速度 +50%',
    cost: 5000,
    game: 'bj',
    apply(params) { params.bj.interval = 2000 },
  },
  {
    id: 'slot_pay2',
    name: 'ペイテーブル改良',
    desc: 'CHERRY 3枚揃い配当アップ',
    effect: 'RTP ≈ 95% → 96.6%',
    cost: 3200,
    game: 'slots',
    apply(params) { params.slots.paytable.triple_C = 100 },
  },
  {
    id: 'slot_speed',
    name: '高速スピン',
    desc: 'スピン間隔 1s → 0.7s',
    effect: '速度 +43%',
    cost: 12000,
    game: 'slots',
    apply(params) { params.slots.interval = 700 },
  },
  {
    id: 'bj_deck_6',
    name: '6デッキ化',
    desc: 'シャッフル頻度が下がり収益効率UP',
    effect: '実効速度 +33%',
    cost: 20000,
    game: 'bj',
    apply(params) {
      params.bj.numDecks = 6
      params.bj.interval = Math.floor(params.bj.interval * 0.75)
    },
  },
  {
    id: 'rou_bets',
    name: '複数BET',
    desc: 'コーナーBET(4マス) 20coinsを追加',
    effect: '収入期待値 +35%',
    cost: 15000,
    game: 'roulette',
    apply(params) { params.roulette.cornerBet = 20 },
  },
  {
    id: 'rou_speed',
    name: 'ホイール高速化',
    desc: 'ホイール間隔 5s → 3s',
    effect: '速度 +67%',
    cost: 30000,
    game: 'roulette',
    apply(params) { params.roulette.interval = 3000 },
  },
]

// Returns the upgrade object, or null if already purchased or not found
export function getUpgrade(id, purchased) {
  if (purchased.has(id)) return null
  return UPGRADES.find(u => u.id === id) ?? null
}
