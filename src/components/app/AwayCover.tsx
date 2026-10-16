import { useEffect, useState } from 'react';
import { EyeOff } from 'lucide-react';
import { isAway, useHideWhenAway } from '@/lib/awayCover';

/** Covers the unlocked wallet while the tab is hidden or the window is not focused. */
export function AwayCover() {
 const enabled = useHideWhenAway();
 const [away, setAway] = useState(false);
 useEffect(() => {
  if (!enabled) { setAway(false); return; }
  const update = () => setAway(isAway(document));
  // Cover immediately on the way out; lift as soon as the page is back.
  const leave = () => setAway(true);
  window.addEventListener('blur', leave);
  window.addEventListener('focus', update);
  window.addEventListener('pagehide', leave);
  document.addEventListener('visibilitychange', update);
  return () => {
   window.removeEventListener('blur', leave);
   window.removeEventListener('focus', update);
   window.removeEventListener('pagehide', leave);
   document.removeEventListener('visibilitychange', update);
  };
 }, [enabled]);
 if (!enabled || !away) return null;
 return <div className="away-cover" role="presentation" aria-hidden="true" onPointerDown={() => setAway(isAway(document))}>
  <div className="away-cover-card"><img src="/brand/veilora-mark.png" alt="" width={56} height={56}/><strong>Veilora is hidden</strong><span><EyeOff size={13}/>Your balances are covered while you’re away</span></div>
 </div>;
}
