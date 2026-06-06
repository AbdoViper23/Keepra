#[test_only]
module keepra::dao_tests;

use std::string;
use sui::clock::{Self, Clock};
use sui::test_scenario as ts;
use keepra::vault::{Self, Vault};
use keepra::heartbeat::{Self, HeartbeatLog};
use keepra::policy;
use keepra::simple_voting::{Self, VotingDAO, VotingProposal};
use keepra::dao_release::{Self, DAOReleaseRequest};
use keepra::dao_adapter_simple_voting as adapter;

const OWNER: address = @0xA;
const M1: address = @0xB;
const M2: address = @0xC;
const M3: address = @0xD;

const SEAL_ID: vector<u8> = b"seal-dao";
const START_MS: u64 = 1_000;
const INACTIVITY: u64 = 86_400;
const THRESHOLD: u64 = 2;

// Create a DAO (3 members, threshold 2) and seal a vault referencing it. Returns the Clock.
fun setup(scenario: &mut ts::Scenario): Clock {
    let mut clk = clock::create_for_testing(scenario.ctx());
    clk.set_for_testing(START_MS);

    simple_voting::create_dao(string::utf8(b"Board"), vector[M1, M2, M3], THRESHOLD, scenario.ctx());
    scenario.next_tx(OWNER);
    let dao = ts::take_shared<VotingDAO>(scenario);
    let dao_id = object::id(&dao);
    ts::return_shared(dao);

    vault::create_and_seal(
        b"blob",
        option::none(),
        SEAL_ID,
        1,
        vector[],
        INACTIVITY,
        vector[M1], // guardian set (unused here — DAO is the release path)
        1,
        option::some(dao_id),
        option::some(THRESHOLD),
        b"email",
        option::none(),
        &clk,
        scenario.ctx(),
    );
    clk
}

#[test]
fun test_dao_release_full_flow() {
    let mut sc = ts::begin(OWNER);
    let clk = setup(&mut sc);

    // Materialize the frozen vault + shared log + shared DAO.
    sc.next_tx(OWNER);
    let vault = ts::take_immutable<Vault>(&sc);
    let mut log = ts::take_shared<HeartbeatLog>(&sc);
    let dao = ts::take_shared<VotingDAO>(&sc);

    // Nothing satisfies the policy yet (no inactivity, no quorum, no DAO).
    assert!(!policy::approve_release(SEAL_ID, &vault, &log, &clk), 100);

    // 1. Anyone opens a DAO release request for the vault.
    dao_release::propose(&vault, &clk, sc.ctx());
    sc.next_tx(M1);
    let mut req = ts::take_shared<DAOReleaseRequest>(&sc);

    // 2. A member opens a voting proposal targeting that request.
    simple_voting::propose(&dao, object::id(&req), sc.ctx());
    sc.next_tx(M1);
    let mut prop = ts::take_shared<VotingProposal>(&sc);

    // 3. Two members vote yes → threshold reached.
    simple_voting::vote(&dao, &mut prop, true, sc.ctx()); // M1
    sc.next_tx(M2);
    simple_voting::vote(&dao, &mut prop, true, sc.ctx()); // M2
    assert!(simple_voting::has_passed(&prop, &dao), 101);

    // 4. Execute via the adapter → flips dao_released.
    adapter::execute_release(&mut req, &mut log, &dao, &mut prop, &clk);
    assert!(heartbeat::dao_released(&log), 102);
    assert!(dao_release::request_executed(&req), 103);

    // 5. The policy now permits release purely via the DAO condition.
    assert!(policy::approve_release(SEAL_ID, &vault, &log, &clk), 104);

    ts::return_immutable(vault);
    ts::return_shared(log);
    ts::return_shared(dao);
    ts::return_shared(req);
    ts::return_shared(prop);
    clock::destroy_for_testing(clk);
    sc.end();
}

#[test]
#[expected_failure(abort_code = adapter::EProposalNotPassed)]
fun test_execute_before_threshold_fails() {
    let mut sc = ts::begin(OWNER);
    let clk = setup(&mut sc);

    sc.next_tx(OWNER);
    let vault = ts::take_immutable<Vault>(&sc);
    let mut log = ts::take_shared<HeartbeatLog>(&sc);
    let dao = ts::take_shared<VotingDAO>(&sc);

    dao_release::propose(&vault, &clk, sc.ctx());
    sc.next_tx(M1);
    let mut req = ts::take_shared<DAOReleaseRequest>(&sc);

    simple_voting::propose(&dao, object::id(&req), sc.ctx());
    sc.next_tx(M1);
    let mut prop = ts::take_shared<VotingProposal>(&sc);

    // Only ONE yes vote — below threshold 2.
    simple_voting::vote(&dao, &mut prop, true, sc.ctx());
    adapter::execute_release(&mut req, &mut log, &dao, &mut prop, &clk); // aborts EProposalNotPassed

    ts::return_immutable(vault);
    ts::return_shared(log);
    ts::return_shared(dao);
    ts::return_shared(req);
    ts::return_shared(prop);
    clock::destroy_for_testing(clk);
    sc.end();
}

#[test]
#[expected_failure(abort_code = simple_voting::ENotMember)]
fun test_non_member_vote_fails() {
    let mut sc = ts::begin(OWNER);
    let clk = setup(&mut sc);

    sc.next_tx(OWNER);
    let vault = ts::take_immutable<Vault>(&sc);
    let log = ts::take_shared<HeartbeatLog>(&sc);
    let dao = ts::take_shared<VotingDAO>(&sc);

    dao_release::propose(&vault, &clk, sc.ctx());
    sc.next_tx(M1);
    let req = ts::take_shared<DAOReleaseRequest>(&sc);
    simple_voting::propose(&dao, object::id(&req), sc.ctx());
    sc.next_tx(M1);
    let mut prop = ts::take_shared<VotingProposal>(&sc);

    // OWNER is not a DAO member → ENotMember.
    sc.next_tx(OWNER);
    simple_voting::vote(&dao, &mut prop, true, sc.ctx());

    ts::return_immutable(vault);
    ts::return_shared(log);
    ts::return_shared(dao);
    ts::return_shared(req);
    ts::return_shared(prop);
    clock::destroy_for_testing(clk);
    sc.end();
}
