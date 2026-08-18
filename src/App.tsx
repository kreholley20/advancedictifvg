import { useEffect } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { seedDefaultsIfEmpty } from "./lib/db";
import DashboardPage from "./pages/DashboardPage";
import TradesPage from "./pages/TradesPage";
import TradeFormPage from "./pages/TradeFormPage";
import TradeDetailPage from "./pages/TradeDetailPage";
import JournalPage from "./pages/JournalPage";
import PlaybookPage from "./pages/PlaybookPage";
import SettingsPage from "./pages/SettingsPage";

const NAV = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/trades", label: "Trades" },
  { to: "/journal", label: "Journal" },
  { to: "/playbook", label: "Playbook" },
  { to: "/settings", label: "Settings" },
];

export default function App() {
  useEffect(() => {
    seedDefaultsIfEmpty();
  }, []);

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <div className="flex items-center gap-2 font-semibold text-slate-100">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-500" />
            Trading Journal
          </div>
          <nav className="flex gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/trades" element={<TradesPage />} />
          <Route path="/trades/new" element={<TradeFormPage />} />
          <Route path="/trades/:id" element={<TradeDetailPage />} />
          <Route path="/trades/:id/edit" element={<TradeFormPage />} />
          <Route path="/journal" element={<JournalPage />} />
          <Route path="/playbook" element={<PlaybookPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
