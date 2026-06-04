# Engineering Plan

> Phase-by-phase execution plan for the Keepra MVP. Each phase has: scope, exact files to touch, acceptance criteria, and a verify command. Phases are sequential — finish phase N before starting N+1. Phases compose so that after each, **the system works end-to-end up to that phase**.

> **For Claude Code**: read this file at the start of every session. Identify the current phase (the first one not marked ✅). Confirm with the user before starting.

---

## Phase Progress Tracker

| Phase | Owner | Days | Status | Commit |
|---|---|---|---|---|
| 0. Setup & CI | E4 | 1 | ✅ Done — added `internal/` for private docs (gitignored); `.claude/` gitignored | — |
| 1. Move skeleton | E1 | 2 | ✅ Done — dropped `errors.move` (inlined per module); `public fun` instead of `public entry` (Move 2024 lint) | — |
| 2. Heartbeat | E1 | 1 | ✅ Done — `revoke_vault` takes `&Clock` (spec called non-existent `current_time_ms` helper) | — |
| 3. Guardian | E1 | 2 | ✅ Done — `mint_and_transfer` combines mint+transfer (spec's pattern fails to compile since GuardianCap lacks `store`) | — |
| 4. Seal integration (CLI) | E2 | 3 | ⬜ Not started | — |
| **5. Walrus integration (CUTOFF)** | E2 | 2 | ⬜ Not started | — |
| 6. zkLogin + Enoki setup | E3 | 3 | ⬜ Not started | — |
| 7. Vault creation UI | E3 | 4 | ⬜ Not started | — |
| 8. Beneficiary claim page | E3 | 4 | ⬜ Not started | — |
| 9. Heartbeat dashboard | E3 | 2 | ⬜ Not started | — |
| 10. Notification daemon | E4 | 3 | ⬜ Not started | — |
| 11. Enoki sponsorship | E2 | 2 | ⬜ Not started | — |
| 12. Immutability hardening | E1 | 2 | ⬜ Not started | — |
| 13. DAO release flow | E1+E2 | 4 | ⬜ Not started | — |
| 14. Demo polish + video | all | 3 | ⬜ Not started | — |
| 15. Walrus Sites (stretch) | E4 | 1 | ⬜ Not started | — |

Total: ~37 dev-days across 4 engineers = ~10 calendar days with parallelism. 6-week timeline absorbs slippage.

---

## Phase 0 — Setup & CI

**Goal:** Working dev environment. CI runs on every PR. Everyone can clone and `pnpm dev`.

### Tasks

1. Initialize pnpm workspaces monorepo per [Repo-Structure.md](./Repo-Structure.md)
2. Set up TypeScript strict mode at repo root (`tsconfig.base.json`)
3. Configure ESLint + Prettier (shared configs in `tooling/`)
4. Install Sui CLI:
   - **macOS:** `brew install sui`
   - **Linux / Debian / WSL** (stream-extract just the `sui` binary to avoid filling `/tmp`):
     ```bash
     mkdir -p ~/.local/bin
     SUI_URL=$(curl -fsSL https://api.github.com/repos/MystenLabs/sui/releases/latest \
       | grep -oP '"browser_download_url":\s*"\K[^"]+' \
       | grep 'ubuntu-x86_64.tgz$')
     curl -fsSL "$SUI_URL" | tar xz -C ~/.local/bin/ ./sui
     chmod +x ~/.local/bin/sui
     sui --version
     ```
     Make sure `~/.local/bin` is in your `PATH`.
   - **Other platforms:** https://docs.sui.io
5. Create empty Move package at `move/keepra/` (just `Move.toml`)
6. Create empty Next.js 15 app at `apps/web/` with App Router
7. Create empty Fastify app at `apps/api/`
8. Set up GitHub Actions: `ci.yml` (lint, type-check, build), `move-test.yml`
9. Add `.env.example` files for both `apps/web` and `apps/api`
10. Add Husky pre-commit hook for lint + format

### Files to create

```
.github/workflows/ci.yml
.github/workflows/move-test.yml
.gitignore
.nvmrc                     # node 20
package.json               # root, with workspaces config
pnpm-workspace.yaml
tooling/eslint-config/...
tooling/tsconfig/base.json
move/keepra/Move.toml
apps/web/package.json
apps/web/next.config.ts
apps/web/tsconfig.json
apps/web/app/page.tsx      # placeholder landing
apps/api/package.json
apps/api/src/index.ts      # health check only
apps/shared/package.json
apps/shared/src/types.ts   # empty placeholder
.env.example
.husky/pre-commit
```

### Acceptance criteria

- [ ] `pnpm install` succeeds with no warnings
- [ ] `pnpm lint` passes (no rules yet, just config)
- [ ] `pnpm typecheck` passes for all workspaces
- [ ] `pnpm --filter @keepra/web build` succeeds
- [ ] `pnpm --filter @keepra/api build` succeeds
- [ ] `sui --version` runs (Sui CLI installed)
- [ ] `cd move/keepra && sui move build` succeeds (empty package compiles)
- [ ] GitHub Actions green on first PR
- [ ] `apps/web/.env.local` and `apps/api/.env` both have `.env.example` templates

### Verify command

```bash
pnpm install && pnpm lint && pnpm typecheck && pnpm -r build && cd move/keepra && sui move build
```

### Commit

```
phase-0: setup monorepo, CI, dev tooling
```

---

## Phase 1 — Move Skeleton (Vault module)

**Goal:** Vault and HeartbeatLog Move structs compile. `create_and_seal` mints a frozen Vault + shared HeartbeatLog. Tests pass.

### Tasks

> Use the installed Sui-Move skill to scaffold each module. Do **not** vibe-code Move from scratch — let the skill generate the boilerplate from the structs in [Contracts.md](./Contracts.md), then refine.

1. Scaffold `move/keepra/sources/vault.move` (Vault struct + `create_and_seal`)
2. Scaffold `move/keepra/sources/heartbeat.move` (HeartbeatLog struct + accessors)
3. Scaffold `move/keepra/sources/events.move` and `errors.move`
4. Implement `vault::create_and_seal` with:
   - Input validation
   - HeartbeatLog minting (shared object)
   - Vault minting + `transfer::public_freeze_object(vault)`
   - `VaultCreated` event emission
5. Write `tests/vault_tests.move`:
   - `test_create_and_seal_happy_path` — creates a vault, asserts frozen state
   - `test_create_and_seal_zero_quorum_fails` — should abort with `EInvalidQuorum`
   - `test_create_and_seal_quorum_exceeds_set_fails` — abort with `EQuorumExceedsSet`
   - `test_create_and_seal_zero_inactivity_fails` — abort with `EInvalidInactivity`

### Files to create

```
move/keepra/sources/vault.move
move/keepra/sources/heartbeat.move
move/keepra/sources/events.move
move/keepra/sources/errors.move
move/keepra/tests/vault_tests.move
```

### Acceptance criteria

- [ ] `sui move build` succeeds with no warnings
- [ ] `sui move test` passes for all 4 vault tests
- [ ] Vault has no public mutator functions on its fields
- [ ] `create_and_seal` ends with `transfer::public_freeze_object`
- [ ] `VaultCreated` event includes vault_id, owner, blob_id, heartbeat_log_id, created_at_ms

### Verify command

```bash
cd move/keepra && sui move build && sui move test
```

### Notes

- Drive Move generation through the Sui-Move skill; the struct shapes in [Contracts.md](./Contracts.md) are the canonical spec
- For test addresses, use `@0xA`, `@0xB`, `@0xC`
- Use `sui::test_scenario` patterns; ask the skill for current Sui framework testing idioms

### Commit

```
phase-1: implement vault.move with create_and_seal + tests
```

---

## Phase 2 — Heartbeat

**Goal:** Owner can call `heartbeat()` to reset the inactivity timer. Non-owners get rejected. Revoked vaults reject heartbeats.

### Tasks

1. Implement `heartbeat::heartbeat(log, clock, ctx)` entry function
2. Implement `vault::revoke_vault(log, ctx)` entry function
3. Add accessor functions on HeartbeatLog (read-only)
4. Write `tests/heartbeat_tests.move`:
   - `test_heartbeat_updates_timestamp`
   - `test_heartbeat_not_owner_fails` — abort `ENotOwner`
   - `test_heartbeat_on_revoked_fails` — abort `EVaultRevoked`
   - `test_revoke_then_heartbeat_fails`
   - `test_revoke_twice_is_no_op` (or aborts; document the choice)

### Files to touch

```
move/keepra/sources/heartbeat.move    (modify)
move/keepra/sources/vault.move        (add revoke_vault)
move/keepra/tests/heartbeat_tests.move (new)
```

### Acceptance criteria

- [ ] `sui move test` all heartbeat tests pass
- [ ] Owner check uses `tx_context::sender(ctx) == log.owner`
- [ ] `Heartbeat` event emitted on successful call
- [ ] `VaultRevoked` event emitted on successful revoke
- [ ] HeartbeatLog accessors are `public fun` (read-only) and setters are `public(package)` only

### Verify command

```bash
cd move/keepra && sui move test --filter heartbeat
```

### Commit

```
phase-2: implement heartbeat + revoke_vault with tests
```

---

## Phase 3 — Guardian

**Goal:** Guardians can attest to a vault. Attestations are idempotent per-address. Non-guardians cannot attest.

### Tasks

1. Implement `guardian::mint_cap` (package-visibility)
2. Implement `guardian::attest(cap, log, clock, ctx)` entry function
3. Wire `mint_cap` into `vault::create_and_seal` — one cap per guardian, transferred to a holding address
4. Add `HeartbeatLog::add_attestation` (package-visibility setter)
5. Write `tests/guardian_tests.move`:
   - `test_attest_happy_path`
   - `test_attest_not_cap_owner_fails`
   - `test_attest_wrong_vault_cap_fails`
   - `test_attest_idempotent` — calling twice from same guardian doesn't double-count
   - `test_attest_on_revoked_fails`

### Files to touch

```
move/keepra/sources/guardian.move     (new)
move/keepra/sources/vault.move        (add mint loop in create_and_seal)
move/keepra/sources/heartbeat.move    (add_attestation setter)
move/keepra/tests/guardian_tests.move (new)
```

### Acceptance criteria

- [ ] `sui move test` all guardian tests pass
- [ ] `GuardianCap` has `key` ability only (no `store`) — prevents indirect transfer
- [ ] `attest` checks `cap.guardian == sender`
- [ ] `attest` checks `cap.vault_id == log.vault_id`
- [ ] Duplicate attest is a no-op (vector dedups on address)
- [ ] `GuardianAttested` event emitted

### Verify command

```bash
cd move/keepra && sui move test --filter guardian
```

### Commit

```
phase-3: implement guardian module + attest with tests
```

---

## Phase 4 — Seal Integration (CLI roundtrip)

**Goal:** A Node.js CLI script encrypts a string, posts an approval PTB, decrypts back, and matches byte-for-byte. This is the **first end-to-end cryptographic test**.

### Tasks

1. Implement `policy::seal_approve_release` Move function — the heart of the system
2. Write `tests/policy_tests.move` — Move-level tests for each release condition
3. Publish the Move package to Sui testnet (record the package ID)
4. Configure Seal client — **Simple config** (Committee server only, `threshold: 1`) per [Seal-Config.md §5](../Seal-Config.md#5-recommended-client-config). Phase 7 onward switches to Hybrid (Committee + 2 independents).
5. Build CLI script at `tools/seal-roundtrip/index.ts`:
   - Connect to Sui testnet
   - `SealClient.encrypt(plaintext, packageId, vault_uid_bytes)` → ciphertext + backupKey
   - `vault::create_and_seal` PTB → on-chain Vault + HeartbeatLog
   - Advance clock past inactivity (testnet workaround: short inactivity window like 60s)
   - `SessionKey.create` → sign
   - Build approval PTB calling `seal_approve_release`
   - `SealClient.decrypt(ciphertext, sessionKey, txBytes)` → plaintext
   - Assert `plaintext === originalPlaintext`

### Files to create

```
move/keepra/sources/policy.move
move/keepra/tests/policy_tests.move
tools/seal-roundtrip/package.json
tools/seal-roundtrip/index.ts
tools/seal-roundtrip/.env.example
```

### Acceptance criteria

- [ ] `sui move test` passes including new policy tests
- [ ] Keepra package published to testnet; package ID recorded in `.env` files
- [ ] `pnpm --filter seal-roundtrip start` outputs: `✓ Encrypted → ✓ Sealed on-chain → ✓ Waiting for inactivity → ✓ Decrypted → ✓ Plaintext matches`
- [ ] Move-level test exists for each: inactivity-only, quorum-only, neither (should fail), revoked (should fail), DAO-released-only
- [ ] `seal_approve_release` is `entry fun`, not `public fun`
- [ ] First parameter is `id: vector<u8>` (Seal requirement)
- [ ] Identity binding asserted: `assert!(id == bcs::to_bytes(&object::id(vault)), ENoAccess);`

### Verify command

```bash
cd move/keepra && sui move test && cd ../../tools/seal-roundtrip && pnpm start
```

### Critical implementation notes

- The IBE identity passed to `SealClient.encrypt` MUST be `bcs::to_bytes(&object::id(vault))`. If you guess at the format it will not match what `seal_approve_release` checks.
- The approval PTB is built with `tx.build({ client, onlyTransactionKind: true })` — NOT a normal executable transaction. It's serialized for the key servers to dry-run.
- Use `verifyKeyServers: true` when constructing `SealClient` — protects against impersonation.
- SDK API shape may have shifted; verify by inspecting `node_modules/@mysten/seal/dist/*.d.ts` before assuming method names.

### Commit

```
phase-4: implement seal_approve_release + end-to-end CLI roundtrip
```

---

## Phase 5 — Walrus Integration (MVP CUTOFF)

**Goal:** Ciphertext lives on Walrus, not just in memory. End-to-end: encrypt → Walrus upload → Walrus download → decrypt. **This is the minimum viable product.**

### Tasks

1. Extend the CLI roundtrip to upload ciphertext to Walrus after encryption
2. Store the returned `blob_id` in the Vault on-chain
3. Fetch ciphertext from Walrus aggregator before decryption
4. Add aggregator fallback list (3 fallback aggregators per [Flows.md Flow 8](./Flows.md#flow-8--walrus-retrieval-with-fallback-aggregators))
5. Verify byte equality after retrieval (Walrus stores integrity-checked blobs)

### Files to touch

```
tools/seal-roundtrip/index.ts          (extend)
apps/shared/src/walrus-client.ts       (new — reusable Walrus wrapper)
apps/shared/src/config.ts              (new — endpoint config)
```

### Acceptance criteria

- [ ] `pnpm --filter seal-roundtrip start` now shows: `✓ Encrypted → ✓ Uploaded to Walrus → ✓ Sealed on-chain → ✓ Fetched from Walrus → ✓ Decrypted → ✓ Plaintext matches`
- [ ] Ciphertext bytes uploaded to Walrus match bytes fetched from aggregator (sha256 check)
- [ ] Aggregator fallback works: if primary returns 5xx/timeout, retry with next
- [ ] Walrus `Blob` object ID is also recorded on-chain (for blob-extension in Phase 9)

### Verify command

```bash
cd tools/seal-roundtrip && pnpm start
```

### Notes

- Walrus testnet may be wiped periodically. Document the testnet endpoint version in `tools/seal-roundtrip/README.md`.
- For now, upload with `epochs: 5` (~70 days at 14-day epochs). Enough for hackathon timeline.
- Use the HTTP API (`PUT /v1/blobs?epochs=5`) for upload — simpler than full SDK for the CLI.

### Commit

```
phase-5: integrate Walrus storage end-to-end — MVP CUTOFF
```

---

## Phase 6 — zkLogin + Enoki Setup

**Goal:** A user can click "Sign in with Google" on the frontend and end up with a Sui address.

### Tasks

1. Create Enoki project; configure Google OAuth client; record API keys in `.env`
2. Wire `registerEnokiWallets()` into `apps/web/app/providers.tsx`
3. Configure `WalletProvider` from `@mysten/dapp-kit`
4. Add `<ConnectButton />` to the navbar
5. Show the connected address in a corner badge
6. Write Playwright test `e2e/zklogin.spec.ts` that:
   - Loads the page
   - Clicks "Sign in with Google"
   - Mocks the OAuth response (Playwright fixtures)
   - Verifies an address appears

### Files to create/touch

```
apps/web/app/providers.tsx                (new)
apps/web/app/layout.tsx                   (wrap with providers)
apps/web/components/wallet/ConnectButton.tsx (new)
apps/web/components/wallet/AddressBadge.tsx  (new)
apps/web/e2e/zklogin.spec.ts              (new)
apps/web/.env.local                       (add Enoki keys)
```

### Acceptance criteria

- [ ] `pnpm --filter web dev` starts on localhost:3000
- [ ] Clicking "Sign in with Google" opens real OAuth popup on testnet
- [ ] After sign-in, the connected Sui address is visible in the UI
- [ ] Refreshing the page preserves the session
- [ ] Playwright test passes (with mocked OAuth)
- [ ] No console errors

### Verify command

```bash
cd apps/web && pnpm dev          # manual smoke
cd apps/web && pnpm test:e2e     # automated
```

### Notes

- Apple OAuth requires Apple Developer account ($99/yr). Skip for MVP; Google only.
- The Enoki testnet network is shared across all apps; use a unique app name to avoid collisions.

### Commit

```
phase-6: integrate Enoki zkLogin with Google sign-in
```

---

## Phase 7 — Vault Creation UI

**Goal:** A real user can complete the 5-step wizard and end up with a sealed vault on testnet.

### Tasks

1. Build the `/create` page with the 5-step wizard per [Frontend.md §3.2](./Frontend.md#32-vault-creation-wizard-create)
2. Implement client-side Seal encryption in a Web Worker
3. Implement Walrus upload (using `apps/shared/src/walrus-client.ts` from Phase 5)
4. Build the `create_and_seal` PTB and submit via the user's wallet
5. After success, redirect to `/dashboard` (placeholder OK for now)
6. Implement BIP-39 pattern detection in `PayloadComposer` (Warning + User Choice for seed phrases per [Security.md §7](./Security.md#7-why-we-dont-store-raw-seed-phrases-directly))
7. Show progress UI during each phase (encrypt → upload → seal)

### Files to create/touch

```
apps/web/app/(app)/create/page.tsx
apps/web/components/vault/PolicyBuilder.tsx
apps/web/components/vault/GuardianList.tsx
apps/web/components/vault/ConditionPreview.tsx
apps/web/components/upload/FileDropzone.tsx
apps/web/components/upload/EncryptionProgress.tsx
apps/web/components/upload/PayloadComposer.tsx
apps/web/lib/seal.ts                     # SealClient wrapper
apps/web/lib/walrus.ts                   # Walrus uploader
apps/web/lib/sui.ts                      # SuiClient singleton
apps/web/lib/seedphrase-detector.ts      # BIP-39 pattern detection
apps/web/stores/useWizardStore.ts        # Zustand
apps/web/workers/encrypt.worker.ts       # Web Worker for Seal encryption
apps/web/e2e/create-vault.spec.ts
```

### Acceptance criteria

- [ ] Wizard works end-to-end on testnet with a real Google sign-in
- [ ] Sealing a 100-byte text payload completes in < 30 seconds wall-clock
- [ ] Sealing a 1 MB file completes in < 90 seconds wall-clock
- [ ] BIP-39 detection warns when user pastes 12 or 24 random words from the wordlist
- [ ] User can still proceed after warning ("Continue anyway")
- [ ] Progress UI updates during encrypt / upload / seal phases
- [ ] After seal, the vault appears in the explorer (link visible in success screen)
- [ ] All wizard inputs are validated with `zod` + `react-hook-form`
- [ ] Playwright e2e test exercises the full flow with a small payload

### Verify command

```bash
cd apps/web && pnpm dev      # manual test
cd apps/web && pnpm test:e2e -- create-vault
```

### Notes

- Web Worker is critical for files > 1 MB — otherwise UI freezes
- Use `tx.build({ client, onlyTransactionKind: true })` for serialization only; user signs separately
- Don't pre-generate vault UIDs — Sui assigns them at TX execution. Use the two-PTB pattern only if absolutely necessary.

### Commit

```
phase-7: implement vault creation wizard with Seal + Walrus
```

---

## Phase 8 — Beneficiary Claim Page

**Goal:** A beneficiary with no crypto background can sign in with Google, see a vault, and decrypt it in the browser. **This is the headline demo flow.**

### Tasks

1. Build `/claim/[vaultId]/page.tsx`
2. Implement the gate: not-yet-unlocked → show countdown; unlocked → show "Open Vault" button
3. Implement decryption flow per [Frontend.md §6](./Frontend.md#6-decryption-flow-client-side):
   - Create SessionKey, get personal message signature
   - Build approval PTB
   - Fetch ciphertext from Walrus (with fallback aggregators)
   - Call `sealClient.decrypt(...)`
4. Render decrypted content based on file type:
   - Text → markdown viewer
   - PDF → react-pdf
   - Image → native `<img>` from blob URL
   - Video → `<video>` from blob URL
   - Unknown → download button
5. Show decryption progress steps in UI

### Files to create

```
apps/web/app/claim/[vaultId]/page.tsx
apps/web/components/claim/ClaimGate.tsx
apps/web/components/claim/DecryptionProgress.tsx
apps/web/components/claim/ContentRenderer.tsx
apps/web/lib/seal-decrypt.ts             # client-side decrypt helper
apps/web/workers/decrypt.worker.ts       # Web Worker for Seal decrypt
apps/web/e2e/claim-vault.spec.ts
```

### Acceptance criteria

- [ ] Beneficiary can claim a vault that's been triggered (manually trigger by waiting out inactivity or via guardian quorum from the dashboard)
- [ ] Decryption works for: 5KB text, 500KB PDF, 5MB image, 50MB video
- [ ] When not unlocked, page shows "Conditions: X/Y met" with a clear status
- [ ] Sign-in flow is "Sign in with Google" → straight to the claim button (no extra hurdles)
- [ ] Decrypted content is never sent back to any server (verify in Network tab — should be zero outbound after decrypt)
- [ ] Plaintext is cleared from memory when user navigates away (best-effort)
- [ ] Playwright e2e test covers the full claim with a small text vault

### Verify command

```bash
cd apps/web && pnpm dev          # manual
cd apps/web && pnpm test:e2e -- claim-vault
```

### Critical: this is THE demo flow

This page is what the hackathon judges will see in the 3-minute demo video. Spend extra time on:
- Loading states (no blank screens)
- Error states (clear language; never expose stack traces)
- Mobile responsiveness (judges may watch on phones)
- Copy clarity ("only you can decrypt this; Keepra never sees the contents")

### Commit

```
phase-8: implement beneficiary claim page with client-side decrypt
```

---

## Phase 9 — Heartbeat Dashboard

**Goal:** The owner sees a list of their vaults, with countdown timers, and can click "I'm alive" to send a heartbeat.

### Tasks

1. Build `/dashboard` page
2. Query owner's vaults via Sui RPC (`getOwnedObjects` filtered to Keepra package types)
3. For each vault, fetch the HeartbeatLog and compute time-until-inactive
4. Implement `<HeartbeatButton />`: builds PTB with `heartbeat()` + `extend_blob()` calls
5. Color-code countdown: green > 7d, yellow 1–7d, red < 24h
6. Build `/vault/[id]/revoke` page with red-zone confirmation modal

### Files to create

```
apps/web/app/(app)/dashboard/page.tsx
apps/web/app/(app)/vault/[id]/page.tsx
apps/web/app/(app)/vault/[id]/revoke/page.tsx
apps/web/components/vault/VaultCard.tsx
apps/web/components/vault/HeartbeatButton.tsx
apps/web/components/vault/VaultStateBadge.tsx
apps/web/components/shared/CountdownTimer.tsx
apps/web/hooks/useVaults.ts
apps/web/hooks/useVault.ts
apps/web/e2e/dashboard.spec.ts
```

### Acceptance criteria

- [ ] Dashboard shows owner's vaults from Sui RPC (no backend needed for MVP)
- [ ] Clicking "I'm alive" sends a heartbeat TX; countdown resets visibly
- [ ] Countdown updates live (re-renders every second)
- [ ] Color coding works
- [ ] Revoke flow requires typing the vault name to confirm
- [ ] After revoke, vault state badge changes to "Revoked" and heartbeat button disappears
- [ ] Playwright e2e: create vault → heartbeat → revoke

### Verify command

```bash
cd apps/web && pnpm test:e2e -- dashboard
```

### Notes

- For now query Sui RPC directly; backend indexer comes in Phase 10
- Use TanStack Query for caching (60s stale time)
- The "I'm alive" PTB should also extend the Walrus blob lifetime — combine in one PTB

### Commit

```
phase-9: implement dashboard with heartbeat and revoke
```

---

## Phase 10 — Notification Daemon

**Goal:** Background service detects when a vault should trigger and emails the beneficiary.

### Tasks

1. Set up Postgres schema per [Backend.md §4](./Backend.md#4-the-indexer)
2. Build `apps/indexer/` to mirror Sui events into Postgres
3. Build `apps/trigger-daemon/` per [Backend.md §5](./Backend.md#5-the-trigger-daemon)
4. Build `apps/notifier/` with AWS SES (sandbox mode OK for hackathon)
5. Wire email templates for `trigger-alert-beneficiary` and `heartbeat-reminder-{7d,1d}`
6. Add `mark_triggered` Move entry function + call it from the daemon

### Files to create

```
apps/indexer/src/index.ts
apps/indexer/src/subscribers/vault.ts
apps/indexer/src/subscribers/guardian.ts
apps/indexer/src/checkpoint.ts
apps/trigger-daemon/src/index.ts
apps/trigger-daemon/src/poll.ts
apps/notifier/src/index.ts
apps/notifier/src/templates/trigger-alert.html
apps/notifier/src/templates/heartbeat-reminder-7d.html
apps/notifier/src/templates/heartbeat-reminder-1d.html
apps/shared/src/db/schema.ts          # Drizzle schema
apps/shared/src/db/migrations/0001_initial.sql
move/keepra/sources/vault.move        # add mark_triggered entry fn
```

### Acceptance criteria

- [ ] Indexer mirrors all Keepra events from chain to Postgres within 10 seconds
- [ ] Trigger daemon detects inactivity-exceeded vaults within 60 seconds of threshold
- [ ] Daemon emits `mark_triggered` TX on-chain (idempotent — calling twice is safe)
- [ ] Beneficiary email arrives within 2 minutes of trigger event
- [ ] Email contains the claim URL (`https://keepra.app/claim/{vaultId}`)
- [ ] All daemon errors logged with structured pino output
- [ ] Daemon survives restart without missing events (cursor persisted)

### Verify command

```bash
# Create a vault with 60-second inactivity, wait, observe email arrival
pnpm --filter @keepra/indexer dev &
pnpm --filter @keepra/trigger-daemon dev &
pnpm --filter @keepra/notifier dev &
# Then create test vault via UI or CLI
```

### Notes

- AWS SES sandbox only allows sending to verified email addresses — add `e1@keepra.dev`, etc. to the verified list for testing
- For hackathon, single Postgres instance is fine; no replication
- `mark_triggered` is cosmetic only — `seal_approve_release` re-evaluates conditions live. Document this clearly in code comments.

### Commit

```
phase-10: implement indexer, trigger daemon, and notifier
```

---

## Phase 11 — Enoki Sponsorship

**Goal:** Beneficiaries claim with zero gas. Guardian attestation also sponsored.

### Tasks

1. Implement `apps/api/src/routes/sponsor.ts` per [Backend.md §3](./Backend.md#the-sponsor-proxy-detail)
2. Wire frontend `claim` and `attest` flows to call `/sponsor` instead of using user's wallet for gas
3. Set Enoki dashboard `allowedMoveCallTargets`:
   - `${PKG}::policy::seal_approve_release` (for dry-run only; never executes)
   - `${PKG}::guardian::attest`
   - `${PKG}::beneficiary::mark_claimed`
4. Add per-IP and per-address rate limiting to `/sponsor`
5. Verify Keepra Enoki budget consumption is monitored

### Files to create

```
apps/api/src/routes/sponsor.ts
apps/api/src/enoki/client.ts
apps/api/src/middleware/rate-limit.ts
apps/web/lib/sponsor.ts                # frontend wrapper for /sponsor
```

### Acceptance criteria

- [ ] Beneficiary with 0 SUI in their address can successfully claim
- [ ] Guardian with 0 SUI can successfully attest
- [ ] `/sponsor` rejects unrecognized move targets with 400
- [ ] Rate limit: 30 sponsor calls/hour/IP enforced
- [ ] Enoki dashboard shows budget consumption increasing as sponsored TXs occur

### Verify command

```bash
# Use a brand new Google account that has never received any SUI
# Complete the full beneficiary claim flow
# Verify the TX is sponsored (check Sui explorer; gas payer ≠ user)
```

### Commit

```
phase-11: integrate Enoki gas sponsorship for beneficiary + guardian flows
```

---

## Phase 12 — Immutability Hardening

**Goal:** All six hard invariants (I1–I6) from [README.md §6](../README.md#6-hard-invariants) are enforced by code and tested.

### Tasks

1. Add Move tests that prove I1–I6 hold:
   - I2: After `create_and_seal`, attempt to mutate vault fields → must fail to compile or abort
   - I3: Call `seal_approve_release` with various bad inputs → asserts work
   - I4: After revoke, attempt heartbeat / attest → must abort
2. Add a TypeScript invariant suite at `tests/invariants/` that exercises full flows on testnet
3. Add a CI workflow `.github/workflows/invariants.yml` that runs the invariant suite nightly
4. Add a code review checklist `CONTRIBUTING.md` referencing each invariant
5. Audit all Move modules for any public mutator on Vault — remove if found

### Files to create/touch

```
move/keepra/tests/invariants_tests.move
tests/invariants/no-operator-decrypt.test.ts
tests/invariants/vault-immutable.test.ts
tests/invariants/policy-required.test.ts
tests/invariants/revoke-only-edit.test.ts
tests/invariants/zero-gas-beneficiary.test.ts
tests/invariants/seed-phrase-warning.test.ts
.github/workflows/invariants.yml
CONTRIBUTING.md
```

### Acceptance criteria

- [ ] All 6 invariant test files pass
- [ ] Move test `test_vault_has_no_public_mutator` confirms by inspection that Vault has no public mutator
- [ ] CI runs invariant suite nightly
- [ ] CONTRIBUTING.md lists invariants with a "do not violate" pledge

### Verify command

```bash
cd move/keepra && sui move test --filter invariants
pnpm --filter tests/invariants test
```

### Commit

```
phase-12: enforce and test hard invariants I1-I6
```

---

## Phase 13 — DAO Release Flow

**Goal:** A configured DAO can pass a release proposal and trigger vault decryption. Demo this end-to-end.

### Tasks

1. Implement `simple_voting.move` per [Oracles.md §2.5](./Oracles.md#25-the-mvp-adapter-keepra_simple_voting)
2. Implement `dao_release.move` and `dao_adapter_simple_voting.move`
3. Add `dao_id` and `dao_threshold` to Vault struct (optional fields)
4. Update `seal_approve_release` to read `log.dao_released`
5. Build frontend `/dao/[daoId]/page.tsx` — simple voting UI (propose, vote, execute)
6. Add wizard step: option to bind a DAO at vault creation
7. Notifier sends owner email on `DAOReleaseProposed`

### Files to create/touch

```
move/keepra/sources/simple_voting.move
move/keepra/sources/dao_release.move
move/keepra/sources/dao_adapter_simple_voting.move
move/keepra/sources/vault.move           # add dao_id, dao_threshold fields
move/keepra/sources/policy.move          # add dao_ok to OR
move/keepra/tests/dao_release_tests.move
apps/web/app/(app)/dao/[daoId]/page.tsx
apps/web/components/dao/ProposalCard.tsx
apps/web/components/dao/VoteButton.tsx
apps/web/components/vault/DaoPicker.tsx   # in wizard step 2
apps/indexer/src/subscribers/dao.ts
apps/notifier/src/templates/dao-proposal-vault.html
```

### Acceptance criteria

- [ ] `sui move test` passes for all DAO tests
- [ ] Demo: create DAO with 3 members + threshold=2; propose release of a vault; 2 members vote yes; execute; vault becomes claimable
- [ ] Owner of the vault receives an email when DAO proposes release
- [ ] Owner can revoke up until execution (test this)
- [ ] If vault has `dao_id=None`, DAO functions abort with clear error

### Verify command

```bash
cd move/keepra && sui move test --filter dao
cd apps/web && pnpm test:e2e -- dao-release
```

### Notes

- The `simple_voting` module is meant for demo only — production users will plug in real Sui DAOs via adapter pattern
- Keep adapter pattern crisp; future adapters (Sui Multisig) should fit the same shape
- DON'T let DAO release bypass owner revocation — revoke takes precedence in `seal_approve_release`

### Commit

```
phase-13: implement DAO release flow with SimpleVoting adapter
```

---

## Phase 14 — Demo Polish + Video

**Goal:** Submission-ready hackathon package. 3-minute demo video. Polished landing page. README has quickstart.

### Tasks

1. Polish the landing page (`apps/web/app/(marketing)/page.tsx`) per the demo script in `internal/Hackathon.md §3` (team-only)
2. Pre-seed "Sarah's Letters" demo data:
   - Create a vault with `last_heartbeat_ms = now - 31 days` (manual time fudge)
   - Use a real email + Google account for "Maya"
   - Letter content: a heartfelt parental letter
3. Record the 3-minute demo video per the beat-by-beat in `internal/Hackathon.md §3` (team-only)
4. Update repo README with: pitch, quickstart, demo video link, deployed URL
5. Write `tools/demo-seed/` script that recreates Sarah's vault from scratch (in case testnet wipes)
6. Submission checklist walk-through per `internal/Hackathon.md §5` (team-only)

### Files to create

```
apps/web/app/(marketing)/page.tsx           # polished landing
apps/web/app/(marketing)/how-it-works/page.tsx
apps/web/app/(marketing)/security/page.tsx
tools/demo-seed/index.ts                    # pre-populate Sarah's vault
README.md                                   # repo README (separate from docs README)
DEMO.md                                     # instructions for demo
```

### Acceptance criteria

- [ ] Landing page renders correctly on desktop + mobile
- [ ] Demo video uploaded (YouTube unlisted + Walrus mirror for resilience)
- [ ] `pnpm demo:seed` recreates Sarah's vault in < 60 seconds
- [ ] README has: pitch, demo video, quickstart (`pnpm install && pnpm dev`), submission link
- [ ] Submission form fields all filled (track, video URL, GitHub URL, deployed URL)

### Verify command

```bash
pnpm demo:seed
# Open the deployed URL on desktop and mobile; verify both work
```

### Commit

```
phase-14: demo polish, video, submission package
```

---

## Phase 15 — Walrus Sites Mirror (Stretch)

**Goal:** Deploy the frontend itself to Walrus Sites. Bonus track points for "everything on Walrus."

### Tasks

1. Install Walrus Sites CLI: `cargo install --git https://github.com/MystenLabs/walrus-sites site-builder`
2. Build static export of Next.js app (`next export` doesn't fully work; use Walrus Sites compatible build)
3. Publish to Walrus Sites; record the SuiNS name
4. Add a footer link from Vercel frontend → Walrus mirror

### Files to create

```
tools/walrus-sites/site.toml
.github/workflows/deploy-walrus-sites.yml
```

### Acceptance criteria

- [ ] Frontend accessible at `keepra.wal.app` (or your SuiNS name)
- [ ] All features work on the Walrus-served version
- [ ] Hash of the deployed bundle is published in repo for verifiability

### Commit

```
phase-15: deploy frontend to Walrus Sites
```

---

## Standing Rules (Apply to All Phases)

### Test Discipline

- Test first. Implementation second.
- Run tests. Paste output. Don't assume.
- Don't commit failing tests (use `.skip` if temporarily disabled — with a comment).

### Commit Discipline

- One phase = one commit (or a small focused series with clear messages)
- Commit message format: `phase-N: <action verb> <what>`
- No commits with "WIP", "fix", "stuff" as the message
- No commits to `main` directly — always via PR (even solo); use squash merge

### Documentation Discipline

- If you change a public Move API, update [Contracts.md](./Contracts.md)
- If you change a flow's structure, update [Flows.md](./Flows.md)
- If you add an env var, add it to `.env.example`
- If you add an npm dep, justify it in the PR description

### Branch Naming

- Feature: `phase-N/<short-name>` (e.g., `phase-4/seal-roundtrip`)
- Bug fix: `fix/<short-name>`
- Doc only: `docs/<short-name>`

### When to Open a PR

- One phase ≈ one PR
- PR description: what was done, how to test locally, link to acceptance criteria
- Self-review your own diff before requesting review
- CI must be green before merge

---

## Post-Submission Plan

After Phase 14 commits, regardless of placement, see [Roadmap.md v1](./Roadmap.md#v1--pre-product-months-13-post-hackathon) for what comes next:

1. Mainnet deployment
2. External Move audit
3. Vault templates
4. First customer interviews
5. Monetization (Personal $5/mo, Family $15/mo)

But that's all out of MVP scope. Phases 0–15 above are the hackathon.

---

## See also

- [CLAUDE.md](../CLAUDE.md) — read first every session
- [Repo-Structure.md](./Repo-Structure.md) — where files go
- `internal/Hackathon.md` (gitignored) — submission strategy, team-only
