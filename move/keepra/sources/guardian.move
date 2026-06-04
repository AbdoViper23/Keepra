module keepra::guardian;

use sui::clock::Clock;
use keepra::heartbeat::{Self, HeartbeatLog};
use keepra::events;

// Error codes (mirror docs/Contracts.md §10 — module-private but numbering is global).
const ENotGuardian: u64 = 2;
const ECapMismatch: u64 = 3;
const EVaultRevoked: u64 = 4;

// `key` ability only — no `store`. Prevents wrapping/indirect transfer.
public struct GuardianCap has key {
    id: UID,
    vault_id: ID,
    guardian: address,
}

// Called only from vault::create_and_seal. Mints and routes directly to the guardian's
// address. Combining mint + transfer here is required because GuardianCap lacks `store`,
// so transfer::transfer must live in this module.
public(package) fun mint_and_transfer(
    vault_id: ID,
    guardian: address,
    ctx: &mut TxContext,
) {
    let cap = GuardianCap {
        id: object::new(ctx),
        vault_id,
        guardian,
    };
    transfer::transfer(cap, guardian);
}

public fun attest(
    cap: &GuardianCap,
    log: &mut HeartbeatLog,
    clock: &Clock,
    ctx: &TxContext,
) {
    let sender = ctx.sender();
    assert!(sender == cap.guardian, ENotGuardian);
    assert!(cap.vault_id == heartbeat::vault_id(log), ECapMismatch);
    assert!(!heartbeat::is_revoked(log), EVaultRevoked);

    heartbeat::add_attestation(log, sender);
    events::emit_guardian_attested(cap.vault_id, sender, clock.timestamp_ms());
}

// Read-only accessors
public fun vault_id(cap: &GuardianCap): ID { cap.vault_id }
public fun guardian(cap: &GuardianCap): address { cap.guardian }
