#![no_std]
use soroban_sdk::{contract, contracterror, contractevent, contractimpl, contracttype, Address, BytesN, Env, String, Vec};
const THRESHOLD: u32 = 100_000;
const EXTEND: u32 = 500_000;
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SplitRecipient { pub wallet: Address, pub role: String, pub share_bps: u32 }
// The finalized record retains the settlement registry ABI.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FinalizedSplit {
    pub agreement_id: String, pub version: u32, pub recipients: Vec<SplitRecipient>,
    pub proposal_hash: BytesN<32>, pub previous_finalized_hash: BytesN<32>, pub finalized_ledger: u32,
}
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Proposal {
    pub track_id: String, pub agreement_id: String, pub version: u32, pub owner: Address,
    pub recipients: Vec<SplitRecipient>, pub proposal_hash: BytesN<32>, pub previous_finalized_hash: BytesN<32>,
}
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Decision { pub wallet: Address, pub action: u32 }
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProposalState { pub proposal: Proposal, pub required: Vec<Address>, pub decisions: Vec<Decision>, pub state: u32 }
#[contracttype]
#[derive(Clone)]
enum Key { Treasury, Registrar, Owner(String), Agreement(String), Head(String), Latest(String), Proposal(String,u32), Split(String,u32) }
#[contracterror]
#[derive(Copy,Clone,Debug,Eq,PartialEq)]
#[repr(u32)]
pub enum Error { Invalid = 1, Ownership = 2, Version = 3, Conflict = 4, Closed = 5, Contributor = 6, Decision = 7 }
#[contractevent(topics = ["music_city", "contributor_decision"])]
pub struct DecisionRecorded { #[topic] pub track_id: String, pub version: u32, pub actor: Address, pub action: u32, pub state: u32 }
#[contractevent(topics = ["music_city", "split_finalized"])]
pub struct SplitFinalized { #[topic] pub track_id: String, #[topic] pub version: u32, pub agreement_id: String, pub proposal_hash: BytesN<32> }
#[contract]
pub struct ContributorRegistry;
fn touch(env: &Env, key: &Key) { env.storage().persistent().extend_ttl(key,THRESHOLD,EXTEND); }
fn put<T: soroban_sdk::IntoVal<Env,soroban_sdk::Val>>(env:&Env,key:&Key,value:&T) { env.storage().persistent().set(key,value); touch(env,key); }
fn append_unique(items: &mut Vec<Address>, address: &Address) { if !items.contains(address) { items.push_back(address.clone()); } }
#[contractimpl]
impl ContributorRegistry {
    pub fn __constructor(env: Env, treasury: Address, registrar: Address) {
        env.storage().instance().set(&Key::Treasury,&treasury);
        env.storage().instance().set(&Key::Registrar,&registrar);
    }
    pub fn treasury(env: Env) -> Address {
        env.storage().instance().extend_ttl(THRESHOLD,EXTEND);
        env.storage().instance().get(&Key::Treasury).unwrap()
    }
    pub fn register_track(env: Env, track_id: String, owner: Address) -> Result<(),Error> {
        let registrar:Address=env.storage().instance().get(&Key::Registrar).unwrap();
        registrar.require_auth();
        env.storage().instance().extend_ttl(THRESHOLD,EXTEND);
        if track_id.len()==0 || track_id.len()>128 { return Err(Error::Invalid); }
        let key=Key::Owner(track_id);
        if let Some(saved)=env.storage().persistent().get::<_,Address>(&key) {
            touch(&env,&key);
            return if saved==owner { Ok(()) } else { Err(Error::Ownership) };
        }
        put(&env,&key,&owner); Ok(())
    }
    pub fn owner(env:Env,track_id:String)->Option<Address>{
        let key=Key::Owner(track_id);let owner=env.storage().persistent().get(&key);if owner.is_some(){touch(&env,&key);}owner
    }
    // Actions: 0 accept, 1 reject, 2 dispute, 3 owner cancellation.
    // States: 0 pending, 1 finalized, 2 rejected, 3 disputed, 4 cancelled.
    pub fn respond(env: Env, proposal: Proposal, actor: Address, action: u32) -> Result<ProposalState,Error> {
        actor.require_auth();
        Self::treasury(env.clone());
        Self::validate(&env,&proposal)?;
        if Self::owner(env.clone(),proposal.track_id.clone())!=Some(proposal.owner.clone()){return Err(Error::Ownership);}
        if action>3 { return Err(Error::Decision); }
        let key=Key::Proposal(proposal.track_id.clone(),proposal.version);
        let head_key=Key::Head(proposal.track_id.clone());
        let head:Option<u32>=env.storage().persistent().get(&head_key);
        let mut stored=if let Some(saved)=env.storage().persistent().get::<_,ProposalState>(&key){
            if saved.proposal!=proposal { return Err(Error::Conflict); }
            // Idempotent retry of the exact recorded action, never a fresh approval.
            if saved.decisions.iter().any(|d|d.wallet==actor && d.action==action) {touch(&env,&key);return Ok(saved);}
            if head!=Some(proposal.version) || saved.state!=0 {return Err(Error::Closed);}
            saved
        }else{
            if actor!=proposal.owner {return Err(Error::Ownership);}
            if let Some(number)=head{
                touch(&env,&head_key);
                if proposal.version<=number{return Err(Error::Version);}
                let previous_key=Key::Proposal(proposal.track_id.clone(),number);
                let previous:ProposalState=env.storage().persistent().get(&previous_key).ok_or(Error::Version)?;
                touch(&env,&previous_key);
                if previous.state==0{return Err(Error::Closed);}
            }
            let identity_key=Key::Agreement(proposal.track_id.clone());
            if let Some(id)=env.storage().persistent().get::<_,String>(&identity_key){
                touch(&env,&identity_key);if id!=proposal.agreement_id{return Err(Error::Conflict);}
            }else{put(&env,&identity_key,&proposal.agreement_id);}
            let mut required=Vec::new(&env);append_unique(&mut required,&proposal.owner);
            if let Some(old)=Self::get_finalized_split(env.clone(),proposal.track_id.clone()){
                if old.proposal_hash!=proposal.previous_finalized_hash || proposal.version<=old.version{return Err(Error::Version);}
                for r in old.recipients.iter(){append_unique(&mut required,&r.wallet);}
            }else if proposal.previous_finalized_hash!=BytesN::from_array(&env,&[0;32]){return Err(Error::Version);}
            for r in proposal.recipients.iter(){append_unique(&mut required,&r.wallet);}
            put(&env,&head_key,&proposal.version);
            ProposalState{proposal:proposal.clone(),required,decisions:Vec::new(&env),state:0}
        };
        if action==3 {
            if actor!=proposal.owner{return Err(Error::Ownership);}
        }else if !stored.required.contains(&actor){return Err(Error::Contributor);}
        if let Some(prior)=stored.decisions.iter().find(|d|d.wallet==actor){
            if !(prior.action==0 && action==2) && action!=3 {return Err(Error::Decision);}
        }
        stored.decisions.push_back(Decision{wallet:actor.clone(),action});
        if action!=0 {stored.state=action+1;}
        else if stored.required.iter().all(|a|stored.decisions.iter().any(|d|d.wallet==a && d.action==0)){
            stored.state=1;
            let record=FinalizedSplit{agreement_id:proposal.agreement_id.clone(),version:proposal.version,recipients:proposal.recipients.clone(),proposal_hash:proposal.proposal_hash.clone(),previous_finalized_hash:proposal.previous_finalized_hash.clone(),finalized_ledger:env.ledger().sequence()};
            put(&env,&Key::Split(proposal.track_id.clone(),proposal.version),&record);
            put(&env,&Key::Latest(proposal.track_id.clone()),&proposal.version);
            SplitFinalized{track_id:proposal.track_id.clone(),version:proposal.version,agreement_id:proposal.agreement_id.clone(),proposal_hash:proposal.proposal_hash.clone()}.publish(&env);
        }
        put(&env,&key,&stored);
        DecisionRecorded{track_id:proposal.track_id,version:proposal.version,actor,action,state:stored.state}.publish(&env);
        Ok(stored)
    }
    pub fn get_proposal(env:Env,track_id:String,version:u32)->Option<ProposalState>{
        let key=Key::Proposal(track_id,version);let result=env.storage().persistent().get(&key);if result.is_some(){touch(&env,&key);}result
    }
    pub fn get_finalized_split(env:Env,track_id:String)->Option<FinalizedSplit>{
        let key=Key::Latest(track_id.clone());let version=env.storage().persistent().get(&key)?;touch(&env,&key);Self::get_finalized_version(env,track_id,version)
    }
    pub fn get_finalized_version(env:Env,track_id:String,version:u32)->Option<FinalizedSplit>{
        let key=Key::Split(track_id,version);let record=env.storage().persistent().get(&key);if record.is_some(){touch(&env,&key);}record
    }
    fn validate(env:&Env,p:&Proposal)->Result<(),Error>{
        if p.track_id.len()==0 || p.track_id.len()>128 || p.agreement_id.len()==0 || p.agreement_id.len()>128 || p.version==0 || p.proposal_hash==BytesN::from_array(env,&[0;32]) || p.recipients.len()==0 || p.recipients.len()>20{return Err(Error::Invalid);}
        let mut total=0u32;
        for (i,r) in p.recipients.iter().enumerate(){
            if r.role.len()==0 || r.role.len()>64 || r.share_bps==0 || r.share_bps>10_000{return Err(Error::Invalid);}
            total=total.checked_add(r.share_bps).ok_or(Error::Invalid)?;
            for j in 0..i {if p.recipients.get(j as u32).unwrap().wallet==r.wallet{return Err(Error::Invalid);}}
        }
        if total!=10_000{return Err(Error::Invalid);}Ok(())
    }
}
#[cfg(test)] mod test;
