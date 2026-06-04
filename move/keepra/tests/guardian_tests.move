#[test_only]
module keepra::guardian_tests;

use sui::clock::{Self, Clock};
use sui::test_scenario as ts;
use keepra::vault;
use keepra::heartbeat::{Self, HeartbeatLog};
use keepra::guardian::{Self, GuardianCap};

const OWNER: address = @0xA;
const GUARDIAN_1: address = @0xB;
const GUARDIAN_2: address = @0xC;
const GUARDIAN_3: address = @0xD;
const NOT_GUARDIAN: address = @0xF;

const INACTIVITY_SECS: u64 = 86_400;
const QUORUM_OK: u8 = 2;
const START_MS: u64 = 1_000;

// Seal a fresh vault as OWNER with three guardians. Caller owns the returned Clock.
fun setup_vault(scenario: &mut ts::Scenario, guardians: vector<address>): Clock {
    let mut clk = clock::create_for_testing(scenario.ctx());
    clk.set_for_testing(START_MS);

    vault::create_and_seal(
        b"blob",
        b"seal-id",
        1,
        vector[],
        INACTIVITY_SECS,
        guardians,
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
fun test_attest_happy_path() {
    let mut scenario = ts::begin(OWNER);
    let clk = setup_vault(&mut scenario, vector[GUARDIAN_1, GUARDIAN_2, GUARDIAN_3]);

    scenario.next_tx(GUARDIAN_1);
    let cap = ts::take_from_sender<GuardianCap>(&scenario);
    let mut log = ts::take_shared<HeartbeatLog>(&scenario);
    guardian::attest(&cap, &mut log, &clk, scenario.ctx());

    assert!(heartbeat::attestation_count(&log) == 1, 0);
    assert!(heartbeat::attestations(&log)[0] == GUARDIAN_1, 1);

    ts::return_to_sender(&scenario, cap);
    ts::return_shared(log);
    clock::destroy_for_testing(clk);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = guardian::ENotGuardian)]
fun test_attest_not_cap_owner_fails() {
    let mut scenario = ts::begin(OWNER);
    let clk = setup_vault(&mut scenario, vector[GUARDIAN_1, GUARDIAN_2, GUARDIAN_3]);

    // GUARDIAN_1 holds their cap.
    scenario.next_tx(GUARDIAN_1);
    let cap = ts::take_from_sender<GuardianCap>(&scenario);

    // NOT_GUARDIAN tries to use it. cap.guardian == GUARDIAN_1 ≠ sender → ENotGuardian.
    scenario.next_tx(NOT_GUARDIAN);
    let mut log = ts::take_shared<HeartbeatLog>(&scenario);
    guardian::attest(&cap, &mut log, &clk, scenario.ctx());

    ts::return_to_address(GUARDIAN_1, cap);
    ts::return_shared(log);
    clock::destroy_for_testing(clk);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = guardian::ECapMismatch)]
fun test_attest_wrong_vault_cap_fails() {
    let mut scenario = ts::begin(OWNER);
    let mut clk = clock::create_for_testing(scenario.ctx());
    clk.set_for_testing(START_MS);

    // Vault A: GUARDIAN_1 + GUARDIAN_2.
    vault::create_and_seal(
        b"blob-A", b"seal-A", 1, vector[], INACTIVITY_SECS,
        vector[GUARDIAN_1, GUARDIAN_2], 2,
        option::none(), option::none(),
        b"email-A", option::none(),
        &clk, scenario.ctx(),
    );

    // Vault B: GUARDIAN_2 + GUARDIAN_3 — GUARDIAN_1 deliberately excluded.
    scenario.next_tx(OWNER);
    vault::create_and_seal(
        b"blob-B", b"seal-B", 1, vector[], INACTIVITY_SECS,
        vector[GUARDIAN_2, GUARDIAN_3], 2,
        option::none(), option::none(),
        b"email-B", option::none(),
        &clk, scenario.ctx(),
    );

    // GUARDIAN_1 holds exactly one cap (for vault A).
    scenario.next_tx(GUARDIAN_1);
    let cap = ts::take_from_sender<GuardianCap>(&scenario);
    let vault_a_id = guardian::vault_id(&cap);

    // Both HeartbeatLogs are shared in this scenario; take both and identify which is which
    // by reading the `vault_id` field. The one not equal to vault A's id is vault B's.
    let log1 = ts::take_shared<HeartbeatLog>(&scenario);
    let log2 = ts::take_shared<HeartbeatLog>(&scenario);
    let (mut log_b, log_other) = if (heartbeat::vault_id(&log1) == vault_a_id) {
        (log2, log1)
    } else {
        (log1, log2)
    };

    // cap.vault_id == vault A, but log_b.vault_id == vault B → ECapMismatch.
    guardian::attest(&cap, &mut log_b, &clk, scenario.ctx());

    ts::return_to_sender(&scenario, cap);
    ts::return_shared(log_b);
    ts::return_shared(log_other);
    clock::destroy_for_testing(clk);
    scenario.end();
}

#[test]
fun test_attest_idempotent() {
    let mut scenario = ts::begin(OWNER);
    let clk = setup_vault(&mut scenario, vector[GUARDIAN_1, GUARDIAN_2, GUARDIAN_3]);

    scenario.next_tx(GUARDIAN_1);
    let cap = ts::take_from_sender<GuardianCap>(&scenario);
    let mut log = ts::take_shared<HeartbeatLog>(&scenario);

    guardian::attest(&cap, &mut log, &clk, scenario.ctx());
    guardian::attest(&cap, &mut log, &clk, scenario.ctx()); // second call — should no-op

    assert!(heartbeat::attestation_count(&log) == 1, 0);

    ts::return_to_sender(&scenario, cap);
    ts::return_shared(log);
    clock::destroy_for_testing(clk);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = guardian::EVaultRevoked)]
fun test_attest_on_revoked_fails() {
    let mut scenario = ts::begin(OWNER);
    let clk = setup_vault(&mut scenario, vector[GUARDIAN_1, GUARDIAN_2, GUARDIAN_3]);

    scenario.next_tx(OWNER);
    let mut log = ts::take_shared<HeartbeatLog>(&scenario);
    vault::revoke_vault(&mut log, &clk, scenario.ctx());
    ts::return_shared(log);

    scenario.next_tx(GUARDIAN_1);
    let cap = ts::take_from_sender<GuardianCap>(&scenario);
    let mut log2 = ts::take_shared<HeartbeatLog>(&scenario);
    guardian::attest(&cap, &mut log2, &clk, scenario.ctx()); // aborts here

    ts::return_to_sender(&scenario, cap);
    ts::return_shared(log2);
    clock::destroy_for_testing(clk);
    scenario.end();
}
