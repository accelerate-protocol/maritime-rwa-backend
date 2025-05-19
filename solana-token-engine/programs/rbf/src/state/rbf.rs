use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum RBFStatus {
    Running,
    Liquidating,
}

#[account]
pub struct RBF {
    /// The creator of the RBF account
    pub creater: Pubkey,
    /// The DRDS (Dynamic Resource Distribution System) associated with the RBF
    pub drds: Pubkey,
    /// The manager responsible for the RBF
    pub manager: Pubkey,
    /// The mint address of the asset token
    pub asset_mint: Pubkey,
    /// The mint address of the RBF token
    pub rbf_mint: Pubkey,
    /// The treasury account holding the asset tokens
    pub asset_treasury: Pubkey,
    /// The recipient account for asset withdrawals
    pub asset_recipient: Pubkey,
    /// The vault account
    pub vault: Pubkey,
    /// Total subscription
    pub total_subscription: u64,
    /// Total redemption
    pub total_redemption: u64,
    /// The minimum amount of asset tokens required for liquidation
    pub liquidation_slippage: u64,
    pub status: RBFStatus,
    /// The bump seed for the program-derived address (PDA)
    pub bump: u8,
}

impl RBF {
    pub const ACCOUNT_SIZE: usize = 32 + 32 + 32 + 32 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 1 + 1;
}

