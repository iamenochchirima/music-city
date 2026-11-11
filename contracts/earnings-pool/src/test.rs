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
    buyer: Address,
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
        let buyer=Address::generate(&env);
        token::StellarAssetClient::new(&env,&asset).mint(&buyer,&1_000_000_000);
        let contract = env.register(EarningsPool, (&treasury, &registry, &asset, &500u32));
        let fixture = Self {
            env,
            treasury,
            registry,
            asset,
            contract,
            buyer,
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
    fn request(&self)->BuyRequest {BuyRequest{order_id:BytesN::from_array(&self.env,&[10;32]),track_id:String::from_str(&self.env,"track"),version:1,proposal_hash:BytesN::from_array(&self.env,&[1;32]),buyer:self.buyer.clone(),gross:1_000_000_000}}
    fn client(&self)->EarningsPoolClient<'_>{EarningsPoolClient::new(&self.env,&self.contract)}
    fn balance(&self, address: &Address) -> i128 {
        token::Client::new(&self.env, &self.asset).balance(address)
    }
}


#[test]
fn prefunds_and_registers_paid_earnings_without_treasury_approval() {
 let f=Fixture::new();let c=f.client();let id=BytesN::from_array(&f.env,&[90;32]);
 c.top_up(&id,&100_000_000);assert_eq!(c.totals().outstanding,0);
 let r=f.request();let p=c.buy(&r);assert_eq!(p.claims.len(),2);assert_eq!(c.totals().outstanding,950_000_000);assert_eq!(c.balance(),1_050_000_000);
 c.buy(&r);assert_eq!(c.totals().outstanding,950_000_000);assert_eq!(c.balance(),1_050_000_000);
 c.claim(&r.order_id,&0);assert_eq!(f.balance(&f.a),665_000_000);
 c.claim(&r.order_id,&1);assert_eq!(f.balance(&f.b),285_000_000);assert_eq!(c.balance(),100_000_000);
 assert!(c.try_claim(&r.order_id,&0).is_err());c.return_surplus(&id,&100_000_000);assert_eq!(c.balance(),0);
 assert_eq!(f.balance(&f.treasury),2_050_000_000);
}
#[test]
fn failed_payment_cannot_register_unsupported_earnings() {
 let f=Fixture::new();let c=f.client();let mut r=f.request();r.gross=2_000_000_000;
 assert!(c.try_buy(&r).is_err());assert!(c.get_order(&r.order_id).is_none());assert_eq!(c.totals().outstanding,0);assert_eq!(c.balance(),0);
}
#[test]
fn reserved_funds_cannot_be_returned_and_changed_orders_fail() {
 let f=Fixture::new();let c=f.client();let mut r=f.request();c.buy(&r);
 assert!(c.try_return_surplus(&BytesN::from_array(&f.env,&[90;32]),&1).is_err());
 r.gross=1;assert!(c.try_buy(&r).is_err());assert_eq!(c.totals().outstanding,950_000_000);
}
#[test]
fn native_authorization_is_required_for_buyer_beneficiary_and_treasury() {
 let f=Fixture::new();let c=f.client();let r=f.request();c.buy(&r);f.env.mock_auths(&[]);
 assert!(c.try_claim(&r.order_id,&1).is_err());assert!(c.try_top_up(&BytesN::from_array(&f.env,&[90;32]),&1).is_err());
 let mut next=r.clone();next.order_id=BytesN::from_array(&f.env,&[11;32]);assert!(c.try_buy(&next).is_err());
}
#[test]
fn stale_split_and_invalid_amounts_fail_without_registering() {
 let f=Fixture::new();let c=f.client();let mut r=f.request();r.proposal_hash=BytesN::from_array(&f.env,&[9;32]);assert!(c.try_buy(&r).is_err());r=f.request();r.gross=0;assert!(c.try_buy(&r).is_err());assert_eq!(c.balance(),0);
}
