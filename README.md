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
- **Legacy pool notice:** An early prototype pool contract remains deployed on-chain and cannot be deleted or upgraded. The application and backend do not interface with it. Users must never send funds to that contract.
- **Threshold trust model:** Each account requires 2-of-3 signatures to execute. Shard A is client-held and encrypted in browser storage. Shard B is backend-held and encrypted at rest with AES-256-GCM. Shard C is an offline recovery key controlled solely by the user. Neither the user alone (without Shard C) nor the backend alone can move funds.
- **Backend co-signer enforcement:** Shard B only co-signs transactions authorized by an active Shard A signature that conform to strict policy: allowlisted targets (native transfers, registered tokens, and verified Uniswap v3/v4 routers), a rolling daily spend limit (capped at 20% of account balance), and an unexpired deadline (<= 5 minutes). All arbitrary contract interactions are denied.
- **Sponsored relayer limits:** Registration is limited to 20 requests per IP per hour across backend replicas; only a keyed hash of the IP is stored. Sponsored deployments also have a shared daily budget (`RELAYER_DAILY_DEPLOYMENT_LIMIT`, default 10). Signed registration request IDs prevent replay.

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

The current factory is `0xF86BEA538EA756048F8DF9BE4BCD88AEB4D65376` on Robinhood Chain 4663. Configure `VEILORA_FACTORY_ADDRESS` to this value in the production backend; USDG is configured through `USDG_TOKEN_ADDRESS`. The deployment script reads `RELAYER_PRIVATE_KEY` from `backend/.env`, checks for chain ID 4663, and does not print the RPC URL or private key. Existing account addresses depend on their original factory, so keep the original factory address available for accounts that have not yet deployed.

### Liege threshold escrow contracts

`VeiloraEscrowFactory` is the deployed V1 factory. Its immutable escrows preserve the original 2-of-3 outcome policy for existing jobs. `VeiloraEscrowFactoryV2` adds a separate version for new jobs: after provider submission, a refund requires the evaluator plus one other outcome signer, and settlement signatures bind to the submitted deliverable commitment. The provider’s submission signature also covers that exact commitment. V2 requires distinct client, provider, evaluator, and Liege signer addresses. The V2 factory is deployed at `0x81E05B0Ee0229ac62ED4e3bc9242aa0b9Ac0830E` on Robinhood Chain 4663 (transaction `0xd0c3ebda36105dd31df57211561721db18f65fcdeda9c3790b54b1d8a7703b17`); V1 jobs and escrows are not migrated. The Liege backend must still select V2 for new jobs before the protection is live in production. Veilora smart-account parties can record an outcome approval through `approveOutcome`; Shard B only co-signs that selector when the target is registered by the configured factory.

The contracts are compiled by `bun run compile:contracts`; the V1 factory deploy command is `bun run deploy:escrow`, and V2 can be deployed with `bun run deploy:escrow:v2`. Each command writes deployment metadata to `contracts/deployed.json`. Enable V2 jobs only after the Liege backend selects the deployed V2 factory for new V2 terms while retaining V1 support for existing jobs. See [Liege's V2 escrow integration handoff](https://github.com/LiegeAgents/LiegeAgentsApp/blob/main/docs/VEILORA-ESCROW-V2.md) for the required backend changes. Existing Liege jobs and the legacy per-job EOA escrow are not migrated.

Run database migrations in the production deployment environment before serving the updated backend. Migration `004` drops obsolete, unimplemented privacy tables; migrations `005`–`007` add registration replay protection, a sponsored deployment budget, daily co-sign limits, and per-wallet factory versioning; migration `008` enables shared registration rate limits without storing raw IP addresses. The local `backend/.env` may point to production: do not run `bun run db:migrate` locally unless `DATABASE_URL` has first been verified to target a disposable or intended database.
