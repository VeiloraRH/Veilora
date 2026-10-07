# AGENTS.md — Working Rules for Veilora

## 1. Operating & Interaction Protocol
> [!IMPORTANT]
> **Answer Questions First:**
> Whenever the user asks a question in a prompt, you MUST prioritize addressing and answering it thoroughly **before writing code or running modifications**.
> - If research is needed, perform read-only inspections/studies first, answer the user clearly, and wait for confirmation before executing actions.
> - Never ignore questions or jump straight into autonomous editing when user input or clarification was requested.

## 2. Project Architecture & Monorepo Layout
- **Frontend:** Root TanStack React + Vite + Tailwind CSS deployed to Vercel (`veilorarh.com`).
- **Backend:** `backend/` is a Bun + Express + PostgreSQL service deployed to Render (`api.veilorarh.com`).
- **Contracts:** `contracts/` Foundry workspace for Robinhood Chain (`4663`).
- **Dual-Repo Sync:**
  - Private repo: `origin` (`NotADeveloper7/veilora`, author: `NAD7`).
  - Public repo: `origin-public` (`VeiloraRH/Veilora`, author: `Veilora`).
  - Use `bun run push:origin`, `bun run push:public`, or `bun run push:all`.
