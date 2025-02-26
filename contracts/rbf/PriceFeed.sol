// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interface/AggregatorV3Interface.sol";

/**
 * @author  tmpAuthor
 * @title   PriceFeed
 * @dev     Implements a simple price feed mechanism with role-based access control.
 * @notice  The contract follows the AggregatorV3Interface and allows authorized users to update price data.
 */
contract PriceFeed is AggregatorV3Interface,Ownable,AccessControl {

    struct RoundData {
        int256 answer;          
        uint256 startedAt;      
        uint256 updatedAt;      
        uint80 answeredInRound; 
    }
    
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant FEEDER_ROLE = keccak256("FEEDER_ROLE");
    mapping(uint80 => RoundData) private rounds;
    uint80 private latestRoundId;
    

    /** 
     * @dev     Constructor initializes the contract with an initial price and sets the manager role.
     * @param   manager  manager Address that will be assigned the MANAGER_ROLE.
     * @param   initialPrice  Initial price value to store in the first round.
     */
    constructor(address manager,int256 initialPrice) Ownable(){
        _addPrice(initialPrice, block.timestamp);
        _grantRole(MANAGER_ROLE, manager);
    }

    
    /**
     * @notice  Grants the FEEDER_ROLE to an address, allowing it to update prices.
     * @dev     Only addresses with MANAGER_ROLE can call this function
     * @param   feederAddr  Address to grant the FEEDER_ROLE.
     */
    function grantFeederRole(address feederAddr) public onlyRole(MANAGER_ROLE){
        _grantRole(FEEDER_ROLE, feederAddr);
    }

    
    /**
     * @notice  Revokes the FEEDER_ROLE from an address, removing its ability to update prices.
     * @dev     Only addresses with MANAGER_ROLE can call this function
     * @param   feederAddr  Address to grant the FEEDER_ROLE.
     */
    function revokeFeederRole(address feederAddr) public onlyRole(MANAGER_ROLE){
        _revokeRole(FEEDER_ROLE, feederAddr);
    }
    
    
    /**
     * @notice  Allows a user with the FEEDER_ROLE to add a new price entry.
     * @dev     Only addresses with FEEDER_ROLE can call this function
     * @param   price  The new price value to store.
     * @param   priceTime  Timestamp of the price update.
     */
    function addPrice(int256 price,uint256 priceTime) external onlyRole(FEEDER_ROLE) {
        _addPrice(price, priceTime);
    }

    /**
     * @notice  Returns the description of the price feed.
     * @return  string  A string representing the price feed pair.
     */
    function description() external pure override returns (string memory) {
        return "RBFToken/USD";
    }

    
    /**
     * @notice  Returns the version of the contract.
     * @return  uint256  The version number as a uint256.
     */
    function version() external pure override returns (uint256) {
        return 1;
    }

    /**
     * @notice  Returns the number of decimal places used for the price values.
     * @return  uint8  The number of decimals.
     */
    function decimals() external pure override returns (uint8) {
        return 8;
    }

    /**
     * @notice  Retrieves price data for a specific round.
     * @param   roundId The round ID to query.
     * @return  uint80  roundId The queried round ID.
     * @return  int256  answer The price recorded for this round.
     * @return  uint256  startedAt Timestamp when the round started.
     * @return  uint256  updatedAt Timestamp when the price was last updated.
     * @return  uint80  answeredInRound The round ID for which the price was answered.
     */
    function getRoundData(uint80 roundId)
        external
        view
        override
        returns (
            uint80,
            int256,
            uint256,
            uint256,
            uint80
        )
    {
        require(rounds[roundId].updatedAt > 0, "No data for this round");
        RoundData memory round = rounds[roundId];
        return (roundId, round.answer, round.startedAt, round.updatedAt, round.answeredInRound);
    }

    /**
     * @notice  Retrieves the latest round data.
     * @return  uint80  latestRoundId The most recent round ID.
     * @return  int256  answer The price recorded in the latest round.
     * @return  uint256  startedAt Timestamp when the latest round started.
     * @return  uint256  updatedAt Timestamp when the latest price update occurred.
     * @return  uint80   answeredInRound The round ID for which the latest price was answered.
     */
    function latestRoundData()
        external
        view
        override
        returns (
            uint80,
            int256,
            uint256,
            uint256,
            uint80
        )
    {
        require(latestRoundId > 0, "No price data available");
        RoundData memory round = rounds[latestRoundId];
        return (latestRoundId, round.answer, round.startedAt, round.updatedAt, round.answeredInRound);
    }

    function _addPrice(int256 price,uint256 priceTime) internal{
        latestRoundId++;
        rounds[latestRoundId] = RoundData({
            answer: price,
            startedAt: priceTime,
            updatedAt: priceTime,
            answeredInRound: latestRoundId
        });

        emit PriceUpdated(latestRoundId, price, priceTime);
    }

}
