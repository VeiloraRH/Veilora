import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Check, CircleDashed, Fingerprint, KeyRound, Server, ShieldCheck } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { getQuorumStatus } from '@/lib/api';
import { drillIsCurrent, readFlag } from '@/lib/recovery';
import { useWallet } from '@/lib/walletContext';

type HealthState = 'ready' | 'attention' | 'checking';

export function WalletHealthCard() {
  const { walletAddress, deviceKeyPresent, deviceKeyUnlocked } = useWallet();
  const quorum = useQuery({
    queryKey: ['quorum', walletAddress],
    enabled: !!walletAddress,
    queryFn: () => getQuorumStatus(walletAddress),
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 1,
  });

  const recoveryVerified = drillIsCurrent(readFlag(walletAddress, 'drill'));
  const data = quorum.data;
  const checks = [
    {
      key: 'device',
      label: 'Device key',
      value: !deviceKeyPresent ? 'Not on this device' : deviceKeyUnlocked ? 'Ready to sign' : 'Unlock to sign',
      detail: !deviceKeyPresent ? 'Import your Shard A key to use this device.' : deviceKeyUnlocked ? 'Your encrypted key is unlocked in this session.' : 'Your key is here and protected by your passphrase.',
      state: deviceKeyUnlocked ? 'ready' : 'attention',
      icon: KeyRound,
    },
    {
      key: 'cosigner',
      label: 'Veilora co-signer',
      value: quorum.isError ? 'Status unavailable' : !data ? 'Checking' : data.freeze.frozen ? 'Account frozen' : data.coSigner.signing ? 'Available' : 'Unavailable',
      detail: quorum.isError ? 'Could not confirm the latest co-signer status.' : !data ? 'Checking the account security service.' : data.freeze.frozen ? 'Signing is paused until the freeze is lifted.' : data.coSigner.signing ? 'Shard B is available for policy-approved requests.' : 'The co-signer is not currently signing.',
      state: quorum.isError || (data && (data.freeze.frozen || !data.coSigner.signing)) ? 'attention' : data ? 'ready' : 'checking',
      icon: Server,
    },
    {
      key: 'account',
      label: 'On-chain account',
      value: quorum.isError ? 'Status unavailable' : !data ? 'Checking' : data.chainError ? 'Could not verify' : data.deployed ? 'Deployed' : 'Ready to deploy',
      detail: quorum.isError ? 'Could not read the latest chain status.' : !data ? 'Checking Robinhood Chain.' : data.chainError ? 'Robinhood Chain could not confirm the account status.' : data.deployed ? 'Your smart account is live on Robinhood Chain.' : 'Your counterfactual account deploys when you make its first transaction.',
      state: quorum.isError || data?.chainError ? 'attention' : data ? 'ready' : 'checking',
      icon: ShieldCheck,
    },
    {
      key: 'recovery',
      label: 'Recovery key',
      value: recoveryVerified ? 'Recently verified' : 'Check recommended',
      detail: recoveryVerified ? 'You verified your offline recovery key on this device within the last 90 days.' : 'Run a quick check to confirm you can find your offline recovery key.',
      state: recoveryVerified ? 'ready' : 'attention',
      icon: Fingerprint,
    },
  ] as const;

  const attentionCount = checks.filter((check) => check.state === 'attention').length;
  const unknownCount = checks.filter((check) => check.state === 'checking').length;
  const summary: HealthState = attentionCount ? 'attention' : unknownCount ? 'checking' : 'ready';
  const title = summary === 'attention' ? 'A few things need attention' : summary === 'checking' ? 'Checking your wallet' : 'Your wallet is ready';

  return (
    <section className="wallet-panel wallet-health-card" aria-labelledby="wallet-health-title">
      <div className="wallet-health-heading">
        <span className={`wallet-health-mark ${summary}`}>
          {summary === 'ready' ? <Check size={17} /> : summary === 'checking' ? <CircleDashed size={17} className="animate-spin" /> : <AlertTriangle size={16} />}
        </span>
        <div className="wallet-health-title-wrap">
          <span className="wallet-health-eyebrow">Wallet health</span>
          <h2 id="wallet-health-title">{title}</h2>
        </div>
        <Link className="wallet-health-link" to="/app/security">Review security</Link>
      </div>
      <ul className="wallet-health-list">
        {checks.map((check) => (
          <li key={check.key} className={`wallet-health-row ${check.state}`}>
            <span className="wallet-health-icon"><check.icon size={16} /></span>
            <div className="wallet-health-copy">
              <div><strong>{check.label}</strong><span className="wallet-health-value">{check.value}</span></div>
              <p>{check.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="wallet-health-footnote"><CircleDashed size={13} /> Recovery verification is recorded only in this browser.</p>
    </section>
  );
}
