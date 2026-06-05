#[test_only]
module keepra::vault_tests;

use sui::clock;
use sui::test_scenario as ts;
use keepra::vault::{Self, Vault};
use keepra::heartbeat::HeartbeatLog;

const OWNER: address = @0xA;
const GUARDIAN_1: address = @0xB;
const GUARDIAN_2: address = @0xC;
const GUARDIAN_3: address = @0xD;

const INACTIVITY_SECS: u64 = 86_400; // 1 day
const QUORUM_OK: u8 = 2;

const TEST_BLOB_ID: vector<u8> = b"test-walrus-blob-id";
const TEST_SEAL_ID: vector<u8> = b"test-seal-id";
const TEST_EMAIL_HASH: vector<u8> = b"test-email-sha256";

#[test]
fun test_create_and_seal_happy_path() {
    let mut scenario = ts::begin(OWNER);
    let clk = clock::create_for_testing(scenario.ctx());

    vault::create_and_seal(
        TEST_BLOB_ID,
        option::none(),
        TEST_SEAL_ID,
        1, // threshold
        vector[], // key_server_ids — empty allowed when threshold matches (validated downstream in Phase 4)
        INACTIVITY_SECS,
        vector[GUARDIAN_1, GUARDIAN_2, GUARDIAN_3],
        QUORUM_OK,
        option::none(),
        option::none(),
        TEST_EMAIL_HASH,
        option::none(),
        &clk,
        scenario.ctx(),
    );

    scenario.next_tx(OWNER);

    // Vault must be frozen (immutable).
    let v = ts::take_immutable<Vault>(&scenario);
    assert!(vault::guardian_quorum(&v) == QUORUM_OK, 0);
    assert!(vault::inactivity_seconds(&v) == INACTIVITY_SECS, 1);
    assert!(vault::guardian_set(&v).length() == 3, 2);
    assert!(vault::version(&v) == 1, 3);
    ts::return_immutable(v);

    // HeartbeatLog must be shared.
    let log = ts::take_shared<HeartbeatLog>(&scenario);
    ts::return_shared(log);

    clock::destroy_for_testing(clk);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = vault::EInvalidQuorum)]
fun test_create_and_seal_zero_quorum_fails() {
    let mut scenario = ts::begin(OWNER);
    let clk = clock::create_for_testing(scenario.ctx());

    vault::create_and_seal(
        TEST_BLOB_ID,
        option::none(),
        TEST_SEAL_ID,
        1,
        vector[],
        INACTIVITY_SECS,
        vector[GUARDIAN_1],
        0, // quorum == 0 → abort
        option::none(),
        option::none(),
        TEST_EMAIL_HASH,
        option::none(),
        &clk,
        scenario.ctx(),
    );

    clock::destroy_for_testing(clk);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = vault::EQuorumExceedsSet)]
fun test_create_and_seal_quorum_exceeds_set_fails() {
    let mut scenario = ts::begin(OWNER);
    let clk = clock::create_for_testing(scenario.ctx());

    vault::create_and_seal(
        TEST_BLOB_ID,
        option::none(),
        TEST_SEAL_ID,
        1,
        vector[],
        INACTIVITY_SECS,
        vector[GUARDIAN_1], // 1 guardian
        3, // quorum > set size → abort
        option::none(),
        option::none(),
        TEST_EMAIL_HASH,
        option::none(),
        &clk,
        scenario.ctx(),
    );

    clock::destroy_for_testing(clk);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = vault::EInvalidInactivity)]
fun test_create_and_seal_zero_inactivity_fails() {
    let mut scenario = ts::begin(OWNER);
    let clk = clock::create_for_testing(scenario.ctx());

    vault::create_and_seal(
        TEST_BLOB_ID,
        option::none(),
        TEST_SEAL_ID,
        1,
        vector[],
        0, // inactivity_seconds == 0 → abort
        vector[GUARDIAN_1, GUARDIAN_2, GUARDIAN_3],
        QUORUM_OK,
        option::none(),
        option::none(),
        TEST_EMAIL_HASH,
        option::none(),
        &clk,
        scenario.ctx(),
    );

    clock::destroy_for_testing(clk);
    scenario.end();
}
