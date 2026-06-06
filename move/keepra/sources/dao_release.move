/// Core of the DAO Release Oracle (docs/Oracles.md §2.3). Holds the
/// `DAOReleaseRequest` that binds a vault + its heartbeat log to a configured
/// DAO, and the package-protected `set_released_internal` that flips
/// `HeartbeatLog.dao_released`. Only a DAO adapter (same package) may call it,
/// after verifying that DAO's pass conditions.
module keepra::dao_release;

use sui::clock::Clock;
use keepra::vault::{Self, Vault};
use keepra::heartbeat::{Self, HeartbeatLog};
use keepra::events;

// Error codes (global registry: docs/Contracts.md §10 — dao_release range 30–39; 4 = revoked).
const ENoDaoConfigured: u64 = 30;
const EWrongLog: u64 = 31;
const EAlreadyReleased: u64 = 32;
const EVaultRevoked: u64 = 4;

/// A shared, open request to release `vault_id` via its configured DAO. Created
/// by anyone (typically a DAO member); resolved by a DAO adapter.
public struct DAOReleaseRequest has key {
    id: UID,
    vault_id: ID,
    dao_id: ID,
    log_id: ID,
    executed: bool,
}

/// Open a release request for a vault that has a DAO configured. The vault is
/// frozen/immutable; we only read it. Emits DAOReleaseProposed (the indexer
/// notifies the owner — their safety net to revoke; docs/Oracles.md §2.8).
public entry fun propose(vault: &Vault, clock: &Clock, ctx: &mut TxContext) {
    let dao_opt = vault::dao_id(vault);
    assert!(dao_opt.is_some(), ENoDaoConfigured);
    let dao_id = *dao_opt.borrow();
    let vault_id = vault::id(vault);

    let req = DAOReleaseRequest {
        id: object::new(ctx),
        vault_id,
        dao_id,
        log_id: vault::heartbeat_log_id(vault),
        executed: false,
    };
    events::emit_dao_release_proposed(vault_id, dao_id, object::id(&req), clock.timestamp_ms());
    transfer::share_object(req);
}

/// Package-visible: a DAO adapter calls this AFTER verifying its DAO's pass
/// conditions. Revocation still takes precedence (Invariant: owner can revoke
/// until execution; docs/Oracles.md §2.7).
public(package) fun set_released_internal(
    req: &mut DAOReleaseRequest,
    log: &mut HeartbeatLog,
    clock: &Clock,
) {
    assert!(!req.executed, EAlreadyReleased);
    assert!(req.log_id == heartbeat::id(log), EWrongLog);
    assert!(!heartbeat::is_revoked(log), EVaultRevoked);

    heartbeat::set_dao_released(log);
    req.executed = true;
    events::emit_dao_release_approved(req.vault_id, req.dao_id, clock.timestamp_ms());
}

// ─── Read-only accessors ───
public fun request_vault_id(req: &DAOReleaseRequest): ID { req.vault_id }
public fun request_dao_id(req: &DAOReleaseRequest): ID { req.dao_id }
public fun request_log_id(req: &DAOReleaseRequest): ID { req.log_id }
public fun request_executed(req: &DAOReleaseRequest): bool { req.executed }
