# Backend

> Keepra's off-chain services. Critical principle: **the backend is untrusted for confidentiality**. It never holds plaintext, decryption keys, or any cryptographic material that could decrypt a vault. Its only roles are UX (emails, dashboards), indexing (faster queries than RPC), and coordination (sponsor proxy, trigger detection).

---

## 1. Services Overview

| Service               | Purpose                                                                  | Process                      | Cadence                         | Cryptographic access |
| --------------------- | ------------------------------------------------------------------------ | ---------------------------- | ------------------------------- | -------------------- |
| `api-gateway`         | REST + GraphQL for frontend                                              | Fastify                      | request-driven                  | None                 |
| `indexer`             | Mirrors Sui events to Postgres                                           | Node + Sui SDK               | 5s polling / event subscription | None                 |
| `notifier`            | Sends emails (heartbeat reminders, beneficiary alerts, guardian invites) | Node                         | request-driven + cron           | None                 |
| `trigger-daemon`      | Polls heartbeat windows; flips convenience flags                         | Node + node-cron             | 60s tick                        | None                 |
| `enoki-sponsor-proxy` | Wraps user PTBs with Enoki sponsor signatures                            | Fastify (inside api-gateway) | request-driven                  | Enoki API key only   |
| `dao-event-relayer`   | Watches DAO module events; forwards to indexer + notifier                | Node                         | event subscription              | None                 |

All services are stateless except for read/write access to a shared Postgres instance.

---

## 2. Repo Layout

```
apps/
├── api/                      # api-gateway service
│   ├── src/
│   │   ├── routes/
│   │   │   ├── vaults.ts            # GET /vaults/:id, GET /vaults?owner=...
│   │   │   ├── notifications.ts     # POST /notify/guardian-invite
│   │   │   ├── sponsor.ts           # POST /sponsor, POST /sponsor/execute
│   │   │   └── health.ts
│   │   ├── db/
│   │   ├── enoki/
│   │   └── index.ts
│   └── package.json
├── indexer/                  # Sui event indexer
│   ├── src/
│   │   ├── subscribers/
│   │   │   ├── vault.ts             # VaultCreated, Heartbeat, VaultRevoked, ...
│   │   │   ├── guardian.ts          # GuardianAttested
│   │   │   └── dao.ts               # DAOReleaseProposed, DAOReleaseApproved
│   │   ├── checkpoint.ts            # Persists last seen seq per subscriber
│   │   └── index.ts
│   └── package.json
├── trigger-daemon/           # Trigger detection + notification dispatch
│   ├── src/
│   │   ├── poll.ts
│   │   ├── notify.ts
│   │   └── index.ts
│   └── package.json
└── shared/                   # Shared TS types, DB models, RPC client
    └── src/
        ├── db.ts                    # Postgres pool
        ├── sui-client.ts
        ├── types.ts
        └── env.ts
```

All services share `apps/shared`. Built via pnpm workspaces.

---

## 3. The API Gateway

### Endpoints

| Method | Path                         | Purpose                                 | Auth                                              |
| ------ | ---------------------------- | --------------------------------------- | ------------------------------------------------- |
| `GET`  | `/health`                    | Liveness probe                          | None                                              |
| `GET`  | `/vaults/:id`                | Vault summary + state                   | Public                                            |
| `GET`  | `/vaults?owner=:addr`        | List owner's vaults                     | Token (owner address verified via signed message) |
| `GET`  | `/claim/:vaultId/preview`    | Show pre-claim info (without decrypt)   | Public                                            |
| `POST` | `/notify/guardian-invite`    | Trigger guardian onboarding email       | Internal (called from frontend after seal)        |
| `POST` | `/notify/heartbeat-reminder` | (Cron-triggered, internal)              | Internal                                          |
| `POST` | `/sponsor`                   | Wrap a PTB with Enoki sponsor signature | Public (user-bound)                               |
| `POST` | `/sponsor/execute`           | Execute a sponsored, user-signed PTB    | Public                                            |

### Why a backend at all (if the frontend talks to Sui directly)?

The backend exists for **three** reasons only:

1. **Notifications** — emails for guardian invites, heartbeat reminders, trigger alerts. Email cannot be sent client-side.
2. **Enoki sponsorship** — the sponsor's Enoki API key is a secret. It cannot live in the browser.
3. **Convenience queries** — listing all vaults owned by an address, pagination, search — these are awkward on Sui RPC directly. The indexer pre-computes them in Postgres.

Everything else (encryption, decryption, vault creation, claim) happens **directly between the browser and Sui/Walrus/Seal**. The backend is not on the critical path for any confidentiality-sensitive operation.

### The sponsor proxy (detail)

```
[Browser]
  user builds PTB locally
  txBytes = tx.build({ client, onlyTransactionKind: true })

  POST /sponsor { txBytes, userAddress }
       │
       ▼
[api-gateway]
  validate: parse PTB, check it only calls allowed Keepra move targets
  call EnokiClient.createSponsoredTransaction({
    network: 'testnet',
    transactionKindBytes: txBytes,
    sender: userAddress,
    allowedMoveCallTargets: KEEPRA_SPONSORED_TARGETS,
  })
  returns { sponsoredBytes, digest }
       │
       ▼
[Browser]
  user signs digest with their zkLogin wallet
       │
       ▼
  POST /sponsor/execute { digest, signature }
       │
       ▼
[api-gateway]
  call EnokiClient.executeSponsoredTransaction({ digest, signature })
       │
       ▼
[Sui executes]
  gas paid by Keepra Enoki budget
```

### Rate limiting

The sponsor proxy is the most abuse-prone endpoint (Keepra pays for gas). Limits:

- **Per IP**: 30 sponsor calls / hour
- **Per zkLogin address**: 100 sponsor calls / day
- **Per move target**: per-target budget cap (configurable in Enoki dashboard)
- **Global daily budget**: hard cap with alert at 80% of monthly Keepra budget

Rate limit state lives in Redis (or `pg`-backed token bucket for MVP).

---

## 4. The Indexer

The indexer mirrors Sui events into Postgres so the frontend can do fast queries.

### Architecture

```
   Sui RPC
      │
      │ queryEvents({ MoveModule: {package: KEEPRA_PKG, module: '*'}})
      │   OR subscribeEvent for real-time
      ▼
   ┌──────────────────────────┐
   │  Indexer service          │
   │  - Polls every 5s         │
   │  - Persists checkpoint    │
   │  - Decodes event payloads │
   │  - Idempotent upserts     │
   └──────┬────────────────────┘
          ▼
   ┌──────────────────────┐
   │  Postgres              │
   │  - vault_index         │
   │  - guardian_attests    │
   │  - heartbeat_history   │
   │  - dao_proposals       │
   │  - events_cursor       │
   └────────────────────────┘
```

### Schema

```sql
-- Mirror of all known vaults
CREATE TABLE vault_index (
  vault_id              TEXT PRIMARY KEY,
  owner_address         TEXT NOT NULL,
  blob_id               TEXT NOT NULL,
  heartbeat_log_id      TEXT NOT NULL,
  threshold             SMALLINT NOT NULL,
  inactivity_seconds    BIGINT NOT NULL,
  guardian_quorum       SMALLINT NOT NULL,
  guardian_count        SMALLINT NOT NULL,
  dao_id                TEXT,
  beneficiary_email_hash BYTEA NOT NULL,
  last_heartbeat_ms     BIGINT NOT NULL,
  triggered             BOOLEAN NOT NULL DEFAULT false,
  trigger_reason        SMALLINT NOT NULL DEFAULT 0,
  revoked               BOOLEAN NOT NULL DEFAULT false,
  dao_released          BOOLEAN NOT NULL DEFAULT false,
  attestation_count     SMALLINT NOT NULL DEFAULT 0,
  created_at_ms         BIGINT NOT NULL,
  updated_at_ms         BIGINT NOT NULL,
  observed_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX vault_index_owner ON vault_index(owner_address);
CREATE INDEX vault_index_triggered ON vault_index(triggered, revoked) WHERE NOT triggered AND NOT revoked;

-- Heartbeat history (for analytics + dashboard countdown)
CREATE TABLE heartbeat_history (
  vault_id   TEXT NOT NULL REFERENCES vault_index(vault_id),
  ts_ms      BIGINT NOT NULL,
  tx_digest  TEXT NOT NULL,
  PRIMARY KEY (vault_id, ts_ms)
);

-- Guardian attestations
CREATE TABLE guardian_attestations (
  vault_id   TEXT NOT NULL REFERENCES vault_index(vault_id),
  guardian   TEXT NOT NULL,
  ts_ms      BIGINT NOT NULL,
  tx_digest  TEXT NOT NULL,
  PRIMARY KEY (vault_id, guardian)
);

-- DAO proposals
CREATE TABLE dao_proposals (
  proposal_id    TEXT PRIMARY KEY,
  vault_id       TEXT NOT NULL REFERENCES vault_index(vault_id),
  dao_id         TEXT NOT NULL,
  proposed_at_ms BIGINT NOT NULL,
  executed       BOOLEAN NOT NULL DEFAULT false
);

-- Beneficiary email storage (KMS-encrypted at rest)
-- Email is needed off-chain for notifications; never sent to chain.
CREATE TABLE beneficiary_link (
  vault_id        TEXT PRIMARY KEY REFERENCES vault_index(vault_id),
  email_hash      BYTEA NOT NULL,
  email_kms_blob  BYTEA NOT NULL,    -- encrypted with provider KMS
  notified        BOOLEAN NOT NULL DEFAULT false
);

-- Indexer checkpoint
CREATE TABLE events_cursor (
  subscriber  TEXT PRIMARY KEY,        -- e.g., 'vault', 'guardian', 'dao'
  last_seq    BIGINT NOT NULL,
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifier outbox (eventually-consistent)
CREATE TABLE notification_outbox (
  id            BIGSERIAL PRIMARY KEY,
  kind          TEXT NOT NULL,         -- 'guardian-invite', 'heartbeat-reminder', 'trigger-alert'
  target_email  TEXT NOT NULL,
  payload       JSONB NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | sent | failed
  attempts      SMALLINT NOT NULL DEFAULT 0,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error    TEXT
);

CREATE INDEX notification_outbox_pending
ON notification_outbox(scheduled_for) WHERE status = 'pending';
```

### Event subscription pattern

```ts
// Pseudo-code
import { SuiClient } from '@mysten/sui/client';

const client = new SuiClient({ url: SUI_RPC_URL });

async function pollLoop() {
  let cursor = await getCursor('vault');
  while (running) {
    const page = await client.queryEvents({
      query: { MoveEventModule: { package: KEEPRA_PKG, module: 'events' } },
      cursor,
      limit: 50,
      order: 'ascending',
    });

    for (const ev of page.data) {
      await handleEvent(ev); // idempotent UPSERT
      cursor = { txDigest: ev.id.txDigest, eventSeq: ev.id.eventSeq };
    }
    await setCursor('vault', cursor);

    if (!page.hasNextPage) await sleep(5000);
  }
}
```

For real-time UX (live heartbeat updates), we also use `subscribeEvent` with reconnection logic. Polling is the source of truth; subscription is optimization.

### Idempotency

Every event handler is idempotent. Events are keyed by `(tx_digest, event_seq)`. Re-processing the same event twice is a no-op.

---

## 5. The Trigger Daemon

A cron service that detects when vaults should be marked triggered (inactivity exceeded or guardian quorum reached) and notifies beneficiaries.

### Loop

```ts
// Pseudo-code, runs every 60s
async function tick() {
  const candidates = await db.query(`
    SELECT vault_id, heartbeat_log_id, last_heartbeat_ms, inactivity_seconds,
           attestation_count, guardian_quorum, dao_released
    FROM vault_index
    WHERE triggered = false AND revoked = false
  `);

  for (const v of candidates) {
    const log = await suiClient.getObject({
      id: v.heartbeat_log_id,
      options: { showContent: true },
    });
    const live = parseHeartbeatLog(log); // current chain state

    if (live.revoked) {
      await db.update('vault_index', v.vault_id, { revoked: true });
      continue;
    }

    const now = Date.now();
    const inactivityElapsed = now - live.last_heartbeat_ms > v.inactivity_seconds * 1000;
    const quorumReached = live.attestations.length >= v.guardian_quorum;
    const daoReleased = live.dao_released;

    if (inactivityElapsed || quorumReached || daoReleased) {
      const reason = daoReleased ? 3 : quorumReached ? 2 : 1;
      await sendTransaction(markTriggered(v.heartbeat_log_id, reason));
      await db.update('vault_index', v.vault_id, { triggered: true, trigger_reason: reason });
      await enqueueNotification({
        kind: 'trigger-alert',
        vault_id: v.vault_id,
      });
    }
  }
}
```

### Critical: the daemon does NOT control decryption

The daemon flips a convenience flag (`triggered=true` in Postgres + on-chain via `mark_triggered`). **The actual decryption check is live inside `seal_approve_release`**, which re-evaluates inactivity, quorum, and DAO release status against current chain state. Even if the daemon is compromised:

| Compromise scenario                         | Consequence                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Daemon spams `mark_triggered(reason=1)`     | Cosmetic only — beneficiary still cannot decrypt unless conditions actually pass at `seal_approve_release` dry-run |
| Daemon sends fraudulent notification emails | Beneficiary clicks claim link → seal_approve fails → "not yet unlocked"                                            |
| Daemon withheld notifications               | Beneficiary still discovers the vault via direct portal / email reminder schedule                                  |

### Reminder cadences

The daemon also sends owner reminders ahead of inactivity:

| Time before due | Reminder                                         |
| --------------- | ------------------------------------------------ |
| 7 days          | "Your vault X needs a heartbeat in 7 days"       |
| 1 day           | "Final reminder: vault X heartbeat due tomorrow" |
| At due          | "Vault X is now in grace period (2 days)"        |
| End of grace    | (Vault triggers; beneficiary notified)           |

---

## 6. The Notifier

The notifier handles email delivery. It reads `notification_outbox` and sends via SES (or SendGrid; pluggable).

### Outbox pattern

Every service that needs to send an email writes to `notification_outbox` instead of calling SES directly:

```sql
INSERT INTO notification_outbox (kind, target_email, payload)
VALUES ('guardian-invite', 'guardian@example.com', '{...}');
```

The notifier worker polls the outbox:

```ts
async function dispatch() {
  const rows = await db.query(`
    SELECT * FROM notification_outbox
    WHERE status = 'pending' AND scheduled_for <= now()
    ORDER BY scheduled_for ASC LIMIT 50
  `);

  for (const row of rows) {
    try {
      await sesClient.send(renderTemplate(row.kind, row.payload));
      await db.update('notification_outbox', row.id, { status: 'sent' });
    } catch (e) {
      await db.update('notification_outbox', row.id, {
        attempts: row.attempts + 1,
        last_error: String(e),
        scheduled_for: new Date(Date.now() + retryBackoff(row.attempts)),
      });
      if (row.attempts > 5) {
        await db.update('notification_outbox', row.id, { status: 'failed' });
      }
    }
  }
}
```

### Email templates

| Kind                        | Template subject                          | Trigger                                               |
| --------------------------- | ----------------------------------------- | ----------------------------------------------------- |
| `guardian-invite`           | "You're a guardian for [Owner]'s vault"   | At vault seal                                         |
| `heartbeat-reminder-7d`     | "Your vault needs a heartbeat in 7 days"  | Cron, 7d before due                                   |
| `heartbeat-reminder-1d`     | "Final reminder: heartbeat due tomorrow"  | Cron, 1d before due                                   |
| `trigger-alert-beneficiary` | "A Keepra vault is now available for you" | When `triggered = true`                               |
| `trigger-alert-owner`       | "Your vault X was triggered"              | Same event (informational, in case of false-positive) |
| `dao-proposal-vault`        | "DAO X has proposed releasing your vault" | DAOReleaseProposed event                              |

All templates are versioned in code; rendering uses Handlebars or MJML.

### What email contents include

- Vault summary (no plaintext, no sensitive data)
- A claim link with the vault ID
- An explanation of the cryptographic process ("only you can decrypt this, the platform cannot")
- Keepra support contact

What email contents **never** include: vault contents, decryption keys, private keys, seed phrases.

---

## 7. The DAO Event Relayer

Specialized indexer subscriber that watches DAO release events.

### Subscriptions

| Event                | Action                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| `DAOReleaseProposed` | Insert into `dao_proposals`; notify vault owner ("DAO X proposed releasing your vault")                     |
| `DAOReleaseApproved` | Update `dao_proposals.executed = true`; update `vault_index.dao_released = true`; enqueue beneficiary alert |

The relayer is logically part of the indexer service — it lives in `apps/indexer/src/subscribers/dao.ts`.

### Adapter awareness

Different DAO frameworks have different event shapes. The relayer maintains a small registry of adapter-specific decoders:

```ts
const decoders: Record<string, EventDecoder> = {
  keepra_simple_voting: decodeSimpleVotingEvent,
  sui_multisig: decodeMultisigEvent,
  // future: governance frameworks
};
```

For the MVP, we ship the `keepra_simple_voting` adapter only. See [Oracles.md](./Oracles.md) for the full design.

---

## 8. Walrus Upload Relay (optional)

For the MVP, the browser talks directly to a public Walrus publisher. For higher-volume v1+ deployments, Keepra can run a private upload relay:

```
  [Browser] ──ciphertext──▶ [Keepra Upload Relay] ──▶ [Walrus storage nodes]
                            (proxy + WAL payment)
```

Benefits:

- Subsidize WAL token costs (Keepra pays, user doesn't see WAL)
- Reduce browser-side network complexity (one POST vs 2,200 storage-node connections)
- Centralized retry and observability

The relay is **untrusted for confidentiality** — it sees ciphertext only.

**Not required for MVP.** Defer to v1.

---

## 9. Sui RPC Layer

All services share a `SuiClient` configured to talk to:

- **Testnet RPC** during dev: `https://fullnode.testnet.sui.io:443`
- **Mainnet RPC** in prod: `https://fullnode.mainnet.sui.io:443`

For higher reliability and lower rate limits, production uses a managed RPC provider (Shinami, Blockberry, or Ruby Nodes' load-balanced endpoint).

### Wallet for daemon-initiated transactions

The trigger daemon needs to call `mark_triggered`. It uses a dedicated **operator wallet**:

- Hot wallet with limited SUI balance (alert when low)
- Can only call `keepra::vault::mark_triggered` (enforced by Enoki sponsor allowlist if sponsored, or simple budget if direct)
- Separate from the Enoki sponsor key
- Compromise of this wallet = attacker can spam `mark_triggered` events but cannot grant unauthorized decryption (Invariant I3 holds)

---

## 10. Deployment

### MVP

| Service          | Hosting                   | Cost      |
| ---------------- | ------------------------- | --------- |
| `api-gateway`    | Railway or Fly.io         | Free tier |
| `indexer`        | Railway                   | Free tier |
| `trigger-daemon` | Railway cron              | Free tier |
| `notifier`       | Inside api-gateway worker | Free tier |
| Postgres         | Neon or Supabase          | Free tier |
| Frontend         | Vercel                    | Free tier |

### Production v1+

| Service          | Hosting                                | Notes                                     |
| ---------------- | -------------------------------------- | ----------------------------------------- |
| `api-gateway`    | AWS Fargate or Fly.io with autoscaling | Sub-second p99                            |
| `indexer`        | Fargate (1 instance)                   | Sticky single-instance to maintain cursor |
| `trigger-daemon` | Fargate (1 instance)                   | Same reasoning                            |
| `notifier`       | Fargate with multiple workers          | Outbox-coordinated, can scale             |
| Postgres         | RDS or Crunchbridge                    | Daily backups                             |
| Frontend         | Vercel + Walrus Sites mirror           | Censorship-resistant frontend             |

---

## 11. Observability

### Logs

- Structured JSON via `pino`
- Each log line includes: `service`, `trace_id`, `vault_id` (when relevant), `event`
- Aggregated to Better Stack (or Datadog in v1+)

### Metrics

- `vault_created_total`
- `vault_triggered_total{reason}`
- `heartbeat_total`
- `notification_sent_total{kind}`
- `seal_decrypt_attempts_total{outcome}` (from frontend telemetry, opt-in)
- `sponsor_transactions_total{move_target,outcome}`
- `enoki_sponsor_budget_remaining`

### Alerts (production)

- Trigger daemon stops emitting heartbeats → page on-call
- Enoki budget < 20% of monthly cap → email
- Indexer cursor falls > 1 hour behind chain head → email
- Any Move error with code > 100 (unexpected) → email
- Postgres CPU > 80% sustained 10min → email

### What we **don't** observe

- Vault plaintext (we never have it)
- Beneficiary contents post-decrypt (client-side only)
- User-identifying information beyond email hashes and Sui addresses

---

## 12. Configuration

All services read from environment variables, never hardcoded values.

### Required env vars (production)

```
# Sui
SUI_NETWORK=mainnet
SUI_RPC_URL=https://fullnode.mainnet.sui.io:443
KEEPRA_PACKAGE_ID=0x...
WALRUS_PUBLISHER_URL=https://publisher.walrus.space
WALRUS_AGGREGATORS=https://aggregator.walrus.space,https://...

# Seal — see Seal-Config.md for the canonical list
SEAL_PACKAGE_ID=0x8d90881fc48eb30d4422db68083b49e7d0f879658444e3a0ed85ce47feaa54b2
SEAL_COMMITTEE_SERVER_ID=0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98
SEAL_COMMITTEE_AGGREGATOR_URL=https://seal-aggregator-testnet.mystenlabs.com
SEAL_INDEP_RUBY=0x6068c0acb197dddbacd4746a9de7f025b2ed5a5b6c1b1ab44dade4426d141da2
SEAL_INDEP_NODEINFRA=0x5466b7df5c15b508678d51496ada8afab0d6f70a01c10613123382b1b8131007

# Enoki
ENOKI_PUBLIC_KEY=enoki_public_...   (used by frontend)
ENOKI_SECRET_KEY=enoki_secret_...   (used by backend only)

# Database
DATABASE_URL=postgres://...

# Email
SES_REGION=us-east-1
SES_FROM_ADDRESS=noreply@keepra.app
KMS_KEY_ARN=arn:aws:kms:...

# Operator wallet (for daemon-initiated transactions)
DAEMON_WALLET_PRIVATE_KEY=...       (in AWS Secrets Manager)
```

---

## 13. Security Posture

| Surface            | Protection                                                        |
| ------------------ | ----------------------------------------------------------------- |
| Backend database   | Encrypted at rest; access via IAM; read-replica for analytics     |
| Beneficiary emails | KMS-encrypted at rest; logs strip email PII                       |
| Enoki sponsor key  | In AWS Secrets Manager; rotated quarterly; alerts on usage spikes |
| Daemon wallet      | Hot wallet, limited balance, alerted on drain                     |
| Public endpoints   | Rate-limited per-IP and per-address                               |
| HTTPS only         | HSTS preload; no plaintext fallback                               |
| CORS               | Strict allowlist for frontend origins                             |

Full threat model in [Security.md](./Security.md).

---

## 14. What the Backend Explicitly Does Not Do

These are common misconceptions worth listing:

- **Does not encrypt user data.** Encryption happens in the browser.
- **Does not decrypt user data.** Decryption happens in the browser.
- **Does not hold any key shares.** Seal key servers hold them, and Keepra operates none of them.
- **Does not sign on behalf of users.** Users sign in their wallet / zkLogin.
- **Does not store plaintext anywhere.** Vault contents only exist on Walrus (encrypted) and in the user's browser (briefly).
- **Does not communicate with Walrus on behalf of users at upload time.** The browser uploads directly.
- **Does not enforce access control.** Move + Seal do.

The backend is a **UX wrapper** around an inherently decentralized cryptographic system.

---

## See also

- [Architecture.md](./Architecture.md) — system overview this backend lives inside
- [Frontend.md](./Frontend.md) — the client that talks to these endpoints
- [Contracts.md](./Contracts.md) — Move modules whose events the indexer subscribes to
- [Security.md](./Security.md) — what threats this design mitigates
- [TechStack.md](./TechStack.md) — exact library versions and infra choices
