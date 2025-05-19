use anchor_lang::prelude::*;


#[account]
pub struct Vault{
    pub creater: Pubkey,
    pub manager: Pubkey,
    pub dexBot: Pubkey,

    pub vault_mint: Pubkey,
    pub asset_mint: Pubkey,

    pub vault_treasury: Pubkey,
    pub asset_treasury: Pubkey,
    pub rbf: Pubkey,

    pub fund_start_time: i64,
    pub fund_end_time: i64,
    pub fund_amount: u64,
    pub rbf_fund_amount: u64,
    pub dex_fund_amount: u64,
    pub min_deposit_amount: u64,
}