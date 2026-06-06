# CLAUDE.md

> **Read this file at the start of every session.** It tells you what Keepra is, how to work on it, what to never do, and where to find context for the current task.

---

## What Is Keepra

Keepra is a **Programmable Conditional Release** primitive built on Sui + Seal + Walrus. Users encrypt data into "Sealed Vaults" on Walrus; decryption is governed by Move-defined `seal_approve_release` policies on Sui. The platform mathematically cannot decrypt — only on-chain policies can release a vault.

MVP release conditions (OR-composed):

1. **Inactivity** (dead-man switch)
2. **Guardian quorum** (m-of-n attestation)
3. **DAO governance vote**

Target: **A production-ready MVP on Sui + Seal + Walrus.**

For deeper context read [README.md](./README.md), then [Architecture.md](./docs/Architecture.md).

---

## Your Job

You are an AI coding agent helping the team build Keepra over a phased, ~6-week MVP timeline. You work **phase by phase** per [Engineering-Plan.md](./docs/Engineering-Plan.md). Each phase is small, testable, and ends with a git commit when its acceptance criteria pass.

You do not work on multiple phases at once. You do not add features outside the current phase. You finish what is asked, verify it works, commit, then ask for the next task.

---

## Required First Actions (Every Session)

1. **Read this file (CLAUDE.md) — you are doing this now**
2. **Read [Engineering-Plan.md](./docs/Engineering-Plan.md)** to identify the current phase
3. **Read [Repo-Structure.md](./docs/Repo-Structure.md)** if you don't have the file layout in context
4. **Confirm understanding** to the user before writing code:
   > "I'm working on Phase X: [name]. Acceptance criteria: [list]. I will [first action]. OK to proceed?"
5. **Wait for confirmation** before writing code unless the user has explicitly said "go" already

If the user gives you a task that isn't in the Engineering Plan, ask before proceeding — it may be valid (a bug, a docs fix) but should be acknowledged as out-of-plan first.

---

## Required Claude Code Skills

> The `.claude/` folder is **gitignored** (personal per-developer). Each team member must install the skills locally so Claude has the right context when working on this codebase.

### Install once on your machine

In Claude Code, run:

```
/plugin install sui-stack-dev
```

This installs the **sui-stack-dev** plugin which bundles every Sui-related skill we rely on:

| Skill                                  | Used for                                                           |
| -------------------------------------- | ------------------------------------------------------------------ |
| `sui-stack-dev:sui-move-development`   | Writing Move modules, structs, tests, abilities, transfer policies |
| `sui-stack-dev:sui-typescript-sdk`     | `@mysten/sui` SDK usage, PTBs, client setup                        |
| `sui-stack-dev:sui-wallet-integration` | `@mysten/dapp-kit-react`, zkLogin, wallet adapters                 |
| `sui-stack-dev:seal-encryption`        | `@mysten/seal` — encrypt/decrypt flows, `seal_approve_*`           |
| `sui-stack-dev:walrus-storage`         | `@mysten/walrus` — uploads, blob management                        |
| `sui-stack-dev:init-dapp`              | Scaffolding new Sui dApp projects                                  |
| `sui-stack-dev:test-move`              | Move tests with filtering, coverage, gas profiling                 |
| `sui-stack-dev:deploy-contract`        | Interactive Move package deploys to testnet/mainnet                |
| `sui-stack-dev:sui-cli-usage`          | `sui client` commands, keytool, network switching                  |

> If a Move-specific code review skill is needed, also install `move-code-review` separately.

These skills activate automatically when you ask Claude about the matching topic. **Never check `.claude/skills/` into git** — that breaks for everyone else.

---

## How You Work

### Test-First Development

Every new feature follows this loop:

1. Write the failing test first (Move test or Vitest, depending on layer)
2. Show the test failing — run it and paste output
3. Implement the minimum code to make it pass
4. Show the test passing — run it and paste output
5. Refactor if needed
6. Commit

**Do not** write implementation code before writing the test. **Do not** claim a test passes without running it.

### Running Commands

When you need to know if something works, run it. Do not assume.

| Question                         | Command (don't guess; run it)      |
| -------------------------------- | ---------------------------------- |
| "Does the Move package compile?" | `cd move/keepra && sui move build` |
| "Do the Move tests pass?"        | `cd move/keepra && sui move test`  |
| "Does the frontend build?"       | `cd apps/web && pnpm build`        |
| "Do the frontend tests pass?"    | `cd apps/web && pnpm test`         |
| "Does TypeScript type-check?"    | `pnpm typecheck` (from repo root)  |
| "Does the linter pass?"          | `pnpm lint` (from repo root)       |

If the user asks "did the tests pass?" — run them and paste the output. Do not say "they should pass."

### Committing

After every phase's acceptance criteria are met:

```bash
git add <files>
git commit -m "phase-N: <short description>"
```

Use the format `phase-N: <description>`. Examples:

- `phase-1: implement vault.move create_and_seal`
- `phase-4: integrate seal encrypt/decrypt CLI roundtrip`
- `phase-8: build beneficiary claim page`

Do not commit code that doesn't compile or fails tests. Do not commit `node_modules`, `.env` files, or build artifacts.

### Asking Before Big Changes

Before any of these, **ask the user first**:

- Changing the Move package's public API after Phase 5 (it locks in patterns other code depends on)
- Adding a new top-level dependency (new npm package, new SDK)
- Deviating from the file layout in [Repo-Structure.md](./docs/Repo-Structure.md)
- Renaming public types or modules
- Adding a new release condition to `seal_approve_release` (this is a security-sensitive surface)
- Bypassing the installed Sui-Move skill for any Move scaffolding

For small refactors inside one file, scaffolding boilerplate, fixing your own bugs — just do it.

---

## Things You Must Never Do

These are not preferences. They are invariants for this project.

### Security Invariants (from [README.md §6](./README.md#6-hard-invariants))

| #      | Rule                                               | What it means in code                                                                                                               |
| ------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **I1** | Operator cannot decrypt                            | No Keepra-operated Seal key server. No DEK ever sent to backend. No plaintext logged.                                               |
| **I2** | Sealed vaults are immutable                        | `vault::create_and_seal` MUST call `transfer::public_freeze_object(vault)` before returning. No mutable accessor on `Vault` fields. |
| **I3** | Decryption requires `seal_approve_release` success | All release conditions live in this one Move function. No second permissive `seal_approve_*` function.                              |
| **I4** | Only edit is revoke                                | No mutator functions on `Vault`. Only `revoke_vault` on `HeartbeatLog` can change state in a destructive way.                       |
| **I5** | Beneficiary pays zero gas                          | All beneficiary-facing PTBs go through Enoki sponsorship. Never make the beneficiary hold SUI.                                      |
| **I6** | No raw seed phrases by default                     | Wizard detects BIP-39 patterns and warns. (Warning + User Choice in MVP.)                                                           |

If a code change you're about to make would break any of these invariants, **stop and ask the user**. Don't "find a clever way" around them — they're load-bearing.

### Coding Don'ts

- **Never** hardcode the Keepra package ID, key server IDs, or Walrus endpoints. Read from environment variables.
- **Never** `console.log` plaintext, DEKs, session keys, or any cryptographic material — even in dev.
- **Never** call a Seal/Walrus/Sui API you haven't read the docs for. If unsure, `web_fetch` from the official docs (see [TechStack.md §14](./docs/TechStack.md#14-reference-docs-authoritative-sources)).
- **Never** use `any` in TypeScript without an explicit `// FIXME` comment explaining why.
- **Never** use `unwrap()` or `expect()` in Rust code (we don't have Rust yet, but if/when we do).
- **Never** add Move's `public` modifier to functions that should be `entry` or `public(package)`. Check the visibility table in [Contracts.md](./docs/Contracts.md).
- **Never** mark a Move function as `seal_approve_*` unless it follows ALL Seal conventions (see [Architecture.md §5](./docs/Architecture.md#5-seal-flow-the-core-primitive)).
- **Never** skip writing tests because "it's obvious it works."
- **Never** silently swallow errors. If a Seal/Walrus/Sui call can fail, surface it with a clear error code.
- **Never** install new dependencies without asking. We pin versions carefully (see [TechStack.md](./docs/TechStack.md)).
- **Never** assume SDK API shapes. Run `npm view <package>` or inspect `.d.ts` files to verify.

### Scope Don'ts

- **Never** work on Phase N+1 before Phase N is committed.
- **Never** add features documented as "v1" or "v2" in [Roadmap.md](./docs/Roadmap.md) to the MVP.
- **Never** rewrite working code "for cleanup" unless asked.
- **Never** add new oracle types beyond DAO release in the MVP.

---

## Mental Model: How the System Composes

You will be touching many files; here's the one-paragraph mental model:

> A user encrypts a payload **client-side using Seal**, uploads the **ciphertext to Walrus**, and mints a **frozen Sui object** (`Vault`) that points to both the blob and the **release policy**. A mutable sidecar (`HeartbeatLog`) tracks liveness and attestations. To decrypt, anyone constructs a **PTB calling `seal_approve_release`**; **Seal key servers dry-run this PTB**, and if it succeeds, they release **t-of-n IBE key shares**, which the client combines locally to recover the **DEK** and AES-GCM-decrypt the ciphertext. **Keepra operator is never on the critical path** for confidentiality.

When in doubt about how a change interacts with the system, re-read [Architecture.md](./docs/Architecture.md) and [Flows.md](./docs/Flows.md).

---

## Reading Order for Specific Tasks

When you start a phase, the docs to read depend on what you're building:

| Phase task             | Read these (in order)                                                                                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Any Move work**      | [Contracts.md](./docs/Contracts.md), then drive scaffolding through the installed Sui-Move skill                                                                                                         |
| **Seal integration**   | [Architecture.md §5](./docs/Architecture.md#5-seal-flow-the-core-primitive), [Flows.md Flow 6 & 7](./docs/Flows.md#flow-6--beneficiary-claim-the-headline-flow), Seal docs at https://seal-docs.wal.app/ |
| **Walrus integration** | [Architecture.md §6](./docs/Architecture.md#6-walrus-integration), [Flows.md Flow 8](./docs/Flows.md#flow-8--walrus-retrieval-with-fallback-aggregators), Walrus docs at https://docs.wal.app/           |
| **zkLogin / Enoki**    | [Architecture.md §7](./docs/Architecture.md#7-zklogin--enoki-flow), [Frontend.md §7](./docs/Frontend.md#7-zklogin-integration), Enoki docs at https://docs.enoki.mystenlabs.com/                         |
| **Frontend UI**        | [Frontend.md](./docs/Frontend.md), then the specific flow in [Flows.md](./docs/Flows.md)                                                                                                                 |
| **Backend service**    | [Backend.md](./docs/Backend.md), then [Architecture.md §3](./docs/Architecture.md#3-top-level-system-diagram)                                                                                            |
| **DAO release**        | [Oracles.md §2](./docs/Oracles.md#2-the-dao-release-oracle-mvp), [Flows.md Flow 9](./docs/Flows.md#flow-9--dao-release)                                                                                  |
| **Security review**    | [Security.md](./docs/Security.md)                                                                                                                                                                        |

You don't need to re-read all the docs every time. Skim what's relevant; ignore what isn't.

---

## Project Glossary (Just the Critical Terms)

| Term                       | Definition                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| **Vault**                  | Frozen on-chain Sui object representing one sealed payload. Immutable after creation.        |
| **HeartbeatLog**           | Mutable shared object tracking `last_heartbeat_ms`, attestations, `revoked`, `dao_released`. |
| **GuardianCap**            | Owned object granting one guardian the right to call `attest()`.                             |
| **Seal**                   | Mysten's threshold IBE library. Provides `SealClient.encrypt()` and `SealClient.decrypt()`.  |
| **Walrus**                 | Decentralized blob storage. Provides `Blob` Sui objects whose lifetime is governed by Move.  |
| **Enoki**                  | Mysten's zkLogin + sponsored-tx service. Lets beneficiaries sign in with Google.             |
| **PTB**                    | Programmable Transaction Block. Sui's atomic multi-call format.                              |
| **`seal_approve_release`** | The ONE Move function Seal key servers dry-run to check if decryption is permitted.          |
| **DEK**                    | Data Encryption Key. The AES-GCM key Seal protects via IBE-KEM.                              |
| **`backupKey`**            | Optional symmetric key returned at encrypt time, allowing offline decryption. Opt-in only.   |
| **Sealed**                 | State from creation until revocation.                                                        |
| **Triggered**              | State after a release condition is satisfied.                                                |
| **Revoked**                | Owner-initiated permanent destruction of access.                                             |
| **Heartbeat**              | Manual "I'm alive" transaction (MVP). Updates `last_heartbeat_ms`.                           |
| **Inactivity**             | Time since last heartbeat. If > `inactivity_seconds`, release condition is satisfied.        |

Full glossary in [Architecture.md §14](./docs/Architecture.md#14-glossary).

---

## Style Conventions

### TypeScript

- Functional components only in React (no class components)
- `async/await` over `.then().catch()`
- Named exports preferred; default exports only for Next.js pages
- File names: `kebab-case.ts` (e.g., `seal-client.ts`)
- Component file names: `PascalCase.tsx` (e.g., `VaultCard.tsx`)
- Hook file names: `useCamelCase.ts` (e.g., `useVault.ts`)
- No `index.ts` re-export files unless the directory is a public package boundary
- All Keepra-specific types live in `apps/shared/src/types.ts`

### Move

- Module names: `snake_case` (e.g., `dao_release`, not `daoRelease`)
- Struct names: `PascalCase` (e.g., `HeartbeatLog`)
- Function names: `snake_case`
- Error constants: `EPascalCase` (e.g., `ENotOwner`) in `errors.move`
- Visibility: prefer `public(package)` over `public`; use `entry` only when transaction-callable
- Always emit an event after state mutation (see `events.move`)

### Comments

- Code comments explain **why**, not **what** (the code says what)
- Move functions get a docstring explaining their preconditions and postconditions
- Magic numbers get named constants

### Imports

- Sort imports: stdlib → external packages → workspace packages → relative
- Group within each section; one blank line between groups

---

## When You Get Stuck

Stuck means: you've tried something, it didn't work, you don't see why.

1. **Re-read the relevant doc.** 90% of "stuck" is missing context.
2. **Run the failing command and paste full output.** Don't summarize — paste it.
3. **Check the official docs.** Use `web_fetch` against `seal-docs.wal.app`, `docs.wal.app`, `docs.sui.io`, `docs.enoki.mystenlabs.com`.
4. **Look for the same pattern elsewhere in the codebase.** Same SDK call somewhere working?
5. **Surface the blocker to the user.** Don't silently retry the same wrong thing 5 times.

What "surface a blocker" looks like:

> "I'm stuck on Phase 4 Seal integration. `SealClient.decrypt()` returns `InvalidParameter` even though the txBytes look correct. I've tried [X, Y, Z]. The doc at [URL] suggests [W] but [reason it doesn't apply]. Recommend we either [option A] or [option B]."

That's a useful message. "It's not working" is not.

---

## When the User Pushes Back

If the user disagrees with your approach, **listen and adjust**. They have more context than you about:

- Product priorities and what users care about
- The team's existing knowledge
- Past architectural decisions made before this session

If they ask for something that conflicts with these docs, ask for clarification: "I read in [doc] that we wanted X; you're asking for Y. Should I update the doc, or am I misreading?"

If they ask for something that breaks a hard invariant (I1–I6), **say so and ask before doing it**. Those invariants are the product's foundation.

---

## How to Hand Off at End of Session

When the user says "stop" or "let's pick this up later":

1. Make sure all completed work is committed
2. Update [Engineering-Plan.md](./docs/Engineering-Plan.md) — mark phase progress (use a checkbox)
3. If anything is in-progress (not commit-ready), note it in a `WIP.md` file at repo root with:
   - What you were doing
   - What state the files are in
   - What the next step is
4. Brief summary to the user: "Committed: [X]. WIP: [Y]. Next session start with: [Z]."

---

## Reminder: Plan Mode Exists

When the user is about to give you a large task, suggest using Claude Code's Plan Mode (Shift+Tab twice). You'll plan the work without writing code, get user buy-in on the plan, then execute.

Plan mode is best for:

- Starting a new phase
- Refactors touching multiple files
- Anything where "should I do X or Y?" is unclear

Plan mode is not needed for:

- Small bug fixes
- Single-file edits
- Tasks the user has explicitly scoped

---

## Doc Map (Quick Reference)

| Doc                                               | When to read                                               |
| ------------------------------------------------- | ---------------------------------------------------------- |
| [README.md](./README.md)                          | First time on the project; need overall pitch              |
| **CLAUDE.md** (this file)                         | Every session start                                        |
| [Seal-Config.md](./Seal-Config.md)                | Anything touching Seal endpoints / IDs — canonical source  |
| [Engineering-Plan.md](./docs/Engineering-Plan.md) | Every session start; identifies current phase              |
| [Repo-Structure.md](./docs/Repo-Structure.md)     | When creating new files; need to know where they go        |
| [Architecture.md](./docs/Architecture.md)         | Need system-level understanding                            |
| [Flows.md](./docs/Flows.md)                       | Working on a specific user flow                            |
| [Contracts.md](./docs/Contracts.md)               | Move-specific design questions                             |
| [Frontend.md](./docs/Frontend.md)                 | Frontend work                                              |
| [Backend.md](./docs/Backend.md)                   | Backend work                                               |
| [Oracles.md](./docs/Oracles.md)                   | DAO release or future oracle questions                     |
| [Security.md](./docs/Security.md)                 | Threat-model questions; when touching crypto               |
| [TechStack.md](./docs/TechStack.md)               | SDK questions; pinning versions; endpoint URLs             |
| [Roadmap.md](./docs/Roadmap.md)                   | "Is this MVP or v1?"                                       |
| `internal/` (gitignored)                          | Team-private planning notes                                |
| `internal/METRICS.md` (gitignored)                | KPIs per phase; what we measure — team-private             |
| `internal/COMPETITION.md` (gitignored)            | Competitive positioning; pitch battle cards — team-private |

---

## Final Note

You are working with a senior team. Abdelrahman is an experienced blockchain dev (Sui, EVM, ICP backgrounds). The other 3 engineers are similarly experienced. **Treat them as peers, not as juniors.** They will catch your mistakes; they will push back; they don't need long explanations of basics. But they also rely on you to:

- Not make things up
- Verify before claiming
- Read the docs before asking
- Stay in scope

That's the bar.

Now go read [Engineering-Plan.md](./docs/Engineering-Plan.md) and confirm the current phase before doing anything else.
