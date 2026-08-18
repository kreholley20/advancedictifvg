import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { db } from "../lib/db";
import { Button, Card, Field, inputClass, Label } from "../components/ui";
import { fmtDate } from "../lib/format";
import type { JournalEntry } from "../types";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const emptyEntry = (date: string): JournalEntry => ({
  id: crypto.randomUUID(),
  date,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export default function JournalPage() {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const entries = useLiveQuery(() => db.journalEntries.orderBy("date").reverse().toArray(), []);
  const [draft, setDraft] = useState<JournalEntry | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    db.journalEntries.where("date").equals(selectedDate).first().then((existing) => {
      if (cancelled) return;
      setDraft(existing ?? emptyEntry(selectedDate));
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  function set<K extends keyof JournalEntry>(key: K, value: JournalEntry[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setSaved(false);
  }

  async function handleSave() {
    if (!draft) return;
    await db.journalEntries.put({ ...draft, updatedAt: new Date().toISOString() });
    setSaved(true);
  }

  return (
    <div className="grid gap-4 pb-16 lg:grid-cols-[220px_1fr]">
      <div className="space-y-2">
        <Field label="Journal date">
          <input type="date" className={inputClass} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        </Field>
        <div className="mt-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Recent entries</div>
          <div className="space-y-1">
            {(entries ?? []).slice(0, 30).map((e) => (
              <button
                key={e.id}
                onClick={() => setSelectedDate(e.date)}
                className={`block w-full rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                  e.date === selectedDate ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:bg-slate-900"
                }`}
              >
                {fmtDate(e.date)}
              </button>
            ))}
            {entries && entries.length === 0 && <p className="text-xs text-slate-600">No entries yet.</p>}
          </div>
        </div>
      </div>

      {draft && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-slate-100">Journal — {fmtDate(selectedDate)}</h1>
            <Button onClick={handleSave}>{saved ? "Saved ✓" : "Save Entry"}</Button>
          </div>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-slate-200">Pre-Market</h2>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Sleep quality (1-5)">
                <select className={inputClass} value={draft.sleepQuality ?? ""} onChange={(e) => set("sleepQuality", e.target.value ? Number(e.target.value) : undefined)}>
                  <option value="">—</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Physical state (1-5)">
                <select className={inputClass} value={draft.physicalState ?? ""} onChange={(e) => set("physicalState", e.target.value ? Number(e.target.value) : undefined)}>
                  <option value="">—</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Mental state (1-5)">
                <select className={inputClass} value={draft.mentalState ?? ""} onChange={(e) => set("mentalState", e.target.value ? Number(e.target.value) : undefined)}>
                  <option value="">—</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="mt-3 space-y-3">
              <Field label="Market bias / conditions today">
                <textarea className={inputClass} rows={2} value={draft.marketBias ?? ""} onChange={(e) => set("marketBias", e.target.value)} />
              </Field>
              <Field label="Watchlist">
                <textarea className={inputClass} rows={2} value={draft.watchlist ?? ""} onChange={(e) => set("watchlist", e.target.value)} />
              </Field>
              <Field label="Goals for the day (e.g. max trades, max loss, focus area)">
                <textarea className={inputClass} rows={2} value={draft.goalsForDay ?? ""} onChange={(e) => set("goalsForDay", e.target.value)} />
              </Field>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-slate-200">Post-Market Review</h2>
            <div className="space-y-3">
              <Field label="What went well today?">
                <textarea className={inputClass} rows={2} value={draft.whatWentWell ?? ""} onChange={(e) => set("whatWentWell", e.target.value)} />
              </Field>
              <Field label="What went poorly / what would you change?">
                <textarea className={inputClass} rows={2} value={draft.whatWentPoorly ?? ""} onChange={(e) => set("whatWentPoorly", e.target.value)} />
              </Field>
              <Field label="Review notes">
                <textarea className={inputClass} rows={2} value={draft.reviewNotes ?? ""} onChange={(e) => set("reviewNotes", e.target.value)} />
              </Field>
              <Field label="Gratitude / what are you proud of?">
                <textarea className={inputClass} rows={2} value={draft.gratitude ?? ""} onChange={(e) => set("gratitude", e.target.value)} />
              </Field>
            </div>
          </Card>

          <Card>
            <Label>Free notes</Label>
            <textarea className={inputClass} rows={3} value={draft.freeNotes ?? ""} onChange={(e) => set("freeNotes", e.target.value)} />
          </Card>
        </div>
      )}
    </div>
  );
}
