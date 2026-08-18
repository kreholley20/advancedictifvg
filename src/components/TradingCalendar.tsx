import { useMemo, useState } from "react";
import { dailyBreakdown, periodKey } from "../lib/stats";
import { fmtMoney } from "../lib/format";
import type { Trade } from "../types";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildMonthCells(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay.getDay(); i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function TradingCalendar({ trades }: { trades: Trade[] }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const dailyMap = useMemo(() => dailyBreakdown(trades), [trades]);
  const cells = useMemo(() => buildMonthCells(cursor.getFullYear(), cursor.getMonth()), [cursor]);

  const monthTotal = useMemo(() => {
    let pnl = 0;
    let trades = 0;
    for (const cell of cells) {
      if (!cell) continue;
      const day = dailyMap.get(periodKey(cell));
      if (day) {
        pnl += day.pnl;
        trades += day.trades;
      }
    }
    return { pnl, trades };
  }, [cells, dailyMap]);

  const today = periodKey(new Date());

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
            className="rounded-lg px-2 py-1 text-sm text-stone-400 hover:bg-stone-800 hover:text-stone-100"
            aria-label="Previous month"
          >
            ‹
          </button>
          <h3 className="w-40 text-center text-sm font-semibold text-stone-200">
            {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </h3>
          <button
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
            className="rounded-lg px-2 py-1 text-sm text-stone-400 hover:bg-stone-800 hover:text-stone-100"
            aria-label="Next month"
          >
            ›
          </button>
        </div>
        {monthTotal.trades > 0 && (
          <div className={`text-sm font-medium ${monthTotal.pnl >= 0 ? "text-sage-400" : "text-clay-400"}`}>
            {fmtMoney(monthTotal.pnl, { signed: true })}
            <span className="ml-1.5 text-xs font-normal text-stone-500">
              ({monthTotal.trades} trade{monthTotal.trades === 1 ? "" : "s"})
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium uppercase tracking-wide text-stone-500">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="pb-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="aspect-square" />;
          const key = periodKey(date);
          const day = dailyMap.get(key);
          const isToday = key === today;
          const isWin = day != null && day.pnl > 0;
          const isLoss = day != null && day.pnl < 0;

          let cellClass = "border-stone-800 bg-stone-900/40";
          let amountClass = "";
          if (isWin) {
            cellClass = "border-sage-800 bg-sage-950";
            amountClass = "text-sage-400";
          } else if (isLoss) {
            cellClass = "border-clay-800 bg-clay-950";
            amountClass = "text-clay-400";
          }

          return (
            <div
              key={i}
              className={`aspect-square rounded-lg border p-1.5 ${cellClass} ${isToday ? "ring-1 ring-stone-400" : ""}`}
            >
              <div className="text-xs text-stone-500">{date.getDate()}</div>
              {day && (
                <div className={`mt-1 text-xs font-semibold leading-tight ${amountClass}`}>
                  {fmtMoney(day.pnl, { signed: true })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
