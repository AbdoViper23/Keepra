# Tech Stack

> Exact technology choices, library versions, infrastructure decisions, and endpoint URLs. This is the engineering team's canonical reference for "what do we install?"

> **Versioning caveat**: SDK versions change. The team should pin specific versions in `package.json` and verify compatibility with the installed Seal/Walrus/Sui frameworks at build time. The versions below are accurate as of late 2025 / early 2026 documentation; **always verify with `npm view <package> version` before pinning**.

---

## 1. At-a-Glance

```
┌──────────────────────────────────────────────────────────────────┐
│  FRONTEND                                                         │
│  Next.js 15 + React 19 + TypeScript                               │
│  @mysten/dapp-kit-react + @mysten/sui + @mysten/seal + @mysten/walrus │
│  @mysten/enoki for zkLogin & sponsored tx                         │
│  TailwindCSS + Radix UI                                           │
│  Zustand + TanStack Query                                         │
├──────────────────────────────────────────────────────────────────┤
│  BACKEND                                                          │
│  Node.js 20 + TypeScript + Fastify                                │
│  pnpm workspaces                                                  │
│  Postgres 16 + pg / Drizzle ORM                                   │
│  SES (or SendGrid) for email                                      │
│  pino for logging                                                 │
├──────────────────────────────────────────────────────────────────┤
│  MOVE                                                             │
│  Sui Move framework (latest stable)                               │
│  sui-cli for build, publish, upgrade                              │
├──────────────────────────────────────────────────────────────────┤
│  INFRA                                                            │
│  Vercel (frontend) → + Walrus Sites (mirror, Phase 14)            │
│  Railway / Fly.io (backend services)                              │
│  Neon / Supabase (Postgres)                                       │
│  GitHub Actions (CI)                                              │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Stack

### Core dependencies

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "typescript": "^5.6.0",

    "@mysten/sui": "latest",
    "@mysten/dapp-kit-react": "latest",
    "@mysten/seal": "latest",
    "@mysten/walrus": "latest",
    "@mysten/enoki": "latest",
    "@mysten/wallet-standard": "latest",

    "@tanstack/react-query": "^5.59.0",
    "zustand": "^5.0.0",

    "tailwindcss": "^3.4.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-toast": "^1.2.0",
    "@radix-ui/react-tooltip": "^1.1.0",

    "react-hook-form": "^7.53.0",
    "zod": "^3.23.0",
    "@hookform/resolvers": "^3.9.0",

    "lucide-react": "^0.450.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.5.0",

    "bip39": "^3.1.0",
    "qrcode": "^1.5.0",

    "next-pwa": "^5.6.0",

    "@sentry/nextjs": "^8.30.0"
  },
  "devDependencies": {
    "@types/node": "^20.16.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/qrcode": "^1.5.0",

    "eslint": "^9.0.0",
    "eslint-config-next": "^15.0.0",
    "prettier": "^3.3.0",

    "vitest": "^2.1.0",
    "@testing-library/react": "^16.0.0",
    "@playwright/test": "^1.48.0"
  }
}
```

### Version pinning policy

- **Mysten SDKs** (`@mysten/sui`, `@mysten/seal`, `@mysten/walrus`, `@mysten/enoki`, `@mysten/dapp-kit-react`): pin to a known-working version. These SDKs are under active development; minor versions can introduce breaking changes. Note: the older `@mysten/dapp-kit` is deprecated — use `@mysten/dapp-kit-react` for new code.
- **Framework deps** (Next.js, React): pin to a major version; minor updates are usually safe.
- **Utility deps** (Zustand, TanStack Query, Radix): caret-range; auto-update on `pnpm i`.

### What the Mysten SDKs are for

| SDK | Purpose |
|---|---|
| `@mysten/sui` | Core RPC client, transaction building, cryptography primitives |
| `@mysten/dapp-kit-react` | React hooks for wallet connection, transaction signing (replaces deprecated `@mysten/dapp-kit`) |
| `@mysten/seal` | Threshold IBE encryption + Move policy decryption |
| `@mysten/walrus` | Browser-friendly Walrus client (upload, download) |
| `@mysten/enoki` | zkLogin authentication + sponsored transactions |
| `@mysten/wallet-standard` | Wallet discovery (used by dapp-kit under the hood) |

---

## 3. Backend Stack

### Core dependencies

```json
{
  "dependencies": {
    "fastify": "^5.0.0",
    "@fastify/cors": "^10.0.0",
    "@fastify/helmet": "^12.0.0",
    "@fastify/rate-limit": "^10.0.0",
    "@fastify/swagger": "^9.0.0",

    "@mysten/sui": "latest",
    "@mysten/enoki": "latest",

    "drizzle-orm": "^0.36.0",
    "postgres": "^3.4.0",

    "ioredis": "^5.4.0",
    "bullmq": "^5.20.0",

    "node-cron": "^3.0.0",

    "@aws-sdk/client-ses": "^3.660.0",
    "@aws-sdk/client-kms": "^3.660.0",
    "@aws-sdk/client-secrets-manager": "^3.660.0",

    "pino": "^9.4.0",
    "pino-pretty": "^11.2.0",

    "zod": "^3.23.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.28.0",
    "tsx": "^4.19.0",
    "vitest": "^2.1.0"
  }
}
```

### Service-by-service module layout

```
apps/
├── api/                  # Fastify HTTP gateway
├── indexer/              # Sui event subscriber
├── trigger-daemon/       # Inactivity/quorum poller
├── notifier/             # SES outbox worker
└── shared/               # Shared types, DB schema, env config
```

All four services share the same Postgres instance. Communication is via DB (outbox pattern) rather than direct HTTP — services are loosely coupled.

---

## 4. Move Package

### Move.toml

```toml
[package]
name = "Keepra"
version = "1.0.0"
edition = "2024"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }

[addresses]
keepra = "0x0"

[dev-addresses]
keepra = "0x0"
```

### Move file layout

```
move/keepra/
├── Move.toml
├── sources/
│   ├── vault.move
│   ├── heartbeat.move
│   ├── guardian.move
│   ├── beneficiary.move
│   ├── dao_release.move
│   ├── policy.move
│   ├── events.move
│   ├── errors.move
│   ├── simple_voting.move          # DAO type for MVP demo
│   └── dao_adapter_simple_voting.move
└── tests/
    ├── vault_tests.move
    ├── heartbeat_tests.move
    ├── guardian_tests.move
    ├── dao_release_tests.move
    ├── policy_tests.move
    └── integration_tests.move
```

### Sui CLI

Install via `brew install sui` (macOS) or follow [docs.sui.io](https://docs.sui.io/guides/developer/getting-started/sui-install). Required for `sui move build`, `sui move test`, `sui client publish`.

Use the **testnet branch** during development; switch to **mainnet branch** for the mainnet deploy at v1.

---

## 5. Infrastructure

### Hosting (MVP / hackathon)

| Service | Provider | Plan |
|---|---|---|
| Frontend | Vercel | Hobby (free) |
| `api` | Railway | Free tier |
| `indexer` | Railway | Free tier |
| `trigger-daemon` | Railway (cron) | Free tier |
| Postgres | Neon | Free tier |
| Email | AWS SES | Sandbox (free) |
| Secrets | AWS Secrets Manager (or Railway env) | Free tier |
| Logs | Better Stack | Free tier |
| Errors (frontend) | Sentry | Hobby |

**Total MVP cost: ~$0/month.** Fits hackathon budget.

### Hosting (v1+ production)

| Service | Provider | Notes |
|---|---|---|
| Frontend | Vercel Pro + Walrus Sites mirror | $20/month |
| Backend | Fly.io or AWS Fargate | $30–100/month based on traffic |
| Postgres | Crunchbridge or RDS | $50/month |
| Email | SES (out of sandbox) | Pay-per-send, ~$0.10/1000 |
| RPC (Sui mainnet) | Shinami or Blockberry | $50–200/month |
| Monitoring | Better Stack Pro | $20/month |
| Sentry | Team plan | $26/month |

**Total v1 cost: ~$200–500/month.** Manageable with even small subscription revenue.

---

## 6. Endpoints (Canonical URLs)

### Sui

| Network | RPC URL |
|---|---|
| Mainnet | `https://fullnode.mainnet.sui.io:443` |
| Testnet | `https://fullnode.testnet.sui.io:443` |
| Devnet | `https://fullnode.devnet.sui.io:443` |

For production: use a managed RPC provider (Shinami, Blockberry, Ruby Nodes) for higher rate limits and better reliability.

### Walrus

| Network | Resource | URL |
|---|---|---|
| Testnet | Publisher | `https://publisher.walrus-testnet.walrus.space` |
| Testnet | Aggregator (primary) | `https://aggregator.walrus-testnet.walrus.space` |
| Mainnet | Publisher | Refer to `https://docs.wal.app/` for current mainnet publishers |
| Mainnet | Aggregator | Refer to `https://docs.wal.app/` for current mainnet aggregators |

Aggregator API specification is available at `<aggregator>/v1/api`.

The community-maintained list of public publishers and aggregators is at [github.com/MystenLabs/awesome-walrus](https://github.com/MystenLabs/awesome-walrus).

### Seal Move Package (Testnet)

```
0x8d90881fc48eb30d4422db68083b49e7d0f879658444e3a0ed85ce47feaa54b2
```

Use as `<SEAL_PACKAGE_ID>` in Move.toml deps, on-chain decryption helpers, and SDK references.

### Decentralized (MPC Committee) Key Server — Testnet *(recommended primary)*

Single logical server backed by a 3-of-5 MPC committee. Counts as **one server** in `SealClient.serverConfigs`. Use this alone with `threshold: 1` for Phase 4 simplicity; combine with independents below for Phase 7+ hybrid.

| Field | Value |
|---|---|
| Object ID | `0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98` |
| Aggregator URL | `https://seal-aggregator-testnet.mystenlabs.com` |
| Threshold | 3-of-5 (internal, hidden from app) |
| Members | Mysten Labs, Natsai, Overclock, NodeInfra, Ruby Nodes |
| API key required | No |

### Independent Open-Mode Key Servers — Testnet

Use any of these alongside the Committee server for a hybrid threshold. No API key needed for `Open` mode.

| Operator | URL | KeyServer Object ID |
|---|---|---|
| Mysten Labs #1 | `https://seal-key-server-testnet-1.mystenlabs.com` | `0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75` |
| Mysten Labs #2 | `https://seal-key-server-testnet-2.mystenlabs.com` | `0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8` |
| Ruby Nodes | `https://seal-testnet.api.rubynodes.io` | `0x6068c0acb197dddbacd4746a9de7f025b2ed5a5b6c1b1ab44dade4426d141da2` |
| NodeInfra | `https://open-seal-testnet.nodeinfra.com` | `0x5466b7df5c15b508678d51496ada8afab0d6f70a01c10613123382b1b8131007` |
| Studio Mirai | `https://open.key-server-testnet.seal.mirai.cloud` | `0x164ac3d2b3b8694b8181c13f671950004765c23f270321a45fdd04d40cccf0f2` |
| Overclock | `https://seal-testnet-open.overclock.run` | `0x9c949e53c36ab7a9c484ed9e8b43267a77d4b8d70e79aa6b39042e3d4c434105` |
| H2O Nodes | `https://seal-open.sui-testnet.h2o-nodes.com` | `0x39cef09b24b667bc6ed54f7159d82352fe2d5dd97ca9a5beaa1d21aa774f25a2` |
| Triton One | `https://seal.testnet.sui.rpcpool.com` | `0x4cded1abeb52a22b6becb42a91d3686a4c901cf52eee16234214d0b5b2da4c46` |
| Natsai | `https://seal-open-test.natsai.xyz` | `0x3c93ec1474454e1b47cf485a4e5361a5878d722b9492daf10ef626a76adc3dad` |
| Mhax.io | `https://seal-testnet-open.suiftly.io` | `0x6a0726a1ea3d62ba2f2ae51104f2c3633c003fb75621d06fde47f04dc930ba06` |

> Source of truth: [Seal-Config.md](../Seal-Config.md) (pulled from `seal-docs.wal.app/Pricing` on 2026-05-18). Object IDs are canonical — operators may rotate URLs; the SDK resolves URLs from the on-chain KeyServer object at runtime.

### Seal Key Servers (Mainnet)

Mainnet key server object IDs are returned at runtime by `getAllowlistedKeyServers("mainnet")` from `@mysten/seal`. Do not hardcode mainnet IDs; fetch them at app boot.

Verified mainnet operators at Seal mainnet launch (Sept 2025): Ruby Nodes, NodeInfra, Studio Mirai, Overclock, H2O Nodes, Triton One, and Enoki by Mysten Labs.

### Enoki

Public API key (frontend) and secret API key (backend) are obtained from the [Enoki Portal](https://portal.enoki.mystenlabs.com/). Set up:

1. Create an Enoki app
2. Configure OAuth providers (Google, Apple)
3. Generate public + secret keys (one pair per network: testnet, mainnet)
4. Set move-call allowlist for sponsored transactions

---

## 7. Package IDs

### Seal package (testnet) — *already deployed by Mysten*

```env
SEAL_PACKAGE_ID_TESTNET=0x8d90881fc48eb30d4422db68083b49e7d0f879658444e3a0ed85ce47feaa54b2
```

### Keepra package (To Be Filled)

These are assigned when the Keepra Move package is deployed. Once deployed, record here:

```env
# Testnet
KEEPRA_PACKAGE_ID_TESTNET=0x...
KEEPRA_UPGRADE_CAP_TESTNET=0x...

# Mainnet (post-audit, v1+)
KEEPRA_PACKAGE_ID_MAINNET=0x...
KEEPRA_UPGRADE_CAP_MAINNET=null  # Made immutable
```

---

## 8. Required Environment Variables

### Frontend (`apps/web/.env.local`)

```env
# Sui
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_SUI_RPC_URL=https://fullnode.testnet.sui.io:443
NEXT_PUBLIC_KEEPRA_PACKAGE_ID=0x...

# Walrus
NEXT_PUBLIC_WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
NEXT_PUBLIC_WALRUS_AGGREGATORS=https://aggregator.walrus-testnet.walrus.space,https://...

# ─── Seal: Move Package ───
NEXT_PUBLIC_SEAL_PACKAGE_ID=0x8d90881fc48eb30d4422db68083b49e7d0f879658444e3a0ed85ce47feaa54b2

# ─── Seal: Decentralized Committee Server (primary) ───
NEXT_PUBLIC_SEAL_COMMITTEE_SERVER_ID=0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98
NEXT_PUBLIC_SEAL_COMMITTEE_AGGREGATOR_URL=https://seal-aggregator-testnet.mystenlabs.com

# ─── Seal: Independent servers (for hybrid; only the ones we plan to use) ───
NEXT_PUBLIC_SEAL_INDEP_RUBY=0x6068c0acb197dddbacd4746a9de7f025b2ed5a5b6c1b1ab44dade4426d141da2
NEXT_PUBLIC_SEAL_INDEP_NODEINFRA=0x5466b7df5c15b508678d51496ada8afab0d6f70a01c10613123382b1b8131007
# Add more from Seal-Config.md as needed

# Enoki
NEXT_PUBLIC_ENOKI_API_KEY=enoki_public_...
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...
NEXT_PUBLIC_APPLE_CLIENT_ID=...

# Backend
NEXT_PUBLIC_API_URL=https://api.keepra.app

# Telemetry
NEXT_PUBLIC_SENTRY_DSN=https://...
```

### Backend (`apps/api/.env`, `apps/indexer/.env`, etc.)

```env
# Sui
SUI_NETWORK=testnet
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
KEEPRA_PACKAGE_ID=0x...

# Database
DATABASE_URL=postgres://user:pass@host:5432/keepra

# Enoki (backend secret key)
ENOKI_SECRET_KEY=enoki_secret_...

# Email
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
SES_FROM_ADDRESS=noreply@keepra.app
KMS_KEY_ARN=arn:aws:kms:us-east-1:...:key/...

# Operator wallet (trigger daemon)
DAEMON_WALLET_PRIVATE_KEY=...   # In Secrets Manager in production

# Observability
LOG_LEVEL=info
SENTRY_DSN=https://...
```

---

## 9. CI / CD

### GitHub Actions workflows

| Workflow | Trigger | Steps |
|---|---|---|
| `ci.yml` | Every PR + push to main | Install, lint, test, build for all packages |
| `move-test.yml` | Move file changes | `sui move build && sui move test` |
| `e2e.yml` | PR labelled `e2e` + nightly | Playwright against staging env |
| `deploy-frontend.yml` | Push to main | Build + deploy to Vercel preview / prod |
| `deploy-backend.yml` | Push to main | Build + deploy to Railway / Fly.io |

### Pre-commit hooks (Husky)

- `eslint --fix`
- `prettier --write`
- `move-fmt` (Move formatting; via Move-analyzer)
- Type check on staged TypeScript files

---

## 10. Browser Support

| Browser | Support level |
|---|---|
| Chrome / Edge (latest 2) | Full |
| Safari (latest 2) | Full |
| Firefox (latest 2) | Full |
| Mobile Safari (iOS 16+) | Full (PWA installable) |
| Chrome Android (latest) | Full |
| Internet Explorer | Not supported |
| Brave | Full (with caveats around Brave Shields blocking some scripts) |

Critical features that require modern browser support:
- WebCrypto API (used by Seal SDK)
- Web Workers (for heavy encryption)
- Service Workers (for PWA)
- Fetch API with abort signals

---

## 11. Performance Targets

| Metric | Target |
|---|---|
| Landing page LCP | < 1.5s |
| Vault wizard time-to-interactive | < 3s |
| 1 MB vault encryption time | < 2s |
| 10 MB vault encryption time | < 8s |
| Walrus upload (1 MB) | < 5s |
| Walrus download (1 MB) | < 3s |
| Seal decrypt time (1 MB) | < 3s |
| End-to-end claim (sign-in → plaintext rendered) | < 30s |

These targets guide UX (loading spinners, progress bars) and infrastructure choices (CDN, caching).

---

## 12. Open-Source Dependencies & Licenses

| Dep | License | Notes |
|---|---|---|
| `@mysten/sui` | Apache 2.0 | OK for commercial |
| `@mysten/seal` | Apache 2.0 | OK for commercial |
| `@mysten/walrus` | Apache 2.0 | OK for commercial |
| `@mysten/enoki` | Apache 2.0 | OK for commercial |
| `@mysten/dapp-kit-react` | Apache 2.0 | OK for commercial |
| Next.js | MIT | OK |
| TailwindCSS | MIT | OK |
| Radix UI | MIT | OK |
| Fastify | MIT | OK |

Keepra's own code is licensed Apache 2.0 (TBD — see [Roadmap.md](./Roadmap.md)).

---

## 13. Verification Checklist (before first commit of stack)

- [ ] `pnpm install` succeeds without errors
- [ ] `sui move build` succeeds against testnet framework
- [ ] `sui move test` passes (initially with skeleton tests)
- [ ] Frontend `pnpm dev` starts on `localhost:3000`
- [ ] Backend `pnpm dev` starts on `localhost:4000`
- [ ] Connect button shows Sui wallets + zkLogin option
- [ ] `@mysten/seal` `getAllowlistedKeyServers("testnet")` returns expected IDs
- [ ] `@mysten/walrus` test upload + download roundtrip works
- [ ] Postgres connection works
- [ ] AWS SES sandbox sends test email
- [ ] CI green on first PR

---

## 14. Reference Docs (Authoritative Sources)

| Topic | URL |
|---|---|
| Sui Move | https://docs.sui.io/ |
| `sui::transfer::public_freeze_object` | https://docs.sui.io/references/framework/sui-framework/transfer |
| Sui Programmable Transaction Blocks | https://docs.sui.io/concepts/transactions/prog-txn-blocks |
| Seal documentation | https://seal-docs.wal.app/ |
| Seal `Using Seal` guide | https://seal-docs.wal.app/UsingSeal |
| Seal Getting Started | https://seal-docs.wal.app/GettingStarted/ |
| Seal Design (GitHub) | https://github.com/MystenLabs/seal/blob/main/Design.md |
| Walrus documentation | https://docs.wal.app/ |
| Walrus HTTP API | https://docs.wal.app/usage/web-api.html |
| Walrus Sites | https://docs.sui.io/sui-stack/walrus/sui-stack-walrus-sites |
| Enoki | https://docs.enoki.mystenlabs.com/ |
| Enoki sponsored transactions | https://docs.enoki.mystenlabs.com/ts-sdk/sponsored-transactions |
| Mysten SDK reference | https://sdk.mystenlabs.com/ |
| Sui Overflow 2026 | https://overflow.sui.io/ |
| Sui Foundation blog (winners 2025) | https://blog.sui.io/2025-sui-overflow-hackathon-winners/ |
| Awesome Walrus | https://github.com/MystenLabs/awesome-walrus |

---

## 15. Things to Verify at Build Time

Because SDKs evolve, verify these against the installed versions:

| Item | How to verify |
|---|---|
| `@mysten/seal` field name for backupKey (`backupKey` vs `key`) | Inspect TypeScript types after install |
| `@mysten/seal` `EncryptedObject` shape | Same |
| `@mysten/walrus` `WalrusClient.writeBlob` parameters | Same |
| Sui Move framework version | Check `Move.lock` after build |
| `transfer::public_freeze_object` signature | Check Sui framework source |
| zkLogin `registerEnokiWallets` signature | Inspect `@mysten/enoki` types |

These are deliberate explicit checks because SDK details have shifted across recent versions. The code-as-written must match the installed library.

---

## See also

- [Frontend.md](./Frontend.md) — how the frontend uses these libraries
- [Backend.md](./Backend.md) — how the backend uses these libraries
- [Architecture.md](./Architecture.md) — endpoint summary
