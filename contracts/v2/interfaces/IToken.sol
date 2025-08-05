// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IToken
 * @dev Token基础模块接口，继承ERC20标准
 */
interface IToken is IERC20 {
    // ============ 事件定义 ============
    event TokenMinted(address indexed to, uint256 amount);
    event TokenBurned(address indexed from, uint256 amount);
    event TokenPaused();
    event TokenUnpaused();

    // ============ 基础字段查询接口 ============
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function paused() external view returns (bool);
    function vault() external view returns (address);

    // ============ 铸币和销毁接口 ============
    function mint(address to, uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;

    // ============ 暂停控制接口 ============
    function pause() external;
    function unpause() external;
} 