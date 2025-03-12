// SPDX-License-Identifier: MIT
/**
    ___                         __                         __
   /   |  _____  _____  ___    / /  ___    _____  ____ _  / /_  ___
  / /| | / ___/ / ___/ / _ \  / /  / _ \  / ___/ / __ `/ / __/ / _ \
 / ___ |/ /__  / /__  /  __/ / /  /  __/ / /    / /_/ / / /_  /  __/
/_/  |_|\___/  \___/  \___/ /_/   \___/ /_/     \__,_/  \__/  \___/

*/
pragma solidity 0.8.26;

interface IRBF {
    event DepositEvent(address depositor, uint256 amount);
    event DepositDataEvent(uint256 depositPirce, uint256 depositMintAmount);
    event SetVault(address vault);
    event SetMintSlippageBps(uint256 mintSlippageBps);
    event SetTokenURI(string tokenURI);
}
