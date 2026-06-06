/// Keepra reference DAO — a minimal m-of-n on-chain voting module any user can
/// deploy/configure in seconds. Used as the demo DAO behind the DAO Release
/// Oracle (docs/Oracles.md §2.5). Keepra never ships its own governance for
/// production — adapters plug into existing Sui DAOs — but this gives a complete,
/// self-contained voting flow for the MVP.
module keepra::simple_voting;

use std::string::String;

// Error codes (global registry: docs/Contracts.md §10 — simple_voting range 20–29).
const ENotMember: u64 = 20;
const EWrongDAO: u64 = 21;
const EAlreadyExecuted: u64 = 22;

public struct VotingDAO has key {
    id: UID,
    name: String,
    members: vector<address>,
    threshold: u64,
}

public struct VotingProposal has key {
    id: UID,
    dao_id: ID,
    /// The object this proposal authorizes — here, a `dao_release::DAOReleaseRequest`.
    target: ID,
    yes_votes: vector<address>,
    no_votes: vector<address>,
    executed: bool,
}

public entry fun create_dao(
    name: String,
    members: vector<address>,
    threshold: u64,
    ctx: &mut TxContext,
) {
    let dao = VotingDAO { id: object::new(ctx), name, members, threshold };
    transfer::share_object(dao);
}

public entry fun propose(dao: &VotingDAO, target: ID, ctx: &mut TxContext) {
    assert!(dao.members.contains(&ctx.sender()), ENotMember);
    let prop = VotingProposal {
        id: object::new(ctx),
        dao_id: object::id(dao),
        target,
        yes_votes: vector[],
        no_votes: vector[],
        executed: false,
    };
    transfer::share_object(prop);
}

/// Idempotent per member: a member's first vote sticks; later calls no-op.
public entry fun vote(dao: &VotingDAO, prop: &mut VotingProposal, yes: bool, ctx: &TxContext) {
    let sender = ctx.sender();
    assert!(dao.members.contains(&sender), ENotMember);
    assert!(prop.dao_id == object::id(dao), EWrongDAO);
    assert!(!prop.executed, EAlreadyExecuted);
    if (!prop.yes_votes.contains(&sender) && !prop.no_votes.contains(&sender)) {
        if (yes) prop.yes_votes.push_back(sender) else prop.no_votes.push_back(sender);
    };
}

public fun has_passed(prop: &VotingProposal, dao: &VotingDAO): bool {
    prop.yes_votes.length() >= dao.threshold
}

/// Marked by the DAO adapter (same package) after a successful release.
public(package) fun mark_executed(prop: &mut VotingProposal) {
    prop.executed = true;
}

// ─── Read-only accessors ───
public fun dao_threshold(dao: &VotingDAO): u64 { dao.threshold }
public fun is_member(dao: &VotingDAO, who: address): bool { dao.members.contains(&who) }
public fun proposal_dao_id(prop: &VotingProposal): ID { prop.dao_id }
public fun proposal_target(prop: &VotingProposal): ID { prop.target }
public fun yes_count(prop: &VotingProposal): u64 { prop.yes_votes.length() }
public fun no_count(prop: &VotingProposal): u64 { prop.no_votes.length() }
public fun is_executed(prop: &VotingProposal): bool { prop.executed }
