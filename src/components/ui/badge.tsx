import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const TONES: Record<string, string> = {
  gold: "bg-gold-400/15 text-amber-700 dark:text-gold-300 border-gold-400/30",
  teal: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
  coral: "bg-coral-500/15 text-coral-600 dark:text-coral-400 border-coral-500/30",
  wine: "bg-wine-500/15 text-wine-600 dark:text-coral-400 border-wine-500/30",
  mist: "bg-slate-100 dark:bg-ink-700/60 text-slate-600 dark:text-mist border-slate-200 dark:border-ink-600",
  cream: "bg-slate-100 dark:bg-cream/8 text-slate-800 dark:text-cream border-slate-200 dark:border-cream/20",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  tone?: "gold" | "teal" | "coral" | "wine" | "mist" | "cream" | string;
}

function Badge({ className, variant, tone, ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        badgeVariants({ variant }),
        tone && TONES[tone],
        className
      )}
      {...props}
    />
  );
}

export { Badge, badgeVariants }
