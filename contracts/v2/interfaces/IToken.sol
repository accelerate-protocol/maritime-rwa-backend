// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IToken
 * @dev Token basic module interface, inheriting ERC20 standard
 */
interface IToken is IERC20 {
    // ============ Event Definitions ============
    event TokenMinted(address indexed to, uint256 amount);
    event TokenBurned(address indexed from, uint256 amount);
    event TokenPaused();
    event TokenUnpaused();

    // ============ Basic Field Query Interface ============
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function paused() external view returns (bool);
    function vault() external view returns (address);

    // ============ Minting and Burning Interface ============
    function mint(address to, uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;

    // ============ Pause Control Interface ============
    function pause() external;
    function unpause() external;
    
    // ============ Unified Initialization Interface ============
    function initiate(address _vault, bytes memory _initData) external;
} 