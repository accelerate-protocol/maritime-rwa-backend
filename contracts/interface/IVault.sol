// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IVault {

    event SetManager(address manager);
    event FundFailRedeem(uint256 shares,uint256 assetAmount,uint256 feeAmount);

    function deposit(
        uint256 assets
    ) external  returns (uint256);

    function redeem() external returns (uint256);

}