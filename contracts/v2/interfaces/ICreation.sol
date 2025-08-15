// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title ICreation
 * @dev 一键部署器接口 - 基于工厂模式的设计
 */
interface ICreation {
    // ============ 结构体定义 ============
    
    /**
     * @dev Vault初始化数据
     */
    struct VaultInitData {
        address validator;        // 验证者地址
        bool whitelistEnabled;    // 是否启用白名单
        address[] initialWhitelist; // 初始白名单
    }
    
    /**
     * @dev Token初始化数据
     */
    struct TokenInitData {
        string name;      // 代币名称
        string symbol;    // 代币符号
        uint8 decimals;   // 代币精度
    }
    
    /**
     * @dev Fund初始化数据
     */
    struct FundInitData {
        uint256 startTime;           // 开始时间（UNIX时间戳）
        uint256 endTime;             // 结束时间（UNIX时间戳）
        address assetToken;          // 融资代币地址（如USDT）
        uint256 maxSupply;           // 最大融资代币数量
        uint256 softCap;             // 融资成功阈值
        uint256 sharePrice;          // 代币价格（单位：融资代币）
        uint256 minDepositAmount;    // 最小投资金额
        uint256 manageFeeBps;        // 管理费基点（如200 = 2%）
        address fundingReceiver;     // 融资接收地址
        address manageFeeReceiver;   // 管理费接收地址
        uint256 decimalsMultiplier;  // 精度乘数（10^融资代币精度）
    }
    
    /**
     * @dev Dividend初始化数据
     */
    struct DividendInitData {
        address rewardToken;   // 收益代币地址（如USDT）
        address rewardManager; // 收益资金管理员
    }
    
    /**
     * @dev 部署结果结构体
     */
    struct DeploymentResult {
        address vault;
        address token;
        address fund;
        address accumulatedYield;
    }
    
    /**
     * @dev 项目结构体
     */
    struct Project {
        string name;
        address vault;
        address token;
        address fund;
        address accumulatedYield;
        uint256 createdAt;
        address deployer;
    }
    
    // ============ 事件定义 ============
    
    event VaultCreated(address indexed vault);
    event TokenCreated(address indexed token);
    event FundCreated(address indexed fund);
    event YieldCreated(address indexed yield);
    
    
    event ProjectCreated(
        string name,
        address vault,
        address token,
        address fund,
        address yield,
        address deployer
        );
    
    event FactoriesUpdated(
        address vaultFactory,
        address tokenFactory,
        address fundFactory,
        address dividendFactory
    );
    
    // ============ 工厂管理接口 ============
    
    /**
     * @dev 设置工厂合约地址
     * @param _vaultFactory Vault工厂地址
     * @param _tokenFactory Token工厂地址
     * @param _fundFactory Fund工厂地址
     * @param _dividendFactory Dividend工厂地址
     */
    function setFactories(
        address _vaultFactory,
        address _tokenFactory,
        address _fundFactory,
        address _dividendFactory
    ) external;
    
    /**
     * @dev 获取工厂地址
     * @return vaultFactory Vault工厂地址
     * @return tokenFactory Token工厂地址
     * @return fundFactory Fund工厂地址
     * @return dividendFactory Dividend工厂地址
     */
    function getFactories() external view returns (
        address vaultFactory,
        address tokenFactory,
        address fundFactory,
        address dividendFactory
    );
    
    // ============ 部署接口 ============
    
    /**
     * @dev 核心部署函数（使用bytes数据，推荐使用）
     * @param projectName 项目名称
     * @param vaultTemplateId Vault模板ID
     * @param vaultInitData Vault初始化数据（bytes格式）
     * @param tokenTemplateId Token模板ID
     * @param tokenInitData Token初始化数据（bytes格式）
     * @param fundTemplateId Fund模板ID
     * @param fundInitData Fund初始化数据（bytes格式）
     * @param dividendTemplateId Dividend模板ID
     * @param dividendInitData Dividend初始化数据（bytes格式）
     * @return result 部署结果
     */
    function deployAll(
        // 项目名称
        string memory projectName,
        
        // Vault参数
        uint256 vaultTemplateId,
        bytes memory vaultInitData,
        
        // Token参数
        uint256 tokenTemplateId,
        bytes memory tokenInitData,
        
        // Fund参数
        uint256 fundTemplateId,
        bytes memory fundInitData,
        
        // Dividend参数
        uint256 dividendTemplateId,
        bytes memory dividendInitData
    ) external returns (DeploymentResult memory result);
    

    
    /**
     * @dev 单独部署Vault
     * @param templateId 模板ID
     * @param initData 初始化数据（bytes格式）
     * @return vault Vault地址
     */
    function deployVault(
        uint256 templateId,
        bytes memory initData
    ) external returns (address vault);
    
    /**
     * @dev 单独部署Token
     * @param templateId 模板ID
     * @param vault Vault地址
     * @param initData 初始化数据（bytes格式）
     * @return token Token地址
     */
    function deployToken(
        uint256 templateId,
        address vault,
        bytes memory initData
    ) external returns (address token);
    
    /**
     * @dev 单独部署Fund
     * @param templateId 模板ID
     * @param vault Vault地址
     * @param initData 初始化数据（bytes格式）
     * @return fund Fund地址
     */
    function deployFund(
        uint256 templateId,
        address vault,
        bytes memory initData
    ) external returns (address fund);
    
    /**
     * @dev 单独部署Dividend
     * @param templateId 模板ID
     * @param vault Vault地址
     * @param token Token地址
     * @param initData 初始化数据（bytes格式）
     * @return dividend Dividend地址
     */
    function deployDividend(
        uint256 templateId,
        address vault,
        address token,
        bytes memory initData
    ) external returns (address dividend);
    
    // ============ 查询接口 ============
    

    
    /**
     * @dev 查询用户部署的项目
     * @param user 用户地址
     * @return projects 用户的项目数组
     */
    function getUserProjects(address user) external view returns (DeploymentResult[] memory projects);
    
    /**
     * @dev 根据项目名称获取项目详情
     * @param projectName 项目名称
     * @return project 项目详情
     */
    function getProjectByName(string memory projectName) external view returns (Project memory);
    
    /**
     * @dev 获取用户的所有项目详情
     * @param user 用户地址
     * @return projects 项目详情数组
     */
    function getUserProjectDetails(address user) external view returns (Project[] memory);
} 