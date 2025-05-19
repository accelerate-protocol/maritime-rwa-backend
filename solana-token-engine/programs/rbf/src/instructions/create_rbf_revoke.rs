use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::*;


#[derive(Accounts)]
pub struct CreateRbfRevoke<'info> {
    #[account(mut, has_one = admin)]
    pub global_config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [b"rbf_auth", creator.key().as_ref()],
        bump = rbf_auth.bump,
        close = admin,
        constraint = rbf_auth.creator == creator.key() @ ErrorCode::InvalidAuthAccount
    )]
    pub rbf_auth: Account<'info, RbfAuth>,

    pub creator: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn revoke_rbf_auth(ctx: Context<RevokeRbfAuth>) -> Result<()> {
    // 关闭账户后会自动转回 lamports 给 admin
    Ok(())
}