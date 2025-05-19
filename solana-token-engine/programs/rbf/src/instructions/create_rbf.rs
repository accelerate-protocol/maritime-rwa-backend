use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::*;
use anchor_spl::token_interface::{Mint,TokenAccount};

//账户
#[derive(Accounts)]
#[instruction(params:RbfInitParams)]
pub struct CreateRbf<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [GlobalConfig::SEED.as_bytes()],
        bump,
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(
        seeds = [b"rbf_auth", creator.key().as_ref()],
        bump,
        constraint = rbf_auth.creator == creator.key() @ ErrorCode::InvalidAuthAccount
    )]
    pub rbf_auth: Account<'info, RbfAuth>,

    #[account(
        init,
        payer = creator,
        space = 8 + RBF::ACCOUNT_SIZE,
        seeds = [b"rbf", creator.key().as_ref(),&global_config.rbf_nonce.to_le_bytes()],
        bump
    )]
    pub rbf: Account<'info, RBF>,

    #[account(
        init,
        payer = creator,
        mint::authority = rbf, 
        mint::decimals = 6,
        mint::token_program = token_program,
    )]
    pub rbf_mint: InterfaceAccount<'info, Mint>,

    #[account(constraint = manager.data_len() > 0, constraint = manager.lamports() > 0)]
    pub manager: AccountInfo<'info>,

    #[account(constraint = drds.data_len() > 0, constraint = drds.lamports() > 0)]
    pub drds: AccountInfo<'info>,

    #[account(constraint = asset_mint.data_len() > 0, constraint = asset_mint.lamports() > 0)]
    pub asset_mint: InterfaceAccount<'info,Mint>,

    #[account(
        init_if_needed,
        payer = creator,
        associated_token::mint = asset_mint,
        associated_token::authority = rbf,
    )]
    pub asset_treasury: InterfaceAccount<'info, TokenAccount>,

    #[account(constraint = asset_recipient.data_len() > 0,constraint = asset_recipient.mint == asset_mint.key())]
    pub asset_recipient: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}


//参数
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RbfInitParams {
    pub liquidation_slippage: u64,
    // extra
}


//指令
pub fn create_rbf(
    ctx: Context<CreateRbf>,
    params:RbfInitParams
) -> Result<()> {
    let rbf = &mut ctx.accounts.rbf;

    rbf.creater = ctx.accounts.creator.key();
    rbf.manager = ctx.accounts.manager.key();
    rbf.drds = ctx.accounts.drds.key();
    rbf.asset_mint = ctx.accounts.asset_mint.key();
    rbf.rbf_mint = ctx.accounts.rbf_mint.key();
    rbf.asset_treasury = ctx.accounts.asset_treasury.key();
    rbf.asset_recipient = ctx.accounts.asset_recipient.key();
    rbf.vault = Pubkey::default();
    rbf.total_subscription = 0;
    rbf.total_redemption = 0;
    rbf.liquidation_slippage = params.liquidation_slippage;
    rbf.status = RBFStatus::Running;
    rbf.bump = *ctx.bumps.get("rbf").unwrap();

    global_config.rbf_nonce = global_config
        .rbf_nonce
        .checked_add(1)
        .ok_or(ErrorCode::NumericalOverflow)?;

    Ok(())

   
}
