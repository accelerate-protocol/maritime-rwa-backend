// SPDX-License-Identifier: MIT
/**
    ___                         __                         __
   /   |  _____  _____  ___    / /  ___    _____  ____ _  / /_  ___
  / /| | / ___/ / ___/ / _ \  / /  / _ \  / ___/ / __ `/ / __/ / _ \
 / ___ |/ /__  / /__  /  __/ / /  /  __/ / /    / /_/ / / /_  /  __/
/_/  |_|\___/  \___/  \___/ /_/   \___/ /_/     \__,_/  \__/  \___/
*/
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "../../interfaces/templates/IVault.sol";
import "../../interfaces/templates/ICrowdsale.sol";
import "../../interfaces/templates/IAccumulatedYield.sol";
import "../../interfaces/templates/IToken.sol";
import "../../interfaces/core/IValidatorRegistry.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {BaseVault} from "./BaseVault.sol";

/**
 * @title CoreVault
 * @dev Core vault template implementation, providing fundamental storage and permission management
 * @notice This contract does not contain specific business logic, business functions are implemented by other modules
 */
contract CoreVault is BaseVault {

    function onTokenTransfer(address from, address to, uint256 amount) external override onlyInitialized whenWhitelisted(from) whenWhitelisted(to) whenNotPaused {
        require(msg.sender == vaultToken, "CoreVault: only token can call");
        if (yield != address(0) && from != address(0) && to != address(0)) {
            IAccumulatedYield(yield).updateUserPoolsOnTransfer(from, to, amount);
        }
    }

    function configureModules(address _vaultToken, address _funding, address _yield) external virtual override(BaseVault) onlyInitialized {
        _setVaultToken(_vaultToken);
        _setFundingModule(_funding);
        _setYieldModule(_yield);

        // Grant roles to funding modules
        _grantRole(MINT_ROLE, funding);
        _grantRole(BURN_ROLE, funding);
        _grantRole(BURN_ROLE, yield);
    }
}