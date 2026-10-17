import { Command, Keyboard, Search, type LucideIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui';

type Shortcut = { keys: readonly string[]; label: string; icon?: LucideIcon };

const shortcuts: readonly Shortcut[] = [
  { keys: ['⌘', 'K'], label: 'Open Universal Search', icon: Search },
  { keys: ['G', 'D'], label: 'Go to Dashboard' },
  { keys: ['G', 'M'], label: 'Go to Market' },
  { keys: ['G', 'S'], label: 'Go to Swap' },
  { keys: ['G', 'B'], label: 'Go to Bridge' },
  { keys: ['G', 'R'], label: 'Go to Rules' },
  { keys: ['G', 'H'], label: 'Go to Activity' },
  { keys: ['G', 'T'], label: 'Go to Settings' },
  { keys: ['P'], label: 'Show or hide balances' },
  { keys: ['?'], label: 'Show this shortcut guide', icon: Keyboard },
] as const;

export function KeyboardShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="wallet-dialog sm:max-w-lg">
      <DialogTitle className="flex items-center gap-2 text-lg"><Keyboard size={19} /> Keyboard shortcuts</DialogTitle>
      <DialogDescription>Use shortcuts anywhere in Veilora when you are not typing in a field.</DialogDescription>
      <div className="mt-2 divide-y rounded-xl border">
        {shortcuts.map(({ keys, label, icon: Icon }) => <div key={label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">{Icon ? <Icon size={16} /> : <Command size={16} className="opacity-0" />}{label}</span>
          <span className="flex shrink-0 items-center gap-1">{keys.map(key => <kbd key={key} className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-foreground">{key}</kbd>)}</span>
        </div>)}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Press <kbd className="rounded border bg-muted px-1 py-0.5 font-mono">G</kbd>, then the second key, for navigation.</p>
    </DialogContent>
  </Dialog>;
}
