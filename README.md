# Veilora

Veilora is a threshold self-custody wallet for Robinhood Chain (chain ID 4663). The current app focuses on balances, send, receive, token swaps, and transaction history.

## Current capabilities

- **2-of-3 account authorization.** Shard A is encrypted on the user's device, Shard B is held by the backend in authenticated ciphertext, and Shard C is exported during onboarding for offline recovery.
- **Send and receive.** Transactions use the account's threshold execution path. Receive displays the public account address and QR code.
- **Swap.** The wallet compares available Uniswap v3 and v4 quotes and submits the selected route after device authorization.
- **Activity.** Transaction history is fetched from the configured Blockscout API with pagination and filtering in the client.
- **Account controls.** Disconnect requires a Shard A signature and clears local wallet data; freeze and unfreeze require fresh Shard A signatures.

## Trust boundaries and security limits

- **No privacy or zero-knowledge guarantees:** Veilora currently has no ZK circuit, SNARK prover, or on-chain verifier. All transactions, token balances, and account activities are transparent and public on Robinhood Chain (EVM 4663). Shielded UTXOs, private notes, and selective-disclosure proofs are not supported.
- **Legacy pool notice:** An early prototype pool contract remains deployed on-chain and cannot be deleted or upgraded. The application and backend do not interface with it, and it holds zero USDG. Users must never send funds to that contract.
- **Threshold trust model:** Each account requires 2-of-3 signatures to execute. Shard A is client-held and encrypted in browser storage. Shard B is backend-held and encrypted at rest with AES-256-GCM. Shard C is an offline recovery key controlled solely by the user. Neither the user alone (without Shard C) nor the backend alone can move funds.
- **Backend co-signer enforcement:** Shard B only co-signs transactions authorized by an active Shard A signature that conform to strict policy: allowlisted targets (native transfers, registered tokens, and verified Uniswap v3/v4 routers), a rolling daily spend limit (capped at 20% of account balance), and an unexpired deadline (<= 5 minutes). All arbitrary contract interactions are denied.
- **Sponsored relayer limits:** Relayed deployments are bounded by per-IP rate limits (20/hour) and a strict daily budget (`RELAYER_DAILY_DEPLOYMENT_LIMIT`, default 10). Replay protection enforces unique signed registration requests.

## Repository layout

- `src/` — React 19, TanStack Router, Vite, Tailwind CSS v4 wallet frontend.
- `backend/` — Bun, Express, and PostgreSQL API for wallet registration, co-signing, signed account controls, relaying, and transaction history.
- `contracts/` — Solidity account and CREATE2 factory contracts with Foundry tests.

## Development

Run from the repository root:

```sh
bun install --frozen-lockfile
bun run dev
bun run check
bun run build
bun test
bun run compile:contracts
```

Backend development runs separately:

```sh
cd backend
bun install --frozen-lockfile
bun run db:migrate
bun run dev
```

The backend requires `DATABASE_URL`, a Robinhood Chain RPC URL, and `SHARD_B_ENCRYPTION_KEY` (at least 32 bytes of secret material). `CO_SIGNER_SHARD_B_SECRET` remains supported for existing encrypted records during key migration. Sponsored account deployment also requires `RELAYER_PRIVATE_KEY`; daily deployments are capped by `RELAYER_DAILY_DEPLOYMENT_LIMIT`.

## Deployment

The factory address is configured through `VEILORA_FACTORY_ADDRESS`; USDG is configured through `USDG_TOKEN_ADDRESS`. The deployment script reads `RELAYER_PRIVATE_KEY` from `backend/.env`, checks for chain ID 4663, and does not print the RPC URL or private key. Existing account addresses depend on their original factory, so keep the original factory address available for accounts that have not yet deployed.

Run database migrations before serving the updated backend. Migration `004` removes the unused shielded-note and disclosure scaffolding; migrations `005`–`007` add registration replay protection, a sponsored deployment budget, daily co-sign limits, and per-wallet factory versioning.
