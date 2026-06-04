# seal-roundtrip (Phase 4)

End-to-end proof of Keepra's cryptographic core on **Sui testnet**:

```
encrypt (Seal IBE) → seal on-chain (create_and_seal, frozen Vault)
  → guardian attest (satisfies quorum) → decrypt → byte-for-byte match
```

Ciphertext stays in memory here. Walrus upload/download is added in Phase 5.

## Prereqs

- Sui CLI installed, network = testnet.
- A funded testnet address. Faucet: https://faucet.sui.io/ (or the v2 HTTP API).
- Keepra package published to testnet (`cd move/keepra && sui client publish --gas-budget 200000000`).

## Setup

```bash
cp .env.example .env
# Fill in:
#   KEEPRA_PACKAGE_ID        — from `sui client publish`
#   CLI_WALLET_PRIVATE_KEY   — `sui keytool export --key-identity <address>` (suiprivkey... form)
```

## Run

```bash
pnpm install        # from repo root
pnpm --filter @keepra/seal-roundtrip start
```

Expected output ends with:

```
✓ Encrypted → ✓ Sealed on-chain → ✓ Attested (quorum) → ✓ Decrypted → ✓ Plaintext matches
```

## Testnet version notes

- **SDKs:** `@mysten/sui@2.17.0`, `@mysten/seal@1.1.3`.
- **Seal config:** Simple (Committee server only, `threshold: 1`), `verifyKeyServers: true`.
  Committee server object ID + aggregator URL come from `Seal-Config.md` (canonical source).
- **Testnet caveat:** Seal/Walrus testnet key servers carry no SLA and may rotate or wipe.
  Re-verify object IDs against `Seal-Config.md` if decryption starts failing.
- **Identity binding:** the IBE identity is a random 32-byte `seal_id` committed into the frozen
  Vault (see `policy::seal_approve_release` and the Phase 4 plan note on identity binding).
