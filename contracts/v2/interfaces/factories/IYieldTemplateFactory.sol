// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;


interface IYieldTemplateFactory{

     event YieldDeployed(
        address proxy,
        address proxyAdmin,
        address implementation,
        address guardian
    );

    function newYield(
        address vault, 
        address vaultToken, 
        bytes memory initData,
        address guardian
    ) external returns (address, address, address);

}