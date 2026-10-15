#![no_std]

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype, token,
    Address, BytesN, Env, String, Vec,
};

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
    fn get_finalized_version(env: Env, track_id: String, version: u32) -> Option<FinalizedSplit>;
}

const TTL_THRESHOLD: u32 = 100_000;
const TTL_EXTEND: u32 = 500_000;
const MAX_EXPIRY_SECONDS: u64 = 604_800;
const MAX_AMOUNT: i128 = i64::MAX as i128;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Configuration {
    pub treasury: Address,
    pub registry: Address,
    pub asset: Address,
    pub network: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ClaimStatus {
    Available,
    Claimed,
    Reclaimed,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Claim {
    pub beneficiary: Address,
    pub amount: i128,
    pub status: ClaimStatus,
    pub updated_ledger: u32,
}

/// One batch consumes one complete revenue source for a track and asset.
/// Splitting a source across batches would make duplicate prevention ambiguous.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SettlementRequest {
    pub batch_id: BytesN<32>,
    pub source_id: BytesN<32>,
    pub track_id: String,
    pub agreement_id: String,
    pub version: u32,
    pub proposal_hash: BytesN<32>,
    pub gross_amount: i128,
    pub fee_bps: u32,
    pub expires_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Batch {
    pub request: SettlementRequest,
    pub claims: Vec<Claim>,
    pub funded: i128,
    pub claimed: i128,
    pub reclaimed: i128,
    pub funded_ledger: u32,
}

#[contracttype]
#[derive(Clone)]
enum Key {
    Configuration,
    Batch(BytesN<32>),
    Source(BytesN<32>),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum SettlementError {
    InvalidRequest = 1,
    AlreadySettled = 2,
    SourceConsumed = 3,
    InvalidAgreement = 4,
    MissingBatch = 5,
    MissingClaim = 6,
    AlreadyConsumed = 7,
    Expired = 8,
    NotExpired = 9,
    Overflow = 10,
    InvalidConfiguration = 11,
}

#[contractevent(topics = ["music_city", "settlement_funded"])]
pub struct SettlementFunded {
    #[topic]
    pub batch_id: BytesN<32>,
    pub source_id: BytesN<32>,
    pub amount: i128,
    pub proposal_hash: BytesN<32>,
    pub expires_at: u64,
}

#[contractevent(topics = ["music_city", "claim_consumed"])]
pub struct ClaimConsumed {
    #[topic]
    pub batch_id: BytesN<32>,
    #[topic]
    pub index: u32,
    pub beneficiary: Address,
    pub amount: i128,
    pub status: ClaimStatus,
}

#[contract]
pub struct EarningsSettlement;

#[contractimpl]
impl EarningsSettlement {
    /// Immutable configuration. There is no administrator bypass or upgrade path.
    pub fn __constructor(
        env: Env,
        treasury: Address,
        registry: Address,
        asset: Address,
    ) -> Result<(), SettlementError> {
        if RegistryClient::new(&env, &registry).treasury() != treasury
            || token::Client::new(&env, &asset).decimals() != 7
        {
            return Err(SettlementError::InvalidConfiguration);
        }
        let config = Configuration {
            treasury,
            registry,
            asset,
            network: env.ledger().network_id(),
        };
        env.storage().instance().set(&Key::Configuration, &config);
        Ok(())
    }

    pub fn configuration(env: Env) -> Configuration {
        env.storage()
            .instance()
            .extend_ttl(TTL_THRESHOLD, TTL_EXTEND);
        env.storage().instance().get(&Key::Configuration).unwrap()
    }

    pub fn settle(env: Env, request: SettlementRequest) -> Result<Batch, SettlementError> {
        let config = Self::configuration(env.clone());
        config.treasury.require_auth();
        let zero = BytesN::from_array(&env, &[0; 32]);
        let now = env.ledger().timestamp();
        if request.batch_id == zero
            || request.source_id == zero
            || request.track_id.len() == 0
            || request.track_id.len() > 128
            || request.agreement_id.len() == 0
            || request.agreement_id.len() > 128
            || request.gross_amount <= 0
            || request.gross_amount > MAX_AMOUNT
            || request.fee_bps >= 10_000
            || request.expires_at <= now
            || request.expires_at - now > MAX_EXPIRY_SECONDS
        {
            return Err(SettlementError::InvalidRequest);
        }
        if env
            .storage()
            .persistent()
            .has(&Key::Batch(request.batch_id.clone()))
        {
            return Err(SettlementError::AlreadySettled);
        }
        if env
            .storage()
            .persistent()
            .has(&Key::Source(request.source_id.clone()))
        {
            return Err(SettlementError::SourceConsumed);
        }
        let split = RegistryClient::new(&env, &config.registry)
            .get_finalized_version(&request.track_id, &request.version)
            .ok_or(SettlementError::InvalidAgreement)?;
        if split.agreement_id != request.agreement_id
            || split.proposal_hash != request.proposal_hash
            || split.recipients.len() == 0
            || split.recipients.len() > 20
        {
            return Err(SettlementError::InvalidAgreement);
        }
        let mut claims = Vec::new(&env);
        let mut assigned = 0_i128;
        let mut funded = 0_i128;
        // The registry's immutable recipient order is also the rounding order.
        // The last recipient receives the gross remainder. Fees round down per recipient.
        for index in 0..split.recipients.len() {
            let recipient = split.recipients.get(index).unwrap();
            let gross = if index + 1 == split.recipients.len() {
                request.gross_amount - assigned
            } else {
                request
                    .gross_amount
                    .checked_mul(recipient.share_bps as i128)
                    .ok_or(SettlementError::Overflow)?
                    / 10_000
            };
            assigned += gross;
            let amount = gross - gross * request.fee_bps as i128 / 10_000;
            funded = funded
                .checked_add(amount)
                .ok_or(SettlementError::Overflow)?;
            claims.push_back(Claim {
                beneficiary: recipient.wallet,
                amount,
                status: ClaimStatus::Available,
                updated_ledger: env.ledger().sequence(),
            });
        }
        // Transfers and records commit atomically. Insufficient funding rolls everything back.
        token::Client::new(&env, &config.asset).transfer(
            &config.treasury,
            &env.current_contract_address(),
            &funded,
        );
        let batch = Batch {
            request: request.clone(),
            claims,
            funded,
            claimed: 0,
            reclaimed: 0,
            funded_ledger: env.ledger().sequence(),
        };
        env.storage()
            .persistent()
            .set(&Key::Source(request.source_id.clone()), &request.batch_id);
        Self::write(&env, &batch);
        SettlementFunded {
            batch_id: request.batch_id,
            source_id: request.source_id,
            amount: funded,
            proposal_hash: request.proposal_hash,
            expires_at: request.expires_at,
        }
        .publish(&env);
        Ok(batch)
    }

    pub fn get_batch(env: Env, batch_id: BytesN<32>) -> Option<Batch> {
        Self::configuration(env.clone());
        let batch: Batch = env
            .storage()
            .persistent()
            .get(&Key::Batch(batch_id.clone()))?;
        Self::touch(&env, &batch);
        Some(batch)
    }

    pub fn claim(env: Env, batch_id: BytesN<32>, index: u32) -> Result<Claim, SettlementError> {
        let config = Self::configuration(env.clone());
        let mut batch =
            Self::get_batch(env.clone(), batch_id.clone()).ok_or(SettlementError::MissingBatch)?;
        let mut claim = batch
            .claims
            .get(index)
            .ok_or(SettlementError::MissingClaim)?;
        claim.beneficiary.require_auth();
        if claim.status != ClaimStatus::Available {
            return Err(SettlementError::AlreadyConsumed);
        }
        if env.ledger().timestamp() >= batch.request.expires_at {
            return Err(SettlementError::Expired);
        }
        if claim.amount > 0 {
            token::Client::new(&env, &config.asset).transfer(
                &env.current_contract_address(),
                &claim.beneficiary,
                &claim.amount,
            );
        }
        claim.status = ClaimStatus::Claimed;
        claim.updated_ledger = env.ledger().sequence();
        batch.claimed += claim.amount;
        batch.claims.set(index, claim.clone());
        Self::write(&env, &batch);
        ClaimConsumed {
            batch_id,
            index,
            beneficiary: claim.beneficiary.clone(),
            amount: claim.amount,
            status: claim.status.clone(),
        }
        .publish(&env);
        Ok(claim)
    }

    pub fn reclaim(env: Env, batch_id: BytesN<32>, index: u32) -> Result<Claim, SettlementError> {
        let config = Self::configuration(env.clone());
        config.treasury.require_auth();
        let mut batch =
            Self::get_batch(env.clone(), batch_id.clone()).ok_or(SettlementError::MissingBatch)?;
        let mut claim = batch
            .claims
            .get(index)
            .ok_or(SettlementError::MissingClaim)?;
        if claim.status != ClaimStatus::Available {
            return Err(SettlementError::AlreadyConsumed);
        }
        if env.ledger().timestamp() < batch.request.expires_at {
            return Err(SettlementError::NotExpired);
        }
        if claim.amount > 0 {
            token::Client::new(&env, &config.asset).transfer(
                &env.current_contract_address(),
                &config.treasury,
                &claim.amount,
            );
        }
        claim.status = ClaimStatus::Reclaimed;
        claim.updated_ledger = env.ledger().sequence();
        batch.reclaimed += claim.amount;
        batch.claims.set(index, claim.clone());
        Self::write(&env, &batch);
        ClaimConsumed {
            batch_id,
            index,
            beneficiary: claim.beneficiary.clone(),
            amount: claim.amount,
            status: claim.status.clone(),
        }
        .publish(&env);
        Ok(claim)
    }

    fn touch(env: &Env, batch: &Batch) {
        env.storage().persistent().extend_ttl(
            &Key::Batch(batch.request.batch_id.clone()),
            TTL_THRESHOLD,
            TTL_EXTEND,
        );
        env.storage().persistent().extend_ttl(
            &Key::Source(batch.request.source_id.clone()),
            TTL_THRESHOLD,
            TTL_EXTEND,
        );
    }

    fn write(env: &Env, batch: &Batch) {
        env.storage()
            .persistent()
            .set(&Key::Batch(batch.request.batch_id.clone()), batch);
        Self::touch(env, batch);
    }
}

#[cfg(test)]
mod test;
