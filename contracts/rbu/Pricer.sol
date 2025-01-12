// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interface/IPricer.sol";

contract Pricer is IPricer,AccessControl {

    bytes32 public constant CHALLENGE_UPDATE_ROLE = keccak256("CHALLENGE_UPDATE_ROLE");
    uint256 public constant CHALLENGE_PERIOD = 36_00;


    struct PriceInfo {
        uint256 price;
        uint256 timestamp;
        uint256 challengeTime;
    }

    mapping(uint256 => PriceInfo) public prices;

    uint256[] public priceIds;

    uint256 public currentPriceId;
    uint256 public latestPriceId;

    modifier onlyWhiteList(address _address) {
        require(_address!=address(0), "Not white list");
        _;
    }

    constructor(address _admin,uint256 _initialPrice) {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _addPrice(_initialPrice, block.timestamp, block.timestamp);
    } 

    function setChallengeUpdateRole(address _address) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(CHALLENGE_UPDATE_ROLE, _address);
    }

    function addPrice(
        uint256 price,
        uint256 timestamp
    ) external virtual override onlyWhiteList(msg.sender) {
        require(block.timestamp>=prices[latestPriceId].challengeTime,"Exist wait challenge price");

        uint256 challengeTime = block.timestamp + CHALLENGE_PERIOD;
        _addPrice(price, timestamp,challengeTime);
    }

    function challengeUpdatePrice(
        uint256 priceId,
        uint256 price,
        uint256 timestamp
    ) external virtual override onlyRole(CHALLENGE_UPDATE_ROLE) {
        require(priceId==latestPriceId,"Only lastPrice can be challenged");
        require(block.timestamp<prices[latestPriceId].challengeTime,"Not exst wait challenge price");
        PriceInfo memory oldPriceInfo = prices[priceId];
        require(oldPriceInfo.price!=price,"price must be different");
        prices[priceId]=PriceInfo(price, timestamp,block.timestamp);
        emit PriceChallenged(priceId, oldPriceInfo.price, price);
    }

    function _addPrice(uint256 price, uint256 timestamp,uint256 challengeTime) internal {
        require(challengeTime>=block.timestamp,"challengeTime must be greater than current time");
        if (price == 0) {
            revert("err price");
        }

        // Set price
        uint256 priceId = ++currentPriceId;
        prices[priceId] = PriceInfo(price, timestamp,challengeTime);
        priceIds.push(priceId);

        // Update latestPriceId
        if (timestamp > prices[latestPriceId].timestamp) {
            latestPriceId = priceId;
        }

        emit PriceAdded(priceId, price, timestamp);
    }

    function getPrice(uint256 priceId) external view override returns (uint256) {
        return prices[priceId].price;
    }

    function getLatestPrice() external view override returns (uint256) {
        if (block.timestamp < prices[latestPriceId].challengeTime){
            return prices[latestPriceId-1].price;
        }else{
            return prices[latestPriceId].price;
        }
    }


    event PriceChallenged(uint256 indexed priceId, uint256 oldPrice, uint256 newPrice);
    event PriceAdded(uint256 indexed priceId, uint256 price, uint256 timestamp);





}