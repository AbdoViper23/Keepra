module keepra::vault;

use std::string::String;
use sui::clock::Clock;
use keepra::heartbeat::{Self, HeartbeatLog};
use keepra::guardian;
use keepra::events;

// Error codes. Numbering matches the global registry in docs/Contracts.md §10.
const ENotOwner: u64 = 1;
const EAlreadyRevoked: u64 = 6;
const EInvalidQuorum: u64 = 7;
const EQuorumExceedsSet: u64 = 8;
const EInvalidInactivity: u64 = 9;
const EInvalidThreshold: u64 = 10;

public struct Vault has key, store {
    id: UID,
    owner: address,
    walrus_blob_id: vector<u8>,
    seal_id: vector<u8>,
    threshold: u8,
    key_server_ids: vector<ID>,
    inactivity_seconds: u64,
    guardian_quorum: u8,
    guardian_set: vector<address>,
    dao_id: Option<ID>,
    dao_threshold: Option<u64>,
    beneficiary_email_hash: vector<u8>,
    beneficiary_zk_sub: Option<String>,
    heartbeat_log_id: ID,
    version: u64,
    created_at_ms: u64,
}

public fun create_and_seal(
    blob_id: vector<u8>,
    seal_id: vector<u8>,
    threshold: u8,
    key_server_ids: vector<ID>,
    inactivity_seconds: u64,
    guardian_set: vector<address>,
    guardian_quorum: u8,
    dao_id: Option<ID>,
    dao_threshold: Option<u64>,
    beneficiary_email_hash: vector<u8>,
    beneficiary_zk_sub: Option<String>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(guardian_quorum > 0, EInvalidQuorum);
    assert!((guardian_quorum as u64) <= guardian_set.length(), EQuorumExceedsSet);
    assert!(inactivity_seconds > 0, EInvalidInactivity);
    // Threshold of 0 always invalid. Upper bound checked only when key_server_ids is non-empty
    // (Phase 4 supplies real server IDs; Phase 1 tests pass an empty vector).
    assert!(threshold > 0, EInvalidThreshold);
    if (!key_server_ids.is_empty()) {
        assert!((threshold as u64) <= key_server_ids.length(), EInvalidThreshold);
    };

    let owner = ctx.sender();
    let now_ms = clock.timestamp_ms();

    // Pre-allocate vault UID so the HeartbeatLog can reference it.
    let vault_uid = object::new(ctx);
    let vault_id = vault_uid.to_inner();

    let log = heartbeat::new(vault_id, owner, now_ms, ctx);
    let heartbeat_log_id = heartbeat::id(&log);

    let vault = Vault {
        id: vault_uid,
        owner,
        walrus_blob_id: blob_id,
        seal_id,
        threshold,
        key_server_ids,
        inactivity_seconds,
        guardian_quorum,
        guardian_set,
        dao_id,
        dao_threshold,
        beneficiary_email_hash,
        beneficiary_zk_sub,
        heartbeat_log_id,
        version: 1,
        created_at_ms: now_ms,
    };

    // Mint a GuardianCap per guardian; each one is routed straight to the guardian's
    // address (no intermediate holding). Bounded by guardian_set length (typically ≤ 10).
    let mut i = 0;
    let n = vault.guardian_set.length();
    while (i < n) {
        guardian::mint_and_transfer(vault_id, vault.guardian_set[i], ctx);
        i = i + 1;
    };

    events::emit_vault_created(
        vault_id,
        owner,
        vault.walrus_blob_id,
        heartbeat_log_id,
        now_ms,
    );

    heartbeat::share(log);

    // Invariant I2: the Vault is frozen and never mutated after this line.
    transfer::public_freeze_object(vault);
}

// ─── Entry: owner permanently disables release (Invariant I4 — only edit operation) ───

public fun revoke_vault(log: &mut HeartbeatLog, clock: &Clock, ctx: &TxContext) {
    assert!(ctx.sender() == heartbeat::owner(log), ENotOwner);
    assert!(!heartbeat::is_revoked(log), EAlreadyRevoked);
    heartbeat::set_revoked(log);
    events::emit_vault_revoked(heartbeat::vault_id(log), clock.timestamp_ms());
}

// ─── Read-only accessors ───

public fun id(v: &Vault): ID { object::id(v) }
public fun owner(v: &Vault): address { v.owner }
public fun walrus_blob_id(v: &Vault): &vector<u8> { &v.walrus_blob_id }
public fun seal_id(v: &Vault): &vector<u8> { &v.seal_id }
public fun threshold(v: &Vault): u8 { v.threshold }
public fun key_server_ids(v: &Vault): &vector<ID> { &v.key_server_ids }
public fun inactivity_seconds(v: &Vault): u64 { v.inactivity_seconds }
public fun guardian_quorum(v: &Vault): u8 { v.guardian_quorum }
public fun guardian_set(v: &Vault): &vector<address> { &v.guardian_set }
public fun dao_id(v: &Vault): &Option<ID> { &v.dao_id }
public fun dao_threshold(v: &Vault): &Option<u64> { &v.dao_threshold }
public fun beneficiary_email_hash(v: &Vault): &vector<u8> { &v.beneficiary_email_hash }
public fun beneficiary_zk_sub(v: &Vault): &Option<String> { &v.beneficiary_zk_sub }
public fun heartbeat_log_id(v: &Vault): ID { v.heartbeat_log_id }
public fun version(v: &Vault): u64 { v.version }
public fun created_at_ms(v: &Vault): u64 { v.created_at_ms }
