# Security

> Keepra's threat model. The product is meaningless if the security claims don't hold. This file enumerates every threat we considered, the mitigations we shipped (or deferred), and what attackers cannot achieve under our model.

---

## 1. Security Goal Statement

**Keepra guarantees that:** A sealed vault's contents can be decrypted **if and only if** the on-chain `seal_approve_release` policy returns successfully for the requesting party — and **only** by parties holding the on-chain-bound identity (the beneficiary's address).

**Keepra does NOT claim:** to protect against compromise of the user's own device, account, or cryptographic material (the user's wallet keys, browser, OS).

**The threat boundary is the user's device.** Everything outside the user's device is treated as untrusted (Walrus, Sui, Keepra servers) or partially trusted under explicit assumptions (Seal key servers, under t-of-n threshold).

---

## 2. Threat Model — STRIDE

### S — Spoofing

| Threat | Vector | Mitigation |
|---|---|---|
| Fake guardian attestation | Attacker mints a `GuardianCap` they shouldn't have | `GuardianCap` can only be minted inside `vault::create_and_seal`. Capability type system prevents forgery. |
| Fake key server in committee | Attacker registers a `KeyServer` object pointing to a legitimate URL but with a different IBE public key | `verifyKeyServers: true` at `SealClient` init fetches `/v1/service` and verifies object ID matches |
| Impersonated beneficiary | Attacker tries to claim with a different Sui address | zkLogin address is derived deterministically from OAuth `sub + iss + aud + salt`; attacker would need to compromise the OAuth account |
| Impersonated DAO | Attacker creates a DAO with the same name and lies about results | DAO is identified by Sui object ID at seal time; immutable in vault. Different DAO = different ID. |
| Phishing claim page | Attacker hosts `keepra-claim.app` and intercepts beneficiary | Walrus Sites deployment (v1+) provides verifiable frontend hash. Email links use real `keepra.app` only. |

### T — Tampering

| Threat | Vector | Mitigation |
|---|---|---|
| Modified ciphertext | Attacker swaps the Walrus blob | Walrus blobs are content-addressed; vault stores exact blob ID; substitution = different blob = vault references unchanged old blob |
| Modified Move policy | Attacker pushes a Move package upgrade that loosens `seal_approve_release` | Mainnet package upgrade authority set to none (immutable) after audit |
| Modified Vault state | Attacker changes guardian set, beneficiary, or threshold | Vault is `public_freeze_object`'d — type system prevents mutation |
| Modified HeartbeatLog (forge attestation) | Attacker calls `attest` without owning a `GuardianCap` | `attest` requires `&GuardianCap` argument; only cap-holder can call |
| Tampering during transit | MITM modifies ciphertext between Walrus and browser | AES-GCM AEAD tag detects tampering; decryption fails |
| Tampering during transit (PTB) | MITM modifies the approval PTB | PTB is signed by user before submission; key server verifies signature |

### R — Repudiation

| Threat | Mitigation |
|---|---|
| Guardian denies attesting | On-chain `attestations: vector<address>` is permanent evidence; tx digest in events |
| Owner denies revoking | `VaultRevoked` event on-chain |
| Beneficiary denies claiming | Optional `VaultClaimed` event (audit signal) |
| DAO denies passing release | All votes and proposal state are on-chain |

### I — Information Disclosure

| Threat | Mitigation |
|---|---|
| Keepra operator reads plaintext | Operator never has plaintext; encryption is client-side; no Keepra key server |
| Keepra operator reads DEK | DEK is only in user's browser briefly; never sent to backend |
| Single key server reads plaintext | Single server has only one IBE key share; cannot decrypt below threshold |
| t-1 key servers collude | Below threshold; still cannot decrypt |
| t colluding key servers | **This is the threshold assumption. Mitigation: pick t-of-n with diverse independent operators across jurisdictions.** |
| Compromised Walrus storage node | Sees ciphertext only; useless without IBE shares |
| Compromised Sui validator | Sees policy state only (not plaintext); cannot grant decryption beyond policy |
| Network observer | Sees only ciphertext (over HTTPS) and signed PTB bytes |
| Side-channel in browser | Out of scope; user trusts their own device |

### D — Denial of Service

| Threat | Mitigation |
|---|---|
| Single key server outage | t-of-n tolerance (default 2-of-3 tolerates 1 failure) |
| Multiple key servers outage | If > n-t servers down, decryption fails until recovery. Owner can opt-in to `backupKey` for emergency recovery. |
| Walrus blob expiry | Heartbeat extends blob; UI alerts 30 days before expiry; multiple aggregator fallbacks |
| Keepra backend outage | Frontend talks to Sui/Walrus/Seal directly. Email notifications delayed but claims still work. |
| Frontend hosting taken down | Walrus Sites deployment (v1+) provides censorship-resistant mirror |
| Sui network outage | Catastrophic — affects all Sui apps. Not Keepra-specific. |
| Trigger daemon down | Beneficiary's email delayed, but `seal_approve_release` re-evaluates conditions live; manual claim still works. |
| Spam vault creation | Rate limiting on sponsor proxy; gas costs deter spam |

### E — Elevation of Privilege

| Threat | Mitigation |
|---|---|
| Compromised Keepra operator wallet | Daemon wallet can only call `mark_triggered` (cosmetic flag); cannot decrypt |
| Compromised Enoki sponsor key | `allowedMoveCallTargets` limits sponsor to specific Keepra functions; cannot sponsor arbitrary attacks |
| Compromised single key server (full takeover) | Single server has 1 IBE share; cannot decrypt below threshold |
| Compromised Move package upgrader (testnet) | Testnet only; users warned not to store real secrets on testnet |
| Compromised Sui full node (lies in dry-run) | Key servers run their own trusted full nodes; multiple servers cross-check |

---

## 3. Threshold Encryption Assumptions

### What Seal guarantees

Per Seal's published design, the system provides:

- **Confidentiality**: requires < t key servers to be compromised
- **Liveness**: requires ≥ t key servers to be operational

### Keepra's configuration

| Parameter | MVP | Production v1+ |
|---|---|---|
| `n` (committee size) | 3 | 5 |
| `t` (threshold) | 2 | 3 |
| Tolerance to liveness failure | 1 server down | 2 servers down |
| Compromise threshold | Need 2 of 3 | Need 3 of 5 |
| Operator diversity | Mysten + Ruby Nodes + NodeInfra (3 jurisdictions) | Add 2 more independent operators |

### Why these numbers

- `t=2, n=3` MVP: Minimum viable threshold (no t=1 because that's trivially broken). Tolerates one operator going down without losing liveness.
- `t=3, n=5` production: Stronger collusion resistance (need 3 colluders vs 2) and stronger liveness (tolerates 2 outages).

### What we explicitly accept

If **2 of our 3 chosen key server operators** secretly collude (e.g., subpoenaed in the same jurisdiction, or breached by the same APT), they can decrypt any vault that uses that committee. Mitigations:

1. **Geographic and operational diversity** in operator selection
2. **Per-vault committee customization** (advanced users can pick their own committee)
3. **`backupKey` self-custody opt-in** (advanced users can keep their own fallback)
4. **`t=3, n=5` for production** (raises bar to 3 colluders)

This is Seal's threat model, not Keepra's invention. Keepra's job is to choose good defaults and document the trade-off clearly.

---

## 4. Oracle Risks

### DAO Release Oracle (the only oracle in MVP+)

| Risk | Mitigation |
|---|---|
| Malicious DAO members vote to release a vault | Owner is notified on `DAOReleaseProposed`; can revoke before execution; DAO selection is the owner's responsibility |
| DAO is compromised (member keys leaked) | Same as above; owner intervention required |
| Wrong DAO bound at seal time | Vault is frozen — owner must revoke and re-create with the right DAO |
| Adapter has a bug allowing release without quorum | Adapter is open-source and audited before mainnet; Move tests cover this case |
| DAO is bricked (no quorum can ever pass) | Inactivity condition still works (OR composition); DAO is not a single point of failure |

### Future oracles (out of MVP)

Each future oracle (death certificate, AI, government API, news scraper) has its own threat model in [Oracles.md](./Oracles.md). The common theme is **m-of-n committees** with **multi-jurisdictional diversity** to avoid single-point-of-failure trust assumptions.

---

## 5. Collusion Risks

### Who could collude to harm a user

| Colluders | Outcome | Mitigation |
|---|---|---|
| `m` guardians (the quorum) | Unauthorized release | Owner picks trusted guardians; can revoke pre-trigger |
| `t` key servers | Unauthorized decryption (across all vaults using that committee) | Operator and jurisdictional diversity; user can opt-in to backupKey |
| `m` guardians + `t` key servers | Belt-and-suspenders unauthorized release | Defense in depth: still need conditions to pass at `seal_approve_release` |
| Keepra operator + 1 key server | No outcome (Keepra operates no key server) | By design |
| Keepra operator alone | No decryption possible (Invariant I1) | By design |
| All guardians + DAO + Keepra operator (collusion of everyone-except-key-servers) | Cannot bypass key servers; cannot decrypt | By cryptographic design |

### What's NOT covered

- **Coerced user**: if the user is forced to sign a claim transaction, decryption succeeds. Keepra cannot distinguish coerced from voluntary signing. (Same as every wallet ever.)
- **Coerced t key servers**: t key servers subpoenaed in the same jurisdiction. Geographic diversity mitigates.
- **Coerced m guardians**: m guardians subpoenaed together. Guardian selection is the user's responsibility.

---

## 6. Endpoint Compromise

### User's device compromised

**Out of scope.** If the user's device is compromised, the attacker can:
- Read plaintext during encryption
- Sign claim transactions as the user
- Steal the `backupKey` recovery sheet if displayed on screen

Keepra cannot defend against device compromise. Standard mitigations apply:
- User should use a clean device for vault creation
- Hardware wallet integration (v1+) for tx signing
- Printed-and-stored recovery sheet (rather than screenshotted)

### Keepra backend compromised

**Confidentiality preserved.** Even with full root access to Keepra's backend:
- Plaintext is not stored anywhere on the backend
- DEKs are not stored
- IBE master keys are not stored (key servers are independent)

Attacker can:
- Send spam emails to users (but not impersonate Keepra with a valid sender domain unless they also compromise DNS)
- Spam `mark_triggered` events (cosmetic only)
- Read off-chain metadata (vault IDs, owner addresses, beneficiary email hashes — but **not** plaintext or decryption keys)

### Keepra frontend hosting compromised

This is the **highest-impact** non-cryptographic attack: malicious JavaScript could steal plaintext during encryption or DEKs during decryption.

Mitigations:
- Open-source frontend with reproducible builds
- Walrus Sites mirror (Phase 14 stretch / v1+): verifiable served content
- Subresource Integrity (SRI) for third-party libraries
- Content Security Policy headers
- Routine independent audits of deployed bundle hashes

This is the same threat web wallets face. Keepra's posture is **transparency + redundancy**: an attacker must compromise both the primary frontend and the Walrus mirror simultaneously, while users have no way to detect the mismatch.

**v2 roadmap item: browser extension** that runs a verified version of the encryption/decryption flow locally, with no external JS dependencies. Removes the frontend-hosting attack vector entirely.

---

## 7. Why We Don't Store Raw Seed Phrases Directly

### The problem

Users often want to encrypt their crypto wallet seed phrases ("Open this if I die so my heirs can access my BTC"). But storing a 24-word seed phrase as plaintext inside a vault has three failure modes:

1. **Browser memory exposure**: during encryption, the seed phrase is in `Uint8Array` memory. A malicious browser extension or compromised tab could potentially read it.
2. **Decryption-time exposure**: when the beneficiary decrypts, the seed phrase appears on their screen. Anyone over their shoulder can steal it.
3. **Confused interpretation**: A beneficiary who is not technical may not know what to do with 24 random words.

### Keepra's MVP stance — Warning + User Choice

The vault creation wizard's payload composer detects patterns matching seed phrases (12 or 24 random words from the BIP-39 wordlist) and shows a warning:

```
┌──────────────────────────────────────────────────────────────┐
│  ⚠️  This looks like a wallet seed phrase.                    │
│                                                               │
│  Storing seed phrases directly is risky:                      │
│   - Your beneficiary may not know what to do with them        │
│   - They may not have a safe way to handle them               │
│                                                               │
│  Consider instead:                                            │
│   - Instructions naming the exchange and account              │
│   - Instructions to contact a specific lawyer or executor     │
│   - Reference to a hardware wallet with separate recovery     │
│                                                               │
│  [ Use a template instead ]  [ Continue anyway ]              │
└──────────────────────────────────────────────────────────────┘
```

The user can still proceed if they choose — the warning is advisory, not prescriptive. This respects user autonomy while reducing footguns.

### v1 templates (Roadmap)

In v1, Keepra ships **pre-baked templates** that structure the payload appropriately:

| Template | Structure |
|---|---|
| Crypto Inheritance | Exchange name + account email + 2FA recovery contact + heir attorney contact |
| Hardware Wallet Recovery | Wallet model + custody-with-relationship + emergency-call number |
| Custodial Bequest | Custodian name + account number + executor contact + legal documents reference |
| Open Vault | "Just put whatever you want" (current MVP default) |

The templates **never** instruct the user to paste a raw seed phrase. They instead create a workflow where the heir contacts a real human who has separate access to the funds.

### v2 — split encoding (research)

The most secure design is **Shamir secret sharing** of the seed phrase across multiple vaults with different release conditions. The heir must combine shares from k of n vaults to reconstruct the seed. This requires UI complexity Keepra defers to v2. See [Roadmap.md](./Roadmap.md).

---

## 8. Abuse Prevention

Keepra's primitives could in principle be used for harmful purposes:

| Abuse vector | Mitigation |
|---|---|
| **Blackmail vaults** ("Pay me or my vault releases compromising info") | Keepra has no insight into vault contents; cannot intercept. **External**: report to law enforcement. Same as any encrypted messaging system. |
| **Murder-with-attestation** (kill the owner, then guardians attest) | Owner picks their own guardians. If they pick badly, that's their decision. We don't add Keepra-side veto. |
| **Hate-speech time capsules** | Keepra has no insight. Same as encrypted email. |
| **Illegal-content storage** | Walrus has its own content moderation flow at the storage layer (out of Keepra scope). Ciphertext is opaque. |
| **Spam vault creation** | Rate limiting on Keepra APIs; Sui gas costs deter mass-spamming |
| **Phishing vault links** | All Keepra notifier emails use SPF/DKIM/DMARC; user-facing copy explicitly warns about phishing |

### Keepra's stance

We are an **infrastructure provider**, not a content host. We design the platform to be **as if Keepra the company doesn't exist** — and that means we can't moderate what we can't see. Abuse mitigation lives at the user's discretion (who they choose as guardians, what they encrypt) and at legal mechanisms (subpoena the user, not Keepra).

This is the same stance taken by Signal, ProtonMail, and any end-to-end encrypted system. We do not believe Keepra's specific abuse surface is uniquely worse than these systems — and the legitimate use cases (crypto inheritance, journalist insurance, DAO succession) are net positive for society.

---

## 9. Audit Trail

Every consequential action in Keepra is **on-chain**:

| Event | Auditable evidence |
|---|---|
| Vault creation | `VaultCreated` event with full parameters |
| Heartbeat | `Heartbeat` event with timestamp |
| Guardian attest | `GuardianAttested` event with guardian address |
| Trigger flip | `VaultTriggered` event with reason code |
| Revocation | `VaultRevoked` event |
| DAO proposal | `DAOReleaseProposed` event |
| DAO release | `DAOReleaseApproved` event |
| Claim (optional) | `VaultClaimed` event |

Post-incident forensics is possible by querying Sui RPC for the full event history of a vault. No off-chain state is the source of truth.

---

## 10. Recovery Posture: Fail-Secret by Default

### The fundamental question

> "What if all key servers shut down? Is my data lost forever?"

### Keepra's answer

**Yes — by default. And this is the correct design.**

If we made data recoverable when key servers fail, we'd need to hold recovery material ourselves, which would break Invariant I1 (Keepra operator cannot decrypt).

Three opt-in escape hatches, in increasing user complexity:

| Layer | Mechanism | Default |
|---|---|---|
| **Diversified committee** | Pick 3 operators across jurisdictions | ✓ Always on |
| **Larger n** | Pick t=2, n=5 to absorb more failures | Configurable in wizard |
| **`backupKey` self-custody** | Printable QR + 24-word mnemonic; anyone holding it can decrypt | Off by default; opt-in with explicit warning |

The wizard surfaces this trade-off **explicitly**: "If you want a safety net against all key servers disappearing, check this box. It comes with a printed recovery sheet you must store in a safe place. Anyone who finds the sheet can decrypt your vault."

Same posture as Seal's own documentation: storing high-value secrets requires explicit understanding of the failure modes.

---

## 11. What an Attacker Cannot Do (Summary)

Under the threat model:

- ❌ Cannot decrypt a vault without satisfying the on-chain policy
- ❌ Cannot decrypt as Keepra operator (we hold no keys)
- ❌ Cannot decrypt by compromising < t key servers
- ❌ Cannot decrypt by compromising the backend
- ❌ Cannot mutate a sealed vault's policy, blob, or beneficiary
- ❌ Cannot bypass `seal_approve_release` (key servers verify via dry-run)
- ❌ Cannot transfer a `GuardianCap` to themselves (object ownership)
- ❌ Cannot replay an old claim (SessionKey has 10-min TTL)
- ❌ Cannot reuse a guardian's attestation without holding the cap

Under explicit failure cases:

- ✓ **Can** decrypt if they're the legitimate beneficiary
- ✓ **Can** decrypt if they compromise t key servers
- ✓ **Can** decrypt if they hold the user's opt-in backupKey
- ✓ **Can** force-trigger a vault by getting m guardians to attest (which is the intended path)
- ✓ **Can** compromise the user's device and act as them (out of scope)

---

## 12. Pre-Mainnet Security Checklist

Before mainnet deploy, Keepra must complete:

- [ ] External Move audit (e.g., OtterSec, Zellic, MoveBit)
- [ ] Frontend security review (CSP, SRI, supply chain)
- [ ] Backend penetration test
- [ ] Key server operator selection finalized (5 operators, 5 jurisdictions)
- [ ] Move package upgrade authority set to immutable
- [ ] Open-source release of frontend + backend with reproducible builds
- [ ] Walrus Sites mirror deployed
- [ ] Bug bounty program launched (Immunefi or similar)
- [ ] Incident response runbook documented
- [ ] Privacy policy + ToS reviewed by counsel
- [ ] RUFADAA tier-1 ("online tool") legal positioning confirmed
- [ ] Threat model review with 2+ external security researchers

---

## See also

- [Architecture.md §12](./Architecture.md#12-trust-boundaries-diagram) — Trust boundaries diagram
- [Contracts.md §12](./Contracts.md#12-upgrade-strategy) — Move upgrade authority
- [Oracles.md §4](./Oracles.md#4-oracle-decentralization-principles-keepras-stance) — Oracle decentralization principles
- [Roadmap.md](./Roadmap.md) — When each security improvement ships
