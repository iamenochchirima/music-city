extern crate std;
use super::*;
use soroban_sdk::{testutils::{Address as _, Events, Ledger}, vec, Address, BytesN, Env, String};
use soroban_sdk::events::Event;

fn setup() -> (Env, Address, Address) {
    let env = Env::default();
    let treasury = Address::generate(&env);
    let contract = env.register(RoyaltySplitRegistry, (&treasury,));
    (env, treasury, contract)
}
fn recipients(env: &Env) -> Vec<SplitRecipient> {
    vec![env,
        SplitRecipient { wallet: Address::generate(env), role: String::from_str(env,"artist"),share_bps: 7000 },
        SplitRecipient { wallet: Address::generate(env), role: String::from_str(env,"producer"),share_bps: 3000 }
    ]
}
#[test]
fn finalizes_and_retains_immutable_history_with_skipped_rejected_versions() {
    let (env, treasury, contract) = setup(); env.mock_all_auths();
    let client = RoyaltySplitRegistryClient::new(&env,&contract);
    assert_eq!(client.treasury(),treasury);
    let track = String::from_str(&env,"track-1"); let agreement = String::from_str(&env,"agreement-1");
    let r = recipients(&env); let zero = BytesN::from_array(&env,&[0;32]);
    let hash1 = BytesN::from_array(&env,&[1;32]); let hash2 = BytesN::from_array(&env,&[2;32]);
    let first = client.finalize_split(&track,&agreement,&2,&r,&hash1,&zero);
    assert_eq!(env.events().all().events().len(),1);
    assert_eq!(env.events().all().events()[0],SplitFinalized { track_id: track.clone(),version: 2,agreement_id: agreement.clone(),proposal_hash: hash1.clone() }.to_xdr(&env,&contract));
    assert_eq!(client.get_finalized_split(&track).unwrap(),first);
    env.ledger().with_mut(|l| l.sequence_number += 10);
    assert_eq!(client.finalize_split(&track,&agreement,&2,&r,&hash1,&zero),first);
    assert_eq!(env.events().all().events().len(),0);
    let next = client.finalize_split(&track,&agreement,&4,&r,&hash2,&hash1);
    assert_eq!(env.events().all().events().len(),1);
    assert_eq!(env.events().all().events()[0],SplitFinalized { track_id: track.clone(),version: 4,agreement_id: agreement.clone(),proposal_hash: hash2.clone() }.to_xdr(&env,&contract));
    assert_eq!(client.get_finalized_split(&track).unwrap(),next);
    assert_eq!(client.get_finalized_version(&track,&2).unwrap(),first);
    assert!(client.get_finalized_version(&track,&3).is_none());
}
#[test]
fn rejects_conflicting_republication_and_incorrect_predecessor() {
    let (env,_,contract) = setup(); env.mock_all_auths();
    let client = RoyaltySplitRegistryClient::new(&env,&contract);
    let track = String::from_str(&env,"track"); let agreement = String::from_str(&env,"agreement");
    let r = recipients(&env); let zero = BytesN::from_array(&env,&[0;32]); let hash = BytesN::from_array(&env,&[1;32]);
    client.finalize_split(&track,&agreement,&1,&r,&hash,&zero);
    assert_eq!(client.try_finalize_split(&track,&agreement,&1,&r,&BytesN::from_array(&env,&[2;32]),&zero),Err(Ok(RegistryError::ConflictingPublication)));
    assert_eq!(client.try_finalize_split(&track,&agreement,&2,&r,&BytesN::from_array(&env,&[2;32]),&zero),Err(Ok(RegistryError::PreviousFinalizedMismatch)));
    assert_eq!(client.try_finalize_split(&track,&String::from_str(&env,"other"),&2,&r,&BytesN::from_array(&env,&[2;32]),&hash),Err(Ok(RegistryError::PreviousFinalizedMismatch)));
}
#[test]
fn rejects_invalid_shares_and_duplicate_wallets() {
    let (env,_,contract) = setup(); env.mock_all_auths();
    let client = RoyaltySplitRegistryClient::new(&env,&contract);
    let track = String::from_str(&env,"track"); let agreement = String::from_str(&env,"agreement");
    let zero = BytesN::from_array(&env,&[0;32]); let hash = BytesN::from_array(&env,&[1;32]);
    let mut r = recipients(&env); let mut invalid = r.get(0).unwrap(); invalid.share_bps = 6999; r.set(0,invalid);
    assert_eq!(client.try_finalize_split(&track,&agreement,&1,&r,&hash,&zero),Err(Ok(RegistryError::InvalidTotalBps)));
    let mut duplicate = recipients(&env); let mut second = duplicate.get(1).unwrap(); second.wallet = duplicate.get(0).unwrap().wallet; duplicate.set(1,second);
    assert_eq!(client.try_finalize_split(&track,&agreement,&1,&duplicate,&hash,&zero),Err(Ok(RegistryError::DuplicateRecipient)));
}
#[test]
fn requires_actual_treasury_authorization() {
    let (env,_,contract) = setup();
    let client = RoyaltySplitRegistryClient::new(&env,&contract);
    assert!(client.try_finalize_split(&String::from_str(&env,"track"),&String::from_str(&env,"agreement"),&1,&recipients(&env),&BytesN::from_array(&env,&[1;32]),&BytesN::from_array(&env,&[0;32])).is_err());
}
