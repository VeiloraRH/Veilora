import { CheckCircle2, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type CompletionNotice = {
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
};

export function CompletionDialog({ notice, onClose }: { notice: CompletionNotice | null; onClose: () => void }) {
  return <Dialog open={!!notice} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="wallet-dialog completion-dialog sm:max-w-sm">
      <span className="completion-dialog-icon"><CheckCircle2 size={25}/></span>
      <DialogHeader className="text-center">
        <DialogTitle>{notice?.title}</DialogTitle>
        <DialogDescription>{notice?.description}</DialogDescription>
      </DialogHeader>
      {notice?.href && <a className="wallet-soft-button w-full" href={notice.href} target="_blank" rel="noreferrer">{notice.linkLabel || 'View details'} <ExternalLink size={14}/></a>}
      <button className="wallet-primary-button completion-dialog-done" onClick={onClose}>Done</button>
    </DialogContent>
  </Dialog>;
}
