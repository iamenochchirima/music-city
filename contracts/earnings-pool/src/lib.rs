#![no_std]
use soroban_sdk::{contract, contractclient, contracterror, contractevent, contractimpl, contracttype, token, Address, BytesN, Env, String, Vec};
// This client describes the registry ABI without linking another contract's exports.
#[contracttype]
#[derive(Clone)]
pub struct SplitRecipient {
    pub wallet: Address,
    pub role: String,
    pub share_bps: u32,
}
#[contracttype]
#[derive(Clone)]
pub struct FinalizedSplit {
    pub agreement_id: String,
    pub version: u32,
    pub recipients: Vec<SplitRecipient>,
    pub proposal_hash: BytesN<32>,
    pub previous_finalized_hash: BytesN<32>,
    pub finalized_ledger: u32,
}
#[contractclient(name = "RegistryClient")]
pub trait Registry {
    fn treasury(env: Env) -> Address;
    fn get_finalized_split(env: Env, track_id: String) -> Option<FinalizedSplit>;
}

const THRESHOLD:u32=100_000;
const EXTEND:u32=500_000;
const MAX:i128=i64::MAX as i128;
#[contracttype]
#[derive(Clone)]
pub struct Config {pub treasury:Address,pub registry:Address,pub asset:Address,pub fee_bps:u32,pub network:BytesN<32>}
#[contracttype]
#[derive(Clone,Debug,Eq,PartialEq)]
pub struct BuyRequest {pub order_id:BytesN<32>,pub track_id:String,pub version:u32,pub proposal_hash:BytesN<32>,pub buyer:Address,pub gross:i128}
#[contracttype]
#[derive(Clone)]
pub struct PoolClaim {pub beneficiary:Address,pub gross:i128,pub fee:i128,pub amount:i128,pub claimed:bool,pub ledger:u32}
#[contracttype]
#[derive(Clone)]
pub struct Purchase {pub request:BuyRequest,pub claims:Vec<PoolClaim>,pub ledger:u32}
#[contracttype]
#[derive(Clone)]
pub struct Movement {pub amount:i128,pub ledger:u32}
#[contracttype]
#[derive(Clone,Default)]
pub struct Totals {pub outstanding:i128,pub purchased:i128,pub fees:i128,pub claimed:i128,pub topped_up:i128,pub returned:i128}
#[contracttype]
#[derive(Clone)]
enum Key {Config,Totals,Order(BytesN<32>),TopUp(BytesN<32>),Returned(BytesN<32>)}
#[contracterror]
#[derive(Copy,Clone,Debug,Eq,PartialEq)]
#[repr(u32)]
pub enum Error {Invalid=1,Changed=2,Missing=3,Consumed=4,Agreement=5,Reserved=6,Overflow=7}
#[contractevent(topics=["music_city","pool_purchase"])]
pub struct PoolPurchase {#[topic]pub order_id:BytesN<32>,pub buyer:Address,pub gross:i128,pub net:i128}
#[contractevent(topics=["music_city","pool_claim"])]
pub struct PoolClaimed {#[topic]pub order_id:BytesN<32>,#[topic]pub index:u32,pub beneficiary:Address,pub amount:i128}
#[contractevent(topics=["music_city","pool_top_up"])]
pub struct PoolTopUp {#[topic]pub id:BytesN<32>,pub amount:i128}
#[contractevent(topics=["music_city","pool_return"])]
pub struct PoolReturn {#[topic]pub id:BytesN<32>,pub amount:i128}
#[contract]
pub struct EarningsPool;
fn add(a:i128,b:i128)->Result<i128,Error>{let n=a.checked_add(b).ok_or(Error::Overflow)?;if n>MAX{return Err(Error::Overflow)}Ok(n)}
fn retain(env:&Env,key:&Key){env.storage().persistent().extend_ttl(key,THRESHOLD,EXTEND);}
fn valid_id(env:&Env,id:&BytesN<32>)->bool{*id!=BytesN::from_array(env,&[0;32])}
#[contractimpl]
impl EarningsPool {
 pub fn __constructor(env:Env,treasury:Address,registry:Address,asset:Address,fee_bps:u32)->Result<(),Error>{
  if fee_bps>9999 || RegistryClient::new(&env,&registry).treasury()!=treasury || token::Client::new(&env,&asset).decimals()!=7{return Err(Error::Invalid)}
  env.storage().instance().set(&Key::Config,&Config{treasury,registry,asset,fee_bps,network:env.ledger().network_id()});
  env.storage().instance().set(&Key::Totals,&Totals::default());Ok(())
 }
 pub fn configuration(env:Env)->Config {env.storage().instance().extend_ttl(THRESHOLD,EXTEND);env.storage().instance().get(&Key::Config).unwrap()}
 pub fn totals(env:Env)->Totals {Self::configuration(env.clone());env.storage().instance().get(&Key::Totals).unwrap()}
 pub fn balance(env:Env)->i128{let c=Self::configuration(env.clone());token::Client::new(&env,&c.asset).balance(&env.current_contract_address())}
 pub fn get_order(env:Env,id:BytesN<32>)->Option<Purchase>{let key=Key::Order(id);let p=env.storage().persistent().get(&key);if p.is_some(){retain(&env,&key)}p}
 pub fn get_top_up(env:Env,id:BytesN<32>)->Option<Movement>{let key=Key::TopUp(id);let p=env.storage().persistent().get(&key);if p.is_some(){retain(&env,&key)}p}
 pub fn get_return(env:Env,id:BytesN<32>)->Option<Movement>{let key=Key::Returned(id);let p=env.storage().persistent().get(&key);if p.is_some(){retain(&env,&key)}p}
 /// Payment and earning registration are one buyer-authorized transaction. No registrar exists.
 pub fn buy(env:Env,request:BuyRequest)->Result<Purchase,Error>{
  request.buyer.require_auth();let c=Self::configuration(env.clone());
  if !valid_id(&env,&request.order_id)||request.track_id.len()==0||request.track_id.len()>128||request.gross<=0||request.gross>MAX{return Err(Error::Invalid)}
  if let Some(old)=Self::get_order(env.clone(),request.order_id.clone()){if old.request!=request{return Err(Error::Changed)}return Ok(old)}
  let split=RegistryClient::new(&env,&c.registry).get_finalized_split(&request.track_id).ok_or(Error::Agreement)?;
  if split.version!=request.version||split.proposal_hash!=request.proposal_hash||split.recipients.is_empty()||split.recipients.len()>20{return Err(Error::Agreement)}
  let mut assigned=0i128;let mut net=0i128;let mut fees=0i128;let mut shares=0u32;let mut claims=Vec::new(&env);
  for (i,r) in split.recipients.iter().enumerate(){
   shares=shares.checked_add(r.share_bps).ok_or(Error::Invalid)?;
   if r.share_bps==0||r.share_bps>10000{return Err(Error::Invalid)}
   for old in claims.iter(){let old:PoolClaim=old;if old.beneficiary==r.wallet{return Err(Error::Invalid)}}
   let gross=if i==split.recipients.len() as usize-1{request.gross-assigned}else{request.gross*r.share_bps as i128/10000};assigned+=gross;
   let fee=gross*c.fee_bps as i128/10000;fees=add(fees,fee)?;net=add(net,gross-fee)?;
   claims.push_back(PoolClaim{beneficiary:r.wallet,gross,fee,amount:gross-fee,claimed:false,ledger:env.ledger().sequence()});
  }
  if shares!=10000||assigned!=request.gross{return Err(Error::Invalid)}
  let mut totals=Self::totals(env.clone());totals.outstanding=add(totals.outstanding,net)?;totals.purchased=add(totals.purchased,request.gross)?;totals.fees=add(totals.fees,fees)?;
  let purchase=Purchase{request:request.clone(),claims,ledger:env.ledger().sequence()};
  env.storage().persistent().set(&Key::Order(request.order_id.clone()),&purchase);retain(&env,&Key::Order(request.order_id.clone()));env.storage().instance().set(&Key::Totals,&totals);
  let asset=token::Client::new(&env,&c.asset);asset.transfer(&request.buyer,&env.current_contract_address(),&request.gross);
  if fees>0{asset.transfer(&env.current_contract_address(),&c.treasury,&fees)}
  PoolPurchase{order_id:request.order_id,buyer:request.buyer,gross:request.gross,net}.publish(&env);Ok(purchase)
 }
 pub fn claim(env:Env,id:BytesN<32>,index:u32)->Result<PoolClaim,Error>{
  let c=Self::configuration(env.clone());let mut order=Self::get_order(env.clone(),id.clone()).ok_or(Error::Missing)?;let mut claim=order.claims.get(index).ok_or(Error::Missing)?;claim.beneficiary.require_auth();
  if claim.claimed||claim.amount<=0{return Err(Error::Consumed)}
  claim.claimed=true;claim.ledger=env.ledger().sequence();order.claims.set(index,claim.clone());env.storage().persistent().set(&Key::Order(id.clone()),&order);retain(&env,&Key::Order(id.clone()));
  let mut totals=Self::totals(env.clone());totals.outstanding-=claim.amount;totals.claimed=add(totals.claimed,claim.amount)?;env.storage().instance().set(&Key::Totals,&totals);
  token::Client::new(&env,&c.asset).transfer(&env.current_contract_address(),&claim.beneficiary,&claim.amount);
  PoolClaimed{order_id:id,index,beneficiary:claim.beneficiary.clone(),amount:claim.amount}.publish(&env);Ok(claim)
 }
 pub fn top_up(env:Env,id:BytesN<32>,amount:i128)->Result<Movement,Error>{
  let c=Self::configuration(env.clone());c.treasury.require_auth();if amount<=0||amount>MAX||!valid_id(&env,&id){return Err(Error::Invalid)}
  if let Some(old)=Self::get_top_up(env.clone(),id.clone()){if old.amount!=amount{return Err(Error::Changed)}return Ok(old)}
  let mut totals=Self::totals(env.clone());totals.topped_up=add(totals.topped_up,amount)?;env.storage().instance().set(&Key::Totals,&totals);
  let movement=Movement{amount,ledger:env.ledger().sequence()};env.storage().persistent().set(&Key::TopUp(id.clone()),&movement);retain(&env,&Key::TopUp(id.clone()));
  token::Client::new(&env,&c.asset).transfer(&c.treasury,&env.current_contract_address(),&amount);PoolTopUp{id,amount}.publish(&env);Ok(movement)
 }
 pub fn return_surplus(env:Env,id:BytesN<32>,amount:i128)->Result<Movement,Error>{
  let c=Self::configuration(env.clone());c.treasury.require_auth();if amount<=0||amount>MAX||!valid_id(&env,&id){return Err(Error::Invalid)}
  if let Some(old)=Self::get_return(env.clone(),id.clone()){if old.amount!=amount{return Err(Error::Changed)}return Ok(old)}
  let mut totals=Self::totals(env.clone());if Self::balance(env.clone())-totals.outstanding<amount{return Err(Error::Reserved)}totals.returned=add(totals.returned,amount)?;env.storage().instance().set(&Key::Totals,&totals);
  let movement=Movement{amount,ledger:env.ledger().sequence()};env.storage().persistent().set(&Key::Returned(id.clone()),&movement);retain(&env,&Key::Returned(id.clone()));
  token::Client::new(&env,&c.asset).transfer(&env.current_contract_address(),&c.treasury,&amount);PoolReturn{id,amount}.publish(&env);Ok(movement)
 }
}
#[cfg(test)]mod test;
