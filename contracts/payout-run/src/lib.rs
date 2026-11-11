#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, symbol_short, xdr::ToXdr, Address, BytesN, Env, IntoVal, Val, Vec};

const THRESHOLD: u32 = 100_000;
const EXTEND: u32 = 500_000;

#[contracttype]
#[derive(Clone)]
pub struct Configuration {
    pub treasury: Address,
    pub registry: Address,
    pub asset: Address,
    pub network: BytesN<32>,
}
#[contracttype]
#[derive(Clone)]
pub struct SettlementRequest {
    pub batch_id: BytesN<32>, pub source_id: BytesN<32>, pub track_id: soroban_sdk::String,
    pub agreement_id: soroban_sdk::String, pub version: u32, pub proposal_hash: BytesN<32>,
    pub gross_amount: i128, pub fee_bps: u32, pub expires_at: u64,
}
#[contracttype]
#[derive(Clone)]
pub struct RunReceipt { pub digest: BytesN<32>, pub source_count: u32 }
#[contracttype]
#[derive(Clone)]
enum Key { Settlement, Run(BytesN<32>) }
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum RunError { InvalidRun = 1, ChangedRun = 2 }
#[contract]
pub struct PayoutRun;
#[contractimpl]
impl PayoutRun {
    pub fn __constructor(env: Env, settlement: Address) {
        let _: Configuration = env.invoke_contract(&settlement, &soroban_sdk::Symbol::new(&env, "configuration"), Vec::new(&env));
        env.storage().instance().set(&Key::Settlement, &settlement);
    }
    pub fn settlement(env: Env) -> Address {
        env.storage().instance().extend_ttl(THRESHOLD, EXTEND);
        env.storage().instance().get(&Key::Settlement).unwrap()
    }
    /// One authorized invocation funds every source or rolls back the entire run.
    pub fn fund(env: Env, run_id: BytesN<32>, requests: Vec<SettlementRequest>) -> Result<RunReceipt, RunError> {
        if run_id == BytesN::from_array(&env, &[0;32]) || requests.is_empty() || requests.len() > 10 { return Err(RunError::InvalidRun); }
        let settlement = Self::settlement(env.clone());
        let config: Configuration = env.invoke_contract(&settlement, &soroban_sdk::Symbol::new(&env, "configuration"), Vec::new(&env));
        config.treasury.require_auth();
        let digest = env.crypto().sha256(&requests.clone().to_xdr(&env)).into();
        if let Some(old) = env.storage().persistent().get::<_, RunReceipt>(&Key::Run(run_id.clone())) {
            if old.digest != digest { return Err(RunError::ChangedRun); }
            env.storage().persistent().extend_ttl(&Key::Run(run_id), THRESHOLD, EXTEND);
            return Ok(old);
        }
        for request in requests.iter() {
            let _: Val = env.invoke_contract(&settlement, &symbol_short!("settle"), (request,).into_val(&env));
        }
        let receipt = RunReceipt { digest, source_count: requests.len() };
        env.storage().persistent().set(&Key::Run(run_id.clone()), &receipt);
        env.storage().persistent().extend_ttl(&Key::Run(run_id), THRESHOLD, EXTEND);
        Ok(receipt)
    }
}
#[cfg(test)] mod test;
