// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title IVault
 * @dev Vault基础模块接口
 */
interface IVault {
    // ============ 事件定义 ============
    event WhitelistAdded(address indexed addr);
    event WhitelistRemoved(address indexed addr);
    event WhitelistStatusChanged(bool enabled);
    event TokenPaused();
    event TokenUnpaused();
    event VerifyDataUpdated(bytes dataHash, bytes signature);

    // ============ 基础字段查询接口 ============
    function vaultToken() external view returns (address);
    function manager() external view returns (address);
    function whitelistEnabled() external view returns (bool);
    function isWhitelisted(address addr) external view returns (bool);
    function validator() external view returns (address);
    function dataHash() external view returns (bytes memory);
    function signature() external view returns (bytes memory);

    // ============ 白名单管理接口 ============
    function addToWhitelist(address _addr) external;
    function removeFromWhitelist(address _addr) external;
    function enableWhitelist() external;
    function disableWhitelist() external;
    function isWhiteList() external view returns (bool);

    // ============ 验证接口 ============
    function verify() external pure returns (bool);
    function updateVerifyData(bytes memory hash, bytes memory _signature) external;

    // ============ 代币控制接口 ============
    function pauseToken() external;
    function unpauseToken() external;
    function isTokenPaused() external view returns (bool);
    
    // ============ 代币操作接口 ============
    function mintToken(address to, uint256 amount) external;
    function burnToken(address from, uint256 amount) external;
    
    // ============ transfer hook接口 ============
    function onTokenTransfer(address from, address to, uint256 amount) external;
    
    // ============ 模块配置接口 ============
    function configureModules(address _vaultToken, address _funding, address _yield) external;
    function setVaultToken(address _vaultToken) external;
    function setFundingModule(address _funding) external;
    function setDividendModule(address _dividendModule) external;
    
    // ============ 融资状态查询接口 ============
    function isFundingSuccessful() external view returns (bool);
    
    // ============ 统一初始化接口 ============
    function initiate(bytes memory _initData) external;
} 