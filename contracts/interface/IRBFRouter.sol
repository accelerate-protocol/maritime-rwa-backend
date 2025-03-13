// SPDX-License-Identifier: MIT
/**
    ___                         __                         __
   /   |  _____  _____  ___    / /  ___    _____  ____ _  / /_  ___
  / /| | / ___/ / ___/ / _ \  / /  / _ \  / ___/ / __ `/ / __/ / _ \
 / ___ |/ /__  / /__  /  __/ / /  /  __/ / /    / /_/ / / /_  /  __/
/_/  |_|\___/  \___/  \___/ /_/   \___/ /_/     \__,_/  \__/  \___/

*/
pragma solidity 0.8.26;


interface IRBFRouter {

     /**
     * @notice  Deploys a new RBF contract after verifying signatures.
     * @dev     Decodes the deployment data, verifies signatures, and deploys the RBF contract along with escrow and price feed.
     * @param   deployData  Encoded data containing deployment parameters.
     * @param   signatures  Array of signatures for verification.
     */
    function deployRBF(
        bytes memory deployData,
        bytes[] memory signatures
    ) external;

    event DeployRBFEvent(
        uint64 rbfId,
        address priceFeed,
        address rbf,
        address dividendTreasury
    );

    event SetWhiteListsAndThreshold(
        address[] whiteLists,
        uint256 threshold
    );
}