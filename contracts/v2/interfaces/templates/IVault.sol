// SPDX-License-Identifier: MIT
/**
    ___                         __                         __
   /   |  _____  _____  ___    / /  ___    _____  ____ _  / /_  ___
  / /| | / ___/ / ___/ / _ \  / /  / _ \  / ___/ / __ `/ / __/ / _ \
 / ___ |/ /__  / /__  /  __/ / /  /  __/ / /    / /_/ / / /_  /  __/
/_/  |_|\___/  \___/  \___/ /_/   \___/ /_/     \__,_/  \__/  \___/
*/
pragma solidity ^0.8.26;

/**
 * @title IVault
 * @dev Vault basic templates interface
 */
interface IVault {
    // ============ Event Definitions ============
    event TokenPaused();
    event TokenUnpaused();

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