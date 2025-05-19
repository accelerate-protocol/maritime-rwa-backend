use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::*;

#[derive(Accounts)]
pub struct UpdateVault<'info> {
    #[account(mut)]
    pub rbf: Account<'info, RBF>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

pub fn update_vault(ctx: Context<UpdateVault>, new_vault: Pubkey) -> Result<()> {
    let rbf = &mut ctx.accounts.rbf;

    require!(
        rbf.vault == Pubkey::default(),
        ErrorCode::VaultAlreadySet
    );

    require_keys_eq!(
        ctx.accounts.authority.key(),
        rbf.manager,
        ErrorCode::Unauthorized
    );

    rbf.vault = new_vault;

    Ok(())
}

