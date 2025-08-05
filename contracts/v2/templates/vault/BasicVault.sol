// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../../interfaces/IVault.sol";
import "../../interfaces/IToken.sol";

/**
 * @title Vault
 * @dev Vault基础模块实现，提供基础存储功能和权限管理
 * @notice 本合约不包含具体业务逻辑，业务功能由其他模块实现
 */
contract Vault is IVault, Ownable, ReentrancyGuard {
    // ============ 状态变量 ============
    
    address public override vaultToken;
    address public override manager;
    bool public override whitelistEnabled;
    mapping(address => bool) public override isWhitelisted;
    address public override validator;
    bytes public override dataHash;
    bytes public override signature;
    
    // 白名单数组，方便遍历
    address[] public whitelistArray;
    
    // 初始化标志
    bool private initialized;
    
    // ============ 修饰符 ============
    
    modifier onlyManager() {
        require(msg.sender == manager, "Vault: only manager");
        _;
    }
    
    modifier onlyVaultToken() {
        require(msg.sender == vaultToken, "Vault: only vault token");
        _;
    }
    
    modifier whenWhitelistEnabled() {
        if (whitelistEnabled) {
            require(isWhitelisted[msg.sender], "Vault: not whitelisted");
        }
        _;
    }
    
    modifier onlyInitialized() {
        require(initialized, "Vault: not initialized");
        _;
    }
    
    // ============ 构造函数 ============
    
    /**
     * @dev 构造函数（用于直接部署）
     */
    constructor() {
        // 空构造函数，支持Clones模式
    }
    
    // ============ 初始化函数 ============
    
    /**
     * @dev 初始化函数（用于Clones模式）
     * @param _manager 管理员地址
     * @param _validator 验证器地址
     * @param _whitelistEnabled 是否启用白名单
     * @param _initialWhitelist 初始白名单地址
     */
    function initVault(
        address _manager,
        address _validator,
        bool _whitelistEnabled,
        address[] memory _initialWhitelist
    ) external {
        require(!initialized, "Vault: already initialized");
        require(_manager != address(0), "Vault: invalid manager");
        require(_validator != address(0), "Vault: invalid validator");
        
        manager = _manager;
        validator = _validator;
        whitelistEnabled = _whitelistEnabled;
        initialized = true;
        
        // 添加初始白名单
        for (uint256 i = 0; i < _initialWhitelist.length; i++) {
            _addToWhitelist(_initialWhitelist[i]);
        }
        
        _transferOwnership(_manager);
    }
    
    // ============ Vault Token 设置 ============
    
    /**
     * @dev 设置vault token地址（只能设置一次）
     * @param _vaultToken vault token地址
     */
    function setVaultToken(address _vaultToken) external onlyOwner onlyInitialized {
        require(vaultToken == address(0), "Vault: token already set");
        require(_vaultToken != address(0), "Vault: invalid token address");
        vaultToken = _vaultToken;
    }
    
    // ============ 白名单管理 ============
    
    /**
     * @dev 添加地址到白名单
     * @param _addr 要添加的地址
     */
    function addToWhitelist(address _addr) external override onlyManager onlyInitialized {
        _addToWhitelist(_addr);
    }
    
    /**
     * @dev 从白名单移除地址
     * @param _addr 要移除的地址
     */
    function removeFromWhitelist(address _addr) external override onlyManager onlyInitialized {
        require(isWhitelisted[_addr], "Vault: not whitelisted");
        
        isWhitelisted[_addr] = false;
        
        // 从数组中移除
        for (uint256 i = 0; i < whitelistArray.length; i++) {
            if (whitelistArray[i] == _addr) {
                whitelistArray[i] = whitelistArray[whitelistArray.length - 1];
                whitelistArray.pop();
                break;
            }
        }
        
        emit WhitelistRemoved(_addr);
    }
    
    /**
     * @dev 启用白名单
     */
    function enableWhitelist() external override onlyManager onlyInitialized {
        whitelistEnabled = true;
        emit WhitelistStatusChanged(true);
    }
    
    /**
     * @dev 禁用白名单
     */
    function disableWhitelist() external override onlyManager onlyInitialized {
        whitelistEnabled = false;
        emit WhitelistStatusChanged(false);
    }
    
    /**
     * @dev 检查是否启用白名单
     * @return 是否启用白名单
     */
    function isWhiteList() external view override returns (bool) {
        return whitelistEnabled;
    }
    
    // ============ 验证功能 ============
    
    /**
     * @dev 验证数据（简单实现，实际应用中需要更复杂的验证逻辑）
     * @return 验证结果
     */
    function verify() external pure override returns (bool) {
        // 简单的验证逻辑，实际实现需要根据具体需求
        return true;
    }
    
    /**
     * @dev 更新验证数据
     * @param hash 数据哈希
     * @param _signature 签名数据
     */
    function updateVerifyData(bytes memory hash, bytes memory _signature) external override onlyManager onlyInitialized {
        dataHash = hash;
        signature = _signature;
        emit VerifyDataUpdated(hash, _signature);
    }
    
    // ============ 代币控制功能 ============
    
    /**
     * @dev 暂停代币
     */
    function pauseToken() external override onlyManager onlyInitialized {
        require(vaultToken != address(0), "Vault: token not set");
        IToken(vaultToken).pause();
        emit TokenPaused();
    }
    
    /**
     * @dev 取消暂停代币
     */
    function unpauseToken() external override onlyManager onlyInitialized {
        require(vaultToken != address(0), "Vault: token not set");
        IToken(vaultToken).unpause();
        emit TokenUnpaused();
    }
    
    /**
     * @dev 检查代币是否暂停
     * @return 代币是否暂停
     */
    function isTokenPaused() external view override returns (bool) {
        if (vaultToken == address(0)) {
            return false;
        }
        return IToken(vaultToken).paused();
    }
    
    // ============ 查询功能 ============
    
    /**
     * @dev 获取白名单长度
     * @return 白名单长度
     */
    function getWhitelistLength() external view returns (uint256) {
        return whitelistArray.length;
    }
    
    /**
     * @dev 获取白名单地址
     * @param index 索引
     * @return 白名单地址
     */
    function getWhitelistAddress(uint256 index) external view returns (address) {
        require(index < whitelistArray.length, "Vault: index out of bounds");
        return whitelistArray[index];
    }
    
    /**
     * @dev 获取完整白名单
     * @return 白名单地址数组
     */
    function getWhitelist() external view returns (address[] memory) {
        return whitelistArray;
    }
    
    // ============ 内部函数 ============
    
    /**
     * @dev 内部添加白名单函数
     * @param _addr 要添加的地址
     */
    function _addToWhitelist(address _addr) internal {
        require(_addr != address(0), "Vault: invalid address");
        require(!isWhitelisted[_addr], "Vault: already whitelisted");
        
        isWhitelisted[_addr] = true;
        whitelistArray.push(_addr);
        
        emit WhitelistAdded(_addr);
    }
} 