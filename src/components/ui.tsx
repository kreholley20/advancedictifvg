import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/60 p-4 ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  valueClassName = "",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  valueClassName?: string;
}) {
  return (
    <Card>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold text-slate-100 ${valueClassName}`}>{value}</div>
      {sub != null && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </Card>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "bad" | "warn";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-slate-800 text-slate-300 border-slate-700",
    good: "bg-emerald-950 text-emerald-400 border-emerald-800",
    bad: "bg-rose-950 text-rose-400 border-rose-800",
    warn: "bg-amber-950 text-amber-400 border-amber-800",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  className = "",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
  disabled?: boolean;
}) {
  const variants: Record<string, string> = {
    primary: "bg-sky-600 hover:bg-sky-500 text-white",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700",
    danger: "bg-rose-700 hover:bg-rose-600 text-white",
    ghost: "hover:bg-slate-800 text-slate-300",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-slate-400">{children}</label>;
}

export const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-600 placeholder:text-slate-600";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function MultiSelectChips({
  options,
  value,
  onChange,
  tone = "neutral",
}: {
  options: readonly string[];
  value: string[];
  onChange: (v: string[]) => void;
  tone?: "neutral" | "bad";
}) {
  function toggle(opt: string) {
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt));
    else onChange([...value, opt]);
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = value.includes(opt);
        const activeClass =
          tone === "bad"
            ? "bg-rose-900 border-rose-600 text-rose-200"
            : "bg-sky-900 border-sky-600 text-sky-200";
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              active ? activeClass : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center">
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
