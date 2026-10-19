import { expect, test } from 'bun:test';
import { advance, idleProgress, stepStates } from '../src/lib/signingProgress';

test('marks finished, current and waiting steps with how long each took', () => {
 let p = idleProgress();
 expect(stepStates(p).map(s => s.status)).toEqual(['pending', 'pending', 'pending', 'pending']);
 p = advance(p, 'prepare', 1_000);
 p = advance(p, 'device', 1_120);
 p = advance(p, 'cosigner', 1_150);
 expect(stepStates(p)).toEqual([
  { status: 'done', ms: 120 }, { status: 'done', ms: 30 }, { status: 'active', ms: null }, { status: 'pending', ms: null },
 ]);
 p = advance(p, 'network', 2_400);
 p = advance(p, 'done', 5_400);
 expect(stepStates(p).map(s => [s.status, s.ms])).toEqual([['done', 120], ['done', 30], ['done', 1250], ['done', 3000]]);
});
