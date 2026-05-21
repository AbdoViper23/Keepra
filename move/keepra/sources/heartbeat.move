module keepra::heartbeat;

public struct HeartbeatLog has key {
    id: UID,
    vault_id: ID,
    owner: address,
    last_heartbeat_ms: u64,
    revoked: bool,
    triggered: bool,
    trigger_reason: u8,
    attestations: vector<address>,
    dao_released: bool,
}

// Called only by vault::create_and_seal.
public(package) fun new(
    vault_id: ID,
    owner: address,
    now_ms: u64,
    ctx: &mut TxContext,
): HeartbeatLog {
    HeartbeatLog {
        id: object::new(ctx),
        vault_id,
        owner,
        last_heartbeat_ms: now_ms,
        revoked: false,
        triggered: false,
        trigger_reason: 0,
        attestations: vector[],
        dao_released: false,
    }
}

public fun id(log: &HeartbeatLog): ID { object::id(log) }
public fun vault_id(log: &HeartbeatLog): ID { log.vault_id }
public fun owner(log: &HeartbeatLog): address { log.owner }
public fun last_heartbeat_ms(log: &HeartbeatLog): u64 { log.last_heartbeat_ms }
public fun is_revoked(log: &HeartbeatLog): bool { log.revoked }
public fun is_triggered(log: &HeartbeatLog): bool { log.triggered }
public fun trigger_reason(log: &HeartbeatLog): u8 { log.trigger_reason }
public fun attestations(log: &HeartbeatLog): &vector<address> { &log.attestations }
public fun attestation_count(log: &HeartbeatLog): u64 { log.attestations.length() }
public fun dao_released(log: &HeartbeatLog): bool { log.dao_released }

// Sharing has to happen in this module because `transfer::share_object` is
// restricted to the object's defining module.
public(package) fun share(log: HeartbeatLog) {
    transfer::share_object(log);
}

// Phase 2+ adds setters: heartbeat(), set_revoked(), set_triggered(), add_attestation(), set_dao_released().
