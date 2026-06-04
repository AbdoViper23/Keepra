module keepra::policy;

use sui::clock::Clock;
use keepra::vault::{Self, Vault};
use keepra::heartbeat::{Self, HeartbeatLog};

const ENoAccess: u64 = 0;

/// THE single Seal gateway. Key servers dry-run this function; if it does not abort,
/// they release their IBE key shares.
///
/// Seal conventions enforced here:
/// - `entry` (not `public`) — callable in a PTB but not by other Move code
/// - prefixed `seal_approve_`
/// - first parameter is the identity `id: vector<u8>`
/// - takes a Clock; side-effect free; deterministic across full nodes
entry fun seal_approve_release(id: vector<u8>, vault: &Vault, log: &HeartbeatLog, clock: &Clock) {
    assert!(approve_release(id, vault, log, clock), ENoAccess);
}

/// Pure release predicate. `public(package)` so it's testable from `policy_tests` and callable
/// by other Keepra modules, but NOT prefixed `seal_approve_` — key servers never treat it as a
/// policy. No security surface: the logic is open-source Move regardless.
public(package) fun approve_release(
    id: vector<u8>,
    vault: &Vault,
    log: &HeartbeatLog,
    clock: &Clock,
): bool {
    // 1. Identity binding: the requested id must equal the nonce sealed into this vault.
    if (id != *vault::seal_id(vault)) return false;
    // 2. Cross-reference vault <-> heartbeat log.
    if (vault::id(vault) != heartbeat::vault_id(log)) return false;
    // 3. Revocation kills decryption forever.
    if (heartbeat::is_revoked(log)) return false;
    // 4. OR-composed release conditions.
    let now = clock.timestamp_ms();
    let inactive_ok =
        now >= heartbeat::last_heartbeat_ms(log) + vault::inactivity_seconds(vault) * 1000;
    let quorum_ok =
        (heartbeat::attestation_count(log) as u8) >= vault::guardian_quorum(vault);
    let dao_ok = heartbeat::dao_released(log);
    inactive_ok || quorum_ok || dao_ok
}
