import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* Thin gold orbit lines, echoing the brand banners. */
export function Orbits({ className }: { className?: string }) {
  return (
    <svg className={cn("pointer-events-none absolute", className)} viewBox="0 0 1200 600" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="orbit" x1="0" x2="1">
          <stop offset="0" stopColor="#eaba65" stopOpacity="0" />
          <stop offset="0.5" stopColor="#eaba65" stopOpacity="0.55" />
          <stop offset="1" stopColor="#db6b55" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M-20 520 C 300 360, 700 120, 1220 60" stroke="url(#orbit)" strokeWidth="1.2" />
      <circle cx="0" cy="0" r="520" transform="translate(980 760)" stroke="#eaba65" strokeOpacity="0.07" />
      <circle cx="0" cy="0" r="380" transform="translate(160 -60)" stroke="#eaba65" strokeOpacity="0.06" />
      <circle cx="612" cy="214" r="3" fill="#f7d372" />
    </svg>
  );
}

export function SectionTitle({ eyebrow, title, children, center }: { eyebrow: string; title: ReactNode; children?: ReactNode; center?: boolean }) {
  return (
    <div className={cn("max-w-3xl", center && "mx-auto text-center")}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.05] text-cream sm:text-5xl lg:text-6xl">{title}</h2>
      {children && <p className="mt-5 text-base leading-relaxed text-mist sm:text-lg">{children}</p>}
    </div>
  );
}

function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <img src="/brand/veilora-mark.png" alt="" width={34} height={34} className="h-[34px] w-[34px]" />
      <span className="font-brand text-2xl font-semibold tracking-[0.04em] text-cream">Veilora</span>
    </span>
  );
}

const NAV = [
  { to: "/roadmap", label: "Roadmap" },
  { to: "/whitepaper", label: "Whitepaper" },
] as const;

/* Sticky header for the standalone marketing pages (the home page uses the glass hero's own nav). */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-colors duration-300",
        scrolled ? "border-ink-600/60 bg-ink-900/80 backdrop-blur-xl" : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-20 sm:px-10">
        <Link to="/" aria-label="Veilora home">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-full px-3 py-1.5 text-sm text-cream-dim transition-colors hover:text-gold-300"
              activeProps={{ className: "bg-gold-400/10 !text-gold-300" }}
            >
              {n.label}
            </Link>
          ))}
          <Link
            to="/app"
            className="ml-1 hidden items-center gap-1.5 rounded-full border border-gold-400/50 px-4 py-1.5 text-sm text-gold-300 transition-colors hover:bg-gold-400 hover:text-ink-900 sm:inline-flex"
          >
            Launch app <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-ink-600/60 px-5 py-10 sm:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Wordmark />
          <p className="mt-2 text-xs text-mist">© 2026 Veilora · Robinhood Chain (4663)</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-mist">
          <a href="/#how-it-works" className="hover:text-gold-300">
            Product
          </a>
          <a href="/#privacy" className="hover:text-gold-300">
            Privacy
          </a>
          <a href="/#developers" className="hover:text-gold-300">
            Developers
          </a>
          <Link to="/roadmap" className="hover:text-gold-300">
            Roadmap
          </Link>
          <Link to="/whitepaper" className="hover:text-gold-300">
            Whitepaper
          </Link>
          <Link to="/app" className="hover:text-gold-300">
            App
          </Link>
        </nav>
      </div>
      <p className="mx-auto mt-8 max-w-6xl text-xs leading-relaxed text-mist/70">
        Veilora is in development. Claims about privacy guarantees, audits, tokenized-stock support and proof providers are subject to independent verification before production
        use. The app shows demo data.
      </p>
    </footer>
  );
}

/* Dark marketing page frame with its own document title. */
export function SitePage({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    window.scrollTo(0, 0);
    return () => {
      document.title = prev;
    };
  }, [title]);

  return (
    <div className="min-h-screen bg-ink-900 text-cream">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}

/* Which of the given section ids is currently in the reading band. */
export function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);
  return active;
}

/* Fades content up the first time it scrolls into view. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [el]);
  return (
    <div
      ref={setEl}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn("transition-all duration-700 ease-out motion-reduce:transition-none", shown ? "translate-y-0 opacity-100" : "motion-safe:translate-y-6 motion-safe:opacity-0", className)}
    >
      {children}
    </div>
  );
}
