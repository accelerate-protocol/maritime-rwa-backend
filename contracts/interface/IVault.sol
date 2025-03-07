// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IVault {

    event SetManager(address manager);
    event FundFailRedeem(address redeemer,uint256 shares,uint256 assetAmount,uint256 feeAmount);
    event DepositEvent(address depositor,uint256 assetAmount,uint256 manageFeeAmount,uint256 shares);
    event ExecStrategyEvent(uint256 depositAmount);

    function deposit(
        uint256 assets
    ) external  returns (uint256);

    function redeem() external returns (uint256);

}