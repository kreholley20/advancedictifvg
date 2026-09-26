//@version=1

// nybo key opens - FXR Script
// Port of the "Opening Prices" section of ICT Killzones & Pivots [TFO]: for each key New York time
// (00:00, 06:00, 08:30, 09:30), a line at the open price of that candle, starting at the candle and
// running right. Only the current New York day's four lines are drawn.
//
// FXR doesn't reliably remove drawings, so past days' lines are never drawn in the first place:
// nothing is drawn until FXR reaches the newest candle on the chart. There the script looks back to
// New York midnight, finds today's key candles, and draws just those.
//
// FXR's runtime only keeps top-level `const name = (...) =>` functions plus init/onTick; every other
// top-level statement (let, const values) is removed. So every helper below is an arrow function,
// constants are written inline, and the record of drawn lines lives on globalThis.

init = () => {
    indicator({ onMainPanel: true, format: 'inherit' });

    // Midnight
    input.bool('Show Midnight Open', true, 'showA', '', 'Midnight');
    input.int('Midnight Open Hour', 0, 'hourA', 0, 23, 1, '', 'Midnight');
    input.int('Midnight Open Minute', 0, 'minuteA', 0, 59, 1, '', 'Midnight');
    // 6am
    input.bool('Show 6am Open', true, 'showB', '', '6am');
    input.int('6am Open Hour', 6, 'hourB', 0, 23, 1, '', '6am');
    input.int('6am Open Minute', 0, 'minuteB', 0, 59, 1, '', '6am');
    // 830am
    input.bool('Show 830am Open', true, 'showC', '', '830am');
    input.int('830am Open Hour', 8, 'hourC', 0, 23, 1, '', '830am');
    input.int('830am Open Minute', 30, 'minuteC', 0, 59, 1, '', '830am');
    // 930am
    input.bool('Show 930am Open', true, 'showD', '', '930am');
    input.int('930am Open Hour', 9, 'hourD', 0, 23, 1, '', '930am');
    input.int('930am Open Minute', 30, 'minuteD', 0, 59, 1, '', '930am');

    input.color('Line Color', color.black, 'lineColor', 'Visuals');
};

// ---- Every line this script has drawn, kept between ticks ----
// FXR recalculates the whole history during replay (and may call init again), while drawings from
// earlier passes stay on the chart. So the registry lives on globalThis and is never reset: it maps
// "open index:candle time" -> drawing id, which lets old lines always be found and deleted, and stops
// the same line being drawn twice. `day` is the New York day the current lines belong to.
const nyboStore = () => {
    let data = Reflect.get(globalThis, '__nyboKeyOpens2');
    if (!data) {
        data = { ids: {}, day: -1 };
        Reflect.set(globalThis, '__nyboKeyOpens2', data);
    }
    return data;
};

// Delete a drawing without letting a stale or unknown id break the script
const nyboDelete = (id) => {
    if (id === '') return;
    try {
        deleteDrawingById(id);
    } catch (e) {
        // already gone
    }
};

// ---- New York time, computed directly (no timezone library needed) ----

// Candle time in milliseconds, whether FXR gives seconds or milliseconds
const nyboToMs = (t) => {
    const n = Number(t);
    return n < 1e11 ? n * 1000 : n;
};

const nyboMod = (a, n) => ((a % n) + n) % n;

// Days since 1970-01-01 for a calendar date
const nyboDaysFromCivil = (y, m, d) => {
    const yy = m <= 2 ? y - 1 : y;
    const era = Math.floor(yy / 400);
    const yoe = yy - era * 400;
    const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
    const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;
};

// Calendar year for a count of days since 1970-01-01
const nyboYearFromDays = (days) => {
    const z = days + 719468;
    const era = Math.floor(z / 146097);
    const doe = z - era * 146097;
    const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    const mp = Math.floor((5 * doy + 2) / 153);
    return yoe + era * 400 + (mp >= 10 ? 1 : 0);
};

// Day number of the nth Sunday of a month (1970-01-01 was a Thursday)
const nyboNthSunday = (y, m, n) => {
    const first = nyboDaysFromCivil(y, m, 1);
    return first + nyboMod(3 - first, 7) + 7 * (n - 1);
};

// New York local time as ms since 1970 (wall clock). US DST runs from the 2nd Sunday of March
// 07:00 UTC to the 1st Sunday of November 06:00 UTC.
const nyboNyLocalMs = (ms) => {
    const y = nyboYearFromDays(Math.floor(ms / 86400000));
    const dstStart = nyboNthSunday(y, 3, 2) * 86400000 + 7 * 3600000;
    const dstEnd = nyboNthSunday(y, 11, 1) * 86400000 + 6 * 3600000;
    const offsetHours = ms >= dstStart && ms < dstEnd ? -4 : -5;
    return ms + offsetHours * 3600000;
};

// ---- Drawing ----

// Delete every registered line whose key matches `test`
const nyboDeleteWhere = (test) => {
    const data = nyboStore();
    for (const key of Object.keys(data.ids)) {
        if (!test(key)) continue;
        nyboDelete(data.ids[key]);
        delete data.ids[key];
    }
};

// Draw open i as a ray starting at candle `t0`'s open price and running right, replacing any older
// line for the same open. horizontalRay anchors to one point, like the horizontalLine/arrowRight
// calls that draw in FXR; the two-point trendLine and rectangle calls drew nothing.
const nyboDraw = (i, t0, price, lineColor) => {
    const data = nyboStore();
    const key = i + ':' + t0;
    if (key in data.ids) return;                               // already on the chart
    nyboDeleteWhere((k) => k.startsWith(i + ':'));             // only the newest line per open
    data.ids[key] = '';
    const id = horizontalRay(t0, price, { linecolor: lineColor, linewidth: 1, linestyle: 0 });
    // The id may come back directly or as a promise; store the real id either way
    Promise.resolve(id).then((v) => {
        if (key in data.ids) data.ids[key] = String(v);
        else nyboDelete(String(v));                            // replaced before the id arrived
    });
};

// When the New York day changes (moving forward, or back to the start of a recalculation),
// delete every line, so only lines from the current day, midnight onward, are ever on the chart
const nyboNewDay = (day) => {
    const data = nyboStore();
    if (data.day === day) return;
    data.day = day;
    nyboDeleteWhere(() => true);
};

onTick = (length, _moment, _, ta, inputs) => {
    const t0 = time(0);
    const t1 = time(1);
    const t2 = time(2);
    const price = openC(0);   // the candle's OPEN
    if (!Number.isFinite(price) || t0 == null || t1 == null) return;

    const ms0 = nyboToMs(t0);
    const ms1 = nyboToMs(t1);
    // Candle length: the smaller of the last two gaps, so a weekend gap doesn't count
    let candleMin = (ms0 - ms1) / 60000;
    if (t2 != null) candleMin = Math.min(candleMin, (ms1 - nyboToMs(t2)) / 60000);
    if (!(candleMin > 0) || candleMin >= 1440) return;   // intraday charts only

    // Only draw on the newest candle, so past days are never drawn. FXR reports every candle as
    // closed during replay, so the newest is found by its index: `index` counts candles and
    // `length` is taken to be the number of candles on the chart.
    const isNewest = index >= length - 1 || !isBarClosed();

    // TEMPORARY diagnostic: FXR doesn't show console.log, so write the values on the chart. Every
    // 09:30 New York candle, every 100th candle and any candle counted as newest gets a small red
    // marker; remove once the newest candle is detected correctly.
    const diagMin = nyboMod(Math.floor(nyboNyLocalMs(ms0) / 60000), 1440);
    if (nyboMod(570 - diagMin, 1440) < candleMin || index % 100 === 0 || isNewest) {
        arrowRight(t0, high(0), { arrowColor: color.red, color: color.red, fontsize: 11, showLabel: true },
            'i=' + index + ' len=' + length + ' closed=' + isBarClosed() + ' now=' + _moment().valueOf());
    }
    if (!isNewest) return;

    const local = nyboNyLocalMs(ms0);
    const today = Math.floor(local / 86400000);
    nyboNewDay(today);

    const shows = [inputs.showA, inputs.showB, inputs.showC, inputs.showD];
    const targets = [
        inputs.hourA * 60 + inputs.minuteA,
        inputs.hourB * 60 + inputs.minuteB,
        inputs.hourC * 60 + inputs.minuteC,
        inputs.hourD * 60 + inputs.minuteD,
    ];
    for (let i = 0; i < 4; i++) {
        if (!shows[i]) nyboDeleteWhere((k) => k.startsWith(i + ':'));
    }

    // Walk back from the newest candle to New York midnight, drawing each key candle found today
    const maxBack = Math.ceil(1440 / candleMin) + 1;
    for (let k = 0; k <= maxBack; k++) {
        const tk = time(k);
        if (tk == null) break;
        const localK = nyboNyLocalMs(nyboToMs(tk));
        if (Math.floor(localK / 86400000) !== today) break;   // reached yesterday
        const minK = nyboMod(Math.floor(localK / 60000), 1440);
        for (let i = 0; i < 4; i++) {
            if (!shows[i]) continue;
            if (nyboMod(targets[i] - minK, 1440) >= candleMin) continue;   // not this candle
            nyboDraw(i, tk, openC(k), inputs.lineColor);
        }
    }
};
