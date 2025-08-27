// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title ICrowdsale
 * @dev Crowdsale module interface
 */
interface ICrowdsale {
    // ============ Struct Definitions ============
    
    /**
     * @dev On-chain signature data structure
     */
    struct OnChainSignatureData {
        string operation;        // Operation name ("deposit", "redeem")
        uint256 amount;          // Deposit amount
        address receiver;        // Receiver address
        uint256 nonce;          // Nonce to prevent replay attacks
        uint256 chainId;        // Chain ID to prevent cross-chain replay
        address contractAddress; // Contract address to prevent replay
    }
    
    /**
     * @dev Off-chain signature data structure
     */
    struct OffChainSignatureData {
        uint256 amount;          // amount
        address receiver;        // Receiver address
    }
    
    // ============ Events ============
    event Deposit(address indexed receiver, uint256 assertAmount, uint256 manageFee, uint256 shares);
    event FundFailRedeem(address redeemer,uint256 shares,uint256 assetAmount,uint256 feeAmount);
    event OffChainDeposit(address indexed receiver, uint256 assertAmount, uint256 shares, bytes signature);
    event OffChainRedeem(address indexed receiver, uint256 assertAmount);
    event FundingAssetsWithdrawn(address indexed receiver, uint256 amount);
    event ManageFeeWithdrawn(address indexed receiver, uint256 amount);
    event TokenUnpausedOnFundingSuccess();

    // ============ Basic Field Query Interface ============
    function vault() external view returns (address);
    function startTime() external view returns (uint256);
    function endTime() external view returns (uint256);
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

    // ============ Funding Operations Interface ============
    // User initiated, requires manager signature
    function deposit(uint256 amount, address receiver, bytes memory signature) external;
    
    // User initiated, requires manager signature - redeems specified amount of shares
    function redeem(uint256 amount, address receiver, bytes memory signature) external;
    
    // Backend manager initiated, requires DRDS signature verification
    function offChainDeposit(uint256 amount, address receiver, bytes memory drdsSignature) external;
    
    // Backend manager initiated - redeems all user shares
    function offChainRedeem(address receiver) external;

    // ============ Fund Management Interface ============
    function withdrawFundingAssets() external;
    function withdrawManageFee() external;
    function unpauseTokenOnFundingSuccess() external;

    // ============ Status Query Interface ============
    function isFundingSuccessful() external view returns (bool);
    function isFundingPeriodActive() external view returns (bool);
    function getTotalRaised() external view returns (uint256);
    function getRemainingSupply() external view returns (uint256);
    
    // ============ Signature Query Interface ============
    function getCallerNonce(address caller) external view returns (uint256);
    function getDepositSignatureMessage(uint256 amount, address receiver, uint256 nonce) external view returns (bytes32);
    function getRedeemSignatureMessage(uint256 amount, address receiver, uint256 nonce) external view returns (bytes32);
    
    // ============ Unified Initialization Interface ============
    function initiate(address _vault,address _token,bytes memory _initData) external;
} 