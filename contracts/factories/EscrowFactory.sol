// SPDX-License-Identifier: MIT
/**
    ___                         __                         __
   /   |  _____  _____  ___    / /  ___    _____  ____ _  / /_  ___
  / /| | / ___/ / ___/ / _ \  / /  / _ \  / ___/ / __ `/ / __/ / _ \
 / ___ |/ /__  / /__  /  __/ / /  /  __/ / /    / /_/ / / /_  /  __/
/_/  |_|\___/  \___/  \___/ /_/   \___/ /_/     \__,_/  \__/  \___/

*/
pragma solidity 0.8.26;

import "../interface/IEscrowFactory.sol";
import "../common/Auth.sol";
import "../common/Escrow.sol";
/**
 * @author  Accelerate Finance
 * @title   EscrowFactory
 * @dev     This contract is responsible for creating new instances of the Escrow contract.
 * @notice  Allows authorized users to deploy new Escrow contracts.
 */
 //tc-1:给RBFRouter授权EscrowFactory调用权限：使用一个没有权限的用户授权，应该失败
 //tc-1:给RBFRouter授权EscrowFactory调用权限：使用一个有权限的用户授权，应该成功
 //tc-2:当前未给VaultRouter授权，应该不能部署Vault
 //tc-2:给VaultRouter授权EscrowFactory调用权限：使用有权限的人给VaultRouter授权，应该成功
contract EscrowFactory is Auth, IEscrowFactory {

    /**
     * @notice Constructor function that initializes the contract and sets the deployer as the authorized user.
     * @dev Inherits from the Auth contract to implement access control.
     * @param deployer The address of the entity deploying the contract, serving as the initial administrator.
     */
    constructor(address deployer) Auth(deployer) {}
    
    /**
     * @notice  Creates a new instance of the Escrow contract.
     * @dev     Only authorized users can call this function.
     * @param   deployer The address of the deployer for the new Escrow contract.
     * @return  address  The address of the newly created Escrow contract.
     */
     //tc-3:没有权限的人调用EscrowFactory的newEscrow方法，应该调用不成功
     //tc-3:有权限的人调用EscrowFactory的newEscrow方法，应该调用成功
    function newEscrow(address deployer) public auth override returns (address) {
        Escrow escrow = new Escrow(deployer);
        emit EscrowDeployed(address(escrow));
        return address(escrow);
    }

}