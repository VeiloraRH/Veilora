import { createRootRoute, Outlet, Link } from "@tanstack/react-router";
import { Shield, Terminal } from "lucide-react";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#070b12] text-slate-100 font-sans">
      <header className="border-b border-slate-800/80 bg-[#070b12]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 font-semibold text-lg tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Shield className="w-4 h-4" />
            </div>
            <span>Veilora</span>
            <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              RHC 4663
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-sm text-slate-400">
            <a href="#control-plane" className="hover:text-emerald-400 transition-colors hidden sm:inline">Control Plane</a>
            <a href="#privacy-plane" className="hover:text-emerald-400 transition-colors hidden sm:inline">Privacy Plane</a>
            <a href="#execution-plane" className="hover:text-emerald-400 transition-colors hidden sm:inline">Execution Plane</a>
            <a
              href="https://github.com/notadeveloper7/veilora"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-mono px-3 py-1.5 rounded-md bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-colors flex items-center gap-1.5"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>v0.1.0</span>
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-850 py-8 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Veilora. Move quietly. Stay in control.</p>
          <p className="font-mono text-slate-600">Robinhood Chain (ID: 4663) · 2-of-3 MPC Quorum</p>
        </div>
      </footer>
    </div>
  );
}
