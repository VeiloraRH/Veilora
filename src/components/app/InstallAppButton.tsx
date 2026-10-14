import { useEffect, useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import '@/components/wallet/wallet.css';

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }> };

export function InstallAppButton({ className = '' }: { className?: string }) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const installedHandler = () => { setInstalled(true); setPromptEvent(null); };
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', installedHandler);
    if (window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone)) setInstalled(true);
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  async function install() {
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
      setPromptEvent(null);
      if (choice.outcome === 'accepted') return;
    }
    setOpen(true);
  }

  if (installed) return null;
  return <>
    <button type="button" className={`wallet-install-button ${className}`} onClick={() => void install()}><Download size={15}/><span>Install Veilora</span></button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="wallet-dialog sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Install Veilora</DialogTitle>
          <DialogDescription>Add Veilora to your home screen or desktop for an app-like window and quick access.</DialogDescription>
        </DialogHeader>
        <div className="wallet-install-help"><Smartphone size={18}/><p>{/iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'In Safari, tap Share, then Add to Home Screen.' : 'Choose Install or Add to Home Screen in your browser menu. Your browser keeps control of the installation.'}</p></div>
        <button className="wallet-primary-button justify-center" onClick={() => setOpen(false)}>Got it</button>
      </DialogContent>
    </Dialog>
  </>;
}
