# Repo Structure

> The exact monorepo layout for Keepra. Every file Claude Code creates must live here. If you find yourself wanting to put a file somewhere not listed below, **stop and ask the user first**.

---

## Top-Level Layout

```
keepra/
├── .github/
│   └── workflows/
│       ├── ci.yml                      # lint + typecheck + build on every PR
│       ├── move-test.yml               # sui move test on Move file changes
│       ├── invariants.yml              # nightly invariant suite
│       ├── deploy-frontend.yml         # Vercel deploy on main
│       ├── deploy-backend.yml          # Railway/Fly deploy on main
│       └── deploy-walrus-sites.yml     # Walrus Sites mirror (phase 15)
│
├── .husky/
│   └── pre-commit                      # lint + format staged files
│
├── README.md                           # repo-root README (pitch + quickstart)
├── CLAUDE.md                           # read at every session start
├── Seal-Config.md                      # canonical Seal testnet values
│
├── docs/                               # all deeper documentation
│   ├── Engineering-Plan.md
│   ├── Repo-Structure.md
│   ├── Architecture.md
│   ├── Flows.md
│   ├── Contracts.md
│   ├── Frontend.md
│   ├── Backend.md
│   ├── Oracles.md
│   ├── Security.md
│   ├── Roadmap.md
│   ├── TechStack.md
│   └── BRAND.md                        # (created when product name is finalized)
│
│  Note: team-private planning notes live in a top-level
│  `internal/` folder (gitignored) — team-only docs.
│
│  Move modules are scaffolded via the installed Sui-Move skill (no static
│  Move-Reference folder; the skill is the source of truth for boilerplate).
│
├── move/
│   └── keepra/                        # Sui Move package
│       ├── Move.toml
│       ├── Move.lock
│       ├── sources/
│       │   ├── vault.move
│       │   ├── heartbeat.move
│       │   ├── guardian.move
│       │   ├── beneficiary.move
│       │   ├── dao_release.move        # Phase 13
│       │   ├── policy.move             # the seal_approve_release home
│       │   ├── events.move
│       │   ├── errors.move
│       │   ├── simple_voting.move      # demo DAO, Phase 13
│       │   └── dao_adapter_simple_voting.move
│       └── tests/
│           ├── vault_tests.move
│           ├── heartbeat_tests.move
│           ├── guardian_tests.move
│           ├── policy_tests.move
│           ├── dao_release_tests.move
│           ├── invariants_tests.move
│           └── integration_tests.move
│
├── apps/
│   ├── web/                            # Next.js 15 frontend
│   │   ├── app/                        # App Router
│   │   │   ├── (marketing)/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── how-it-works/page.tsx
│   │   │   │   └── security/page.tsx
│   │   │   ├── (app)/
│   │   │   │   ├── layout.tsx          # auth-gated
│   │   │   │   ├── dashboard/page.tsx
│   │   │   │   ├── create/page.tsx
│   │   │   │   ├── vault/[id]/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── revoke/page.tsx
│   │   │   │   ├── dao/[daoId]/page.tsx
│   │   │   │   └── settings/page.tsx
│   │   │   ├── guardian/
│   │   │   │   ├── onboard/[capId]/page.tsx
│   │   │   │   └── attest/[vaultId]/page.tsx
│   │   │   ├── claim/[vaultId]/page.tsx
│   │   │   ├── recover/page.tsx
│   │   │   ├── layout.tsx
│   │   │   ├── providers.tsx           # WalletProvider + Enoki
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── ui/                     # Radix-based design system
│   │   │   ├── wallet/
│   │   │   ├── vault/
│   │   │   ├── upload/
│   │   │   ├── claim/
│   │   │   ├── dao/
│   │   │   ├── recovery/
│   │   │   └── shared/
│   │   ├── lib/
│   │   │   ├── seal.ts                 # SealClient wrapper
│   │   │   ├── walrus.ts               # Walrus uploader/downloader
│   │   │   ├── sui.ts                  # SuiClient singleton
│   │   │   ├── enoki.ts                # zkLogin helpers
│   │   │   ├── sponsor.ts              # /sponsor proxy client
│   │   │   ├── seedphrase-detector.ts  # BIP-39 detection
│   │   │   ├── seal-decrypt.ts
│   │   │   └── errors.ts               # Move error code mapping
│   │   ├── stores/                     # Zustand
│   │   │   ├── useSessionStore.ts
│   │   │   ├── useWizardStore.ts
│   │   │   └── useVaultsStore.ts
│   │   ├── hooks/                      # TanStack Query wrappers
│   │   │   ├── useVault.ts
│   │   │   ├── useVaults.ts
│   │   │   └── useHeartbeat.ts
│   │   ├── workers/                    # Web Workers (heavy crypto)
│   │   │   ├── encrypt.worker.ts
│   │   │   └── decrypt.worker.ts
│   │   ├── e2e/                        # Playwright tests
│   │   │   ├── zklogin.spec.ts
│   │   │   ├── create-vault.spec.ts
│   │   │   ├── claim-vault.spec.ts
│   │   │   ├── dashboard.spec.ts
│   │   │   └── dao-release.spec.ts
│   │   ├── public/                     # static assets
│   │   ├── .env.example
│   │   ├── .env.local                  # gitignored
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── api/                            # Fastify HTTP gateway
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── health.ts
│   │   │   │   ├── vaults.ts
│   │   │   │   ├── notifications.ts
│   │   │   │   └── sponsor.ts
│   │   │   ├── enoki/client.ts
│   │   │   ├── middleware/
│   │   │   │   ├── rate-limit.ts
│   │   │   │   └── auth.ts
│   │   │   ├── db/index.ts
│   │   │   └── index.ts
│   │   ├── .env.example
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── indexer/                        # Sui event indexer
│   │   ├── src/
│   │   │   ├── subscribers/
│   │   │   │   ├── vault.ts
│   │   │   │   ├── guardian.ts
│   │   │   │   └── dao.ts
│   │   │   ├── checkpoint.ts
│   │   │   └── index.ts
│   │   ├── .env.example
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── trigger-daemon/                 # Trigger detection cron
│   │   ├── src/
│   │   │   ├── poll.ts
│   │   │   ├── notify.ts
│   │   │   └── index.ts
│   │   ├── .env.example
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── notifier/                       # SES email worker
│   │   ├── src/
│   │   │   ├── templates/
│   │   │   │   ├── trigger-alert.html
│   │   │   │   ├── heartbeat-reminder-7d.html
│   │   │   │   ├── heartbeat-reminder-1d.html
│   │   │   │   ├── guardian-invite.html
│   │   │   │   └── dao-proposal-vault.html
│   │   │   ├── render.ts
│   │   │   └── index.ts
│   │   ├── .env.example
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── shared/                         # Cross-package shared code
│       ├── src/
│       │   ├── types.ts                # Keepra-wide TS types
│       │   ├── config.ts               # endpoint URLs, package IDs
│       │   ├── sui-client.ts           # SuiClient singleton
│       │   ├── walrus-client.ts        # Walrus wrapper
│       │   ├── db/
│       │   │   ├── schema.ts           # Drizzle schema
│       │   │   ├── client.ts
│       │   │   └── migrations/
│       │   │       └── 0001_initial.sql
│       │   └── env.ts                  # zod-validated env loader
│       ├── tsconfig.json
│       └── package.json
│
├── tools/                              # Dev tools (not deployed)
│   ├── seal-roundtrip/                 # Phase 4-5 CLI
│   │   ├── index.ts
│   │   ├── .env.example
│   │   └── package.json
│   ├── demo-seed/                      # Phase 14 demo data seed
│   │   ├── index.ts
│   │   └── package.json
│   └── walrus-sites/                   # Phase 15 deploy config
│       └── site.toml
│
├── tooling/                            # Shared dev configs
│   ├── eslint-config/
│   │   ├── base.js
│   │   └── package.json
│   ├── tsconfig/
│   │   ├── base.json
│   │   ├── nextjs.json
│   │   └── node.json
│   └── prettier-config/
│       └── package.json
│
├── tests/                              # Cross-cutting integration tests
│   └── invariants/
│       ├── no-operator-decrypt.test.ts
│       ├── vault-immutable.test.ts
│       ├── policy-required.test.ts
│       ├── revoke-only-edit.test.ts
│       ├── zero-gas-beneficiary.test.ts
│       └── seed-phrase-warning.test.ts
│
├── .env.example                        # root-level shared env
├── .gitignore
├── .nvmrc                              # node 20
├── .prettierrc
├── CONTRIBUTING.md
├── DEMO.md                             # how to run the demo
├── LICENSE                             # Apache 2.0
├── README.md                           # repo README (separate from docs/README.md)
├── package.json                        # root, with workspaces
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```

---

## Root `package.json`

```json
{
  "name": "keepra-monorepo",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm -r --parallel dev",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "format": "prettier --write .",
    "move:build": "cd move/keepra && sui move build",
    "move:test": "cd move/keepra && sui move test",
    "demo:seed": "pnpm --filter @keepra/demo-seed start",
    "prepare": "husky"
  },
  "devDependencies": {
    "husky": "^9.1.0",
    "prettier": "^3.3.0",
    "turbo": "^2.2.0"
  }
}
```

## `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'tools/*'
  - 'tooling/*'
  - 'tests/*'
```

## `.gitignore`

```
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
.next/
out/
build/

# Move build artifacts
move/keepra/build/

# Environment
.env
.env.local
.env.production
!.env.example

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# Testing
coverage/
playwright-report/
test-results/

# Sui CLI artifacts
.sui/

# Generated
*.tsbuildinfo
```

## `.nvmrc`

```
20
```

---

## App-Specific `package.json` Examples

### `apps/web/package.json`

```json
{
  "name": "@keepra/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
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
    "@keepra/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20.16.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/qrcode": "^1.5.0",
    "typescript": "^5.6.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.0.0",
    "vitest": "^2.1.0",
    "@testing-library/react": "^16.0.0",
    "@playwright/test": "^1.48.0"
  }
}
```

### `apps/api/package.json`

```json
{
  "name": "@keepra/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "fastify": "^5.0.0",
    "@fastify/cors": "^10.0.0",
    "@fastify/helmet": "^12.0.0",
    "@fastify/rate-limit": "^10.0.0",
    "@mysten/sui": "latest",
    "@mysten/enoki": "latest",
    "drizzle-orm": "^0.36.0",
    "postgres": "^3.4.0",
    "pino": "^9.4.0",
    "zod": "^3.23.0",
    "dotenv": "^16.4.0",
    "@keepra/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "tsx": "^4.19.0",
    "vitest": "^2.1.0",
    "@types/node": "^20.16.0"
  }
}
```

### `apps/shared/package.json`

```json
{
  "name": "@keepra/shared",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "lint": "eslint src",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@mysten/sui": "latest",
    "drizzle-orm": "^0.36.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^20.16.0"
  }
}
```

### `apps/indexer/package.json` (template; mirrors `trigger-daemon`, `notifier`)

```json
{
  "name": "@keepra/indexer",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@mysten/sui": "latest",
    "drizzle-orm": "^0.36.0",
    "postgres": "^3.4.0",
    "pino": "^9.4.0",
    "@keepra/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "tsx": "^4.19.0",
    "@types/node": "^20.16.0"
  }
}
```

### `tools/seal-roundtrip/package.json`

```json
{
  "name": "@keepra/seal-roundtrip",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "start": "tsx index.ts"
  },
  "dependencies": {
    "@mysten/sui": "latest",
    "@mysten/seal": "latest",
    "@mysten/walrus": "latest",
    "dotenv": "^16.4.0",
    "@keepra/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "tsx": "^4.19.0",
    "@types/node": "^20.16.0"
  }
}
```

---

## Move Package: `move/keepra/Move.toml`

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

---

## TypeScript Configs

### `tooling/tsconfig/base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "skipLibCheck": true,
    "allowJs": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

### `apps/web/tsconfig.json`

```json
{
  "extends": "../../tooling/tsconfig/base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "es2022", "webworker"],
    "jsx": "preserve",
    "allowJs": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"],
      "@keepra/shared": ["../shared/src"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### `apps/api/tsconfig.json`

```json
{
  "extends": "../../tooling/tsconfig/base.json",
  "compilerOptions": {
    "lib": ["es2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Environment Variable Files

### Root `.env.example`

```bash
# This file is at the repo root and contains shared values.
# App-specific values live in each app's own .env.example.

# Sui network (used by every app)
SUI_NETWORK=testnet
SUI_RPC_URL=https://fullnode.testnet.sui.io:443

# Keepra Move package (set after first deploy)
KEEPRA_PACKAGE_ID=
```

### `apps/web/.env.example`

> Seal values pulled from [Seal-Config.md](../Seal-Config.md) — that file is the source of truth. URLs for independent servers are resolved on-chain from the Object IDs at runtime, so we only persist IDs in env.

```bash
# Sui
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_SUI_RPC_URL=https://fullnode.testnet.sui.io:443
NEXT_PUBLIC_KEEPRA_PACKAGE_ID=

# Walrus
NEXT_PUBLIC_WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
NEXT_PUBLIC_WALRUS_AGGREGATORS=https://aggregator.walrus-testnet.walrus.space

# ─── Seal: Move Package (testnet) ───
NEXT_PUBLIC_SEAL_PACKAGE_ID=0x8d90881fc48eb30d4422db68083b49e7d0f879658444e3a0ed85ce47feaa54b2

# ─── Seal: Decentralized Committee Server (primary, recommended) ───
# Single logical server backed by a 3-of-5 MPC committee. Counts as ONE server in serverConfigs.
NEXT_PUBLIC_SEAL_COMMITTEE_SERVER_ID=0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98
NEXT_PUBLIC_SEAL_COMMITTEE_AGGREGATOR_URL=https://seal-aggregator-testnet.mystenlabs.com

# ─── Seal: Independent Open-Mode Servers (for hybrid threshold; Phase 7+) ───
NEXT_PUBLIC_SEAL_INDEP_MYSTEN_1=0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75
NEXT_PUBLIC_SEAL_INDEP_MYSTEN_2=0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8
NEXT_PUBLIC_SEAL_INDEP_RUBY=0x6068c0acb197dddbacd4746a9de7f025b2ed5a5b6c1b1ab44dade4426d141da2
NEXT_PUBLIC_SEAL_INDEP_NODEINFRA=0x5466b7df5c15b508678d51496ada8afab0d6f70a01c10613123382b1b8131007
NEXT_PUBLIC_SEAL_INDEP_MIRAI=0x164ac3d2b3b8694b8181c13f671950004765c23f270321a45fdd04d40cccf0f2
NEXT_PUBLIC_SEAL_INDEP_OVERCLOCK=0x9c949e53c36ab7a9c484ed9e8b43267a77d4b8d70e79aa6b39042e3d4c434105
NEXT_PUBLIC_SEAL_INDEP_H2O=0x39cef09b24b667bc6ed54f7159d82352fe2d5dd97ca9a5beaa1d21aa774f25a2
NEXT_PUBLIC_SEAL_INDEP_TRITON=0x4cded1abeb52a22b6becb42a91d3686a4c901cf52eee16234214d0b5b2da4c46
NEXT_PUBLIC_SEAL_INDEP_NATSAI=0x3c93ec1474454e1b47cf485a4e5361a5878d722b9492daf10ef626a76adc3dad
NEXT_PUBLIC_SEAL_INDEP_MHAX=0x6a0726a1ea3d62ba2f2ae51104f2c3633c003fb75621d06fde47f04dc930ba06

# Enoki (public key — frontend safe)
NEXT_PUBLIC_ENOKI_API_KEY=
NEXT_PUBLIC_GOOGLE_CLIENT_ID=

# Backend
NEXT_PUBLIC_API_URL=http://localhost:4000

# Telemetry (optional)
NEXT_PUBLIC_SENTRY_DSN=
```

### `apps/api/.env.example`

```bash
# Sui
SUI_NETWORK=testnet
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
KEEPRA_PACKAGE_ID=

# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/keepra

# Enoki (secret key — backend only, NEVER expose)
ENOKI_SECRET_KEY=

# Email
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
SES_FROM_ADDRESS=noreply@keepra.app
KMS_KEY_ARN=

# Daemon wallet (for mark_triggered TXs)
DAEMON_WALLET_PRIVATE_KEY=

# Observability
LOG_LEVEL=info
SENTRY_DSN=

# Server
PORT=4000
```

### `tools/seal-roundtrip/.env.example`

> Phase 4 CLI uses the **Simple** Seal client (Committee server only, threshold=1). Phase 7+ switches the frontend to **Hybrid** (Committee + 2 independents, threshold=2). See [Seal-Config.md §5](../../Seal-Config.md#5-recommended-client-config).

```bash
SUI_NETWORK=testnet
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
KEEPRA_PACKAGE_ID=

WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
WALRUS_AGGREGATORS=https://aggregator.walrus-testnet.walrus.space

# ─── Seal: Move Package ───
SEAL_PACKAGE_ID=0x8d90881fc48eb30d4422db68083b49e7d0f879658444e3a0ed85ce47feaa54b2

# ─── Seal: Decentralized Committee Server (primary, recommended) ───
SEAL_COMMITTEE_SERVER_ID=0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98
SEAL_COMMITTEE_AGGREGATOR_URL=https://seal-aggregator-testnet.mystenlabs.com

# ─── Seal: Independent Open-Mode Servers (optional, for hybrid threshold) ───
SEAL_INDEP_RUBY=0x6068c0acb197dddbacd4746a9de7f025b2ed5a5b6c1b1ab44dade4426d141da2
SEAL_INDEP_NODEINFRA=0x5466b7df5c15b508678d51496ada8afab0d6f70a01c10613123382b1b8131007

# Local Sui keypair for the CLI to sign with
CLI_WALLET_PRIVATE_KEY=
```

---

## CI Workflow Templates

### `.github/workflows/ci.yml`

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  lint-typecheck-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm -r build
```

### `.github/workflows/move-test.yml`

```yaml
name: Move Tests
on:
  push:
    paths: ['move/**']
  pull_request:
    paths: ['move/**']

jobs:
  move-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Sui CLI
        run: |
          SUI_URL=$(curl -fsSL https://api.github.com/repos/MystenLabs/sui/releases/latest \
            | grep -oP '"browser_download_url":\s*"\K[^"]+' \
            | grep 'ubuntu-x86_64.tgz$')
          curl -fsSL "$SUI_URL" | sudo tar xz -C /usr/local/bin/ ./sui
          sudo chmod +x /usr/local/bin/sui
      - run: sui --version
      - run: cd move/keepra && sui move build
      # - run: cd move/keepra && sui move test   # enable in Phase 1 once tests exist
```

---

## Husky Pre-Commit Hook

### `.husky/pre-commit`

```sh
#!/usr/bin/env sh

# Run linter on staged files
pnpm exec lint-staged

# Type-check the workspaces with staged files
pnpm typecheck
```

### Root `package.json` `lint-staged` config (add to existing)

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yaml,yml}": ["prettier --write"],
    "*.move": ["echo 'Move files: format with sui move-analyzer manually'"]
  }
}
```

---

## Naming Conventions Recap

### TypeScript files

- `kebab-case.ts` for utility/lib files: `seal-decrypt.ts`, `walrus-client.ts`
- `PascalCase.tsx` for React components: `VaultCard.tsx`, `HeartbeatButton.tsx`
- `useCamelCase.ts` for React hooks: `useVault.ts`, `useHeartbeat.ts`
- `*.test.ts` and `*.spec.ts` for tests

### Move files

- `snake_case.move`: `dao_release.move`, `simple_voting.move`
- Structs inside: `PascalCase` (`Vault`, `HeartbeatLog`)
- Functions: `snake_case` (`create_and_seal`, `mint_cap`)
- Constants: `ESCREAMING_SNAKE_CASE` for errors (`ENotOwner`)

### Directories

- All lowercase: `apps/`, `move/`, `tools/`
- Multi-word separated by hyphens: `seal-roundtrip/`, `trigger-daemon/`

---

## Where Common Things Live

When you're not sure where to put a file, use this lookup:

| You're writing...                            | Put it in...                                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| A Move struct                                | `move/keepra/sources/<module>.move`                                                                  |
| A Move test                                  | `move/keepra/tests/<module>_tests.move`                                                              |
| A React page                                 | `apps/web/app/<route>/page.tsx`                                                                      |
| A React component                            | `apps/web/components/<category>/<Component>.tsx`                                                     |
| A reusable client helper (Seal, Walrus, Sui) | `apps/web/lib/<helper>.ts` for frontend-specific; `apps/shared/src/<helper>-client.ts` for cross-app |
| A Zustand store                              | `apps/web/stores/use<Name>Store.ts`                                                                  |
| A TanStack Query hook                        | `apps/web/hooks/use<Name>.ts`                                                                        |
| A Web Worker                                 | `apps/web/workers/<name>.worker.ts`                                                                  |
| A Playwright e2e test                        | `apps/web/e2e/<flow>.spec.ts`                                                                        |
| An API route                                 | `apps/api/src/routes/<route>.ts`                                                                     |
| An indexer subscriber                        | `apps/indexer/src/subscribers/<event>.ts`                                                            |
| An email template                            | `apps/notifier/src/templates/<template>.html`                                                        |
| A DB schema change                           | `apps/shared/src/db/schema.ts` + migration file                                                      |
| A shared TS type                             | `apps/shared/src/types.ts`                                                                           |
| A dev script (one-off)                       | `tools/<tool-name>/`                                                                                 |
| A new env var                                | `*.env.example` + `apps/shared/src/env.ts` (zod schema)                                              |
| A new doc                                    | `docs/<Topic>.md`                                                                                    |

If your file doesn't fit any of these, stop and ask.

---

## See also

- [CLAUDE.md](../CLAUDE.md) — workflow rules
- [Engineering-Plan.md](./Engineering-Plan.md) — what to build in each phase
- [TechStack.md](./TechStack.md) — exact dependency versions
