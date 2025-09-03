// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
/**
 * @title IToken
 * @dev Token basic module interface, inheriting ERC20 standard
 */
interface IToken is IERC20Upgradeable {
    
    // ============ Basic Field Query Interface ============
    function paused() external view returns (bool);
    function vault() external view returns (address);

    // ============ Minting and Burning Interface ============
    function mint(address to, uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;

    // ============ Pause Control Interface ============
    function pause() external;
    function unpause() external;
} 