// SPDX-License-Identifier: AGPL-3.0-only
/**
    ___                         __                         __
   /   |  _____  _____  ___    / /  ___    _____  ____ _  / /_  ___
  / /| | / ___/ / ___/ / _ \  / /  / _ \  / ___/ / __ `/ / __/ / _ \
 / ___ |/ /__  / /__  /  __/ / /  /  __/ / /    / /_/ / / /_  /  __/
/_/  |_|\___/  \___/  \___/ /_/   \___/ /_/     \__,_/  \__/  \___/

*/
pragma solidity 0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./Auth.sol";
import "../interface/IEscrow.sol";


/// @title  Escrow
/// @notice Escrow contract that holds tokens.
///         Only wards can approve funds to be taken out.
/// @author Based on code from https://github.com/centrifuge/liquidity-pools
contract Escrow is Auth, IEscrow {
    
    constructor(address deployer) Auth(deployer) {}

    // --- Token approvals ---
    /// @inheritdoc IEscrow
    function approveMax(address token, address spender) external override auth {
        if (IERC20(token).allowance(address(this), spender) == 0) {
            SafeERC20.safeIncreaseAllowance(IERC20(token), spender, type(uint256).max);
            emit Approve(token, spender, type(uint256).max);
        }
    }
    
    /// @inheritdoc IEscrow
    function unapprove(address token, address spender) external override auth {
        SafeERC20.safeDecreaseAllowance(IERC20(token), spender, 0);
        emit Approve(token, spender, 0);
    }

}