#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, BytesN, Env,
    String, Vec,
};

const MAX_RECIPIENTS: u32 = 20;
const TOTAL_BPS: u32 = 10_000;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SplitRecipient {
    pub wallet_address: String,
    pub chain: String,
    pub role: String,
    pub share_bps: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TrackSplit {
    pub version: u32,
    pub recipients: Vec<SplitRecipient>,
    pub metadata_hash: BytesN<32>,
    pub frozen: bool,
    pub updated_ledger: u32,
}

#[contractevent(topics = ["music_city", "split_set"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SplitSet {
    #[topic]
    pub version: u32,
    pub track_id: String,
    pub metadata_hash: BytesN<32>,
}

#[contractevent(topics = ["music_city", "split_frozen"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SplitFrozen {
    #[topic]
    pub version: u32,
    pub track_id: String,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    LatestVersion(String),
    Split(String, u32),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum RegistryError {
    AlreadyInitialized = 1,
    InvalidRecipientCount = 2,
    InvalidRecipient = 3,
    InvalidTotalBps = 4,
    DuplicateRecipient = 5,
    InvalidVersion = 6,
    SplitNotFound = 7,
    TrackFrozen = 8,
    VersionMismatch = 9,
}

#[contract]
pub struct RoyaltySplitRegistry;

#[contractimpl]
impl RoyaltySplitRegistry {
    pub fn __constructor(env: Env, admin: Address) -> Result<(), RegistryError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(RegistryError::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn set_track_split(
        env: Env,
        track_id: String,
        version: u32,
        recipients: Vec<SplitRecipient>,
        metadata_hash: BytesN<32>,
    ) -> Result<TrackSplit, RegistryError> {
        Self::require_admin(&env);
        Self::validate_recipients(&recipients)?;

        let latest_key = DataKey::LatestVersion(track_id.clone());
        let latest_version = env.storage().persistent().get::<_, u32>(&latest_key);

        match latest_version {
            Some(current_version) => {
                let current = Self::read_version(&env, &track_id, current_version)?;
                if current.frozen {
                    return Err(RegistryError::TrackFrozen);
                }
                if version != current_version + 1 {
                    return Err(RegistryError::InvalidVersion);
                }
            }
            None if version != 1 => return Err(RegistryError::InvalidVersion),
            None => {}
        }

        let record = TrackSplit {
            version,
            recipients,
            metadata_hash: metadata_hash.clone(),
            frozen: false,
            updated_ledger: env.ledger().sequence(),
        };

        env.storage()
            .persistent()
            .set(&DataKey::Split(track_id.clone(), version), &record);
        env.storage().persistent().set(&latest_key, &version);
        SplitSet {
            version,
            track_id,
            metadata_hash,
        }
        .publish(&env);

        Ok(record)
    }

    pub fn get_track_split(env: Env, track_id: String) -> Option<TrackSplit> {
        let version = env
            .storage()
            .persistent()
            .get::<_, u32>(&DataKey::LatestVersion(track_id.clone()))?;

        env.storage()
            .persistent()
            .get(&DataKey::Split(track_id, version))
    }

    pub fn get_track_split_version(env: Env, track_id: String, version: u32) -> Option<TrackSplit> {
        env.storage()
            .persistent()
            .get(&DataKey::Split(track_id, version))
    }

    pub fn freeze_track_split(
        env: Env,
        track_id: String,
        version: u32,
    ) -> Result<TrackSplit, RegistryError> {
        Self::require_admin(&env);

        let latest_version = env
            .storage()
            .persistent()
            .get::<_, u32>(&DataKey::LatestVersion(track_id.clone()))
            .ok_or(RegistryError::SplitNotFound)?;

        if latest_version != version {
            return Err(RegistryError::VersionMismatch);
        }

        let split_key = DataKey::Split(track_id.clone(), version);
        let mut record = Self::read_version(&env, &track_id, version)?;
        record.frozen = true;
        record.updated_ledger = env.ledger().sequence();
        env.storage().persistent().set(&split_key, &record);
        SplitFrozen { version, track_id }.publish(&env);

        Ok(record)
    }

    fn require_admin(env: &Env) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
    }

    fn read_version(
        env: &Env,
        track_id: &String,
        version: u32,
    ) -> Result<TrackSplit, RegistryError> {
        env.storage()
            .persistent()
            .get(&DataKey::Split(track_id.clone(), version))
            .ok_or(RegistryError::SplitNotFound)
    }

    fn validate_recipients(recipients: &Vec<SplitRecipient>) -> Result<(), RegistryError> {
        let count = recipients.len();
        if count == 0 || count > MAX_RECIPIENTS {
            return Err(RegistryError::InvalidRecipientCount);
        }

        let mut total = 0_u32;
        for index in 0..count {
            let recipient = recipients.get(index).unwrap();
            if recipient.wallet_address.len() == 0
                || recipient.chain.len() == 0
                || recipient.role.len() == 0
                || recipient.share_bps == 0
                || recipient.share_bps > TOTAL_BPS
            {
                return Err(RegistryError::InvalidRecipient);
            }

            total = total
                .checked_add(recipient.share_bps)
                .ok_or(RegistryError::InvalidTotalBps)?;

            for previous_index in 0..index {
                let previous = recipients.get(previous_index).unwrap();
                if previous.chain == recipient.chain
                    && previous.wallet_address == recipient.wallet_address
                {
                    return Err(RegistryError::DuplicateRecipient);
                }
            }
        }

        if total != TOTAL_BPS {
            return Err(RegistryError::InvalidTotalBps);
        }

        Ok(())
    }
}

#[cfg(test)]
mod test;
