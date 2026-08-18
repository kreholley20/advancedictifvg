import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { db } from "../lib/db";
import { tradePnl, tradeRMultiple, tradeRisk } from "../lib/stats";
import { fmtDateTime, fmtMoney, fmtNum, fmtR, pnlColor } from "../lib/format";
import { Badge, Button, Card } from "../components/ui";

export default function TradeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const trade = useLiveQuery(() => (id ? db.trades.get(id) : undefined), [id]);
  const rules = useLiveQuery(() => db.playbookRules.toArray(), []);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (trade === undefined) return <p className="text-sm text-slate-500">Loading...</p>;
  if (trade === null || !trade) return <p className="text-sm text-slate-500">Trade not found.</p>;

  const pnl = tradePnl(trade);
  const risk = tradeRisk(trade);
  const r = tradeRMultiple(trade);

  async function handleDelete() {
    if (!id) return;
    await db.trades.delete(id);
    navigate("/trades");
  }

  return (
    <div className="space-y-4 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-100">{trade.symbol}</h1>
          <Badge tone={trade.direction === "long" ? "good" : "bad"}>{trade.direction}</Badge>
          <Badge tone={trade.status === "open" ? "warn" : "neutral"}>{trade.status}</Badge>
        </div>
        <div className="flex gap-2">
          <Link to={`/trades/${trade.id}/edit`}>
            <Button variant="secondary">Edit</Button>
          </Link>
          {confirmDelete ? (
            <>
              <Button variant="danger" onClick={handleDelete}>
                Confirm Delete
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <div className="text-xs uppercase tracking-wide text-slate-500">P&amp;L</div>
          <div className={`mt-1 text-xl font-semibold ${pnlColor(pnl)}`}>{pnl == null ? "—" : fmtMoney(pnl, { signed: true })}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wide text-slate-500">R-Multiple</div>
          <div className={`mt-1 text-xl font-semibold ${pnlColor(r)}`}>{fmtR(r)}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wide text-slate-500">Risk ($)</div>
          <div className="mt-1 text-xl font-semibold text-slate-200">{risk == null ? "—" : fmtMoney(risk)}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wide text-slate-500">Grade</div>
          <div className="mt-1 text-xl font-semibold text-slate-200">{trade.grade ?? "—"}</div>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Trade Details</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Row label="Entry" value={fmtDateTime(trade.entryDate)} />
          <Row label="Exit" value={fmtDateTime(trade.exitDate)} />
          <Row label="Entry Price" value={fmtNum(trade.entryPrice)} />
          <Row label="Exit Price" value={fmtNum(trade.exitPrice)} />
          <Row label="Stop Loss" value={fmtNum(trade.stopLoss)} />
          <Row label="Target" value={fmtNum(trade.target)} />
          <Row label="Size" value={fmtNum(trade.size)} />
          <Row label="Fees" value={trade.fees != null ? fmtMoney(trade.fees) : "—"} />
          <Row label="Strategy" value={trade.strategy ?? "—"} />
          <Row label="Asset Class" value={trade.assetClass ?? "—"} />
          <Row label="Timeframe" value={trade.timeframe ?? "—"} />
          <Row label="Followed Plan" value={trade.followedPlan == null ? "—" : trade.followedPlan ? "Yes" : "No"} />
        </dl>
        {trade.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {trade.tags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Psychology</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <EmotionGroup label="Before" emotions={trade.emotionsBefore} />
          <EmotionGroup label="During" emotions={trade.emotionsDuring} />
          <EmotionGroup label="After" emotions={trade.emotionsAfter} />
        </div>
        {trade.confidenceBefore != null && (
          <p className="mt-3 text-sm text-slate-400">
            Confidence before entry: <span className="text-slate-200">{trade.confidenceBefore}/5</span>
          </p>
        )}
        {trade.mistakes.length > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Mistakes</div>
            <div className="flex flex-wrap gap-1.5">
              {trade.mistakes.map((m) => (
                <Badge key={m} tone="bad">
                  {m}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </Card>

      {trade.ruleChecklist.length > 0 && rules && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Rule Checklist</h2>
          <div className="space-y-1.5">
            {trade.ruleChecklist.map((item) => {
              const rule = rules.find((r) => r.id === item.ruleId);
              if (!rule) return null;
              return (
                <div key={item.ruleId} className="flex items-center gap-2 text-sm">
                  <span className={item.followed ? "text-emerald-400" : "text-rose-400"}>{item.followed ? "✓" : "✗"}</span>
                  <span className="text-slate-300">{rule.title}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {(trade.notes || trade.lessonLearned) && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Notes</h2>
          {trade.notes && (
            <div className="mb-3">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Thesis / Notes</div>
              <p className="whitespace-pre-wrap text-sm text-slate-300">{trade.notes}</p>
            </div>
          )}
          {trade.lessonLearned && (
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Lesson Learned</div>
              <p className="whitespace-pre-wrap text-sm text-slate-300">{trade.lessonLearned}</p>
            </div>
          )}
        </Card>
      )}

      {trade.screenshots.length > 0 && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Screenshots</h2>
          <div className="flex flex-wrap gap-3">
            {trade.screenshots.map((src, i) => (
              <img key={i} src={src} alt={`Screenshot ${i + 1}`} className="max-h-64 rounded-lg border border-slate-800 object-contain" />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-slate-200">{value}</dd>
    </div>
  );
}

function EmotionGroup({ label, emotions }: { label: string; emotions: string[] }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      {emotions.length === 0 ? (
        <span className="text-sm text-slate-600">—</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {emotions.map((e) => (
            <Badge key={e}>{e}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}
