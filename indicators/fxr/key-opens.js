// Key Opening Prices - FXR Script port of the "Opening Prices" section of
// "ICT Killzones & Pivots [TFO]" (MPL-2.0, (c) tradeforopp)
//
// Draws a horizontal line at the open price of the candle that contains each
// configured New York time, extending it until that same time comes around again.
//
// To change the times, edit OPENS below. Times are HHMM in America/New_York
// (DST-aware). Colors and on/off toggles are editable from the indicator settings.

const OPENS = [
  { time: '0930', name: 'NY Open', key: 'o1', color: color.rgba(33, 150, 243, 1) },
  { time: '1200', name: 'Midday',  key: 'o2', color: color.rgba(255, 152, 0, 1) },
  { time: '1600', name: 'Close',   key: 'o3', color: color.rgba(255, 0, 0, 1) },
  { time: '0000', name: 'Midnight', key: 'o4', color: color.rgba(255, 235, 59, 1), off: true },
]

const TIMEZONE = 'America/New_York'
const TF_LIMIT_MINUTES = 30   // no drawings on timeframes >= this (same default as the Pine script)
const MINUTES_PER_DAY = 1440
const NO_FILL = color.rgba(0, 0, 0, 0)

init = () => {
  input.bool('Show opening prices', true, 'show')
  input.bool('Extend lines to chart edge (lighter, but lines never stop)', false, 'extendAll')
  for (const o of OPENS) {
    input.bool(o.name + ' (' + o.time + ')', !o.off, o.key + 'On')
    input.color(o.name + ' color', o.color, o.key + 'Color')
  }
}

let nyFormat = null
try {
  nyFormat = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
} catch (e) {
  nyFormat = null
}

const toMs = (t) => (t < 1e12 ? t * 1000 : t)

// Minute of the day (0-1439) in New York for a candle timestamp
const nyMinuteOfDay = (t) => {
  const d = new Date(toMs(t))
  if (nyFormat) {
    let h = 0
    let m = 0
    for (const p of nyFormat.formatToParts(d)) {
      if (p.type === 'hour') h = Number(p.value) % 24
      if (p.type === 'minute') m = Number(p.value)
    }
    return h * 60 + m
  }
  // Fallback if Intl timezones are unavailable: fixed UTC-5, no DST
  return (((d.getUTCHours() - 5) * 60 + d.getUTCMinutes()) % MINUTES_PER_DAY + MINUTES_PER_DAY) % MINUTES_PER_DAY
}

const parseHHMM = (s) => {
  const v = String(s).replace(':', '').padStart(4, '0')
  const h = Number(v.slice(0, 2))
  const m = Number(v.slice(2, 4))
  return h * 60 + m
}

// True when the candle starting at minute `start` (lasting `dur` minutes) contains `target`
const containsMinute = (start, dur, target) =>
  (((target - start) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY < dur

onTick = (length, _moment, _, ta, inputs) => {
  if (!inputs.show || length < 3) return

  // Candle duration: the smaller of the last two gaps, so weekend/session gaps don't inflate it
  const dur = Math.min(toMs(time(0)) - toMs(time(1)), toMs(time(1)) - toMs(time(2))) / 60000
  if (!(dur > 0) || dur >= TF_LIMIT_MINUTES) return

  // One day of candles is enough to find the latest occurrence of any time
  const maxBack = Math.min(length - 1, Math.ceil(MINUTES_PER_DAY / dur) + 1)

  for (const o of OPENS) {
    if (!inputs[o.key + 'On']) continue
    const target = parseHHMM(o.time)
    const col = inputs[o.key + 'Color']

    if (inputs.extendAll) {
      // Draw once, on the open candle, and let the chart extend it
      if (containsMinute(nyMinuteOfDay(time(0)), dur, target)) {
        rectangle(time(0), openC(0), time(0), openC(0), { backgroundColor: NO_FILL, color: col, extendRight: true })
      }
      continue
    }

    // Find the most recent open candle and extend its line to the current candle
    for (let k = 0; k <= maxBack; k++) {
      if (containsMinute(nyMinuteOfDay(time(k)), dur, target)) {
        const price = openC(k)
        const from = k === 0 ? time(0) : time(1)
        rectangle(from, price, time(0), price, { backgroundColor: NO_FILL, color: col })
        break
      }
    }
  }
}
