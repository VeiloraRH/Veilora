import { useEffect, useState, type ReactNode } from 'react';
import { usePrivacyMode } from '@/lib/privacyMode';

const REVEAL_MS = 5000;

/** Wraps a balance or amount. In privacy mode it shows dots; tapping reveals it for a few seconds. */
export function Private({ children, mask = '••••', className }: { children: ReactNode; mask?: string; className?: string }) {
 const on = usePrivacyMode();
 const [revealed, setRevealed] = useState(false);
 useEffect(() => { if (!revealed) return; const t = setTimeout(() => setRevealed(false), REVEAL_MS); return () => clearTimeout(t); }, [revealed]);
 useEffect(() => { if (!on) setRevealed(false); }, [on]);
 if (!on || revealed) return <span className={className}>{children}</span>;
 return <span role="button" tabIndex={0} className={`pv-mask ${className ?? ''}`} title="Hidden by privacy mode. Tap to show for 5 seconds." aria-label="Hidden amount. Activate to show briefly."
  onClick={e => { e.stopPropagation(); setRevealed(true); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setRevealed(true); } }}>{mask}</span>;
}
