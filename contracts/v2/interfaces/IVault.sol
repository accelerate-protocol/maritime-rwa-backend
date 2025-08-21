// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title IVault
 * @dev Vault basic module interface
 */
interface IVault {
    // ============ Event Definitions ============
    event WhitelistAdded(address indexed addr);
    event WhitelistRemoved(address indexed addr);
    event WhitelistStatusChanged(bool enabled);
    event TokenPaused();
    event TokenUnpaused();
    event VerifyDataUpdated(bytes dataHash, bytes signature);

    // ============ Basic Field Query Interface ============
    function vaultToken() external view returns (address);
    function manager() external view returns (address);
    function whitelistEnabled() external view returns (bool);
    function isWhitelisted(address addr) external view returns (bool);
    function validator() external view returns (address);
    function dataHash() external view returns (bytes memory);
    function signature() external view returns (bytes memory);

    // ============ Whitelist Management Interface ============
    function addToWhitelist(address _addr) external;
    function removeFromWhitelist(address _addr) external;
    function enableWhitelist() external;
    function disableWhitelist() external;
    function isWhiteList() external view returns (bool);

    // ============ Verification Interface ============
    function verify() external pure returns (bool);
    function updateVerifyData(bytes memory hash, bytes memory _signature) external;

    // ============ Token Control Interface ============
    function pauseToken() external;
    function unpauseToken() external;
    function isTokenPaused() external view returns (bool);
    
    // ============ Token Operation Interface ============
    function mintToken(address to, uint256 amount) external;
    function burnToken(address from, uint256 amount) external;
    
    // ============ Transfer Hook Interface ============
    function onTokenTransfer(address from, address to, uint256 amount) external;
    
    // ============ Module Configuration Interface ============
    function configureModules(address _vaultToken, address _funding, address _yield) external;
    
    // ============ Funding Status Query Interface ============
    function isFundingSuccessful() external view returns (bool);
    
    // ============ Unified Initialization Interface ============
    function initiate(bytes memory _initData) external;
} 