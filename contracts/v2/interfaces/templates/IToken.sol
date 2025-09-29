// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
/**
 * @title IToken
 * @dev Token basic templates interface, inheriting ERC20 standard
 */
interface IToken is IERC20 {
    
    // ============ Basic Field Query Interface ============
    function paused() external view returns (bool);

    // ============ Minting and Burning Interface ============
    function mint(address to, uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;

    // ============ Pause Control Interface ============
    function pause() external;
    function unpause() external;
} 