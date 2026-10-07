import { query } from "./db/index";

export interface FreezeState {
  address: string;
  frozen: boolean;
  frozenUntil: string | null;
  reason: string | null;
}

export const ATTEMPT_WINDOW_MINUTES = 15;
export const MAX_ATTEMPTS = 5;

// In-memory rate limiting map for wrong codes per address
const attemptTracker = new Map<string, { attempts: number; windowStart: number }>();

export function isLockedOut(address: string): boolean {
  const record = attemptTracker.get(address.toLowerCase());
  if (!record) return false;
  const now = Date.now();
  if (now - record.windowStart > ATTEMPT_WINDOW_MINUTES * 60 * 1000) {
    attemptTracker.delete(address.toLowerCase());
    return false;
  }
  return record.attempts >= MAX_ATTEMPTS;
}

export function recordFailedAttempt(address: string): void {
  const key = address.toLowerCase();
  const record = attemptTracker.get(key);
  const now = Date.now();
  if (!record || now - record.windowStart > ATTEMPT_WINDOW_MINUTES * 60 * 1000) {
    attemptTracker.set(key, { attempts: 1, windowStart: now });
  } else {
    record.attempts += 1;
  }
}

export function resetAttempts(address: string): void {
  attemptTracker.delete(address.toLowerCase());
}

export async function getFreezeState(address: string): Promise<FreezeState> {
  const normalized = address.toLowerCase();
  const result = await query(
    `SELECT is_frozen, frozen_until, freeze_reason
     FROM wallets WHERE address = $1`,
    [normalized]
  );

  if (result.rows.length === 0) {
    return {
      address: normalized,
      frozen: false,
      frozenUntil: null,
      reason: null,
    };
  }

  const row = result.rows[0];
  const now = new Date();
  const isStillFrozen = row.is_frozen && (!row.frozen_until || new Date(row.frozen_until) > now);

  return {
    address: normalized,
    frozen: isStillFrozen,
    frozenUntil: row.frozen_until ? new Date(row.frozen_until).toISOString() : null,
    reason: row.freeze_reason,
  };
}

export async function freezeWallet(
  address: string,
  hours: number = 24,
  reason: string = "Emergency user freeze"
): Promise<FreezeState> {
  const normalized = address.toLowerCase();
  const frozenUntil = new Date(Date.now() + Math.min(hours, 168) * 3600 * 1000);

  await query(
    `UPDATE wallets
     SET is_frozen = true,
         frozen_until = $1,
         freeze_reason = $2,
         updated_at = now()
     WHERE address = $3`,
    [frozenUntil, reason, normalized]
  );

  return {
    address: normalized,
    frozen: true,
    frozenUntil: frozenUntil.toISOString(),
    reason,
  };
}

export async function unfreezeWallet(address: string): Promise<FreezeState> {
  const normalized = address.toLowerCase();

  await query(
    `UPDATE wallets
     SET is_frozen = false,
         frozen_until = null,
         freeze_reason = null,
         updated_at = now()
     WHERE address = $1`,
    [normalized]
  );

  return {
    address: normalized,
    frozen: false,
    frozenUntil: null,
    reason: null,
  };
}
