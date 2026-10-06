# Contributing to Veilora

Thank you for your interest in contributing to Veilora.

Veilora is building the private financial operating layer for Robinhood Chain. Because Veilora secures private funds and cryptographic proofs, all contributions must adhere to high standards of rigor, explainability, and safety.

---

## What We're Looking For Right Now

We welcome targeted contributions in these areas:
- **Gate 1 Core Infrastructure:** Intent normalization parsers, balance simulation helpers, and policy rule definitions.
- **Robinhood Chain Adapters:** RPC providers, gas estimation strategies, and ERC-4337 UserOperation builders.
- **Frontend Enhancements:** TanStack Router UX refinements, accessible UI components, and state simulation visualizations.
- **Test Coverage:** Unit and integration tests for backend routes, migration idempotency, and edge-case simulation logic.

### What Is Out of Scope
- Token launch, staking mechanics, or speculative financial gimmicks.
- Universal anonymity or untraceability claims.
- Bypassing 2-of-3 threshold quorum or client-side simulation safeguards.
- Unvetted or unaudited cryptographic proving circuits.

---

## Development Setup

1. **Prerequisites:**
   - [Bun](https://bun.sh) (>= 1.4.0)
   - [Node.js](https://nodejs.org) (>= 20)
   - PostgreSQL (16+)

2. **Clone and Install:**
   ```bash
   git clone https://github.com/notadeveloper7/veilora.git
   cd veilora
   bun install
   cd backend && bun install && cd ..
   ```

3. **Configure Environment:**
   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   ```

4. **Verify Tests:**
   ```bash
   bun run check
   bun run build
   cd backend && bun run check && bun test
   ```

---

## Contribution Workflow

1. **Fork & Branch:** Create a feature branch from `main`:
   ```bash
   git checkout -b feat/describe-your-feature
   ```
2. **One Concern Per PR:** Keep changes focused on a single issue or feature. Avoid bundling refactors with new features.
3. **Tests Required:** Any change affecting intent parsing, balance simulation, policy checks, or database migrations must include automated tests.
4. **Commit Style:** Use imperative, present-tense messages in plain English:
   - `Add simulation check for gas reserve threshold`
   - `Fix migration ordering in backend runner`
   - `Update intent parser to support tokenized stock tickers`
5. **Open a Pull Request:** Describe the proposed changes, the specific plane affected (Control, Privacy, or Execution), and steps to verify locally.

---

## Reporting Issues

If you encounter a bug, open an issue with:
1. **Context:** What action or intent you attempted.
2. **Expected Behavior:** What the simulation or UI should have produced.
3. **Actual Behavior:** Error messages, stack traces, or unexpected state transitions.
4. **Reproduction Steps:** Step-by-step instructions to reproduce the issue.

---

## Security Disclosures

Do **NOT** report potential security vulnerabilities or cryptographic issues via public GitHub issues. Follow the instructions in [SECURITY.md](SECURITY.md) to report privately to our security team.
