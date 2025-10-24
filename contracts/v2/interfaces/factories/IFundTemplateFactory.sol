// SPDX-License-Identifier: MIT
/**
    ___                         __                         __
   /   |  _____  _____  ___    / /  ___    _____  ____ _  / /_  ___
  / /| | / ___/ / ___/ / _ \  / /  / _ \  / ___/ / __ `/ / __/ / _ \
 / ___ |/ /__  / /__  /  __/ / /  /  __/ / /    / /_/ / / /_  /  __/
/_/  |_|\___/  \___/  \___/ /_/   \___/ /_/     \__,_/  \__/  \___/
*/
pragma solidity ^0.8.26;


interface IFundTemplateFactory{

     event FundDeployed(
        address proxy,
        address proxyAdmin,
        address implementation,
        address guardian
    );

    function newFund(
        address vault, 
        address token, 
        bytes memory initData,
        address guardian
    ) external returns (address, address, address);

}