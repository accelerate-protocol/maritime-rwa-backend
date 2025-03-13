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
 //tc-5:给RBFRouter授权PriceFeedFactory调用权限：使用一个没有权限的用户授权，应该失败
 //tc-6:给RBFRouter授权PriceFeedFactory调用权限：使用一个有权限的用户授权，应该成功
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
     //tc-34:没有权限的人调用PriceFeedFactory的newPriceFeed方法，应该调用不成功
     //tc-35:有权限的人调用PriceFeedFactory的newPriceFeed方法，应该调用成功
    function newPriceFeed(
        address manager
    ) public auth override returns (address){
        PriceFeed pricer = new PriceFeed(manager);
        emit PriceFeedDeployed(address(pricer));
        return address(pricer);
    }

}







