import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Tone, Visibility } from "@/demo/data";

export function Logo({ className, size = 32, wordmark = true }: { className?: string; size?: number; wordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <img src="/brand/veilora-mark.png" alt="" width={size} height={size} style={{ width: size, height: size }} />
      {wordmark && <span className="font-display text-[1.45em] font-semibold tracking-[0.04em] text-cream">Veilora</span>}
    </span>
  );
}

const TONES: Record<Tone, string> = {
  gold: "bg-gold-400/12 text-gold-300 border-gold-400/30",
  teal: "bg-teal-400/12 text-teal-300 border-teal-400/30",
  coral: "bg-coral-500/12 text-coral-400 border-coral-500/30",
  wine: "bg-wine-500/20 text-coral-400 border-wine-500/40",
  mist: "bg-ink-700/60 text-mist border-ink-600",
  cream: "bg-cream/8 text-cream border-cream/20",
};

export function Badge({ tone = "mist", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium", TONES[tone], className)}>
      {children}
    </span>
  );
}

const VIS: Record<Visibility, { label: string; tone: Tone }> = {
  public: { label: "Public", tone: "coral" },
  shielded: { label: "Shielded", tone: "teal" },
  provider: { label: "Proof provider", tone: "gold" },
  local: { label: "On device", tone: "cream" },
};

export function VisibilityBadge({ v }: { v: Visibility }) {
  return <Badge tone={VIS[v].tone}>{VIS[v].label}</Badge>;
}

export function Dot({ tone = "mist", pulse }: { tone?: Tone; pulse?: boolean }) {
  const c: Record<Tone, string> = {
    gold: "bg-gold-400",
    teal: "bg-teal-400",
    coral: "bg-coral-500",
    wine: "bg-wine-500",
    mist: "bg-mist",
    cream: "bg-cream",
  };
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", c[tone], pulse && "animate-pulse")} />;
}

export function Card({
  title,
  eyebrow,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("panel min-w-0", className)}>
      {(title || eyebrow || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-ink-600/60 px-5 py-4">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow !text-[10px] mb-1">{eyebrow}</p>}
            {title && <h2 className="text-[15px] font-semibold text-cream">{title}</h2>}
          </div>
          {action}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

type ButtonVariant = "primary" | "outline" | "ghost" | "danger";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const v: Record<ButtonVariant, string> = {
    primary: "bg-gold-400 text-ink-900 hover:bg-gold-300 disabled:bg-ink-600 disabled:text-mist",
    outline: "border border-cream/30 text-cream hover:border-gold-400 hover:text-gold-300 disabled:opacity-40",
    ghost: "text-cream-dim hover:bg-ink-700 hover:text-cream disabled:opacity-40",
    danger: "border border-coral-500/50 text-coral-400 hover:bg-coral-500/10 disabled:opacity-40",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed",
        v[variant],
        className,
      )}
      {...props}
    />
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h1 className="font-display text-4xl font-semibold leading-tight text-cream sm:text-[2.6rem]">{title}</h1>
        {description && <p className="mt-2 text-sm leading-relaxed text-mist">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "gold" | "teal" | "coral" }) {
  const t = tone === "gold" ? "text-gold-300" : tone === "teal" ? "text-teal-300" : tone === "coral" ? "text-coral-400" : "text-cream";
  return (
    <div className="panel min-w-0 px-5 py-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-mist">{label}</p>
      <p className={cn("mt-1.5 truncate text-2xl font-semibold tabular-nums", t)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-mist">{sub}</p>}
    </div>
  );
}

export function KV({ k, v, mono }: { k: ReactNode; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-600/40 py-2.5 text-sm last:border-0">
      <span className="text-mist">{k}</span>
      <span className={cn("text-right text-cream", mono && "font-mono text-[13px]")}>{v}</span>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-lg border border-ink-600 bg-ink-850 p-1">
      {items.map((i) => (
        <button
          key={i.id}
          onClick={() => onChange(i.id)}
          className={cn(
            "whitespace-nowrap rounded-md px-3.5 py-1.5 text-sm transition-colors",
            value === i.id ? "bg-gold-400 font-medium text-ink-900" : "text-mist hover:text-cream",
          )}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-mist">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-mist">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-950/60 px-3.5 py-2.5 text-sm text-cream placeholder:text-mist/60 focus:border-gold-400 focus:outline-none";

export function DemoNote({ children }: { children?: ReactNode }) {
  return (
    <p className="text-xs text-mist">
      {children ?? "Demo data. Nothing is signed, proved or submitted."}
    </p>
  );
}
