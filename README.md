# Veilora

[![CI](https://github.com/notadeveloper7/veilora/actions/workflows/backend.yml/badge.svg)](https://github.com/notadeveloper7/veilora/actions/workflows/backend.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-1.x-000000?logo=bun&logoColor=white)
![TanStack](https://img.shields.io/badge/TanStack-React-FF4154?logo=react&logoColor=white)
![Robinhood Chain](https://img.shields.io/badge/Robinhood_Chain-4663-00C805?logo=ethereum&logoColor=white)

> **Move quietly. Stay in control.**

Veilora is a private financial operating layer for Robinhood Chain (Chain ID `4663`) and compatible networks. It bridges threshold self-custody (2-of-3 MPC quorum), intent-based planning, and local-first balance simulations with shielded DeFi execution, selective disclosure view keys, and clean-provenance (PPOI) proofs into an explainable control loop with no single point of signing authority.

---

## Architecture: Three Planes

| Plane | Core Responsibility | Key Components |
|---|---|---|
| **Control Plane** | *"What do I want to happen?"* | Intent Console, Simulation & Quote Engine, Policy & Guardrails, 2-of-3 Quorum Outbox, Local Audit Trail |
| **Privacy Plane** | *"Who can see what?"* | Shielded UTXO Notes, Join-split Commitments, Clean-Provenance Proofs, Scoped View Keys |
| **Execution Plane** | *"How does it settle?"* | Robinhood Chain Adapter, ERC-4337 Account Abstraction, Uniswap V3 Swaps, Morpho Lending, Broadcaster Network |

---

## Core Capabilities

| Capability | Specification | Guarantee |
|---|---|---|
| **Threshold Custody** | 2-of-3 Shard Quorum (Shard A: Device, Shard B: Policy Co-signer, Shard C: Passkey) | No unilateral fund movements or single points of failure |
| **Intent Normalization** | Natural language to structured simulation diffs | Clear before-and-after state preview before signing |
| **Shielded Operations** | UTXO-style private notes & join-split circuits | Protects balance exposure and transactional counterparties |
| **Clean Provenance** | Association-set proofs of innocence (PPOI) | Validates clean history without publishing user books |
| **Selective Disclosure** | Scoped, time-limited, and revocable view keys | Granular disclosure for counterparty, tax, or audit compliance |
| **Safe Unshielding** | Deterministic timeout, destination verification & refund state machine | Eliminates stranded-fund risk if proof providers delay |

---

## Execution Pipeline

```text
1. Express Intent  --> "Buy 500 USDG of NVDA exposure and keep it shielded"
2. Local Parse     --> Verify supported tokens, routes, and reserve policies
3. Simulation      --> Compute public diff, expected note commitment, and gas reserve
4. Policy Gate     --> Validate max slippage / fee ceiling (<0.75%) and provenance
5. Quorum Auth     --> Collect threshold signatures (Shard A + Shard B)
6. Atomic Settle   --> Broadcaster executes on Robinhood Chain (ERC-4337 / DEX)
7. Audit Receipt   --> Local encrypted receipt generated with proof state & commitment
```

---

## API Endpoints

The backend provides HTTP endpoints for status monitoring, simulation, and outbox orchestration:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health, ISO timestamp, and version metadata |
| `POST` | `/v1/intent/simulate` | Simulates public/shielded balance diffs and fee quotes |
| `POST` | `/v1/policies/evaluate` | Evaluates plan against active guardrails and fee ceilings |
| `POST` | `/v1/outbox/authorize` | Submits threshold signature shares for 2-of-3 execution |
| `GET` | `/v1/adapters/status` | Current capability declarations for Robinhood Chain |

---

## Repository Structure

```text
veilora/
├── .github/workflows/
│   └── backend.yml           # CI: test, GHCR build/push, release, Render deploy
├── backend/                  # Bun + Express + PostgreSQL service
│   ├── db/migrations/        # SQL migrations (001_initial.sql)
│   ├── src/
│   │   ├── db/               # pg.Pool connection & transaction migration runner
│   │   ├── routes/           # Express routes (/health)
│   │   ├── app.ts            # App configuration & middleware
│   │   └── index.ts          # Server entrypoint
│   ├── tests/                # Bun test suite with supertest
│   ├── Dockerfile            # Container build for deployment
│   └── package.json
├── contracts/                # Smart contracts scaffold (Robinhood Chain)
├── src/                      # TanStack React frontend
│   ├── components/ui/        # Reusable interface components
│   ├── lib/                  # Utilities (cn, helpers)
│   ├── routes/               # File-based TanStack Router pages
│   │   ├── __root.tsx        # Navigation shell
│   │   └── index.tsx         # Intent Simulator landing experience
│   ├── main.tsx              # React DOM entry
│   └── router.tsx            # TanStack Router instance
├── technical-docs/           # Product specifications & architectural PDFs
├── vercel.json               # Vercel deployment configuration
├── vite.config.ts            # Vite + TanStack Router + Tailwind configuration
└── package.json              # Monorepo root scripts & frontend dependencies
```

---

## Getting Started

### Prerequisites
- [Bun](https://bun.sh) (>= 1.4.0)
- [Node.js](https://nodejs.org) (>= 20)
- PostgreSQL (local instance or Supabase)

### 1. Installation

```bash
# Clone repository
git clone https://github.com/notadeveloper7/veilora.git
cd veilora

# Install frontend dependencies
bun install

# Install backend dependencies
cd backend && bun install && cd ..
```

### 2. Environment Setup

```bash
# Frontend environment
cp .env.example .env

# Backend environment
cp backend/.env.example backend/.env
```

### 3. Development

```bash
# Run TanStack React frontend (http://localhost:5173)
bun run dev

# Run backend API in watch mode (http://localhost:3001)
bun run backend:dev
```

### 4. Running Tests & Type Checks

```bash
# Run frontend typecheck & build
bun run check
bun run build

# Run backend test suite
bun run test
```

---

## Phased Roadmap

- [x] **Gate 1 — Trustworthy Control Core:** 2-of-3 threshold custody architecture, intent console, simulation engine, policy guardrails, and audit receipts.
- [ ] **Gate 2 — Shielded Payments:** Private notes and clean-provenance (PPOI) proof integration for USDG on Robinhood Chain.
- [ ] **Gate 3 — Shielded DeFi Recipes:** Composable recipes (shield → swap → note commit) with broadcaster failover and atomic execution.
- [ ] **Gate 4 — Tokenized-Stock Differentiation:** Shielded equity exposure (e.g., NVDA exposure) with corporate-action handling and compliance proofs.
- [ ] **Gate 5 — Multichain Privacy:** Extend execution plane beyond Robinhood Chain with explicit per-chain privacy declarations.

---

## Tech Stack

- **Frontend:** TanStack React, TanStack Router, TanStack Query, Tailwind CSS, Vite
- **Backend:** TypeScript, Bun, Express, PostgreSQL (`pg`)
- **Hosting:** Vercel (Frontend), Render / GHCR (Backend)
- **Primary Chain:** Robinhood Chain (`4663`)

---

## License

[MIT](LICENSE) © 2026 Veilora
