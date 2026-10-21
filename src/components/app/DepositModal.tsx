import { copyAddress } from '@/lib/clipboardGuard';
import { useEffect,useState } from 'react';
import QRCode from 'qrcode';
import { Check,Copy,Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { PaymentLinksDialog } from './PaymentLinksDialog';
export function DepositModal({open,onClose,accountAddress}:{open:boolean;onClose:()=>void;accountAddress:string}){
 const [qr,setQr]=useState('');const [copied,setCopied]=useState(false);const [error,setError]=useState('');const [links,setLinks]=useState(false);
 useEffect(()=>{setQr('');setError('');setCopied(false);if(open&&accountAddress)void QRCode.toDataURL(accountAddress,{margin:2,width:260,color:{dark:'#202638',light:'#ffffff'}}).then(setQr).catch(()=>setError('QR code unavailable. You can still copy the address.'));},[open,accountAddress]);
 async function copy(){try{await copyAddress(accountAddress);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{setError('Could not copy. Select the address below to copy it manually.');}}
 return <><Dialog open={open&&!links} onOpenChange={v=>!v&&onClose()}><DialogContent className="wallet-dialog text-center sm:max-w-sm"><DialogHeader><DialogTitle className="text-center">Receive assets</DialogTitle><DialogDescription className="text-center">Your wallet address on Robinhood Chain.</DialogDescription></DialogHeader><div className="mx-auto my-2 flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-xs"><img src="/robinhood-logo.png" width={16} height={16} alt=""/>Robinhood Chain</div><div className="mx-auto grid h-56 w-56 place-items-center rounded-2xl border bg-white p-2">{qr?<img src={qr} alt={`QR code for ${accountAddress}`} width={210} height={210}/>:<span className="text-xs text-slate-500">Generating QR code…</span>}</div><p className="select-all break-all rounded-xl bg-muted p-3 font-mono text-xs leading-6">{accountAddress}</p><Button className="h-12 w-full rounded-xl" onClick={()=>void copy()}>{copied?<Check/>:<Copy/>}{copied?'Copied address':'Copy address'}</Button>{error&&<p role="alert" className="text-xs text-red-500">{error}</p>}<p className="text-[11px] leading-5 text-muted-foreground">Send only assets on Robinhood Chain to this address.</p><Button variant="outline" className="h-11 w-full rounded-xl" onClick={()=>setLinks(true)}><Link2/>Create a payment link</Button></DialogContent></Dialog><PaymentLinksDialog open={open&&links} onClose={()=>{setLinks(false);onClose();}}/></>;
}
