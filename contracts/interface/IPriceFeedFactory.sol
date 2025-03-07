// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IPriceFeedFactory {
    
    /**
     * @notice  Creates a new instance of the PriceFeed contract.
     * @dev     Only authorized users can call this function.
     * @param   manager  The address of the manager for the new PriceFeed contract.
     * @return  address  The address of the newly created PriceFeed contract.
     */
    function newPriceFeed(
        address manager
    ) external returns (address);
    
    /**
     * @notice Event emitted when PriceFeed is deployed.
     *
     * @param priceFeed deployed PriceFeed address.
     */
    event PriceFeedDeployed(address indexed priceFeed);

}