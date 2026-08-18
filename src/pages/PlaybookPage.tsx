import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db } from "../lib/db";
import { Badge, Button, Card, Field, inputClass } from "../components/ui";
import type { PlaybookRule, RuleCategory } from "../types";

const CATEGORIES: { value: RuleCategory; label: string }[] = [
  { value: "process", label: "Process" },
  { value: "entry", label: "Entry" },
  { value: "risk", label: "Risk" },
  { value: "exit", label: "Exit" },
  { value: "mindset", label: "Mindset" },
];

export default function PlaybookPage() {
  const rules = useLiveQuery(() => db.playbookRules.orderBy("order").toArray(), []);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<RuleCategory>("process");
  const [description, setDescription] = useState("");

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const maxOrder = rules && rules.length ? Math.max(...rules.map((r) => r.order)) : -1;
    const rule: PlaybookRule = {
      id: crypto.randomUUID(),
      category,
      title: title.trim(),
      description: description.trim() || undefined,
      active: true,
      order: maxOrder + 1,
    };
    await db.playbookRules.add(rule);
    setTitle("");
    setDescription("");
  }

  async function toggleActive(rule: PlaybookRule) {
    await db.playbookRules.update(rule.id, { active: !rule.active });
  }

  async function removeRule(id: string) {
    await db.playbookRules.delete(id);
  }

  return (
    <div className="space-y-4 pb-16">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Trading Playbook</h1>
        <p className="mt-1 text-sm text-slate-500">
          Define the rules that separate your best trades from your worst. Active rules appear as a checklist when you log
          a trade, so you can measure your discipline over time — not just your P&amp;L.
        </p>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Add a Rule</h2>
        <form onSubmit={addRule} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <Field label="Category">
              <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as RuleCategory)}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Rule">
              <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. I only trade the first 2 hours of the session" />
            </Field>
          </div>
          <Field label="Notes (optional)">
            <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Button type="submit">Add Rule</Button>
        </form>
      </Card>

      <div className="space-y-3">
        {CATEGORIES.map((c) => {
          const group = (rules ?? []).filter((r) => r.category === c.value);
          if (group.length === 0) return null;
          return (
            <Card key={c.value}>
              <h3 className="mb-2 text-sm font-semibold text-slate-200">{c.label}</h3>
              <div className="space-y-2">
                {group.map((rule) => (
                  <div key={rule.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 p-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={rule.active ? "text-sm text-slate-200" : "text-sm text-slate-500 line-through"}>{rule.title}</span>
                        {!rule.active && <Badge>inactive</Badge>}
                      </div>
                      {rule.description && <p className="mt-0.5 text-xs text-slate-500">{rule.description}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button variant="ghost" onClick={() => toggleActive(rule)}>
                        {rule.active ? "Disable" : "Enable"}
                      </Button>
                      <Button variant="ghost" onClick={() => removeRule(rule.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
        {rules && rules.length === 0 && <p className="text-sm text-slate-500">No rules yet. Add your first one above.</p>}
      </div>
    </div>
  );
}
