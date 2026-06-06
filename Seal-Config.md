# Seal Testnet Config — Latest Values

> **Read this FIRST.** Source of truth for all Seal testnet endpoints, object IDs, and the Seal package ID. If any other doc in this repo has different values for these, **the values here win** — update the other doc.
>
> Pulled from https://seal-docs.wal.app/Pricing on 2026-05-18.

---

## 1. Seal Move Package (Testnet)

The on-chain Seal package. Use this as the `<SEAL_PACKAGE_ID>` everywhere — Move.toml deps, on-chain decryption helpers, and Sui Move registry references.

```
0x8d90881fc48eb30d4422db68083b49e7d0f879658444e3a0ed85ce47feaa54b2
```

---

## 2. Decentralized (MPC Committee) Key Server — Testnet

**This is the recommended primary key server for Keepra.** It's a single logical server backed by a 3-of-5 MPC committee. Counts as **one server** in your `SealClient.serverConfigs` array.

| Field               | Value                                                                |
| ------------------- | -------------------------------------------------------------------- |
| Object ID           | `0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98` |
| Aggregator URL      | `https://seal-aggregator-testnet.mystenlabs.com`                     |
| Threshold           | 3-of-5 (internal, hidden from app)                                   |
| Members             | Mysten Labs, Natsai, Overclock, NodeInfra, Ruby Nodes                |
| Aggregator operator | Mysten Labs                                                          |
| API key required    | No                                                                   |

---

## 3. Independent Open-Mode Key Servers — Testnet

Use any of these alongside the committee server for a hybrid threshold. **No API key needed for `Open` mode.** Each counts as one server.

| Operator     | Object ID                                                            | URL                                              |
| ------------ | -------------------------------------------------------------------- | ------------------------------------------------ |
| Mysten 1     | `0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75` | https://seal-key-server-testnet-1.mystenlabs.com |
| Mysten 2     | `0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8` | https://seal-key-server-testnet-2.mystenlabs.com |
| Ruby Nodes   | `0x6068c0acb197dddbacd4746a9de7f025b2ed5a5b6c1b1ab44dade4426d141da2` | https://seal-testnet.api.rubynodes.io            |
| NodeInfra    | `0x5466b7df5c15b508678d51496ada8afab0d6f70a01c10613123382b1b8131007` | https://open-seal-testnet.nodeinfra.com          |
| Studio Mirai | `0x164ac3d2b3b8694b8181c13f671950004765c23f270321a45fdd04d40cccf0f2` | https://open.key-server-testnet.seal.mirai.cloud |
| Overclock    | `0x9c949e53c36ab7a9c484ed9e8b43267a77d4b8d70e79aa6b39042e3d4c434105` | https://seal-testnet-open.overclock.run          |
| H2O Nodes    | `0x39cef09b24b667bc6ed54f7159d82352fe2d5dd97ca9a5beaa1d21aa774f25a2` | https://seal-open.sui-testnet.h2o-nodes.com      |
| Triton One   | `0x4cded1abeb52a22b6becb42a91d3686a4c901cf52eee16234214d0b5b2da4c46` | https://seal.testnet.sui.rpcpool.com             |
| Natsai       | `0x3c93ec1474454e1b47cf485a4e5361a5878d722b9492daf10ef626a76adc3dad` | https://seal-open-test.natsai.xyz                |
| Mhax.io      | `0x6a0726a1ea3d62ba2f2ae51104f2c3633c003fb75621d06fde47f04dc930ba06` | https://seal-testnet-open.suiftly.io             |

> URLs may change; **Object ID is canonical** (it points to the on-chain object holding the live URL).

---

## 4. `.env.example` — Copy This

```bash
# ─── Seal: Move Package ───
NEXT_PUBLIC_SEAL_PACKAGE_ID=0x8d90881fc48eb30d4422db68083b49e7d0f879658444e3a0ed85ce47feaa54b2

# ─── Seal: Decentralized Committee Server (primary, recommended) ───
NEXT_PUBLIC_SEAL_COMMITTEE_SERVER_ID=0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98
NEXT_PUBLIC_SEAL_COMMITTEE_AGGREGATOR_URL=https://seal-aggregator-testnet.mystenlabs.com

# ─── Seal: Independent Servers (for hybrid threshold) ───
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
```

---

## 5. Recommended Client Config

### Simple (use this for Phase 4 CLI roundtrip)

```ts
const sealClient = new SealClient({
  suiClient,
  serverConfigs: [
    {
      objectId: process.env.NEXT_PUBLIC_SEAL_COMMITTEE_SERVER_ID,
      aggregatorUrl: process.env.NEXT_PUBLIC_SEAL_COMMITTEE_AGGREGATOR_URL,
      weight: 1,
    },
  ],
  verifyKeyServers: true,
});
// encrypt with threshold: 1
```

### Hybrid (use this for Phase 7 onward, stronger pitch)

```ts
const sealClient = new SealClient({
  suiClient,
  serverConfigs: [
    {
      objectId: process.env.NEXT_PUBLIC_SEAL_COMMITTEE_SERVER_ID,
      aggregatorUrl: process.env.NEXT_PUBLIC_SEAL_COMMITTEE_AGGREGATOR_URL,
      weight: 1,
    },
    { objectId: process.env.NEXT_PUBLIC_SEAL_INDEP_RUBY, weight: 1 },
    { objectId: process.env.NEXT_PUBLIC_SEAL_INDEP_NODEINFRA, weight: 1 },
  ],
  verifyKeyServers: true,
});
// encrypt with threshold: 2 (2-of-3)
```

---

## 6. What to Update in Other Docs

When you read this file first, then go to the rest of the repo, **replace the following old/placeholder values wherever they appear**:

| Old / Placeholder                                                               | Replace with                                         |
| ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `0xCOMMITTEE_KEY_SERVER_OBJECT_ID`                                              | the Committee Server Object ID above                 |
| Any old `NEXT_PUBLIC_SEAL_KEY_SERVER_IDS=...,...,...` comma list                | the new env var structure in section 4               |
| Any old `NEXT_PUBLIC_SEAL_KEY_SERVER_URLS=...,...,...` comma list               | delete — URLs are looked up from Object IDs on-chain |
| Any hardcoded `https://seal-key-server-testnet-*.mystenlabs.com` arrays in code | replace with config-driven `serverConfigs`           |
| Missing `NEXT_PUBLIC_SEAL_PACKAGE_ID`                                           | add it per section 4                                 |

Files that likely contain stale values:

- `Repo-Structure.md` (the `.env.example` template)
- `TechStack.md` (the Seal key servers section)
- `Architecture.md` (Seal flow section, if it hardcodes endpoints)
- `apps/web/.env.example` (after Phase 0 setup)
- `tools/seal-roundtrip/.env.example` (after Phase 4 setup)

---

## 7. Notes & Caveats

- **No SLA on testnet.** The Pricing page warns: testnet key servers have no availability guarantees, SLAs, or long-term key persistence. Fine for testnet-only development; not for mainnet production.
- **Object ID is canonical.** URLs are not — operators can update the URL of the on-chain KeyServer object. The SDK resolves URLs from the object at runtime.
- **API keys.** All `Open` mode servers above are free and require no API key for testnet. `Permissioned` mode servers (not listed here) require contacting the operator.
- **Mainnet.** When migrating to mainnet (post-MVP, see Roadmap v1), all of these values will be different. Don't reuse testnet IDs on mainnet.
- **Re-verify before deployment.** Check the live Pricing page (https://seal-docs.wal.app/Pricing) before deploying to confirm values haven't changed.
