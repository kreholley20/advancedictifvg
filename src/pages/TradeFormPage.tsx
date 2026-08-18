import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../lib/db";
import { Button, Card, Field, inputClass, Label, MultiSelectChips } from "../components/ui";
import { EMOTION_OPTIONS, MISTAKE_OPTIONS, type Direction, type Emotion, type Mistake, type RuleChecklistItem, type Trade } from "../types";

const emptyForm = () => ({
  symbol: "",
  direction: "long" as Direction,
  assetClass: "",
  strategy: "",
  timeframe: "",
  entryDate: new Date().toISOString().slice(0, 16),
  exitDate: "",
  entryPrice: "",
  exitPrice: "",
  stopLoss: "",
  target: "",
  size: "",
  fees: "",
  emotionsBefore: [] as Emotion[],
  emotionsDuring: [] as Emotion[],
  emotionsAfter: [] as Emotion[],
  confidenceBefore: "" as string,
  mistakes: [] as Mistake[],
  followedPlan: "" as "" | "yes" | "no",
  grade: "",
  tags: "",
  notes: "",
  lessonLearned: "",
  screenshots: [] as string[],
});

export default function TradeFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const rules = useLiveQuery(() => db.playbookRules.orderBy("order").toArray(), []);

  const [form, setForm] = useState(emptyForm());
  const [checklist, setChecklist] = useState<RuleChecklistItem[]>([]);
  const [loaded, setLoaded] = useState(!isEdit);

  useEffect(() => {
    if (!id) return;
    db.trades.get(id).then((t) => {
      if (!t) return;
      setForm({
        symbol: t.symbol,
        direction: t.direction,
        assetClass: t.assetClass ?? "",
        strategy: t.strategy ?? "",
        timeframe: t.timeframe ?? "",
        entryDate: t.entryDate.slice(0, 16),
        exitDate: t.exitDate ? t.exitDate.slice(0, 16) : "",
        entryPrice: String(t.entryPrice),
        exitPrice: t.exitPrice != null ? String(t.exitPrice) : "",
        stopLoss: t.stopLoss != null ? String(t.stopLoss) : "",
        target: t.target != null ? String(t.target) : "",
        size: String(t.size),
        fees: t.fees != null ? String(t.fees) : "",
        emotionsBefore: t.emotionsBefore,
        emotionsDuring: t.emotionsDuring,
        emotionsAfter: t.emotionsAfter,
        confidenceBefore: t.confidenceBefore != null ? String(t.confidenceBefore) : "",
        mistakes: t.mistakes,
        followedPlan: t.followedPlan == null ? "" : t.followedPlan ? "yes" : "no",
        grade: t.grade ?? "",
        tags: t.tags.join(", "),
        notes: t.notes ?? "",
        lessonLearned: t.lessonLearned ?? "",
        screenshots: t.screenshots,
      });
      setChecklist(t.ruleChecklist);
      setLoaded(true);
    });
  }, [id]);

  // Initialize checklist from active playbook rules once rules load (for new trades)
  useEffect(() => {
    if (!isEdit && rules && checklist.length === 0) {
      setChecklist(rules.filter((r) => r.active).map((r) => ({ ruleId: r.id, followed: false })));
    }
  }, [rules, isEdit, checklist.length]);

  function set<K extends keyof ReturnType<typeof emptyForm>>(key: K, value: ReturnType<typeof emptyForm>[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleScreenshot(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const readers = Array.from(files).map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        })
    );
    const dataUrls = await Promise.all(readers);
    set("screenshots", [...form.screenshots, ...dataUrls]);
  }

  function removeScreenshot(idx: number) {
    set(
      "screenshots",
      form.screenshots.filter((_, i) => i !== idx)
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.symbol || !form.entryPrice || !form.size) return;

    const now = new Date().toISOString();
    const trade: Trade = {
      id: id ?? crypto.randomUUID(),
      createdAt: id ? (await db.trades.get(id))?.createdAt ?? now : now,
      updatedAt: now,
      symbol: form.symbol.toUpperCase().trim(),
      direction: form.direction,
      assetClass: form.assetClass || undefined,
      strategy: form.strategy || undefined,
      timeframe: form.timeframe || undefined,
      entryDate: new Date(form.entryDate).toISOString(),
      exitDate: form.exitDate ? new Date(form.exitDate).toISOString() : undefined,
      // A trade counts as closed once it has an exit price — no separate
      // manual toggle to forget, so P&L/stats never silently exclude it.
      status: form.exitPrice ? "closed" : "open",
      entryPrice: Number(form.entryPrice),
      exitPrice: form.exitPrice ? Number(form.exitPrice) : undefined,
      stopLoss: form.stopLoss ? Number(form.stopLoss) : undefined,
      target: form.target ? Number(form.target) : undefined,
      size: Number(form.size),
      fees: form.fees ? Number(form.fees) : undefined,
      emotionsBefore: form.emotionsBefore,
      emotionsDuring: form.emotionsDuring,
      emotionsAfter: form.emotionsAfter,
      confidenceBefore: form.confidenceBefore ? Number(form.confidenceBefore) : undefined,
      mistakes: form.mistakes,
      followedPlan: form.followedPlan === "" ? null : form.followedPlan === "yes",
      ruleChecklist: checklist,
      grade: form.grade || undefined,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      notes: form.notes || undefined,
      lessonLearned: form.lessonLearned || undefined,
      screenshots: form.screenshots,
    };

    await db.trades.put(trade);
    navigate(`/trades/${trade.id}`);
  }

  if (!loaded) return <p className="text-sm text-stone-500">Loading...</p>;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-16">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-stone-100">{isEdit ? "Edit Trade" : "Log New Trade"}</h1>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit">Save Trade</Button>
        </div>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-stone-200">Trade Details</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Symbol *">
            <input className={inputClass} value={form.symbol} onChange={(e) => set("symbol", e.target.value)} required />
          </Field>
          <Field label="Direction">
            <select className={inputClass} value={form.direction} onChange={(e) => set("direction", e.target.value as Direction)}>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </Field>
          <Field label="Asset Class">
            <input
              className={inputClass}
              placeholder="Futures, Forex, Stocks..."
              value={form.assetClass}
              onChange={(e) => set("assetClass", e.target.value)}
            />
          </Field>
          <Field label="Timeframe">
            <input className={inputClass} placeholder="5m, 1H, Daily" value={form.timeframe} onChange={(e) => set("timeframe", e.target.value)} />
          </Field>
          <Field label="Strategy / Setup">
            <input className={inputClass} placeholder="e.g. Breakout Retest" value={form.strategy} onChange={(e) => set("strategy", e.target.value)} />
          </Field>
          <Field label="Status">
            <div className={`${inputClass} flex items-center`}>
              {form.exitPrice ? (
                <span className="text-sage-400">Closed</span>
              ) : (
                <span className="text-amber-400">Open</span>
              )}
              <span className="ml-2 text-xs text-stone-500">(set by exit price)</span>
            </div>
          </Field>
          <Field label="Entry Date/Time">
            <input type="datetime-local" className={inputClass} value={form.entryDate} onChange={(e) => set("entryDate", e.target.value)} />
          </Field>
          <Field label="Exit Date/Time">
            <input type="datetime-local" className={inputClass} value={form.exitDate} onChange={(e) => set("exitDate", e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-stone-200">Price &amp; Risk</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Entry Price *">
            <input type="number" step="any" className={inputClass} value={form.entryPrice} onChange={(e) => set("entryPrice", e.target.value)} required />
          </Field>
          <Field label="Exit Price">
            <input type="number" step="any" className={inputClass} value={form.exitPrice} onChange={(e) => set("exitPrice", e.target.value)} />
          </Field>
          <Field label="Stop Loss">
            <input type="number" step="any" className={inputClass} value={form.stopLoss} onChange={(e) => set("stopLoss", e.target.value)} />
          </Field>
          <Field label="Target">
            <input type="number" step="any" className={inputClass} value={form.target} onChange={(e) => set("target", e.target.value)} />
          </Field>
          <Field label="Size *">
            <input type="number" step="any" className={inputClass} value={form.size} onChange={(e) => set("size", e.target.value)} required />
          </Field>
          <Field label="Fees">
            <input type="number" step="any" className={inputClass} value={form.fees} onChange={(e) => set("fees", e.target.value)} />
          </Field>
        </div>
        <p className="mt-2 text-xs text-stone-500">
          Set a stop loss to unlock automatic R-multiple calculations. P&amp;L and R are computed automatically once exit price is filled in.
        </p>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-stone-200">Psychology</h2>
        <div className="space-y-4">
          <div>
            <Label>Emotions before entry</Label>
            <MultiSelectChips options={EMOTION_OPTIONS} value={form.emotionsBefore} onChange={(v) => set("emotionsBefore", v as Emotion[])} />
          </div>
          <div>
            <Label>Emotions during trade</Label>
            <MultiSelectChips options={EMOTION_OPTIONS} value={form.emotionsDuring} onChange={(v) => set("emotionsDuring", v as Emotion[])} />
          </div>
          <div>
            <Label>Emotions after trade</Label>
            <MultiSelectChips options={EMOTION_OPTIONS} value={form.emotionsAfter} onChange={(v) => set("emotionsAfter", v as Emotion[])} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Confidence before (1-5)">
              <select className={inputClass} value={form.confidenceBefore} onChange={(e) => set("confidenceBefore", e.target.value)}>
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Followed my plan?">
              <select className={inputClass} value={form.followedPlan} onChange={(e) => set("followedPlan", e.target.value as "" | "yes" | "no")}>
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </Field>
            <Field label="Execution grade">
              <select className={inputClass} value={form.grade} onChange={(e) => set("grade", e.target.value)}>
                <option value="">—</option>
                {["A", "B", "C", "D", "F"].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div>
            <Label>Mistakes made (tag anything that applies, even on winners)</Label>
            <MultiSelectChips options={MISTAKE_OPTIONS} value={form.mistakes} onChange={(v) => set("mistakes", v as Mistake[])} tone="bad" />
          </div>
        </div>
      </Card>

      {rules && rules.filter((r) => r.active).length > 0 && (
        <Card>
          <h2 className="mb-1 text-sm font-semibold text-stone-200">Rule Checklist</h2>
          <p className="mb-3 text-xs text-stone-500">Did you follow your own playbook on this trade? Edit rules on the Playbook page.</p>
          <div className="space-y-2">
            {rules
              .filter((r) => r.active)
              .map((rule) => {
                const item = checklist.find((c) => c.ruleId === rule.id);
                const followed = item?.followed ?? false;
                return (
                  <label key={rule.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={followed}
                      onChange={(e) => {
                        const next = checklist.filter((c) => c.ruleId !== rule.id);
                        next.push({ ruleId: rule.id, followed: e.target.checked });
                        setChecklist(next);
                      }}
                      className="h-4 w-4 rounded border-stone-700 bg-stone-950 text-sage-600"
                    />
                    <span className={followed ? "text-stone-300" : "text-stone-500"}>{rule.title}</span>
                  </label>
                );
              })}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-stone-200">Notes &amp; Screenshots</h2>
        <div className="space-y-3">
          <Field label="Tags (comma separated)">
            <input className={inputClass} placeholder="breakout, earnings, A+ setup" value={form.tags} onChange={(e) => set("tags", e.target.value)} />
          </Field>
          <Field label="Trade thesis / notes">
            <textarea className={inputClass} rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
          <Field label="Lesson learned">
            <textarea className={inputClass} rows={2} value={form.lessonLearned} onChange={(e) => set("lessonLearned", e.target.value)} />
          </Field>
          <div>
            <Label>Chart screenshots</Label>
            <input type="file" accept="image/*" multiple onChange={handleScreenshot} className="text-sm text-stone-400" />
            {form.screenshots.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {form.screenshots.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} alt={`Screenshot ${i + 1}`} className="h-20 w-32 rounded-lg border border-stone-800 object-cover" />
                    <button
                      type="button"
                      onClick={() => removeScreenshot(i)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-clay-700 text-xs text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </form>
  );
}
