extern crate std;
use super::*;
use royalty_split_registry::{RoyaltySplitRegistry, RoyaltySplitRegistryClient, SplitRecipient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    vec,
};

struct Fixture {
    env: Env,
    treasury: Address,
    registry: Address,
    asset: Address,
    contract: Address,
    a: Address,
    b: Address,
}
impl Fixture {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().with_mut(|l| l.timestamp = 100);
        let treasury = Address::generate(&env);
        let a = Address::generate(&env);
        let b = Address::generate(&env);
        let registry = env.register(RoyaltySplitRegistry, (&treasury,));
        let asset = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        token::StellarAssetClient::new(&env, &asset).mint(&treasury, &2_000_000_000);
        let contract = env.register(EarningsSettlement, (&treasury, &registry, &asset));
        let fixture = Self {
            env,
            treasury,
            registry,
            asset,
            contract,
            a,
            b,
        };
        fixture.finalize(1, 7000, [1; 32], [0; 32]);
        fixture
    }
    fn finalize(&self, version: u32, share: u32, hash: [u8; 32], previous: [u8; 32]) {
        RoyaltySplitRegistryClient::new(&self.env, &self.registry).finalize_split(
            &String::from_str(&self.env, "track"),
            &String::from_str(&self.env, "agreement"),
            &version,
            &vec![
                &self.env,
                SplitRecipient {
                    wallet: self.a.clone(),
                    role: String::from_str(&self.env, "artist"),
                    share_bps: share,
                },
                SplitRecipient {
                    wallet: self.b.clone(),
                    role: String::from_str(&self.env, "producer"),
                    share_bps: 10000 - share,
                },
            ],
            &BytesN::from_array(&self.env, &hash),
            &BytesN::from_array(&self.env, &previous),
        );
    }
    fn request(&self) -> SettlementRequest {
        SettlementRequest {
            batch_id: BytesN::from_array(&self.env, &[10; 32]),
            source_id: BytesN::from_array(&self.env, &[20; 32]),
            track_id: String::from_str(&self.env, "track"),
            agreement_id: String::from_str(&self.env, "agreement"),
            version: 1,
            proposal_hash: BytesN::from_array(&self.env, &[1; 32]),
            gross_amount: 1_000_000_000,
            fee_bps: 0,
            expires_at: 200,
        }
    }
    fn client(&self) -> EarningsSettlementClient<'_> {
        EarningsSettlementClient::new(&self.env, &self.contract)
    }
    fn balance(&self, address: &Address) -> i128 {
        token::Client::new(&self.env, &self.asset).balance(address)
    }
}

#[test]
fn funds_claims_and_recovers_only_expired_obligations() {
    let f = Fixture::new();
    let request = f.request();
    let c = f.client();
    let batch = c.settle(&request);
    assert_eq!(batch.funded, 1_000_000_000);
    assert_eq!(batch.claims.get(0).unwrap().amount, 700_000_000);
    assert_eq!(batch.claims.get(1).unwrap().amount, 300_000_000);
    assert_eq!(f.balance(&f.contract), batch.funded);
    assert_eq!(
        c.try_reclaim(&request.batch_id, &1),
        Err(Ok(SettlementError::NotExpired))
    );
    c.claim(&request.batch_id, &0);
    assert_eq!(f.balance(&f.a), 700_000_000);
    assert_eq!(
        c.try_claim(&request.batch_id, &0),
        Err(Ok(SettlementError::AlreadyConsumed))
    );
    f.env.ledger().with_mut(|l| l.timestamp = 200);
    assert_eq!(
        c.try_claim(&request.batch_id, &1),
        Err(Ok(SettlementError::Expired))
    );
    c.reclaim(&request.batch_id, &1);
    assert_eq!(
        c.try_claim(&request.batch_id, &1),
        Err(Ok(SettlementError::AlreadyConsumed))
    );
    assert_eq!(
        c.try_reclaim(&request.batch_id, &1),
        Err(Ok(SettlementError::AlreadyConsumed))
    );
    let final_batch = c.get_batch(&request.batch_id).unwrap();
    assert_eq!(
        final_batch.funded,
        final_batch.claimed + final_batch.reclaimed + f.balance(&f.contract)
    );
    assert_eq!(final_batch.claimed, 700_000_000);
    assert_eq!(final_batch.reclaimed, 300_000_000);
    assert_eq!(f.balance(&f.treasury), 1_300_000_000);
}

#[test]
fn prevents_batch_and_source_replay_even_under_new_agreement() {
    let f = Fixture::new();
    let mut r = f.request();
    let c = f.client();
    c.settle(&r);
    assert_eq!(c.try_settle(&r), Err(Ok(SettlementError::AlreadySettled)));
    f.finalize(2, 5000, [2; 32], [1; 32]);
    r.batch_id = BytesN::from_array(&f.env, &[11; 32]);
    r.version = 2;
    r.proposal_hash = BytesN::from_array(&f.env, &[2; 32]);
    assert_eq!(c.try_settle(&r), Err(Ok(SettlementError::SourceConsumed)));
    r.source_id = BytesN::from_array(&f.env, &[21; 32]);
    let amended = c.settle(&r);
    assert_eq!(amended.claims.get(0).unwrap().amount, 500_000_000);
    assert_eq!(
        c.get_batch(&f.request().batch_id)
            .unwrap()
            .claims
            .get(0)
            .unwrap()
            .amount,
        700_000_000
    );
}

#[test]
fn pins_exact_historical_version_and_rejects_forged_evidence() {
    let f = Fixture::new();
    let mut r = f.request();
    let c = f.client();
    r.proposal_hash = BytesN::from_array(&f.env, &[9; 32]);
    assert_eq!(c.try_settle(&r), Err(Ok(SettlementError::InvalidAgreement)));
    r = f.request();
    r.version = 2;
    assert_eq!(c.try_settle(&r), Err(Ok(SettlementError::InvalidAgreement)));
    r = f.request();
    r.agreement_id = String::from_str(&f.env, "forged");
    assert_eq!(c.try_settle(&r), Err(Ok(SettlementError::InvalidAgreement)));
    f.finalize(3, 5000, [3; 32], [1; 32]);
    assert_eq!(
        c.settle(&f.request()).claims.get(0).unwrap().amount,
        700_000_000
    );
}

#[test]
fn deterministic_small_allocations_fees_and_limits() {
    let f = Fixture::new();
    let mut r = f.request();
    let c = f.client();
    r.gross_amount = 11;
    r.fee_bps = 2500;
    let b = c.settle(&r);
    assert_eq!(b.claims.get(0).unwrap().amount, 6);
    assert_eq!(b.claims.get(1).unwrap().amount, 3);
    assert_eq!(b.funded, 9);
    r = f.request();
    r.batch_id = BytesN::from_array(&f.env, &[12; 32]);
    r.source_id = BytesN::from_array(&f.env, &[22; 32]);
    r.gross_amount = 1;
    let b = c.settle(&r);
    assert_eq!(b.claims.get(0).unwrap().amount, 0);
    assert_eq!(b.claims.get(1).unwrap().amount, 1);
    r = f.request();
    r.gross_amount = MAX_AMOUNT + 1;
    assert_eq!(c.try_settle(&r), Err(Ok(SettlementError::InvalidRequest)));
    r = f.request();
    r.expires_at = 100;
    assert_eq!(c.try_settle(&r), Err(Ok(SettlementError::InvalidRequest)));
    r = f.request();
    r.expires_at = 100 + MAX_EXPIRY_SECONDS + 1;
    assert_eq!(c.try_settle(&r), Err(Ok(SettlementError::InvalidRequest)));
}

#[test]
fn insufficient_funding_rolls_back_source_and_batch() {
    let f = Fixture::new();
    let mut r = f.request();
    let c = f.client();
    r.gross_amount = 3_000_000_000;
    assert!(c.try_settle(&r).is_err());
    assert!(c.get_batch(&r.batch_id).is_none());
    assert_eq!(f.balance(&f.treasury), 2_000_000_000);
    assert_eq!(f.balance(&f.contract), 0);
    r.gross_amount = 1_000_000_000;
    assert_eq!(c.settle(&r).funded, 1_000_000_000);
}

#[test]
fn authorization_cannot_be_bypassed_for_funding_claim_or_reclaim() {
    let f = Fixture::new();
    let r = f.request();
    let c = f.client();
    f.env.set_auths(&[]);
    assert!(c.try_settle(&r).is_err());
    f.env.mock_all_auths();
    c.settle(&r);
    f.env.set_auths(&[]);
    assert!(c.try_claim(&r.batch_id, &0).is_err());
    f.env.ledger().with_mut(|l| l.timestamp = 200);
    assert!(c.try_reclaim(&r.batch_id, &1).is_err());
    assert_eq!(f.balance(&f.contract), 1_000_000_000);
}

#[test]
fn source_tombstones_and_batch_lifetimes_extend_together() {
    use soroban_sdk::testutils::storage::Persistent;
    let f = Fixture::new();
    let r = f.request();
    let c = f.client();
    c.settle(&r);
    let initial = f.env.as_contract(&f.contract, || {
        f.env
            .storage()
            .persistent()
            .get_ttl(&Key::Batch(r.batch_id.clone()))
    });
    assert!(initial >= TTL_EXTEND);
    f.env.ledger().with_mut(|l| l.sequence_number += 410_000);
    c.get_batch(&r.batch_id).unwrap();
    f.env.as_contract(&f.contract, || {
        let batch_ttl = f
            .env
            .storage()
            .persistent()
            .get_ttl(&Key::Batch(r.batch_id.clone()));
        let source_ttl = f
            .env
            .storage()
            .persistent()
            .get_ttl(&Key::Source(r.source_id.clone()));
        assert!(batch_ttl >= TTL_EXTEND);
        assert_eq!(batch_ttl, source_ttl);
    });
}
