// SPDX-License-Identifier: MIT
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