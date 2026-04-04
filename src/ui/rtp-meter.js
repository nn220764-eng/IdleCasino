// RTP bar and value updater

// RTP range for visual bar: 90% = 0%, 100% = 100% width
// Shows more dramatic changes in the 90-100% range
const RTP_MIN = 85
const RTP_MAX = 100

export function updateRTPMeter(gameId, rtpValue) {
  const bar = document.getElementById(`rtp-bar-${gameId}`)
  const val = document.getElementById(`rtp-val-${gameId}`)
  if (!bar || !val) return

  const clamped = Math.max(RTP_MIN, Math.min(RTP_MAX, rtpValue))
  const pct = ((clamped - RTP_MIN) / (RTP_MAX - RTP_MIN)) * 100
  bar.style.width = `${pct}%`
  val.textContent = `${rtpValue.toFixed(1)}%`

  // Color: green when high (good for casino), orange when low
  const color = rtpValue >= 95 ? '#4caf50' : rtpValue >= 90 ? '#ff9800' : '#f44336'
  bar.style.background = color
  val.style.color = color
}
