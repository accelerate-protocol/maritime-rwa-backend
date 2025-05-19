use anchor_lang::prelude::*;

declare_id!("8pRSLehr1aSzXY38S9RLnmNHmniVWcNjgNfRhEYpL7VF");

#[program]
pub mod solana_token_engine {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }

    pub fn rbf_deploy(ctx: Context<RBFDeploy>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }

    pub fn vault_deploy_auth(ctx: Context<VaultDeployAuth>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }

    pub fn vault_deploy_revoke(ctx: Context<VaultDeployRevoke>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }

    pub fn vault_deploy(ctx: Context<VaultDeploy>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }





}

#[derive(Accounts)]
pub struct Initialize {}
