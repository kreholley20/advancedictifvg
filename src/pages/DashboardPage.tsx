import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { db } from "../lib/db";
import {
  breakdownBy,
  computeEquityCurve,
  computeStats,
  currentPeriodPnl,
  mistakeBreakdown,
  periodBreakdown,
  tradeRMultiple,
  type Period,
} from "../lib/stats";
import { fmtDate, fmtMoney, fmtPct, fmtR } from "../lib/format";
import { Badge, Card, EmptyState, StatCard } from "../components/ui";

const CHART_GRID = "#292524"; // stone-800
const CHART_TICK = "#a8a29e"; // stone-400
const CHART_TOOLTIP_BG = "#1c1917"; // stone-900
const CHART_TOOLTIP_BORDER = "#44403c"; // stone-700
const CHART_SAGE = "#97ab68"; // sage-400
const CHART_CLAY = "#c8734d"; // clay-400

export default function DashboardPage() {
  const trades = useLiveQuery(() => db.trades.toArray(), []);
  const [periodView, setPeriodView] = useState<Period>("week");

  const stats = useMemo(() => computeStats(trades ?? []), [trades]);
  const equity = useMemo(() => computeEquityCurve(trades ?? []), [trades]);
  const byStrategy = useMemo(() => breakdownBy(trades ?? [], (t) => t.strategy || "Unspecified"), [trades]);
  const byMistake = useMemo(() => mistakeBreakdown(trades ?? []), [trades]);
  const weeklyRows = useMemo(() => periodBreakdown(trades ?? [], "week"), [trades]);
  const monthlyRows = useMemo(() => periodBreakdown(trades ?? [], "month"), [trades]);
  const periodRows = periodView === "week" ? weeklyRows : monthlyRows;
  const thisWeekPnl = useMemo(() => currentPeriodPnl(weeklyRows, "week"), [weeklyRows]);
  const thisMonthPnl = useMemo(() => currentPeriodPnl(monthlyRows, "month"), [monthlyRows]);
  const rHistogram = useMemo(() => {
    const closed = (trades ?? []).filter((t) => t.status === "closed");
    const buckets: Record<string, number> = {};
    for (const t of closed) {
      const r = tradeRMultiple(t);
      if (r == null) continue;
      const bucket = Math.floor(r);
      const label = `${bucket}R`;
      buckets[label] = (buckets[label] ?? 0) + 1;
    }
    return Object.entries(buckets)
      .map(([label, count]) => ({ label, count, sortKey: parseInt(label) }))
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [trades]);

  if (trades && trades.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-stone-100">Dashboard</h1>
        <EmptyState
          title="No data yet"
          sub="Log a few trades to see your win rate, expectancy, R-multiples, and psychology patterns here."
        />
        <Link to="/trades/new" className="text-sm font-medium text-sage-400 hover:underline">
          Log your first trade →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      <h1 className="text-lg font-semibold text-stone-100">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total P&L" value={fmtMoney(stats.totalPnl, { signed: true })} valueClassName={stats.totalPnl >= 0 ? "text-sage-400" : "text-clay-400"} />
        <StatCard label="Win Rate" value={fmtPct(stats.winRate)} sub={`${stats.wins}W / ${stats.losses}L / ${stats.breakeven}BE`} />
        <StatCard label="Expectancy" value={fmtMoney(stats.expectancy, { signed: true })} sub="avg $ / trade" />
        <StatCard label="Profit Factor" value={stats.profitFactor == null ? "—" : stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)} />
        <StatCard label="Avg R" value={fmtR(stats.avgR)} />
        <StatCard
          label="Current Streak"
          value={stats.currentStreak.count === 0 ? "—" : `${stats.currentStreak.count} ${stats.currentStreak.type}${stats.currentStreak.count > 1 ? "s" : ""}`}
          valueClassName={stats.currentStreak.type === "win" ? "text-sage-400" : stats.currentStreak.type === "loss" ? "text-clay-400" : ""}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Avg Win" value={fmtMoney(stats.avgWin)} valueClassName="text-sage-400" />
        <StatCard label="Avg Loss" value={fmtMoney(stats.avgLoss)} valueClassName="text-clay-400" />
        <StatCard label="Max Drawdown" value={fmtMoney(stats.maxDrawdown)} valueClassName="text-clay-400" />
        <StatCard label="Rule Adherence" value={fmtPct(stats.ruleAdherenceRate)} sub="checklist items followed" />
      </div>

      {(stats.planFollowedWinRate != null || stats.planNotFollowedWinRate != null) && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-stone-200">Discipline Check</h2>
          <p className="text-sm text-stone-400">
            Win rate when you followed your plan:{" "}
            <span className="font-medium text-sage-400">{fmtPct(stats.planFollowedWinRate)}</span>
            {"   "}vs. when you didn't:{" "}
            <span className="font-medium text-clay-400">{fmtPct(stats.planNotFollowedWinRate)}</span>
          </p>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-stone-200">Equity Curve (Cumulative P&amp;L)</h2>
        {equity.length === 0 ? (
          <p className="text-sm text-stone-500">No closed trades yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={equity.map((p, i) => ({ ...p, idx: i + 1 }))}>
              <defs>
                <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_SAGE} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={CHART_SAGE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
              <XAxis dataKey="idx" tick={{ fill: CHART_TICK, fontSize: 12 }} label={{ value: "Trade #", position: "insideBottom", offset: -3, fill: CHART_TICK, fontSize: 11 }} />
              <YAxis tick={{ fill: CHART_TICK, fontSize: 12 }} tickFormatter={(v) => fmtMoney(v)} width={70} />
              <Tooltip
                contentStyle={{ background: CHART_TOOLTIP_BG, border: `1px solid ${CHART_TOOLTIP_BORDER}`, borderRadius: 8, fontSize: 12 }}
                labelFormatter={(_, p) => (p?.[0]?.payload ? fmtDate(p[0].payload.date) : "")}
                formatter={(v) => [fmtMoney(Number(v), { signed: true }), "Cumulative P&L"]}
              />
              <Area type="monotone" dataKey="cumulative" stroke={CHART_SAGE} fill="url(#equityFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {rHistogram.length > 0 && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-stone-200">R-Multiple Distribution</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rHistogram}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
              <XAxis dataKey="label" tick={{ fill: CHART_TICK, fontSize: 12 }} />
              <YAxis tick={{ fill: CHART_TICK, fontSize: 12 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: CHART_TOOLTIP_BG, border: `1px solid ${CHART_TOOLTIP_BORDER}`, borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {rHistogram.map((entry, i) => (
                  <Cell key={i} fill={entry.sortKey < 0 ? CHART_CLAY : CHART_SAGE} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-stone-200">Performance by Strategy</h2>
          {byStrategy.length === 0 ? (
            <p className="text-sm text-stone-500">No closed trades yet.</p>
          ) : (
            <BreakdownTable rows={byStrategy} />
          )}
        </Card>

        <Card>
          <h2 className="mb-1 text-sm font-semibold text-stone-200">Costliest Mistakes</h2>
          <p className="mb-3 text-xs text-stone-500">Total P&amp;L impact of trades tagged with each mistake — find your biggest leaks.</p>
          {byMistake.length === 0 ? (
            <p className="text-sm text-stone-500">No mistakes tagged yet — nice, or you haven't logged enough trades.</p>
          ) : (
            <div className="space-y-2">
              {byMistake.map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-stone-400">{row.key}</span>
                  <span className="flex items-center gap-2">
                    <Badge>{row.trades}x</Badge>
                    <span className={row.totalPnl >= 0 ? "text-sage-400" : "text-clay-400"}>{fmtMoney(row.totalPnl, { signed: true })}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="This Week P&L"
          value={fmtMoney(thisWeekPnl, { signed: true })}
          valueClassName={thisWeekPnl >= 0 ? "text-sage-400" : "text-clay-400"}
        />
        <StatCard
          label="This Month P&L"
          value={fmtMoney(thisMonthPnl, { signed: true })}
          valueClassName={thisMonthPnl >= 0 ? "text-sage-400" : "text-clay-400"}
        />
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-stone-200">P&amp;L by Period</h2>
          <div className="flex gap-1">
            {(["week", "month"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodView(p)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  periodView === p ? "bg-stone-800 text-stone-100" : "text-stone-500 hover:bg-stone-900"
                }`}
              >
                {p}ly
              </button>
            ))}
          </div>
        </div>
        {periodRows.length === 0 ? (
          <p className="text-sm text-stone-500">No closed trades yet.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={periodRows}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="label" tick={{ fill: CHART_TICK, fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: CHART_TICK, fontSize: 12 }} tickFormatter={(v) => fmtMoney(v)} width={70} />
                <Tooltip
                  contentStyle={{ background: CHART_TOOLTIP_BG, border: `1px solid ${CHART_TOOLTIP_BORDER}`, borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [fmtMoney(Number(v), { signed: true }), "P&L"]}
                />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {periodRows.map((row, i) => (
                    <Cell key={i} fill={row.pnl >= 0 ? CHART_SAGE : CHART_CLAY} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-stone-500">
                    <th className="pb-2 font-medium">{periodView === "week" ? "Week" : "Month"}</th>
                    <th className="pb-2 text-right font-medium">Trades</th>
                    <th className="pb-2 text-right font-medium">Win %</th>
                    <th className="pb-2 text-right font-medium">P&amp;L</th>
                  </tr>
                </thead>
                <tbody>
                  {[...periodRows].reverse().map((row) => (
                    <tr key={row.key} className="border-t border-stone-900">
                      <td className="py-1.5 text-stone-300">{row.label}</td>
                      <td className="py-1.5 text-right text-stone-400">{row.trades}</td>
                      <td className="py-1.5 text-right text-stone-400">{fmtPct(row.winRate)}</td>
                      <td className={`py-1.5 text-right font-medium ${row.pnl >= 0 ? "text-sage-400" : "text-clay-400"}`}>
                        {fmtMoney(row.pnl, { signed: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function BreakdownTable({ rows }: { rows: ReturnType<typeof breakdownBy> }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-stone-500">
          <th className="pb-2 font-medium">Setup</th>
          <th className="pb-2 text-right font-medium">Trades</th>
          <th className="pb-2 text-right font-medium">Win %</th>
          <th className="pb-2 text-right font-medium">Avg R</th>
          <th className="pb-2 text-right font-medium">P&amp;L</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-t border-stone-900">
            <td className="py-1.5 text-stone-300">{row.key}</td>
            <td className="py-1.5 text-right text-stone-400">{row.trades}</td>
            <td className="py-1.5 text-right text-stone-400">{fmtPct(row.winRate)}</td>
            <td className="py-1.5 text-right text-stone-400">{fmtR(row.avgR)}</td>
            <td className={`py-1.5 text-right font-medium ${row.totalPnl >= 0 ? "text-sage-400" : "text-clay-400"}`}>
              {fmtMoney(row.totalPnl, { signed: true })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
