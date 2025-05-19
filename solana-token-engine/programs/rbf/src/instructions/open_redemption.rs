use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::*;


#[derive(Accounts)]
pub struct OpenRedemption<'info> {
    #[account(mut)]
    pub rbf: Account<'info, RBF>,

    #[account(mut)]
    pub authority: Signer<'info>,
}


pub fn open_redemption(ctx: Context<OpenRedemption>) -> Result<()> {
    let rbf = &mut ctx.accounts.rbf;
    require!(
        rbf.status == RBFStatus::Running,
        ErrorCode::InvalidRBFStatus
    );

    require_keys_eq!(
        ctx.accounts.authority.key(),
        rbf.drds,
        ErrorCode::Unauthorized
    );
    rbf.status = RBFStatus::Liquidating;
    Ok(())
}



