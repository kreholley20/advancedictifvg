//@version=1

// nybo key opens - FXR Script
// Marks the open price of the candle containing 00:00, 06:00, 08:30 and 09:30 (New York by default).
// Only the most recent line per time is kept. Each line is labeled with its time.

init = () => {
    indicator({ onMainPanel: true, format: 'inherit' });

    input.str('Timezone', 'America/New_York', 'timeZone', [], '', 'Settings');

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

    input.color('00:00 Open Line Color', color.red, 'colorA', 'Visuals');
    input.color('06:00 Open Line Color', color.orange, 'colorB', 'Visuals');
    input.color('08:30 Open Line Color', color.yellow, 'colorC', 'Visuals');
    input.color('09:30 Open Line Color', color.lime, 'colorD', 'Visuals');
};

// Data kept between ticks. FXR's runtime only keeps top-level `const name = (...) =>` functions
// (plus init/onTick) and removes every other top-level statement, so plain variables never exist.
// The data hangs off this function instead; Reflect keeps the editor's type checker happy.
// '' = no line yet, 0 = never drawn.
const nyboStore = () => {
    let data = Reflect.get(nyboStore, 'data');
    if (!data) {
        data = { lineIds: ['', '', '', ''], drawnAt: [0, 0, 0, 0] };
        Reflect.set(nyboStore, 'data', data);
    }
    return data;
};

// Replace open i's line with a new one at `price` (FXR's horizontalLine is (price, styles, text) despite the docs)
const drawOpen = (i, price, t0, lineColor, text) => {
    const data = nyboStore();
    if (data.lineIds[i] !== '') deleteDrawingById(data.lineIds[i]);
    data.lineIds[i] = horizontalLine(price, { linecolor: lineColor, linewidth: 1, linestyle: 0, showLabel: true, textcolor: lineColor }, text);
    data.drawnAt[i] = t0;
};

// Draw open i if the current candle contains hour:minute
const checkOpen = (i, show, hour, minute, lineColor, text, t0, price, startMin, candleMin) => {
    if (!show) return;
    const target = hour * 60 + minute;
    // Minutes from the candle's start to the target, wrapping past midnight
    const offset = (((target - startMin) % 1440) + 1440) % 1440;
    if (offset >= candleMin) return;   // target isn't inside this candle
    if (nyboStore().drawnAt[i] === t0) return;      // onTick runs every price update: draw once per candle
    drawOpen(i, price, t0, lineColor, text);
};

onTick = (length, _moment, _, ta, inputs) => {
    const t0 = time(0);
    const t1 = time(1);
    const t2 = time(2);
    const price = openC(0);   // the candle's OPEN, not its high/low
    if (!Number.isFinite(price) || t0 == null || t1 == null) return;

    // Candle length in minutes: the smaller of the last two gaps, so a weekend gap doesn't count
    let candleMin = _moment(t0).diff(_moment(t1), 'minutes');
    if (t2 != null) candleMin = Math.min(candleMin, _moment(t1).diff(_moment(t2), 'minutes'));
    if (!(candleMin > 0) || candleMin >= 1440) return;   // intraday charts only

    const start = _moment(t0).tz(inputs.timeZone);
    const startMin = start.hour() * 60 + start.minute();

    checkOpen(0, inputs.showA, inputs.hourA, inputs.minuteA, inputs.colorA, '0:00', t0, price, startMin, candleMin);
    checkOpen(1, inputs.showB, inputs.hourB, inputs.minuteB, inputs.colorB, '6:00', t0, price, startMin, candleMin);
    checkOpen(2, inputs.showC, inputs.hourC, inputs.minuteC, inputs.colorC, '8:30', t0, price, startMin, candleMin);
    checkOpen(3, inputs.showD, inputs.hourD, inputs.minuteD, inputs.colorD, '9:30', t0, price, startMin, candleMin);
};
