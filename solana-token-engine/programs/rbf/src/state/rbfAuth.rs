use anchor_lang::prelude::*;

#[account]
pub struct RbfAuth {
    pub creator: Pubkey,
    pub bump: u8,
}

impl RbfAuth {
    pub const ACCOUNT_SIZE: usize = 32+1;
}