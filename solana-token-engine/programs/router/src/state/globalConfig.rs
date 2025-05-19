use anchor_lang::prelude::*;

#[account]
pub struct GlobalConfig {
    pub admin: Pubkey,
    pub drds: Pubkey,
    pub bump: u8,
}




