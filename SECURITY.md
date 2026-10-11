# Security Policy

Veilora is a self-custody wallet for Robinhood Chain (chain ID `4663`). The current application supports transparent on-chain wallet operations. It does not provide zero-knowledge shielding, private notes, provenance proofs, or selective disclosure.

## Reporting a Vulnerability

Please do not disclose vulnerabilities publicly before coordinating a fix. Report them to **security@veilorarh.com** with:

- A description and reproduction steps or proof of concept.
- The affected component and potential impact.
- Any relevant transaction hashes, addresses, or logs, with secrets removed.

We aim to acknowledge reports within 48 hours, provide an initial assessment within 72 hours, and coordinate disclosure after a fix is available. These are response targets, not guarantees.

## In Scope

- Smart-account authorization, signature validation, and replay protection.
- Backend co-signing policies, wallet registration, relaying, and API authentication.
- Device-key encryption, recovery flows, and sensitive data handling.
- Transaction construction, recipient validation, token handling, and swap routing.
- Wallet history and balance data integrity.

## Out of Scope

- Social engineering or compromise of a user's device outside Veilora's code.
- Vulnerabilities in Robinhood Chain, token issuers, or other upstream services.
- Denial of service against infrastructure where no security boundary is crossed.

## Current Trust Boundaries

- On-chain balances and transactions are public and transparent.
- Shard A is stored encrypted in the user's browser; Shard B is encrypted at rest by the backend; Shard C is intended for offline user recovery.
- The backend co-signer applies transaction allowlists and spend limits. This is an additional policy boundary, not a substitute for reviewing and authorizing transactions with the user's device key.
- A prototype shielded-pool contract from an earlier version remains deployed and cannot be removed. The current application does not call it. Do not send funds to it.

## Deployed Factory

The current Veilora factory is deployed on Robinhood Chain (`4663`) at `0xF86BEA538EA756048F8DF9BE4BCD88AEB4D65376`. Existing wallets may still depend on the previous factory at `0x210f310f150c0df3224d61ca7dcaf3e1ad578bd7`.
