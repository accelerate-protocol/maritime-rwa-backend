use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::*;


#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        space = 8 + GlobalConfig::ACCOUNT_SIZE,
        payer = admin,
        seeds = [GlobalConfig::SEED.as_bytes()],
        bump,
    )]
    pub global_config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    let global_config = &mut ctx.accounts.global_config;
    global_config.admin = ctx.accounts.user.key();
    global_config.rbf_nonce = 0;
    global_config.bump = *ctx.bumps.get("global_config").unwrap();
    Ok(())
}