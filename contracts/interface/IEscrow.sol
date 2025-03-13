// SPDX-License-Identifier: AGPL-3.0-only
/**
    ___                         __                         __
   /   |  _____  _____  ___    / /  ___    _____  ____ _  / /_  ___
  / /| | / ___/ / ___/ / _ \  / /  / _ \  / ___/ / __ `/ / __/ / _ \
 / ___ |/ /__  / /__  /  __/ / /  /  __/ / /    / /_/ / / /_  /  __/
/_/  |_|\___/  \___/  \___/ /_/   \___/ /_/     \__,_/  \__/  \___/

*/
pragma solidity 0.8.26;

interface IEscrow {
    // --- Events ---
    event Approve(address indexed token, address indexed spender, uint256 value);

    // --- Token approvals ---
    /// @notice sets the allowance of `spender` to `type(uint256).max` if it is currently 0
    function approveMax(address token, address spender) external;

    /// @notice sets the allowance of `spender` to 0
    function unapprove(address token, address spender) external;
}
