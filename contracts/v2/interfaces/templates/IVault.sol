// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title IVault
 * @dev Vault basic templates interface
 */
interface IVault {
    // ============ Event Definitions ============
    event TokenPaused();
    event TokenUnpaused();
    event ManagerChanged(address indexed oldManager, address indexed newManager);

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
    
    // ============ Query Interface ============
    function getValidator() external view returns (address);
    
}