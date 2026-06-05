# seal-roundtrip (Phase 4–5)

End-to-end proof of Keepra's cryptographic + storage core on **Sui testnet**:

```
encrypt (Seal IBE) → upload ciphertext to Walrus → seal on-chain
  (create_and_seal, frozen Vault) → guardian attest (satisfies quorum)
  → fetch from Walrus (aggregator fallback) → sha256-verify → decrypt → byte-match
```

The ciphertext physically lives on Walrus; the roundtrip fetches it back (trying each
aggregator in order) and verifies sha256 equality before decrypting.

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
✓ Encrypted → ✓ Uploaded to Walrus → ✓ Sealed on-chain → ✓ Attested → ✓ Fetched from Walrus → ✓ Decrypted → ✓ Plaintext matches
```

To prove aggregator fallback, prepend a bogus aggregator and confirm it still completes:

```bash
WALRUS_AGGREGATORS="https://bogus.invalid.example,https://aggregator.walrus-testnet.walrus.space" \
  pnpm --filter @keepra/seal-roundtrip start
```

## Testnet version notes

- **SDKs:** `@mysten/sui@2.17.0`, `@mysten/seal@1.1.3`.
- **Seal config:** Simple (Committee server only, `threshold: 1`), `verifyKeyServers: true`.
  Committee server object ID + aggregator URL come from `Seal-Config.md` (canonical source).
- **Testnet caveat:** Seal/Walrus testnet key servers carry no SLA and may rotate or wipe.
  Re-verify object IDs against `Seal-Config.md` if decryption starts failing.
- **Identity binding:** the IBE identity is a random 32-byte `seal_id` committed into the frozen
  Vault (see `policy::seal_approve_release` and the Phase 4 plan note on identity binding).
