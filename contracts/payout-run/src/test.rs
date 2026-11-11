extern crate std;
use super::*;
use earnings_settlement::{EarningsSettlement, EarningsSettlementClient};
use soroban_sdk::{token, String};
use royalty_split_registry::{RoyaltySplitRegistry, RoyaltySplitRegistryClient, SplitRecipient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    vec,
};

struct Fixture {
    env: Env,
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
fn funds_multiple_sources_with_one_authorization_and_preserves_claims() {
 let f=Fixture::new();let router=f.env.register(PayoutRun, (&f.contract,));
 let c=PayoutRunClient::new(&f.env,&router);let run=BytesN::from_array(&f.env,&[90;32]);
 let a=f.request();let mut b=f.request();b.batch_id=BytesN::from_array(&f.env,&[11;32]);b.source_id=BytesN::from_array(&f.env,&[21;32]);
 let requests=vec![&f.env,a.clone(),b.clone()];c.fund(&run,&requests);
 assert_eq!(f.balance(&f.contract),2_000_000_000);
 assert_eq!(f.client().get_batch(&a.batch_id).unwrap().funded,1_000_000_000);
 assert_eq!(f.client().get_batch(&b.batch_id).unwrap().funded,1_000_000_000);
 c.fund(&run,&requests);assert_eq!(f.balance(&f.contract),2_000_000_000);
 assert!(c.try_fund(&run,&vec![&f.env,a]).is_err());
 f.client().claim(&b.batch_id,&0);assert_eq!(f.balance(&f.a),700_000_000);
}
#[test]
fn failed_source_rolls_back_the_whole_run() {
 let f=Fixture::new();let router=f.env.register(PayoutRun, (&f.contract,));let c=PayoutRunClient::new(&f.env,&router);
 let a=f.request();let mut b=f.request();b.batch_id=BytesN::from_array(&f.env,&[11;32]);b.source_id=BytesN::from_array(&f.env,&[21;32]);b.proposal_hash=BytesN::from_array(&f.env,&[9;32]);
 assert!(c.try_fund(&BytesN::from_array(&f.env,&[90;32]),&vec![&f.env,a.clone(),b]).is_err());
 assert_eq!(f.balance(&f.contract),0);assert!(f.client().get_batch(&a.batch_id).is_none());
}
#[test]
fn missing_treasury_authorization_and_oversized_runs_fail() {
 let f=Fixture::new();let router=f.env.register(PayoutRun, (&f.contract,));let c=PayoutRunClient::new(&f.env,&router);
 f.env.mock_auths(&[]);
 assert!(c.try_fund(&BytesN::from_array(&f.env,&[90;32]),&vec![&f.env,f.request()]).is_err());
 let mut requests=Vec::new(&f.env);for _ in 0..11 {requests.push_back(f.request());}
 assert!(c.try_fund(&BytesN::from_array(&f.env,&[90;32]),&requests).is_err());
}
