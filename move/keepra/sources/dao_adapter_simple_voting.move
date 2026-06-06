/// Adapter binding the Keepra reference DAO (`simple_voting`) to the DAO Release
/// Oracle. Verifies that a passed proposal targets the release request, then
/// forwards to the package-protected `dao_release::set_released_internal`.
/// Other DAO types (Sui Multisig, governance frameworks) get their own adapters
/// (docs/Oracles.md §2.4) — the core never trusts a DAO directly.
module keepra::dao_adapter_simple_voting;

use sui::clock::Clock;
use keepra::dao_release::{Self, DAOReleaseRequest};
use keepra::heartbeat::HeartbeatLog;
use keepra::simple_voting::{Self, VotingDAO, VotingProposal};

// Error codes (global registry: docs/Contracts.md §10 — adapter range 40–49).
const EWrongProposal: u64 = 40;
const EWrongDAO: u64 = 41;
const EProposalNotPassed: u64 = 42;

public entry fun execute_release(
    req: &mut DAOReleaseRequest,
    log: &mut HeartbeatLog,
    dao: &VotingDAO,
    prop: &mut VotingProposal,
    clock: &Clock,
) {
    // The proposal must target exactly this release request.
    assert!(simple_voting::proposal_target(prop) == object::id(req), EWrongProposal);
    // The proposal's DAO must be the one passed AND the one the vault configured.
    assert!(simple_voting::proposal_dao_id(prop) == object::id(dao), EWrongDAO);
    assert!(dao_release::request_dao_id(req) == object::id(dao), EWrongDAO);
    // The proposal must have reached the DAO's threshold.
    assert!(simple_voting::has_passed(prop, dao), EProposalNotPassed);

    dao_release::set_released_internal(req, log, clock);
    simple_voting::mark_executed(prop);
}
