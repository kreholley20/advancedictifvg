// Key Opening Prices - FXR Script port of the "Opening Prices" section of
// "ICT Killzones & Pivots [TFO]" (MPL-2.0, (c) tradeforopp)
//
// Draws a horizontal line at the open price of the candle that contains each
// configured New York time, extending it until that same time comes around again.
//
// To change the times, edit OPENS below. Times are HHMM in New York time
// (DST-aware). Colors and on/off toggles are editable from the indicator settings.

const OPENS = [
  { time: '0930', name: 'NY Open', key: 'o1', color: color.rgba(33, 150, 243, 1) },
  { time: '1200', name: 'Midday',  key: 'o2', color: color.rgba(255, 152, 0, 1) },
  { time: '1600', name: 'Close',   key: 'o3', color: color.rgba(255, 0, 0, 1) },
  { time: '0000', name: 'Midnight', key: 'o4', color: color.rgba(255, 235, 59, 1), off: true },
]

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

const MS_PER_MINUTE = 60000
const MS_PER_HOUR = 3600000
const MS_PER_DAY = 86400000

// Accept seconds or milliseconds (1e11 ms is 1973; 1e11 s is year 5138)
const toMs = (t) => (t < 1e11 ? t * 1000 : t)
const mod = (a, n) => ((a % n) + n) % n

// Days since 1970-01-01 for a calendar date (FXR Script has no date API)
const daysFromCivil = (y, m, d) => {
  const yy = m <= 2 ? y - 1 : y
  const era = Math.floor(yy / 400)
  const yoe = yy - era * 400
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

// Calendar year for a count of days since 1970-01-01
const yearFromDays = (days) => {
  const z = days + 719468
  const era = Math.floor(z / 146097)
  const doe = z - era * 146097
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365)
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  return yoe + era * 400 + (mp >= 10 ? 1 : 0)
}

// Day number of the nth Sunday of a month (1970-01-01 was a Thursday)
const nthSunday = (y, m, n) => {
  const first = daysFromCivil(y, m, 1)
  return first + mod(3 - first, 7) + 7 * (n - 1)
}

// US DST: 2nd Sunday of March 02:00 EST (07:00 UTC) to 1st Sunday of November 02:00 EDT (06:00 UTC)
const isNewYorkDST = (ms) => {
  const y = yearFromDays(Math.floor(ms / MS_PER_DAY))
  const start = nthSunday(y, 3, 2) * MS_PER_DAY + 7 * MS_PER_HOUR
  const end = nthSunday(y, 11, 1) * MS_PER_DAY + 6 * MS_PER_HOUR
  return ms >= start && ms < end
}

// Minute of the day (0-1439) in New York for a candle timestamp
const nyMinuteOfDay = (t) => {
  const ms = toMs(t)
  const local = ms + (isNewYorkDST(ms) ? -4 : -5) * MS_PER_HOUR
  return mod(Math.floor(local / MS_PER_MINUTE), MINUTES_PER_DAY)
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
  const dur = Math.min(toMs(time(0)) - toMs(time(1)), toMs(time(1)) - toMs(time(2))) / MS_PER_MINUTE
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
