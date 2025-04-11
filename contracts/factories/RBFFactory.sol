// SPDX-License-Identifier: MIT
/**
    ___                         __                         __
   /   |  _____  _____  ___    / /  ___    _____  ____ _  / /_  ___
  / /| | / ___/ / ___/ / _ \  / /  / _ \  / ___/ / __ `/ / __/ / _ \
 / ___ |/ /__  / /__  /  __/ / /  /  __/ / /    / /_/ / / /_  /  __/
/_/  |_|\___/  \___/  \___/ /_/   \___/ /_/     \__,_/  \__/  \___/

*/
pragma solidity 0.8.26;

import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "../interface/IRBFFactory.sol";
import "../common/Auth.sol";
import "../rbf/RBF.sol";


//tc-38:升级RBF
/**
 * @author  Accelerate Finance
 * @title   RBFFactory
 * @dev     This contract is responsible for deploying and managing instances of the RBF contract.
 *
 * @notice  This contract serves as a Factory for the upgradable RBF token contract.
 *          Upon calling `newRBF` the caller address will
 *          deploy the following:
 *          1) RBF - The implementation contract, ERC20Upgradeable contract with the constructor disabled
 *          2) ProxyAdmin - OZ ProxyAdmin contract, used to upgrade the proxy instance.
 *                          Owner is set to `guardian` address.
 *          3) TransparentUpgradeableProxy - OZ TransparentUpgradeableProxy contract, used to proxy the implementation.
 *          Following the above mentioned deployment, the address of the RBFFactory contract will:
 *          i) Transfer ownership of the ProxyAdmin to that of the `guardian` address.
 *          ii) Transfer ownership of the rbfProxied to that of the msg.sender address.
 *
 */
 //tc-1:给RBFRouter授权RBFFactory调用权限：使用一个没有权限的用户授权，应该失败
 //tc-1:给RBFRouter授权RBFFactory调用权限：使用一个有权限的用户授权，应该成功
contract RBFFactory is Auth, IRBFFactory {
    event RBFDeployed(
        address proxy,
        address proxyAdmin,
        address implementation,
        address guardian
    );

    /**
     * @notice Constructor function that initializes the contract and sets the deployer as the authorized user.
     * @dev Inherits from the Auth contract to implement access control.
     * @param deployer The address of the entity deploying the contract, serving as the initial administrator.
     */
    constructor(address deployer) Auth(deployer) {}

    /**
     * @notice  Creates a new instance of the RBF contract using an upgradeable proxy.
     * @dev     Deploys a new implementation of RBF, a ProxyAdmin, and a TransparentUpgradeableProxy.
     *          Transfers ownership of the proxy admin to the guardian and the RBF to the caller.
     * @param   data  The initialization data for the RBF contract.
     * @param   guardian  The address that will take ownership of the proxy admin.
     * @return  address   The address of the newly created RBF proxy contract.
     * @return  address   The address of the newly created proxy admin contract.
     * @return  address   The address of the newly created RBF implementation contract.
     */
     //tc-5:没有权限的人调用RBFFactory的newRBF方法，应该调用不成功
     //tc-5:有权限的人调用RBFFactory的newRBF方法，应该调用成功
    function newRBF(
        RBFInitializeData memory data,
        address guardian
    ) public override auth returns (address, address, address) {
        RBF rbfImplementation = new RBF();
        ProxyAdmin rbfProxyAdmin = new ProxyAdmin();
        TransparentUpgradeableProxy rbfProxy = new TransparentUpgradeableProxy(
            address(rbfImplementation),
            address(rbfProxyAdmin),
            ""
        );
        RBF rbfProxied = RBF(address(rbfProxy));
        rbfProxied.initialize(data);
        rbfProxyAdmin.transferOwnership(guardian);
        rbfProxied.transferOwnership(msg.sender);
        assert(rbfProxyAdmin.owner() == guardian);
        assert(rbfProxied.owner() == msg.sender);
        emit RBFDeployed(
            address(rbfProxied),
            address(rbfProxyAdmin),
            address(rbfImplementation),
            guardian
        );

        return (
            address(rbfProxied),
            address(rbfProxyAdmin),
            address(rbfImplementation)
        );
    }
}
