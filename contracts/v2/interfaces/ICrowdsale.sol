// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title ICrowdsale
 * @dev 众筹模块接口
 */
interface ICrowdsale {
    // ============ 事件定义 ============
    event Deposit(address indexed user, uint256 amount, address indexed receiver, uint256 shares);
    event Redeem(address indexed user, uint256 amount, address indexed receiver);
    event OffChainDeposit(address indexed manager, address indexed receiver, uint256 amount, bytes signature);
    event OffChainRedeem(address indexed manager, address indexed receiver, uint256 amount);
    event FundingAssetsWithdrawn(address indexed receiver, uint256 amount);
    event ManageFeeWithdrawn(address indexed receiver, uint256 amount);

    // ============ 基础字段查询接口 ============
    function vault() external view returns (address);
    function startTime() external view returns (uint256);
    function endTime() external view returns (uint256);
    function vaultToken() external view returns (address);
    function assetToken() external view returns (address);
    function maxSupply() external view returns (uint256);
    function softCap() external view returns (uint256);
    function sharePrice() external view returns (uint256);
    function minDepositAmount() external view returns (uint256);
    function manageFeeBps() external view returns (uint256);
    function fundingReceiver() external view returns (address);
    function manageFeeReceiver() external view returns (address);
    function decimalsMultiplier() external view returns (uint256);
    function manager() external view returns (address);
    function fundingAssets() external view returns (uint256);
    function manageFee() external view returns (uint256);

    // ============ 融资操作接口 ============
    function deposit(uint256 amount, address receiver) external returns (uint256);
    function redeem(uint256 amount, address receiver) external;
    function depositWithSignature(uint256 amount, address receiver, bytes memory signature) external;
    function offChainRedeem(uint256 amount, address receiver) external;

    // ============ 资金管理接口 ============
    function withdrawFundingAssets() external;
    function withdrawManageFee() external;

    // ============ 状态查询接口 ============
    function isFundingSuccessful() external view returns (bool);
    function isFundingPeriodActive() external view returns (bool);
    function getTotalRaised() external view returns (uint256);
    function getRemainingSupply() external view returns (uint256);
} 