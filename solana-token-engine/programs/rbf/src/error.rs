use anchor_lang::prelude::*;


#[error_code]
#[derive(PartialEq, Eq)]
pub enum ErrorCode {


    #[msg("Invalid RBF authorization account.")]
    InvalidAuthAccount,

}