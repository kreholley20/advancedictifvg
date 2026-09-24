//@version=1

// nybo key opens - FXR Script
// Marks the open price of the most recent candle containing 00:00, 06:00, 08:30 and 09:30 New York
// time: a black line from that candle to a few candles right of current price.
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
    input.int('Extend Past Price (candles)', 5, 'extendBars', 1, 50, 1, 'How far the lines reach past the current candle', 'Visuals');
};

// ---- Data kept between ticks, per open ('' / 0 = nothing yet) ----
// lineIds: current line, openTime/openPrice: the open candle, endTime: where the line currently ends
const nyboStore = () => {
    let data = Reflect.get(nyboStore, 'data');
    if (!data) {
        data = { lineIds: ['', '', '', ''], openTime: [0, 0, 0, 0], openPrice: [0, 0, 0, 0], endTime: [0, 0, 0, 0] };
        Reflect.set(nyboStore, 'data', data);
    }
    return data;
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

// Redraw open i's line from its open candle to `endTime`, at the open price
const nyboDrawLine = (i, endTime, lineColor, text) => {
    const data = nyboStore();
    if (data.lineIds[i] !== '') deleteDrawingById(data.lineIds[i]);
    data.lineIds[i] = trendLine(
        newPoint(data.openTime[i], data.openPrice[i]),
        newPoint(endTime, data.openPrice[i]),
        { linecolor: lineColor, linewidth: 1, linestyle: 0, showLabel: true },
        text
    );
    data.endTime[i] = endTime;
};

// Handle open i on the current candle: start a new line when the candle contains hour:minute
// New York time, and keep the line reaching `extendBars` candles past the current one.
const nyboUpdate = (i, show, hour, minute, text, t0, price, startMin, candleMin, gap, extendBars, lineColor) => {
    const data = nyboStore();
    if (!show) {
        if (data.lineIds[i] !== '') deleteDrawingById(data.lineIds[i]);
        data.lineIds[i] = '';
        data.openTime[i] = 0;
        return;
    }
    const isOpenCandle = nyboMod(hour * 60 + minute - startMin, 1440) < candleMin;
    if (isOpenCandle && data.openTime[i] !== t0) {
        data.openTime[i] = t0;
        data.openPrice[i] = price;
        nyboDrawLine(i, t0 + extendBars * gap, lineColor, text);
        return;
    }
    if (data.openTime[i] === 0) return;
    // Redraw only once the line end is less than half the extension ahead, not on every candle
    if (t0 + Math.ceil(extendBars / 2) * gap > data.endTime[i]) {
        nyboDrawLine(i, t0 + extendBars * gap, lineColor, text);
    }
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
    // One candle in the chart's own time units, to place the line end in the future
    const gap = t2 != null ? Math.min(t0 - t1, t1 - t2) : t0 - t1;
    const ext = inputs.extendBars;
    const col = inputs.lineColor;

    nyboUpdate(0, inputs.showA, inputs.hourA, inputs.minuteA, '0:00', t0, price, startMin, candleMin, gap, ext, col);
    nyboUpdate(1, inputs.showB, inputs.hourB, inputs.minuteB, '6:00', t0, price, startMin, candleMin, gap, ext, col);
    nyboUpdate(2, inputs.showC, inputs.hourC, inputs.minuteC, '8:30', t0, price, startMin, candleMin, gap, ext, col);
    nyboUpdate(3, inputs.showD, inputs.hourD, inputs.minuteD, '9:30', t0, price, startMin, candleMin, gap, ext, col);
};
