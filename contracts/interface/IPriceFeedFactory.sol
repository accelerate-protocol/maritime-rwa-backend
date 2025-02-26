// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IPriceFeedFactory {
    
    /**
     * @notice  Creates a new instance of the PriceFeed contract.
     * @dev     Only authorized users can call this function.
     * @param   admin  The address of the admin for the new PriceFeed contract.
     * @param   initialPrice  The initial price value for the PriceFeed contract.
     * @return  address  The address of the newly created PriceFeed contract.
     */
    function newPriceFeed(
        address admin,
        int256 initialPrice
    ) external returns (address);
    
    /**
     * @notice Event emitted when PriceFeed is deployed.
     *
     * @param priceFeed deployed PriceFeed address.
     */
    event PriceFeedDeployed(address indexed priceFeed);

}