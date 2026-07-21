extern crate std;

use super::*;
use soroban_sdk::{testutils::Address as _, vec, Address, BytesN, Env, String};

fn recipient(env: &Env, wallet: &str, role: &str, share_bps: u32) -> SplitRecipient {
    SplitRecipient {
        wallet_address: String::from_str(env, wallet),
        chain: String::from_str(env, "stellar"),
        role: String::from_str(env, role),
        share_bps,
    }
}

fn setup() -> (Env, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(RoyaltySplitRegistry, (&admin,));

    (env, admin, contract_id)
}

#[test]
fn publishes_and_reads_versioned_splits() {
    let (env, admin, contract_id) = setup();
    let client = RoyaltySplitRegistryClient::new(&env, &contract_id);
    assert_eq!(client.admin(), admin);

    let track_id = String::from_str(&env, "track-001");
    let first = vec![
        &env,
        recipient(&env, "GARTIST", "artist", 7_000),
        recipient(&env, "GPRODUCER", "producer", 3_000),
    ];
    let first_hash = BytesN::from_array(&env, &[1; 32]);

    let published = client.set_track_split(&track_id, &1, &first, &first_hash);
    assert_eq!(published.version, 1);
    assert_eq!(published.recipients, first);
    assert!(!published.frozen);
    assert_eq!(client.get_track_split(&track_id).unwrap(), published);

    let second = vec![&env, recipient(&env, "GARTIST", "artist", 10_000)];
    let second_hash = BytesN::from_array(&env, &[2; 32]);
    let updated = client.set_track_split(&track_id, &2, &second, &second_hash);

    assert_eq!(updated.version, 2);
    assert_eq!(client.get_track_split(&track_id).unwrap(), updated);
    assert_eq!(
        client.get_track_split_version(&track_id, &1).unwrap(),
        published
    );
}

#[test]
fn freezes_the_latest_split() {
    let (env, _admin, contract_id) = setup();
    let client = RoyaltySplitRegistryClient::new(&env, &contract_id);
    let track_id = String::from_str(&env, "track-frozen");
    let recipients = vec![&env, recipient(&env, "GARTIST", "artist", 10_000)];

    client.set_track_split(
        &track_id,
        &1,
        &recipients,
        &BytesN::from_array(&env, &[3; 32]),
    );
    let frozen = client.freeze_track_split(&track_id, &1);

    assert!(frozen.frozen);
    assert_eq!(client.get_track_split(&track_id).unwrap(), frozen);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn rejects_splits_that_do_not_total_one_hundred_percent() {
    let (env, _admin, contract_id) = setup();
    let client = RoyaltySplitRegistryClient::new(&env, &contract_id);
    client.set_track_split(
        &String::from_str(&env, "track-invalid"),
        &1,
        &vec![&env, recipient(&env, "GARTIST", "artist", 9_999)],
        &BytesN::from_array(&env, &[4; 32]),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn rejects_duplicate_recipients() {
    let (env, _admin, contract_id) = setup();
    let client = RoyaltySplitRegistryClient::new(&env, &contract_id);
    client.set_track_split(
        &String::from_str(&env, "track-duplicate"),
        &1,
        &vec![
            &env,
            recipient(&env, "GARTIST", "artist", 5_000),
            recipient(&env, "GARTIST", "writer", 5_000),
        ],
        &BytesN::from_array(&env, &[5; 32]),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn requires_sequential_versions() {
    let (env, _admin, contract_id) = setup();
    let client = RoyaltySplitRegistryClient::new(&env, &contract_id);
    client.set_track_split(
        &String::from_str(&env, "track-version"),
        &2,
        &vec![&env, recipient(&env, "GARTIST", "artist", 10_000)],
        &BytesN::from_array(&env, &[6; 32]),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn rejects_new_versions_after_freeze() {
    let (env, _admin, contract_id) = setup();
    let client = RoyaltySplitRegistryClient::new(&env, &contract_id);
    let track_id = String::from_str(&env, "track-final");
    let recipients = vec![&env, recipient(&env, "GARTIST", "artist", 10_000)];
    client.set_track_split(
        &track_id,
        &1,
        &recipients,
        &BytesN::from_array(&env, &[7; 32]),
    );
    client.freeze_track_split(&track_id, &1);
    client.set_track_split(
        &track_id,
        &2,
        &recipients,
        &BytesN::from_array(&env, &[8; 32]),
    );
}
