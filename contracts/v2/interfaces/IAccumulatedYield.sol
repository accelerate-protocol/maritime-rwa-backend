// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title IAccumulatedYield
 * @dev Accumulated yield contract interface based on sushiswap's masterchef algorithm
 */
interface IAccumulatedYield {
    // ============ Struct Definitions ============
    
    /**
     * @dev Global pool information structure
     */
    struct GlobalPoolInfo {
        uint256 totalAccumulatedShares;     // Total accumulated shares in the yield pool
        uint256 lastDividendTime;          // Last dividend distribution time
        uint256 totalDividend;             // Total dividend amount distributed
        bool isActive;                     // Whether the yield pool is active
        address shareToken;                // Address of the share token (user's share certificate)
        address rewardToken;               // Address of the reward token (USDT and other stablecoins)
    }
    
    /**
     * @dev User information structure
     */
    struct UserInfo {
        uint256 accumulatedShares;         // User's current accumulated shares
        uint256 lastClaimTime;             // Last claim time
        uint256 lastClaimDividend;         // Total dividend amount at last claim
        uint256 totalClaimed;              // Total claimed amount
    }
    

    

    
    // ============ Event Definitions ============
    
    /**
     * @dev Global pool initialization event
     */
    event GlobalPoolInitialized(
        address indexed shareToken,
        address indexed rewardToken,
        uint256 timestamp
    );
    
    /**
     * @dev Dividend distribution event
     */
    event DividendDistributed(
        uint256 amount,
        uint256 timestamp,
        address indexed validator,
        bytes signature
    );
    
    /**
     * @dev Reward claim event
     */
    event RewardClaimed(
        address indexed user,
        uint256 claimedAmount,
        uint256 transferredAmount,
        uint256 timestamp
    );
    
    /**
     * @dev User pool update event
     */
    event UserPoolUpdated(
        address indexed user,
        uint256 newAccumulatedShares,
        uint256 timestamp
    );
    
    /**
     * @dev Token transfer event (for tracking transfers that affect yield)
     */
    event ShareTokenTransferred(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );
    
    /**
     * @dev Manager update event
     */
    event ManagerUpdated(
        address indexed oldManager,
        address indexed newManager
    );
    
    /**
     * @dev Dividend treasury update event
     */
    event DividendTreasuryUpdated(
        address indexed oldTreasury,
        address indexed newTreasury
    );
    

    

    
    // ============ Global Pool Management Interface ============
    
    /**
     * @dev Set manager
     * @param _manager New manager address
     */
    function setManager(address _manager) external;
    
    /**
     * @dev Set dividend treasury address
     * @param _dividendTreasury New dividend treasury address
     */
    function setDividendTreasury(address _dividendTreasury) external;
    
    /**
     * @dev Initialize global yield pool
     * @param _vault Vault contract address
     * @param _manager Manager address
     * @param _dividendTreasury Dividend treasury address
     * @param shareToken Share token address
     * @param rewardToken Reward token address
     */
    function initGlobalPool(
        address _vault,
        address _manager,
        address _dividendTreasury,
        address shareToken,
        address rewardToken
    ) external;
    
    /**
     * @dev Update global pool status
     * @param isActive Whether to activate
     */
    function updateGlobalPoolStatus(
        bool isActive
    ) external;
    
    // ============ User Operation Interface ============
    
    /**
     * @dev User claim rewards
     */
    function claimReward() external;
    
    // ============ Yield Distribution Interface ============
    
    /**
     * @dev Distribute dividend to global pool
     * @param dividendAmount Distribution amount
     * @param signature Dividend signature
     */
    function distributeDividend(
        uint256 dividendAmount,
        bytes memory signature
    ) external;
    
    // ============ Token Transfer Related Interface ============
    
    /**
     * @dev Update user pools on token transfer (core functionality)
     * @param from Transfer from address
     * @param to Transfer to address
     * @param amount Transfer amount
     * 
     * Note: This function should be called in the following cases:
     * - User-to-user transfers
     */
    function updateUserPoolsOnTransfer(
        address from,
        address to,
        uint256 amount
    ) external;
    
    // ============ Query Interface ============
    
    /**
     * @dev Query global pool information
     * @return Global pool information structure
     */
    function getGlobalPoolInfo() external view returns (GlobalPoolInfo memory);
    
    /**
     * @dev Query user information
     * @param user User address
     * @return User information structure
     */
    function getUserInfo(address user) external view returns (UserInfo memory);
    
    /**
     * @dev Query user's pending rewards
     * @param user User address
     * @return Pending reward amount
     */
    function pendingReward(address user) external view returns (uint256);
    

    
    /**
     * @dev Query global pool total dividend amount
     * @return Total dividend amount
     */
    function totalDividend() external view returns (uint256);
    
    /**
     * @dev Query global pool total accumulated shares
     * @return Total accumulated shares
     */
    function totalAccumulatedShares() external view returns (uint256);
    
    /**
     * @dev Query current manager
     * @return Manager address
     */
    function getManager() external view returns (address);
    
    /**
     * @dev Query dividend treasury address
     * @return Dividend treasury address
     */
    function getDividendTreasury() external view returns (address);
    
    /**
     * @dev Calculate user's accumulated shares at specified balance
     * @param user User address
     * @param userBalance Specified user balance
     * @return Accumulated shares
     */
    function calculateAccumulatedShares(address user, uint256 userBalance) external view returns (uint256);
    

} 