import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState } from "react";
import { db } from "../lib/db";
import { Button, Card } from "../components/ui";

interface BackupShape {
  version: 1;
  exportedAt: string;
  trades: unknown[];
  journalEntries: unknown[];
  playbookRules: unknown[];
}

export default function SettingsPage() {
  const tradeCount = useLiveQuery(() => db.trades.count(), []);
  const journalCount = useLiveQuery(() => db.journalEntries.count(), []);
  const ruleCount = useLiveQuery(() => db.playbookRules.count(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  async function handleExport() {
    const [trades, journalEntries, playbookRules] = await Promise.all([
      db.trades.toArray(),
      db.journalEntries.toArray(),
      db.playbookRules.toArray(),
    ]);
    const backup: BackupShape = {
      version: 1,
      exportedAt: new Date().toISOString(),
      trades,
      journalEntries,
      playbookRules,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trading-journal-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as Partial<BackupShape>;
      if (!data.trades && !data.journalEntries && !data.playbookRules) {
        setMessage("This file doesn't look like a valid backup.");
        return;
      }
      await db.transaction("rw", db.trades, db.journalEntries, db.playbookRules, async () => {
        if (data.trades) await db.trades.bulkPut(data.trades as never[]);
        if (data.journalEntries) await db.journalEntries.bulkPut(data.journalEntries as never[]);
        if (data.playbookRules) await db.playbookRules.bulkPut(data.playbookRules as never[]);
      });
      setMessage(
        `Imported ${data.trades?.length ?? 0} trades, ${data.journalEntries?.length ?? 0} journal entries, ${data.playbookRules?.length ?? 0} rules.`
      );
    } catch {
      setMessage("Could not read that file — make sure it's a JSON backup exported from this app.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleClearAll() {
    await db.transaction("rw", db.trades, db.journalEntries, db.playbookRules, async () => {
      await db.trades.clear();
      await db.journalEntries.clear();
      await db.playbookRules.clear();
    });
    setConfirmClear(false);
    setMessage("All data cleared.");
  }

  return (
    <div className="max-w-2xl space-y-4 pb-16">
      <h1 className="text-lg font-semibold text-stone-100">Settings</h1>

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-stone-200">Your Data</h2>
        <p className="mb-3 text-sm text-stone-500">
          Everything is stored locally in your browser (IndexedDB) — nothing is sent to a server. That means it's
          private, but it also means it can be lost if you clear browser data. Export a backup regularly.
        </p>
        <div className="mb-4 flex gap-4 text-sm text-stone-400">
          <span>
            <span className="font-medium text-stone-200">{tradeCount ?? "…"}</span> trades
          </span>
          <span>
            <span className="font-medium text-stone-200">{journalCount ?? "…"}</span> journal entries
          </span>
          <span>
            <span className="font-medium text-stone-200">{ruleCount ?? "…"}</span> playbook rules
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExport}>Export Backup (JSON)</Button>
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            Import Backup
          </Button>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImport} />
        </div>
        {message && <p className="mt-3 text-sm text-sage-400">{message}</p>}
      </Card>

      <Card className="border-clay-900">
        <h2 className="mb-1 text-sm font-semibold text-clay-400">Danger Zone</h2>
        <p className="mb-3 text-sm text-stone-500">Permanently delete all trades, journal entries, and playbook rules from this browser.</p>
        {confirmClear ? (
          <div className="flex gap-2">
            <Button variant="danger" onClick={handleClearAll}>
              Yes, delete everything
            </Button>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setConfirmClear(true)}>
            Clear All Data
          </Button>
        )}
      </Card>
    </div>
  );
}
