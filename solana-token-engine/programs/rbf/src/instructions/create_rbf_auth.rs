use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::*;


#[derive(Accounts)]
pub struct CreateRbfAuth<'info> {
    #[account(mut, has_one = admin)]
    pub global_config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + RbfAuth::ACCOUNT_SIZE,
        seeds = [b"rbf_auth", creator.key().as_ref()],
        bump
    )]
    pub rbf_auth: Account<'info, RbfAuth>,
    pub creator: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn create_rbf_auth(ctx: Context<CreateRbfAuth>) -> Result<()> {
    let rbf_auth = &mut ctx.accounts.rbf_auth;

    rbf_auth.creator = ctx.accounts.creator.key();
    rbf_auth.bump = *ctx.bumps.get("rbf_auth").unwrap();

    Ok(())
}

