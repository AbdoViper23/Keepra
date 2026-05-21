module keepra::events;

use sui::event;

public struct VaultCreated has copy, drop, store {
    vault_id: ID,
    owner: address,
    blob_id: vector<u8>,
    heartbeat_log_id: ID,
    created_at_ms: u64,
}

public struct Heartbeat has copy, drop, store {
    vault_id: ID,
    timestamp_ms: u64,
}

public struct GuardianAttested has copy, drop, store {
    vault_id: ID,
    guardian: address,
    timestamp_ms: u64,
}

public struct VaultTriggered has copy, drop, store {
    vault_id: ID,
    reason: u8,
    triggered_at_ms: u64,
}

public struct VaultRevoked has copy, drop, store {
    vault_id: ID,
    revoked_at_ms: u64,
}

public struct DAOReleaseProposed has copy, drop, store {
    vault_id: ID,
    dao_id: ID,
    proposal_id: ID,
    proposed_at_ms: u64,
}

public struct DAOReleaseApproved has copy, drop, store {
    vault_id: ID,
    dao_id: ID,
    timestamp_ms: u64,
}

public struct VaultClaimed has copy, drop, store {
    vault_id: ID,
    claimant: address,
    timestamp_ms: u64,
}

public(package) fun emit_vault_created(
    vault_id: ID,
    owner: address,
    blob_id: vector<u8>,
    heartbeat_log_id: ID,
    created_at_ms: u64,
) {
    event::emit(VaultCreated { vault_id, owner, blob_id, heartbeat_log_id, created_at_ms });
}

public(package) fun emit_heartbeat(vault_id: ID, timestamp_ms: u64) {
    event::emit(Heartbeat { vault_id, timestamp_ms });
}

public(package) fun emit_guardian_attested(vault_id: ID, guardian: address, timestamp_ms: u64) {
    event::emit(GuardianAttested { vault_id, guardian, timestamp_ms });
}

public(package) fun emit_vault_triggered(vault_id: ID, reason: u8, triggered_at_ms: u64) {
    event::emit(VaultTriggered { vault_id, reason, triggered_at_ms });
}

public(package) fun emit_vault_revoked(vault_id: ID, revoked_at_ms: u64) {
    event::emit(VaultRevoked { vault_id, revoked_at_ms });
}

public(package) fun emit_dao_release_proposed(
    vault_id: ID,
    dao_id: ID,
    proposal_id: ID,
    proposed_at_ms: u64,
) {
    event::emit(DAOReleaseProposed { vault_id, dao_id, proposal_id, proposed_at_ms });
}

public(package) fun emit_dao_release_approved(vault_id: ID, dao_id: ID, timestamp_ms: u64) {
    event::emit(DAOReleaseApproved { vault_id, dao_id, timestamp_ms });
}

public(package) fun emit_vault_claimed(vault_id: ID, claimant: address, timestamp_ms: u64) {
    event::emit(VaultClaimed { vault_id, claimant, timestamp_ms });
}
