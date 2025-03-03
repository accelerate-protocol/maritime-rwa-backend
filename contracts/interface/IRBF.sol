// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IRBF {

    /**
     * @notice  Allows the vault to deposit the asset token and mint corresponding RBF tokens.
     * @dev     Deposits the asset token, deducts the manager's fee, and mints RBF tokens based on the asset's price.
     * @param   amount  The amount of asset token being deposited.
     */
    function deposit(uint256 amount) external;

    event DepositEvent(
        address receiver,
        uint256 amount,
        uint256 feeAmount,
        uint256 actualAmount,
        uint256 mintAmount
    );
    event DividendEvent(
        address receiver,
        uint256 amount
    );

    event SetVault(address vault);
}

