export type Direction = "long" | "short";

export type TradeStatus = "open" | "closed";

/** Emotional/mental state options a trader can select before, during, and after a trade. */
export const EMOTION_OPTIONS = [
  "Calm",
  "Confident",
  "Focused",
  "Neutral",
  "Anxious",
  "Excited",
  "Fearful",
  "Frustrated",
  "Impatient",
  "Greedy",
  "Tired",
  "Distracted",
  "Revenge-y",
  "FOMO",
  "Bored",
] as const;
export type Emotion = (typeof EMOTION_OPTIONS)[number];

/** Common self-sabotaging behaviors, based on patterns that separate profitable
 * traders from unprofitable ones — tag these on losing (and winning) trades to
 * find your leaks. */
export const MISTAKE_OPTIONS = [
  "No setup / low quality entry",
  "Sized too large",
  "Moved stop loss",
  "No stop loss set",
  "Entered too early",
  "Entered too late (chased)",
  "Exited too early",
  "Held too long / hoped",
  "Revenge trade",
  "FOMO entry",
  "Overtraded (too many trades)",
  "Traded outside plan/strategy",
  "Ignored higher timeframe context",
  "Traded during news without plan",
  "Averaged down against plan",
  "Distracted / not fully present",
  "Broke a personal rule",
] as const;
export type Mistake = (typeof MISTAKE_OPTIONS)[number];

export interface RuleChecklistItem {
  ruleId: string;
  followed: boolean;
}

export interface Trade {
  id: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO

  symbol: string;
  direction: Direction;
  assetClass?: string; // e.g. "Futures", "Forex", "Stocks", "Crypto", "Options"
  strategy?: string; // setup/playbook name, free text (matches PlaybookRule.category optionally)
  timeframe?: string; // e.g. "5m", "1H", "Daily"

  entryDate: string; // ISO datetime
  exitDate?: string; // ISO datetime
  status: TradeStatus;

  entryPrice: number;
  exitPrice?: number;
  stopLoss?: number;
  target?: number;
  size: number; // position size / contracts / shares
  fees?: number;

  // Psychology
  emotionsBefore: Emotion[];
  emotionsDuring: Emotion[];
  emotionsAfter: Emotion[];
  confidenceBefore?: number; // 1-5
  mistakes: Mistake[];
  followedPlan: boolean | null; // null = not rated
  ruleChecklist: RuleChecklistItem[];

  grade?: string; // A/B/C/D/F self-graded execution quality
  tags: string[];
  notes?: string; // free-form thesis / journal notes
  lessonLearned?: string;

  screenshots: string[]; // data URLs (before/after chart, optional)
}

export interface JournalEntry {
  id: string;
  date: string; // ISO date (yyyy-mm-dd), one per day
  createdAt: string;
  updatedAt: string;

  // Pre-market
  sleepQuality?: number; // 1-5
  physicalState?: number; // 1-5
  mentalState?: number; // 1-5
  marketBias?: string;
  goalsForDay?: string;
  watchlist?: string;

  // Post-market
  whatWentWell?: string;
  whatWentPoorly?: string;
  reviewNotes?: string;
  gratitude?: string;

  freeNotes?: string;
}

export type RuleCategory = "entry" | "exit" | "risk" | "mindset" | "process";

export interface PlaybookRule {
  id: string;
  category: RuleCategory;
  title: string;
  description?: string;
  active: boolean;
  order: number;
}
