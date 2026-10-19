/**
 * The steps of one 2-of-3 signature, reported as they happen so the review
 * screen can show them live. Display only: reporting a stage changes nothing
 * about how the transaction is signed or checked.
 */
export type SigningStage = 'prepare' | 'device' | 'cosigner' | 'network' | 'done';
export const SIGNING_STEPS: { stage: Exclude<SigningStage, 'done'>; label: string; detail: string }[] = [
 { stage: 'prepare', label: 'Preparing', detail: 'Reading your account’s nonce and building the exact call' },
 { stage: 'device', label: 'Your device key signs', detail: 'Shard A signs on this device; the key never leaves it' },
 { stage: 'cosigner', label: 'Co-signer checks and signs', detail: 'Veilora’s co-signer checks its policy, then adds Shard B' },
 { stage: 'network', label: 'Network confirms', detail: 'Submitted with gas paid by Veilora, waiting for the block' },
];

export type SigningProgress = { current: SigningStage | null; startedAt: Partial<Record<SigningStage, number>> };
export const idleProgress = (): SigningProgress => ({ current: null, startedAt: {} });

export function advance(progress: SigningProgress, stage: SigningStage, now = Date.now()): SigningProgress {
 return { current: stage, startedAt: { ...progress.startedAt, [stage]: now } };
}

export type StepState = { status: 'pending' | 'active' | 'done'; ms: number | null };

/** Each step's state, and how long finished steps took. */
export function stepStates(progress: SigningProgress): StepState[] {
 const order: SigningStage[] = ['prepare', 'device', 'cosigner', 'network', 'done'];
 const at = progress.current ? order.indexOf(progress.current) : -1;
 return SIGNING_STEPS.map((step, i) => {
  const start = progress.startedAt[step.stage];
  const end = progress.startedAt[order[i + 1]];
  return { status: i < at ? 'done' : i === at ? 'active' : 'pending', ms: i < at && start != null && end != null ? end - start : null };
 });
}
