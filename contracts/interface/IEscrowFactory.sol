// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
interface IEscrowFactory {
    
    /**
     * @notice  Creates a new instance of the Escrow contract.
     * @dev     Only authorized users can call this function.
     * @param   deployer The address of the deployer for the new Escrow contract.
     * @return  address  The address of the newly created Escrow contract.
     */
    function newEscrow(address deployer) external returns (address);

    /**
     * @notice Event emitted when Escrow is deployed.
     *
     * @param escrow deployed Escrow address.
     */
    event EscrowDeployed(address indexed escrow);
}
