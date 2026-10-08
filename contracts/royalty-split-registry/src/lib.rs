#![no_std]

use soroban_sdk::{contract, contracterror, contractevent, contractimpl, contracttype, Address, BytesN, Env, String, Vec};

const MAX_RECIPIENTS: u32 = 20;
const TOTAL_BPS: u32 = 10_000;
const TTL_THRESHOLD: u32 = 100_000;
const TTL_EXTEND: u32 = 500_000;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SplitRecipient {
    pub wallet: Address,
    pub role: String,
    pub share_bps: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FinalizedSplit {
    pub agreement_id: String,
    pub version: u32,
    pub recipients: Vec<SplitRecipient>,
    pub proposal_hash: BytesN<32>,
    pub previous_finalized_hash: BytesN<32>,
    pub finalized_ledger: u32,
}

#[contractevent(topics = ["music_city", "split_finalized"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SplitFinalized {
    #[topic]
    pub track_id: String,
    #[topic]
    pub version: u32,
    pub agreement_id: String,
    pub proposal_hash: BytesN<32>,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Treasury,
    LatestVersion(String),
    Split(String, u32),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum RegistryError {
    InvalidRecipientCount = 1,
    InvalidRecipient = 2,
    InvalidTotalBps = 3,
    DuplicateRecipient = 4,
    InvalidVersion = 5,
    ConflictingPublication = 6,
    PreviousFinalizedMismatch = 7,
    InvalidIdentity = 8,
}

#[contract]
pub struct RoyaltySplitRegistry;

#[contractimpl]
impl RoyaltySplitRegistry {
    pub fn __constructor(env: Env, treasury: Address) {
        env.storage().instance().set(&DataKey::Treasury, &treasury);
    }

    pub fn treasury(env: Env) -> Address {
        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);
        env.storage().instance().get(&DataKey::Treasury).unwrap()
    }

    /// The treasury G-account's real Stellar threshold authorizes publication.
    /// Off-chain contributor signature evidence is bound by proposal_hash.
    pub fn finalize_split(
        env: Env,
        track_id: String,
        agreement_id: String,
        version: u32,
        recipients: Vec<SplitRecipient>,
        proposal_hash: BytesN<32>,
        previous_finalized_hash: BytesN<32>,
    ) -> Result<FinalizedSplit, RegistryError> {
        Self::treasury(env.clone()).require_auth();
        if track_id.len() == 0 || agreement_id.len() == 0 || proposal_hash == BytesN::from_array(&env, &[0; 32]) {
            return Err(RegistryError::InvalidIdentity);
        }
        Self::validate_recipients(&recipients)?;
        let key = DataKey::Split(track_id.clone(), version);
        let record = FinalizedSplit {
            agreement_id: agreement_id.clone(), version, recipients,
            proposal_hash: proposal_hash.clone(), previous_finalized_hash: previous_finalized_hash.clone(),
            finalized_ledger: env.ledger().sequence(),
        };
        if let Some(existing) = env.storage().persistent().get::<_, FinalizedSplit>(&key) {
            if existing.agreement_id == record.agreement_id && existing.recipients == record.recipients
                && existing.proposal_hash == record.proposal_hash && existing.previous_finalized_hash == record.previous_finalized_hash {
                env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);
                return Ok(existing);
            }
            return Err(RegistryError::ConflictingPublication);
        }
        let latest_key = DataKey::LatestVersion(track_id.clone());
        if let Some(current_version) = env.storage().persistent().get::<_, u32>(&latest_key) {
            if version <= current_version { return Err(RegistryError::InvalidVersion); }
            let current: FinalizedSplit = env.storage().persistent().get(&DataKey::Split(track_id.clone(), current_version)).unwrap();
            if current.agreement_id != agreement_id || current.proposal_hash != previous_finalized_hash {
                return Err(RegistryError::PreviousFinalizedMismatch);
            }
        } else if version == 0 || previous_finalized_hash != BytesN::from_array(&env, &[0; 32]) {
            return Err(RegistryError::InvalidVersion);
        }
        env.storage().persistent().set(&key, &record);
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);
        env.storage().persistent().set(&latest_key, &version);
        env.storage().persistent().extend_ttl(&latest_key, TTL_THRESHOLD, TTL_EXTEND);
        SplitFinalized { track_id, version, agreement_id, proposal_hash }.publish(&env);
        Ok(record)
    }

    pub fn get_finalized_split(env: Env, track_id: String) -> Option<FinalizedSplit> {
        let key = DataKey::LatestVersion(track_id.clone());
        let version = env.storage().persistent().get::<_, u32>(&key)?;
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);
        Self::get_finalized_version(env, track_id, version)
    }

    pub fn get_finalized_version(env: Env, track_id: String, version: u32) -> Option<FinalizedSplit> {
        let key = DataKey::Split(track_id, version);
        let record = env.storage().persistent().get(&key)?;
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);
        Some(record)
    }

    fn validate_recipients(recipients: &Vec<SplitRecipient>) -> Result<(), RegistryError> {
        let count = recipients.len();
        if count == 0 || count > MAX_RECIPIENTS { return Err(RegistryError::InvalidRecipientCount); }
        let mut total = 0_u32;
        for index in 0..count {
            let recipient = recipients.get(index).unwrap();
            if recipient.role.len() == 0 || recipient.share_bps == 0 || recipient.share_bps > TOTAL_BPS {
                return Err(RegistryError::InvalidRecipient);
            }
            total = total.checked_add(recipient.share_bps).ok_or(RegistryError::InvalidTotalBps)?;
            for prior in 0..index {
                if recipients.get(prior).unwrap().wallet == recipient.wallet { return Err(RegistryError::DuplicateRecipient); }
            }
        }
        if total != TOTAL_BPS { return Err(RegistryError::InvalidTotalBps); }
        Ok(())
    }
}

#[cfg(test)]
mod test;
