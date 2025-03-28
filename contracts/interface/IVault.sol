// SPDX-License-Identifier: MIT
/**
    ___                         __                         __
   /   |  _____  _____  ___    / /  ___    _____  ____ _  / /_  ___
  / /| | / ___/ / ___/ / _ \  / /  / _ \  / ___/ / __ `/ / __/ / _ \
 / ___ |/ /__  / /__  /  __/ / /  /  __/ / /    / /_/ / / /_  /  __/
/_/  |_|\___/  \___/  \___/ /_/   \___/ /_/     \__,_/  \__/  \___/

*/
pragma solidity 0.8.26;

interface IVault {

    event SetManager(address manager);
    event FundFailRedeem(address redeemer,uint256 shares,uint256 assetAmount,uint256 feeAmount);
    event OffChainDepositEvent(address operator,address receiver,uint256 amount);
    event OffChainRedeemEvent(address redeemer,uint256 shares);
    event DepositEvent(address depositor,uint256 assetAmount,uint256 manageFeeAmount,uint256 shares);
    event ExecStrategyEvent(uint256 depositAmount);

    function deposit(
        uint256 assets
    ) external  returns (uint256);

    function redeem() external returns (uint256);

}