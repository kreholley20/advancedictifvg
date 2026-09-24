//@version=1

// nybo key opens - FXR Script
// Port of the "Opening Prices" section of ICT Killzones & Pivots [TFO]: for each key New York time
// (00:00, 06:00, 08:30, 09:30), a line at the open price of that candle, starting at the candle and
// running right. Only the most recent line per time is kept.
//
// FXR's runtime only keeps top-level `const name = (...) =>` functions plus init/onTick; every other
// top-level statement (let, const values) is removed. So every helper below is an arrow function,
// constants are written inline, and data kept between ticks hangs off a function.

init = () => {
    indicator({ onMainPanel: true, format: 'inherit' });

    // 00:00
    input.bool('Show 00:00 Open', true, 'showA', '', '00:00');
    input.int('00:00 Open Hour', 0, 'hourA', 0, 23, 1, '', '00:00');
    input.int('00:00 Open Minute', 0, 'minuteA', 0, 59, 1, '', '00:00');
    // 06:00
    input.bool('Show 06:00 Open', true, 'showB', '', '06:00');
    input.int('06:00 Open Hour', 6, 'hourB', 0, 23, 1, '', '06:00');
    input.int('06:00 Open Minute', 0, 'minuteB', 0, 59, 1, '', '06:00');
    // 08:30
    input.bool('Show 08:30 Open', true, 'showC', '', '08:30');
    input.int('08:30 Open Hour', 8, 'hourC', 0, 23, 1, '', '08:30');
    input.int('08:30 Open Minute', 30, 'minuteC', 0, 59, 1, '', '08:30');
    // 09:30
    input.bool('Show 09:30 Open', true, 'showD', '', '09:30');
    input.int('09:30 Open Hour', 9, 'hourD', 0, 23, 1, '', '09:30');
    input.int('09:30 Open Minute', 30, 'minuteD', 0, 59, 1, '', '09:30');

    input.color('Line Color', color.black, 'lineColor', 'Visuals');

    // Start clean on load / settings change (FXR clears the old drawings itself)
    Reflect.set(globalThis, '__nyboKeyOpens', { lineIds: ['', '', '', ''], drawnAt: [0, 0, 0, 0] });
};

// ---- Data kept between ticks, per open ('' / 0 = nothing yet) ----
// Kept on globalThis: FXR may re-run the script between updates, which would reset anything stored
// on the script's own variables or functions (old lines then never got deleted).
const nyboStore = () => {
    let data = Reflect.get(globalThis, '__nyboKeyOpens');
    if (!data) {
        data = { lineIds: ['', '', '', ''], drawnAt: [0, 0, 0, 0] };
        Reflect.set(globalThis, '__nyboKeyOpens', data);
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

// Minute of the day (0-1439) in New York. US DST runs from the 2nd Sunday of March 07:00 UTC
// to the 1st Sunday of November 06:00 UTC.
const nyboNyMinute = (ms) => {
    const y = nyboYearFromDays(Math.floor(ms / 86400000));
    const dstStart = nyboNthSunday(y, 3, 2) * 86400000 + 7 * 3600000;
    const dstEnd = nyboNthSunday(y, 11, 1) * 86400000 + 6 * 3600000;
    const offsetHours = ms >= dstStart && ms < dstEnd ? -4 : -5;
    return nyboMod(Math.floor((ms + offsetHours * 3600000) / 60000), 1440);
};

// ---- Drawing ----

// Replace open i's line with a ray starting at candle `t0`'s open price and running right.
// horizontalRay anchors to one point, like the horizontalLine/arrowRight calls that draw in FXR;
// the two-point trendLine and rectangle calls drew nothing.
const nyboDraw = (i, t0, price, lineColor) => {
    const data = nyboStore();
    nyboDelete(data.lineIds[i]);
    data.lineIds[i] = '';
    data.drawnAt[i] = t0;
    const id = horizontalRay(t0, price, { linecolor: lineColor, linewidth: 1, linestyle: 0 });
    // The id may come back directly or as a promise; store the real id either way
    Promise.resolve(id).then((v) => {
        if (data.drawnAt[i] === t0) data.lineIds[i] = String(v);
        else nyboDelete(String(v));   // a newer line already replaced this one
    });
};

// Draw open i when the current candle contains hour:minute New York time (once per candle)
const nyboCheck = (i, show, hour, minute, lineColor, t0, price, startMin, candleMin) => {
    if (!show) return;
    if (nyboMod(hour * 60 + minute - startMin, 1440) >= candleMin) return;   // not this candle
    if (nyboStore().drawnAt[i] === t0) return;                                // already drawn
    nyboDraw(i, t0, price, lineColor);
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

    const startMin = nyboNyMinute(ms0);

    nyboCheck(0, inputs.showA, inputs.hourA, inputs.minuteA, inputs.lineColor, t0, price, startMin, candleMin);
    nyboCheck(1, inputs.showB, inputs.hourB, inputs.minuteB, inputs.lineColor, t0, price, startMin, candleMin);
    nyboCheck(2, inputs.showC, inputs.hourC, inputs.minuteC, inputs.lineColor, t0, price, startMin, candleMin);
    nyboCheck(3, inputs.showD, inputs.hourD, inputs.minuteD, inputs.lineColor, t0, price, startMin, candleMin);
};
