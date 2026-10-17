import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

// Each acknowledgement that disables a signing button must have a checkbox that can set it,
// otherwise the button stays disabled for every recipient that needs the acknowledgement.
const GATES = [
  { file: 'src/components/dashboard/SendModal.tsx', state: 'acknowledged', setter: 'setAcknowledged' },
  { file: 'src/components/dashboard/SendModal.tsx', state: 'simulationAck', setter: 'setSimulationAck' },
  { file: 'src/routes/app/bridge.tsx', state: 'recipientAck', setter: 'setRecipientAck' },
  { file: 'src/components/wallet/SendNftModal.tsx', state: 'acknowledged', setter: 'setAcknowledged' },
  { file: 'src/components/wallet/SendNftModal.tsx', state: 'simulationAck', setter: 'setSimulationAck' },
];

describe('review acknowledgements', () => {
  for (const { file, state, setter } of GATES) {
    test(`${state} in ${file} has a checkbox`, () => {
      const source = readFileSync(file, 'utf8');
      expect(source).toMatch(new RegExp(`!${state}\\b`));
      expect(source).toMatch(new RegExp(`type="checkbox"\\s+checked=\\{${state}\\}\\s+onChange=\\{\\(?e\\)?\\s*=>\\s*${setter}\\(e\\.target\\.checked\\)\\}`));
    });
  }
});
