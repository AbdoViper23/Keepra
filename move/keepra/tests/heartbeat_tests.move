#[test_only]
module keepra::heartbeat_tests;

use sui::clock::{Self, Clock};
use sui::test_scenario as ts;
use keepra::vault;
use keepra::heartbeat::{Self, HeartbeatLog};

const OWNER: address = @0xA;
const NOT_OWNER: address = @0xF;
const GUARDIAN_1: address = @0xB;
const GUARDIAN_2: address = @0xC;
const GUARDIAN_3: address = @0xD;

const INACTIVITY_SECS: u64 = 86_400;
const QUORUM_OK: u8 = 2;
const START_MS: u64 = 1_000;

// Seal a fresh vault as OWNER. Caller owns the returned Clock.
fun setup_vault(scenario: &mut ts::Scenario): Clock {
    let mut clk = clock::create_for_testing(scenario.ctx());
    clk.set_for_testing(START_MS);

    vault::create_and_seal(
        b"blob",
        b"seal-id",
        1,
        vector[],
        INACTIVITY_SECS,
        vector[GUARDIAN_1, GUARDIAN_2, GUARDIAN_3],
        QUORUM_OK,
        option::none(),
        option::none(),
        b"email-hash",
        option::none(),
        &clk,
        scenario.ctx(),
    );
    clk
}

#[test]
fun test_heartbeat_updates_timestamp() {
    let mut scenario = ts::begin(OWNER);
    let mut clk = setup_vault(&mut scenario);

    scenario.next_tx(OWNER);
    clk.increment_for_testing(5_000);

    let mut log = ts::take_shared<HeartbeatLog>(&scenario);
    heartbeat::heartbeat(&mut log, &clk, scenario.ctx());
    assert!(heartbeat::last_heartbeat_ms(&log) == START_MS + 5_000, 0);
    ts::return_shared(log);

    clock::destroy_for_testing(clk);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = heartbeat::ENotOwner)]
fun test_heartbeat_not_owner_fails() {
    let mut scenario = ts::begin(OWNER);
    let clk = setup_vault(&mut scenario);

    scenario.next_tx(NOT_OWNER);
    let mut log = ts::take_shared<HeartbeatLog>(&scenario);
    heartbeat::heartbeat(&mut log, &clk, scenario.ctx());

    ts::return_shared(log);
    clock::destroy_for_testing(clk);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = heartbeat::EVaultRevoked)]
fun test_heartbeat_on_revoked_fails() {
    let mut scenario = ts::begin(OWNER);
    let clk = setup_vault(&mut scenario);

    scenario.next_tx(OWNER);
    let mut log = ts::take_shared<HeartbeatLog>(&scenario);
    vault::revoke_vault(&mut log, &clk, scenario.ctx());
    heartbeat::heartbeat(&mut log, &clk, scenario.ctx()); // aborts here

    ts::return_shared(log);
    clock::destroy_for_testing(clk);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = heartbeat::EVaultRevoked)]
fun test_revoke_then_heartbeat_fails() {
    let mut scenario = ts::begin(OWNER);
    let clk = setup_vault(&mut scenario);

    scenario.next_tx(OWNER);
    let mut log = ts::take_shared<HeartbeatLog>(&scenario);
    vault::revoke_vault(&mut log, &clk, scenario.ctx());
    assert!(heartbeat::is_revoked(&log), 0); // state asserted between txs
    ts::return_shared(log);

    scenario.next_tx(OWNER);
    let mut log2 = ts::take_shared<HeartbeatLog>(&scenario);
    heartbeat::heartbeat(&mut log2, &clk, scenario.ctx()); // aborts here

    ts::return_shared(log2);
    clock::destroy_for_testing(clk);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = vault::EAlreadyRevoked)]
fun test_revoke_twice_aborts() {
    let mut scenario = ts::begin(OWNER);
    let clk = setup_vault(&mut scenario);

    scenario.next_tx(OWNER);
    let mut log = ts::take_shared<HeartbeatLog>(&scenario);
    vault::revoke_vault(&mut log, &clk, scenario.ctx());
    vault::revoke_vault(&mut log, &clk, scenario.ctx()); // aborts here

    ts::return_shared(log);
    clock::destroy_for_testing(clk);
    scenario.end();
}
