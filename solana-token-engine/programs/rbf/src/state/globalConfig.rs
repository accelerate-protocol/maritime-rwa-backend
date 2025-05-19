use anchor_lang::prelude::*;

#[account]
pub struct GlobalConfig {
    pub admin: Pubkey,
    pub rbf_nonce: u64,
    pub bump: u8,
}

impl GlobalConfig {
    pub const ACCOUNT_SIZE: usize = 32+8+1;
}