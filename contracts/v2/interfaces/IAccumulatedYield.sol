// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title IAccumulatedYield
 * @dev 参考sushiswap的masterchef算法实现的收益合约接口
 */
interface IAccumulatedYield {
    // ============ 结构体定义 ============
    
    /**
     * @dev 全局收益池信息结构
     */
    struct GlobalPoolInfo {
        uint256 totalAccumulatedShares;     // 收益池累积总份额
        uint256 lastDividendTime;          // 最后派息时间
        uint256 totalDividend;             // 总派息金额
        bool isActive;                     // 收益池是否激活
        address shareToken;                // 用户持有的份额凭证的token地址
        address rewardToken;               // 收益代币 (USDT等稳定币)地址
    }
    
    /**
     * @dev 用户信息结构
     */
    struct UserInfo {
        uint256 accumulatedShares;         // 用户当前持有的累计份额
        uint256 lastClaimTime;             // 最后领取时间
        uint256 lastClaimDividend;         // 最后一次派息的总金额
        uint256 totalClaimed;              // 总领取金额
    }
    

    

    
    // ============ 事件定义 ============
    
    /**
     * @dev 全局池子初始化事件
     */
    event GlobalPoolInitialized(
        address indexed shareToken,
        address indexed rewardToken,
        uint256 timestamp
    );
    
    /**
     * @dev 收益分配事件
     */
    event DividendDistributed(
        uint256 amount,
        uint256 timestamp,
        address indexed validator,
        bytes32 indexed messageHash
    );
    
    /**
     * @dev 收益领取事件
     */
    event RewardClaimed(
        address indexed user,
        uint256 claimedAmount,
        uint256 transferredAmount,
        uint256 timestamp
    );
    
    /**
     * @dev 用户池更新事件
     */
    event UserPoolUpdated(
        address indexed user,
        uint256 newAccumulatedShares,
        uint256 timestamp
    );
    
    /**
     * @dev 代币转移事件（用于跟踪影响收益的转移）
     */
    event ShareTokenTransferred(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );
    
    /**
     * @dev 管理员更新事件
     */
    event ManagerUpdated(
        address indexed oldManager,
        address indexed newManager
    );
    
    /**
     * @dev 派息接收地址更新事件
     */
    event DividendReceiverUpdated(
        address indexed oldReceiver,
        address indexed newReceiver
    );
    

    

    
    // ============ 全局池子管理接口 ============
    
    /**
     * @dev 设置管理员
     * @param _manager 新的管理员地址
     */
    function setManager(address _manager) external;
    
    /**
     * @dev 设置派息接收地址
     * @param _dividendReceiver 新的派息接收地址
     */
    function setDividendReceiver(address _dividendReceiver) external;
    
    /**
     * @dev 初始化全局收益池
     * @param _vault Vault合约地址
     * @param _manager 管理员地址
     * @param _dividendReceiver 派息资金的接收地址
     * @param shareToken 份额凭证代币地址
     * @param rewardToken 收益代币地址
     */
    function initGlobalPool(
        address _vault,
        address _manager,
        address _dividendReceiver,
        address shareToken,
        address rewardToken
    ) external;
    
    /**
     * @dev 更新全局池子状态
     * @param isActive 是否激活
     */
    function updateGlobalPoolStatus(
        bool isActive
    ) external;
    
    // ============ 用户操作接口 ============
    
    /**
     * @dev 用户领取收益
     */
    function claimReward() external;
    
    // ============ 收益分配接口 ============
    
    /**
     * @dev 向全局池子派息
     * @param dividendAmount 分配数量
     * @param signature 派息签名
     */
    function distributeDividend(
        uint256 dividendAmount,
        bytes memory signature
    ) external;
    
    // ============ 代币转移相关接口 ============
    
    /**
     * @dev 在代币转移时更新用户池（核心功能）
     * @param from 转出地址
     * @param to 转入地址
     * @param amount 转移数量
     * 
     * 说明：此函数应在以下情况被调用：
     * - 用户间转账
     */
    function updateUserPoolsOnTransfer(
        address from,
        address to,
        uint256 amount
    ) external;
    
    // ============ 查询接口 ============
    
    /**
     * @dev 查询全局池子信息
     * @return 全局池子信息结构体
     */
    function getGlobalPoolInfo() external view returns (GlobalPoolInfo memory);
    
    /**
     * @dev 查询用户信息
     * @param user 用户地址
     * @return 用户信息结构体
     */
    function getUserInfo(address user) external view returns (UserInfo memory);
    
    /**
     * @dev 查询用户待领取收益
     * @param user 用户地址
     * @return 待领取收益数量
     */
    function pendingReward(address user) external view returns (uint256);
    

    
    /**
     * @dev 查询全局池子总派息数量
     * @return 总派息数量
     */
    function totalDividend() external view returns (uint256);
    
    /**
     * @dev 查询全局池子总累积份额
     * @return 总累积份额
     */
    function totalAccumulatedShares() external view returns (uint256);
    
    /**
     * @dev 查询当前管理员
     * @return 管理员地址
     */
    function getManager() external view returns (address);
    
    /**
     * @dev 查询派息接收地址
     * @return 派息接收地址
     */
    function getDividendReceiver() external view returns (address);
    
    /**
     * @dev 计算用户在指定余额下的累计份额
     * @param user 用户地址
     * @param userBalance 指定的用户余额
     * @return 累计份额
     */
    function calculateAccumulatedShares(address user, uint256 userBalance) external view returns (uint256);
    

} 