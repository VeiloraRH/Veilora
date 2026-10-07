import type { ReactNode } from "react";
import { CheckCircle2, AlertCircle, X, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tone, Visibility } from "@/demo/data";

// Shadcn component exports
export { Button, buttonVariants, type ButtonProps } from "./button";
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "./card";
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./dialog";
export { Input } from "./input";
export { Badge, badgeVariants } from "./badge";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "./tooltip";
export { Separator } from "./separator";
export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "./sheet";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from "./dropdown-menu";

// Application Brand & Layout Helpers
export function Logo({
  className,
  size = 32,
  wordmark = true,
}: {
  className?: string;
  size?: number;
  wordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <img
        src="/brand/veilora-mark.png"
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
      {wordmark && (
        <span className="font-brand text-[1.45em] font-semibold tracking-[0.04em] text-slate-900 dark:text-cream">
          Veilora
        </span>
      )}
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
  const toneClasses: Record<Tone, string> = {
    gold: "bg-gold-400/15 text-amber-700 dark:text-gold-300 border-gold-400/30",
    teal: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
    coral: "bg-coral-500/15 text-coral-600 dark:text-coral-400 border-coral-500/30",
    wine: "bg-wine-500/15 text-wine-600 dark:text-coral-400 border-wine-500/30",
    mist: "bg-slate-100 dark:bg-ink-700/60 text-slate-600 dark:text-mist border-slate-200 dark:border-ink-600",
    cream: "bg-slate-100 dark:bg-cream/8 text-slate-800 dark:text-cream border-slate-200 dark:border-cream/20",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        toneClasses[VIS[v].tone]
      )}
    >
      {VIS[v].label}
    </span>
  );
}

export function Dot({ tone = "mist" }: { tone?: Tone }) {
  const c: Record<Tone, string> = {
    gold: "bg-gold-400",
    teal: "bg-teal-400",
    coral: "bg-coral-500",
    wine: "bg-wine-500",
    mist: "bg-mist",
    cream: "bg-cream",
  };
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", c[tone])} />;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h1 className="text-3xl font-semibold leading-tight text-slate-900 dark:text-cream sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-mist">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "gold" | "teal" | "coral";
}) {
  const t =
    tone === "gold"
      ? "text-amber-600 dark:text-gold-300"
      : tone === "teal"
      ? "text-teal-600 dark:text-teal-300"
      : tone === "coral"
      ? "text-coral-600 dark:text-coral-400"
      : "text-slate-900 dark:text-cream";
  return (
    <div className="panel min-w-0 px-5 py-4 bg-white dark:bg-ink-900 border border-slate-200 dark:border-ink-700 shadow-sm">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-mist">
        {label}
      </p>
      <p className={cn("mt-1.5 truncate text-2xl font-semibold tabular-nums", t)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500 dark:text-mist">{sub}</p>}
    </div>
  );
}

export function KV({ k, v, mono }: { k: ReactNode; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-ink-700/60 py-2.5 text-sm last:border-0">
      <span className="text-slate-500 dark:text-mist">{k}</span>
      <span className={cn("text-right text-slate-900 dark:text-cream", mono && "font-mono text-[13px]")}>
        {v}
      </span>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-600 dark:text-mist">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-slate-500 dark:text-mist">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-slate-200 dark:border-ink-600 bg-white dark:bg-ink-950/70 px-3.5 py-2.5 text-sm text-slate-900 dark:text-cream placeholder:text-slate-400 dark:placeholder:text-mist/60 focus:border-[#eaba65] focus:outline-none transition-colors";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  maxWidth = "md",
}: ModalProps) {
  if (!open) return null;

  const maxWidthClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-900/60 dark:bg-ink-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div
        className={cn(
          "panel relative z-10 w-full overflow-hidden border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 shadow-2xl transition-all",
          maxWidthClass
        )}
      >
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-ink-800 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-cream">{title}</h3>
            {description && (
              <p className="mt-1 text-xs text-slate-500 dark:text-mist">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-700 dark:text-mist dark:hover:text-cream transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">{children}</div>

        {actions && (
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-ink-800 bg-slate-50 dark:bg-ink-950/40 px-6 py-3.5">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export interface StatusModalProps {
  open: boolean;
  onClose: () => void;
  type: "success" | "error" | "info";
  title: string;
  message: string;
  details?: ReactNode;
  actionText?: string;
  onAction?: () => void;
}

export function StatusModal({
  open,
  onClose,
  type,
  title,
  message,
  details,
  actionText = "Close",
  onAction,
}: StatusModalProps) {
  if (!open) return null;

  const iconConfig = {
    success: {
      icon: CheckCircle2,
      color: "text-teal-500 dark:text-teal-300",
      bg: "bg-teal-50 dark:bg-teal-400/10 border-teal-200 dark:border-teal-400/30",
    },
    error: {
      icon: AlertCircle,
      color: "text-coral-500 dark:text-coral-400",
      bg: "bg-coral-50 dark:bg-coral-500/10 border-coral-200 dark:border-coral-500/30",
    },
    info: {
      icon: Info,
      color: "text-[#eaba65]",
      bg: "bg-amber-50 dark:bg-gold-400/10 border-amber-200 dark:border-gold-400/30",
    },
  }[type];

  const Icon = iconConfig.icon;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title=""
      maxWidth="sm"
      actions={
        <button
          type="button"
          className="rounded-xl px-4 py-2 text-sm font-semibold bg-[#eaba65] text-slate-950 hover:bg-[#d8a855] transition-colors"
          onClick={() => {
            if (onAction) onAction();
            onClose();
          }}
        >
          {actionText}
        </button>
      }
    >
      <div className="text-center">
        <div
          className={cn(
            "mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border",
            iconConfig.bg
          )}
        >
          <Icon className={cn("h-6 w-6", iconConfig.color)} />
        </div>
        <h4 className="text-lg font-semibold text-slate-900 dark:text-cream">{title}</h4>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-cream-dim">
          {message}
        </p>
        {details && <div className="mt-4 text-left">{details}</div>}
      </div>
    </Modal>
  );
}
