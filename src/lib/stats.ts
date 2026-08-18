import type { Trade } from "../types";

/** A trade is closed once it has an exit price — the source of truth for
 * "closed", independent of the stored status field (which is kept in sync
 * with this at save time, but this stays correct even for older records). */
export function isClosed(t: Trade): boolean {
  return t.exitPrice != null;
}

/** Realized P&L in currency terms. Positive = win, negative = loss. */
export function tradePnl(t: Trade): number | null {
  if (t.exitPrice == null) return null;
  const dir = t.direction === "long" ? 1 : -1;
  const gross = (t.exitPrice - t.entryPrice) * dir * t.size;
  return gross - (t.fees ?? 0);
}

/** Risk in currency terms based on stop loss distance. Null if no stop set. */
export function tradeRisk(t: Trade): number | null {
  if (t.stopLoss == null) return null;
  const dir = t.direction === "long" ? 1 : -1;
  const riskPerUnit = (t.entryPrice - t.stopLoss) * dir;
  if (riskPerUnit <= 0) return null;
  return riskPerUnit * t.size;
}

/** R-multiple: P&L expressed as a multiple of initial risk. Null if no stop or not closed. */
export function tradeRMultiple(t: Trade): number | null {
  const pnl = tradePnl(t);
  const risk = tradeRisk(t);
  if (pnl == null || risk == null || risk === 0) return null;
  return pnl / risk;
}

export interface StatsSummary {
  totalTrades: number;
  closedTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number | null; // 0-1
  totalPnl: number;
  avgWin: number | null;
  avgLoss: number | null; // negative number
  expectancy: number | null; // avg $ per trade
  profitFactor: number | null;
  avgR: number | null;
  bestTrade: number | null;
  worstTrade: number | null;
  currentStreak: { type: "win" | "loss" | "none"; count: number };
  maxDrawdown: number | null;
  ruleAdherenceRate: number | null; // 0-1, across trades with a checklist
  planFollowedWinRate: number | null; // win rate when followedPlan=true
  planNotFollowedWinRate: number | null; // win rate when followedPlan=false
}

export function computeStats(trades: Trade[]): StatsSummary {
  const closed = trades
    .filter((t) => tradePnl(t) != null)
    .sort((a, b) => new Date(a.exitDate ?? a.entryDate).getTime() - new Date(b.exitDate ?? b.entryDate).getTime());

  const pnls = closed.map((t) => tradePnl(t)!);
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const breakeven = pnls.filter((p) => p === 0).length;

  const totalPnl = pnls.reduce((a, b) => a + b, 0);
  const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : null;
  const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : null;
  const winRate = closed.length ? wins.length / closed.length : null;

  const grossWin = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : null;

  const expectancy = closed.length ? totalPnl / closed.length : null;

  const rMultiples = closed.map((t) => tradeRMultiple(t)).filter((r): r is number => r != null);
  const avgR = rMultiples.length ? rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length : null;

  const bestTrade = pnls.length ? Math.max(...pnls) : null;
  const worstTrade = pnls.length ? Math.min(...pnls) : null;

  // Current streak (most recent closed trades)
  let currentStreak: StatsSummary["currentStreak"] = { type: "none", count: 0 };
  for (let i = pnls.length - 1; i >= 0; i--) {
    const p = pnls[i];
    const type: "win" | "loss" | "none" = p > 0 ? "win" : p < 0 ? "loss" : "none";
    if (i === pnls.length - 1) {
      currentStreak = { type, count: type === "none" ? 0 : 1 };
    } else if (type === currentStreak.type) {
      currentStreak.count++;
    } else {
      break;
    }
  }

  // Max drawdown on cumulative equity curve
  let peak = 0;
  let cumulative = 0;
  let maxDD = 0;
  for (const p of pnls) {
    cumulative += p;
    peak = Math.max(peak, cumulative);
    maxDD = Math.min(maxDD, cumulative - peak);
  }
  const maxDrawdown = pnls.length ? maxDD : null;

  const tradesWithChecklist = trades.filter((t) => t.ruleChecklist.length > 0);
  const ruleAdherenceRate = tradesWithChecklist.length
    ? tradesWithChecklist.reduce((acc, t) => {
        const followed = t.ruleChecklist.filter((r) => r.followed).length;
        return acc + followed / t.ruleChecklist.length;
      }, 0) / tradesWithChecklist.length
    : null;

  const followedTrades = closed.filter((t) => t.followedPlan === true);
  const notFollowedTrades = closed.filter((t) => t.followedPlan === false);
  const planFollowedWinRate = followedTrades.length
    ? followedTrades.filter((t) => (tradePnl(t) ?? 0) > 0).length / followedTrades.length
    : null;
  const planNotFollowedWinRate = notFollowedTrades.length
    ? notFollowedTrades.filter((t) => (tradePnl(t) ?? 0) > 0).length / notFollowedTrades.length
    : null;

  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    breakeven,
    winRate,
    totalPnl,
    avgWin,
    avgLoss,
    expectancy,
    profitFactor,
    avgR,
    bestTrade,
    worstTrade,
    currentStreak,
    maxDrawdown,
    ruleAdherenceRate,
    planFollowedWinRate,
    planNotFollowedWinRate,
  };
}

export interface EquityPoint {
  date: string;
  cumulative: number;
  tradePnl: number;
}

export function computeEquityCurve(trades: Trade[]): EquityPoint[] {
  const closed = trades
    .filter((t) => tradePnl(t) != null)
    .sort((a, b) => new Date(a.exitDate ?? a.entryDate).getTime() - new Date(b.exitDate ?? b.entryDate).getTime());

  let cumulative = 0;
  return closed.map((t) => {
    const pnl = tradePnl(t)!;
    cumulative += pnl;
    return {
      date: t.exitDate ?? t.entryDate,
      cumulative,
      tradePnl: pnl,
    };
  });
}

export type Period = "week" | "month";

function startOfWeek(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // week starts Monday
  date.setDate(date.getDate() + diff);
  return date;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function periodBucketStart(d: Date, period: Period): Date {
  return period === "week" ? startOfWeek(d) : startOfMonth(d);
}

export function periodKey(d: Date): string {
  // Local-date key (not UTC) so bucketing matches the trader's own calendar.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface PeriodPnl {
  key: string; // sortable bucket-start date, yyyy-mm-dd
  label: string; // human-readable range/month
  pnl: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number | null;
}

/** Groups closed trades into weekly (Mon-start) or monthly P&L buckets. */
export function periodBreakdown(trades: Trade[], period: Period): PeriodPnl[] {
  const closed = trades.filter((t) => tradePnl(t) != null);
  const buckets = new Map<string, Trade[]>();
  for (const t of closed) {
    const d = new Date(t.exitDate ?? t.entryDate);
    const key = periodKey(periodBucketStart(d, period));
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(t);
  }

  return Array.from(buckets.entries())
    .map(([key, group]) => {
      const pnls = group.map((t) => tradePnl(t)!);
      const wins = pnls.filter((p) => p > 0).length;
      const losses = pnls.filter((p) => p < 0).length;
      const start = new Date(`${key}T00:00:00`);
      const label =
        period === "week"
          ? `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${new Date(
              start.getTime() + 6 * 86400000
            ).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
          : start.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      return {
        key,
        label,
        pnl: pnls.reduce((a, b) => a + b, 0),
        trades: group.length,
        wins,
        losses,
        winRate: group.length ? wins / group.length : null,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

/** P&L for whichever bucket "now" falls into, or 0 if no closed trades yet this period. */
export function currentPeriodPnl(rows: PeriodPnl[], period: Period): number {
  const key = periodKey(periodBucketStart(new Date(), period));
  return rows.find((r) => r.key === key)?.pnl ?? 0;
}

export interface DayPnl {
  pnl: number;
  trades: number;
  wins: number;
  losses: number;
}

/** Per-calendar-day P&L, keyed by local yyyy-mm-dd (via periodKey), for the trading calendar view. */
export function dailyBreakdown(trades: Trade[]): Map<string, DayPnl> {
  const closed = trades.filter((t) => tradePnl(t) != null);
  const map = new Map<string, DayPnl>();
  for (const t of closed) {
    const key = periodKey(new Date(t.exitDate ?? t.entryDate));
    const pnl = tradePnl(t)!;
    const existing = map.get(key) ?? { pnl: 0, trades: 0, wins: 0, losses: 0 };
    existing.pnl += pnl;
    existing.trades += 1;
    if (pnl > 0) existing.wins += 1;
    else if (pnl < 0) existing.losses += 1;
    map.set(key, existing);
  }
  return map;
}

export function groupBy<T, K extends string>(items: T[], keyFn: (item: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const item of items) {
    const key = keyFn(item);
    (out[key] ??= []).push(item);
  }
  return out;
}

export interface BreakdownRow {
  key: string;
  trades: number;
  winRate: number | null;
  totalPnl: number;
  avgR: number | null;
}

export function breakdownBy(trades: Trade[], keyFn: (t: Trade) => string): BreakdownRow[] {
  const closed = trades.filter((t) => tradePnl(t) != null);
  const grouped = groupBy(closed, keyFn as (t: Trade) => string);
  return Object.entries(grouped)
    .map(([key, group]) => {
      const pnls = group.map((t) => tradePnl(t)!);
      const wins = pnls.filter((p) => p > 0).length;
      const rMultiples = group.map((t) => tradeRMultiple(t)).filter((r): r is number => r != null);
      return {
        key,
        trades: group.length,
        winRate: group.length ? wins / group.length : null,
        totalPnl: pnls.reduce((a, b) => a + b, 0),
        avgR: rMultiples.length ? rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length : null,
      };
    })
    .sort((a, b) => b.trades - a.trades);
}

export function mistakeBreakdown(trades: Trade[]): BreakdownRow[] {
  const closed = trades.filter((t) => tradePnl(t) != null);
  const rows = new Map<string, Trade[]>();
  for (const t of closed) {
    for (const m of t.mistakes) {
      if (!rows.has(m)) rows.set(m, []);
      rows.get(m)!.push(t);
    }
  }
  return Array.from(rows.entries())
    .map(([key, group]) => {
      const pnls = group.map((t) => tradePnl(t)!);
      const wins = pnls.filter((p) => p > 0).length;
      return {
        key,
        trades: group.length,
        winRate: group.length ? wins / group.length : null,
        totalPnl: pnls.reduce((a, b) => a + b, 0),
        avgR: null,
      };
    })
    .sort((a, b) => a.totalPnl - b.totalPnl);
}
