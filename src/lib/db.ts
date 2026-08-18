import Dexie, { type Table } from "dexie";
import type { JournalEntry, PlaybookRule, Trade } from "../types";

class TradingJournalDB extends Dexie {
  trades!: Table<Trade, string>;
  journalEntries!: Table<JournalEntry, string>;
  playbookRules!: Table<PlaybookRule, string>;

  constructor() {
    super("trading-journal-db");
    this.version(1).stores({
      trades: "id, symbol, entryDate, status, strategy",
      journalEntries: "id, date",
      playbookRules: "id, category, order",
    });
  }
}

export const db = new TradingJournalDB();

const DEFAULT_RULES: Omit<PlaybookRule, "id">[] = [
  {
    category: "process",
    title: "I have a written reason for this trade that isn't 'it looks like it will move'",
    active: true,
    order: 0,
  },
  {
    category: "risk",
    title: "I know my stop loss and position size before I enter",
    active: true,
    order: 1,
  },
  {
    category: "risk",
    title: "I am risking no more than my max risk-per-trade rule",
    active: true,
    order: 2,
  },
  {
    category: "entry",
    title: "Price/setup matches one of my defined playbook setups",
    active: true,
    order: 3,
  },
  {
    category: "mindset",
    title: "I am calm and not trading to 'get back' losses (no revenge trading)",
    active: true,
    order: 4,
  },
  {
    category: "mindset",
    title: "I have not exceeded my max trades / max loss for the day",
    active: true,
    order: 5,
  },
  {
    category: "exit",
    title: "I have a plan for where I'll take profit before entering",
    active: true,
    order: 6,
  },
];

export async function seedDefaultsIfEmpty() {
  // Wrapped in a single transaction so the count-check and insert are atomic —
  // otherwise two concurrent calls (e.g. React StrictMode's double effect
  // invocation) can both see count===0 and double-seed the default rules.
  await db.transaction("rw", db.playbookRules, async () => {
    const count = await db.playbookRules.count();
    if (count === 0) {
      await db.playbookRules.bulkAdd(
        DEFAULT_RULES.map((r) => ({ ...r, id: crypto.randomUUID() }))
      );
    }
  });
}
