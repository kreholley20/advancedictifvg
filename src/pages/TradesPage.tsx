import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db } from "../lib/db";
import { isClosed, tradePnl, tradeRMultiple } from "../lib/stats";
import { fmtDate, fmtMoney, fmtR, pnlColor } from "../lib/format";
import { Badge, Button, EmptyState, inputClass } from "../components/ui";
import type { Trade } from "../types";

export default function TradesPage() {
  const trades = useLiveQuery(() => db.trades.orderBy("entryDate").reverse().toArray(), []);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "closed" | "wins" | "losses">("all");

  const filtered = useMemo(() => {
    if (!trades) return [];
    return trades.filter((t) => {
      if (search && !t.symbol.toLowerCase().includes(search.toLowerCase()) && !t.strategy?.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (filter === "open") return !isClosed(t);
      if (filter === "closed") return isClosed(t);
      if (filter === "wins") return (tradePnl(t) ?? 0) > 0;
      if (filter === "losses") return (tradePnl(t) ?? 0) < 0;
      return true;
    });
  }, [trades, search, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-stone-100">Trades</h1>
        <Link to="/trades/new">
          <Button>+ Log Trade</Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputClass} max-w-xs`}
          placeholder="Search symbol or strategy..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1">
          {(["all", "open", "closed", "wins", "losses"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                filter === f ? "bg-stone-800 text-stone-100" : "text-stone-500 hover:bg-stone-900"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {trades && trades.length === 0 && (
        <EmptyState
          title="No trades logged yet"
          sub="Log your first trade to start tracking your edge, your mistakes, and your psychology."
        />
      )}

      {filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-stone-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-800 bg-stone-900/60 text-left text-xs uppercase tracking-wide text-stone-500">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Symbol</th>
                <th className="px-3 py-2 font-medium">Dir</th>
                <th className="px-3 py-2 font-medium">Strategy</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">P&amp;L</th>
                <th className="px-3 py-2 font-medium text-right">R</th>
                <th className="px-3 py-2 font-medium">Plan?</th>
                <th className="px-3 py-2 font-medium">Mistakes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <TradeRow key={t.id} trade={t} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TradeRow({ trade: t }: { trade: Trade }) {
  const pnl = tradePnl(t);
  const r = tradeRMultiple(t);
  const navigate = useNavigate();
  return (
    <tr
      onClick={() => navigate(`/trades/${t.id}`)}
      className="cursor-pointer border-b border-stone-900 last:border-0 hover:bg-stone-900/40"
    >
      <td className="px-3 py-2 text-stone-400">{fmtDate(t.entryDate)}</td>
      <td className="px-3 py-2">
        <Link to={`/trades/${t.id}`} className="font-medium text-stone-100 hover:text-sage-400" onClick={(e) => e.stopPropagation()}>
          {t.symbol}
        </Link>
      </td>
      <td className="px-3 py-2">
        <Badge tone={t.direction === "long" ? "good" : "bad"}>{t.direction}</Badge>
      </td>
      <td className="px-3 py-2 text-stone-400">{t.strategy || "—"}</td>
      <td className="px-3 py-2">
        <Badge tone={isClosed(t) ? "neutral" : "warn"}>{isClosed(t) ? "closed" : "open"}</Badge>
      </td>
      <td className={`px-3 py-2 text-right font-medium ${pnlColor(pnl)}`}>{pnl == null ? "—" : fmtMoney(pnl, { signed: true })}</td>
      <td className={`px-3 py-2 text-right ${pnlColor(r)}`}>{fmtR(r)}</td>
      <td className="px-3 py-2">
        {t.followedPlan === true && <Badge tone="good">Yes</Badge>}
        {t.followedPlan === false && <Badge tone="bad">No</Badge>}
        {t.followedPlan == null && <span className="text-stone-600">—</span>}
      </td>
      <td className="px-3 py-2 text-stone-500">{t.mistakes.length > 0 ? t.mistakes.length : "—"}</td>
    </tr>
  );
}
