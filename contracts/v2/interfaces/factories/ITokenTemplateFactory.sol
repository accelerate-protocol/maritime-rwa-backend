// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;


interface ITokenTemplateFactory {

     event TokenDeployed(
        address proxy,
        address proxyAdmin,
        address implementation,
        address guardian
    );

    function newToken(
        address vault,
        bytes memory initData,
        address guardian
    ) external returns (address, address, address);

}