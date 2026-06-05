#[test_only]
module keepra::policy_tests;

use sui::clock::{Self, Clock};
use sui::test_scenario as ts;
use keepra::vault::{Self, Vault};
use keepra::heartbeat::{Self, HeartbeatLog};
use keepra::guardian::{Self, GuardianCap};
use keepra::policy;

const OWNER: address = @0xA;
const GUARDIAN_1: address = @0xB;
const GUARDIAN_2: address = @0xC;

const INACTIVITY_SECS: u64 = 86_400; // 1 day
const QUORUM: u8 = 2;
const START_MS: u64 = 1_000;
const SEAL_ID: vector<u8> = b"keepra-seal-id-32-bytes-nonce-xx";

// Seal a vault as OWNER with two guardians. Caller owns the returned Clock.
fun setup_vault(scenario: &mut ts::Scenario): Clock {
    let mut clk = clock::create_for_testing(scenario.ctx());
    clk.set_for_testing(START_MS);

    vault::create_and_seal(
        b"blob",
        option::none(),
        SEAL_ID,
        1,
        vector[],
        INACTIVITY_SECS,
        vector[GUARDIAN_1, GUARDIAN_2],
        QUORUM,
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
fun test_approve_inactivity_only() {
    let mut scenario = ts::begin(OWNER);
    let mut clk = setup_vault(&mut scenario);

    scenario.next_tx(OWNER);
    // Advance past the inactivity window (in ms).
    clk.set_for_testing(START_MS + INACTIVITY_SECS * 1000);

    let v = ts::take_immutable<Vault>(&scenario);
    let log = ts::take_shared<HeartbeatLog>(&scenario);
    assert!(policy::approve_release(SEAL_ID, &v, &log, &clk), 0);

    ts::return_immutable(v);
    ts::return_shared(log);
    clock::destroy_for_testing(clk);
    scenario.end();
}

#[test]
fun test_approve_quorum_only() {
    let mut scenario = ts::begin(OWNER);
    let clk = setup_vault(&mut scenario); // clock NOT advanced — inactivity not satisfied

    // Two guardians attest to reach quorum=2.
    scenario.next_tx(GUARDIAN_1);
    let cap1 = ts::take_from_sender<GuardianCap>(&scenario);
    let mut log = ts::take_shared<HeartbeatLog>(&scenario);
    guardian::attest(&cap1, &mut log, &clk, scenario.ctx());
    ts::return_to_sender(&scenario, cap1);
    ts::return_shared(log);

    scenario.next_tx(GUARDIAN_2);
    let cap2 = ts::take_from_sender<GuardianCap>(&scenario);
    let mut log2 = ts::take_shared<HeartbeatLog>(&scenario);
    guardian::attest(&cap2, &mut log2, &clk, scenario.ctx());
    ts::return_to_sender(&scenario, cap2);
    ts::return_shared(log2);

    scenario.next_tx(OWNER);
    let v = ts::take_immutable<Vault>(&scenario);
    let log3 = ts::take_shared<HeartbeatLog>(&scenario);
    assert!(policy::approve_release(SEAL_ID, &v, &log3, &clk), 0);
    ts::return_immutable(v);
    ts::return_shared(log3);

    clock::destroy_for_testing(clk);
    scenario.end();
}

#[test]
fun test_approve_dao_only() {
    let mut scenario = ts::begin(OWNER);
    let clk = setup_vault(&mut scenario); // no inactivity, no quorum

    scenario.next_tx(OWNER);
    let v = ts::take_immutable<Vault>(&scenario);
    let mut log = ts::take_shared<HeartbeatLog>(&scenario);
    heartbeat::set_dao_released_for_testing(&mut log, true);
    assert!(policy::approve_release(SEAL_ID, &v, &log, &clk), 0);

    ts::return_immutable(v);
    ts::return_shared(log);
    clock::destroy_for_testing(clk);
    scenario.end();
}

#[test]
fun test_approve_neither_fails() {
    let mut scenario = ts::begin(OWNER);
    let clk = setup_vault(&mut scenario);

    scenario.next_tx(OWNER);
    let v = ts::take_immutable<Vault>(&scenario);
    let log = ts::take_shared<HeartbeatLog>(&scenario);
    assert!(!policy::approve_release(SEAL_ID, &v, &log, &clk), 0);

    ts::return_immutable(v);
    ts::return_shared(log);
    clock::destroy_for_testing(clk);
    scenario.end();
}

#[test]
fun test_approve_revoked_fails() {
    let mut scenario = ts::begin(OWNER);
    let mut clk = setup_vault(&mut scenario);

    // Owner revokes.
    scenario.next_tx(OWNER);
    let mut log = ts::take_shared<HeartbeatLog>(&scenario);
    vault::revoke_vault(&mut log, &clk, scenario.ctx());
    ts::return_shared(log);

    // Even with inactivity satisfied, revoke overrides.
    scenario.next_tx(OWNER);
    clk.set_for_testing(START_MS + INACTIVITY_SECS * 1000);
    let v = ts::take_immutable<Vault>(&scenario);
    let log2 = ts::take_shared<HeartbeatLog>(&scenario);
    assert!(!policy::approve_release(SEAL_ID, &v, &log2, &clk), 0);

    ts::return_immutable(v);
    ts::return_shared(log2);
    clock::destroy_for_testing(clk);
    scenario.end();
}

#[test]
fun test_approve_wrong_identity_fails() {
    let mut scenario = ts::begin(OWNER);
    let mut clk = setup_vault(&mut scenario);

    scenario.next_tx(OWNER);
    clk.set_for_testing(START_MS + INACTIVITY_SECS * 1000); // conditions satisfied
    let v = ts::take_immutable<Vault>(&scenario);
    let log = ts::take_shared<HeartbeatLog>(&scenario);
    // Wrong identity bytes → must fail even though release condition holds.
    assert!(!policy::approve_release(b"wrong-identity", &v, &log, &clk), 0);

    ts::return_immutable(v);
    ts::return_shared(log);
    clock::destroy_for_testing(clk);
    scenario.end();
}
