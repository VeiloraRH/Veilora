# Security Policy

Veilora handles private state transitions, threshold signing authorization, and digital asset execution on Robinhood Chain. Security and cryptographic soundness are central to our product integrity.

---

## Reporting a Vulnerability

If you discover a security vulnerability in Veilora, please **do not** open a public issue or discuss it publicly.

Instead, report it immediately to our security response team:

📧 **security@veilorarh.com**

Please include:
- A clear description of the vulnerability.
- Steps to reproduce the issue or a proof-of-concept (PoC).
- The potential impact on users, funds, or privacy guarantees.
- Affected components (Control Plane, Privacy Plane, Execution Plane, or backend services).

---

## Response Timeline

- **Initial Acknowledgment:** Within **48 hours** of receiving your report.
- **Triage & Assessment:** Within **72 hours** with severity classification.
- **Critical Remediation:** Target deployment of critical patches within **7 days**.
- **Public Disclosure:** Coordinated disclosure after mitigation has been deployed and verified.

---

## Scope

### In Scope
- Threshold signing quorum bypasses (circumventing 2-of-3 Shard rules).
- Shielded note double-spending or nullifier collisions.
- Policy engine evasions (bypassing fee ceilings, gas reserves, or destination checks).
- Unauthorized exposure of private notes, view keys, or intent payloads.
- Backend API authentication, injection, or transaction replay vulnerabilities.
- Safe unshielding state machine flaws that could trap funds or cause indefinite limbo.

### Out of Scope
- Denial of Service (DoS) attacks on publicly rate-limited infrastructure.
- Social engineering attacks targeting user devices directly.
- Vulnerabilities in upstream third-party chains or underlying EVM implementations outside our adapters.

---

## Attack Surfaces

Given Veilora's architecture, we actively protect against:
1. **Quorum Bypass:** Attempts to authorize execution with fewer than 2 valid threshold shards.
2. **Proof Invalidation / Replay:** Malicious or replayed clean-provenance (PPOI) proofs.
3. **Broadcaster Redirection:** Rogue relayers attempting to redirect unshielded payouts away from verified destinations.
4. **Intent Injection / Parsing Drift:** Misleading natural language representations that create divergent execution plans.
5. **View Key Leakage:** Unintended revelation of past or unrelated transactions beyond the requested scope.

---

## Safe Harbor & Reporter Recognition

We support responsible security research. If you make a good-faith effort to avoid privacy violations, destruction of data, and service interruption during your research:
- We will not pursue legal action against you.
- We will credit you in our release notes and security advisories (unless you prefer anonymity).

---

## Deployed Contracts

*Contract deployments on Robinhood Chain (Chain ID `4663`) will be published here upon testnet and mainnet verification.*
