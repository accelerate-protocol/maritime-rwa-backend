// SPDX-License-Identifier: MIT
/**
    ___                         __                         __
   /   |  _____  _____  ___    / /  ___    _____  ____ _  / /_  ___
  / /| | / ___/ / ___/ / _ \  / /  / _ \  / ___/ / __ `/ / __/ / _ \
 / ___ |/ /__  / /__  /  __/ / /  /  __/ / /    / /_/ / / /_  /  __/
/_/  |_|\___/  \___/  \___/ /_/   \___/ /_/     \__,_/  \__/  \___/
*/
pragma solidity ^0.8.26;

import "./BaseVault.sol";
import "../../interfaces/templates/IFundVault.sol";
import "../../interfaces/templates/ICrowdsale.sol";

contract FundVault is BaseVault,IFundVault {

    bytes32 public constant FEEDER_ROLE = keccak256("FEEDER_ROLE");
    // Mapping to store round data, where the key is the round ID and the value is a RoundData struct
    mapping(uint256 => RoundData) private rounds;
    // Stores the latest round ID, which increments each time new data is added
    uint256 public latestRoundId;

    function initiate(bytes memory _initData) override public initializer {
        (address _manager, address _validator, bool _whitelistEnabled, address[] memory _initialWhitelist) =
        abi.decode(_initData, (address, address, bool, address[]));
        _initVault(_manager, _validator, _whitelistEnabled, _initialWhitelist);

        _grantRole(FEEDER_ROLE, _manager);
        _setRoleAdmin(FEEDER_ROLE, MANAGER_ROLE);
    }

    function isFundSuccessful() external view returns (bool){
        return ICrowdsale(funding).isFundingSuccessful();
    }

    function addPrice(uint256 sharePrice) external onlyInitialized whenNotPaused onlyRole(FEEDER_ROLE){
        latestRoundId++;
        rounds[latestRoundId] = RoundData({
            price: sharePrice,
            startedAt: block.timestamp
        });
        emit PriceUpdated(latestRoundId, sharePrice, block.timestamp);
    }


    function getRoundData(uint256 roundId) external view returns (RoundData memory){
        return rounds[roundId];
    }

    function lastestRoundData() external view returns (RoundData memory){
        return rounds[latestRoundId];
    }

    function lastestPrice() external view returns (uint256){
        RoundData memory round = rounds[latestRoundId];
        return round.price;
    }

    function configureModules(address _vaultToken, address _funding, address _yield) external virtual override(IVault, BaseVault) onlyInitialized {
        _setVaultToken(_vaultToken);
        _setFundingModule(_funding);
        _setYieldModule(_yield);

        // Grant roles to funding and yield modules
        _grantRole(MINT_ROLE, funding);
        _grantRole(BURN_ROLE, funding);
        _grantRole(BURN_ROLE, yield);
    }

    function priceDecimals() external pure returns (uint8){
        return 8;
    }


    


}