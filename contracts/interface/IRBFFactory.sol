// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "../rbf/RBF.sol";

interface IRBFFactory {
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
    function newRBF(
        RBFInitializeData memory data,
        address guardian
    ) external returns (address, address, address);

}
