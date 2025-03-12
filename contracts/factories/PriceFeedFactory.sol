// SPDX-License-Identifier: MIT
/**
    ___                         __                         __
   /   |  _____  _____  ___    / /  ___    _____  ____ _  / /_  ___
  / /| | / ___/ / ___/ / _ \  / /  / _ \  / ___/ / __ `/ / __/ / _ \
 / ___ |/ /__  / /__  /  __/ / /  /  __/ / /    / /_/ / / /_  /  __/
/_/  |_|\___/  \___/  \___/ /_/   \___/ /_/     \__,_/  \__/  \___/

*/
pragma solidity 0.8.26;

import "../interface/IPriceFeedFactory.sol";
import "../common/Auth.sol";
import "../rbf/PriceFeed.sol";

/**
 * @author  Accelerate Finance
 * @title   PriceFeedFactory
 * @dev     This contract is responsible for creating new instances of the PriceFeedFactory contract.
 * @notice  Allows authorized users to deploy new PriceFeedFactory contracts.
 */
contract PriceFeedFactory is Auth, IPriceFeedFactory {
    /**
     * @notice Constructor function that initializes the contract and sets the deployer as the authorized user.
     * @dev Inherits from the Auth contract to implement access control.
     * @param deployer The address of the entity deploying the contract, serving as the initial administrator.
     */
    constructor(address deployer) Auth(deployer) {}

    /**
     * @notice  Creates a new instance of the PriceFeed contract.
     * @dev     Only authorized users can call this function.
     * @param   manager  The address of the manager for the new PriceFeed contract.
     * @return  address  The address of the newly created PriceFeed contract.
     */
    function newPriceFeed(
        address manager
    ) public auth override returns (address){
        PriceFeed pricer = new PriceFeed(manager);
        emit PriceFeedDeployed(address(pricer));
        return address(pricer);
    }

}







