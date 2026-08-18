# Trading Journal

A private, local-first trading journal built to help you become a consistently
profitable trader — not just track P&L, but surface *why* you win and lose.

All data lives in your browser (IndexedDB). Nothing is sent to a server. Export
a backup regularly from **Settings**.

## Why these features

Profitable traders consistently point to the same handful of habits. Each page
in this app exists to support one of them:

- **You can't improve what you don't measure precisely.** The Dashboard
  computes win rate, expectancy, profit factor, average R-multiple, and max
  drawdown from your actual trade log — not vibes.
- **Risk-adjusted results (R-multiples) matter more than raw P&L.** Every
  trade with a stop loss automatically gets an R-multiple, and the dashboard
  shows your R distribution so you can see whether your winners are actually
  bigger than your losers.
- **Most losses come from a small set of repeated mistakes, not bad luck.**
  The trade form lets you tag mistakes (revenge trading, moved stop, FOMO
  entry, oversized, etc.) on every trade, win or lose. The "Costliest
  Mistakes" panel on the dashboard ranks which habits are actually costing
  you money.
- **Discipline is a bigger edge than any single setup.** Define your own
  rules in the **Playbook**, check them off on every trade, and the
  dashboard's "Discipline Check" shows your win rate when you followed your
  plan vs. when you didn't — usually the single most convincing number in the
  whole app.
- **Psychology drives execution.** Every trade captures your emotional state
  before, during, and after, plus a 1–5 confidence rating, so you can spot
  patterns like "I lose money when I trade anxious" or "my best trades happen
  when I feel calm and bored."
- **Daily review compounds.** The **Journal** page is for pre-market mindset
  (sleep, mental state, goals/limits for the day, watchlist) and post-market
  review (what went well/poorly, lessons), independent of any single trade —
  this is where habits and self-awareness actually get built.
- **Setup-level performance review beats trading everything the same way.**
  The dashboard breaks down win rate, average R, and P&L by strategy/setup so
  you can find your edge and cut what isn't working.

## Pages

| Page | Purpose |
|---|---|
| **Dashboard** | Equity curve, win rate, expectancy, profit factor, R-multiple distribution, discipline check, performance by setup, costliest mistakes |
| **Trades** | Log/search/filter every trade — entry/exit, size, stop/target, fees, strategy, psychology, mistakes, rule checklist, notes, chart screenshots |
| **Journal** | Daily pre-market mindset and post-market review, separate from individual trades |
| **Playbook** | Your own trading rules, organized by category (entry, exit, risk, mindset, process) — used as a per-trade checklist |
| **Settings** | Export/import a full JSON backup, view data counts, clear all data |

## Running it

```bash
npm install
npm run dev      # start the dev server
npm run build    # typecheck + production build
```

## Data & privacy

Trades, journal entries, and playbook rules are stored in your browser via
IndexedDB (using [Dexie](https://dexie.org/)). There is no backend — your
data never leaves your machine unless you export it yourself. Because
browser storage can be cleared, **export a backup from Settings regularly**;
import restores (merges) from a backup JSON file.

## Tech stack

React + TypeScript + Vite, Tailwind CSS v4, Dexie (IndexedDB), Recharts,
React Router.
