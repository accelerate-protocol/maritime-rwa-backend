// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IFactory.sol";

import "../interfaces/IVaultTempFactory.sol";

contract VaultFactory is IVaultFactory, Ownable {
    using Clones for address;
    
    mapping(uint256 => address) public templates;
    uint256 public templateCount;
    
    function addTemplate(uint256 templateId, address template) external override onlyOwner {
        require(template != address(0), "VaultFactory: invalid template");
        require(templates[templateId] == address(0), "VaultFactory: template already exists");
        
        templates[templateId] = template;
        if (templateId >= templateCount) {
            templateCount = templateId + 1;
        }
        
        emit TemplateAdded(templateId, template);
    }
    
    function createVault(uint256 templateId, bytes memory initData,address guardian) external override returns (address vault) {
        address template = templates[templateId];
        require(template != address(0), "VaultFactory: template not found");

        (address vaultProxy,address proxyAdmin,address implementation) = IVaultTempFactory(template).newVault(initData,guardian);
        emit VaultCreated(templateId, vaultProxy, msg.sender);
        // vault = template.clone();
        // (bool success, bytes memory returndata) = vault.call(
        //     abi.encodeWithSignature("initiate(bytes)", initData)
        // );
        // if (!success) {
        //     if (returndata.length > 0) {
        //         string memory reason;
        //         assembly { returndata := add(returndata, 0x04) }
        //         reason = abi.decode(returndata, (string));
        //         revert(string(abi.encodePacked("VaultFactory: initialization failed: ", reason)));
        //     } else {
        //         revert("VaultFactory: initialization failed");
        //     }
        // }
        
        return vault;
    }
    
    function getTemplate(uint256 templateId) external view override returns (address) {
        return templates[templateId];
    }
    
    function getTemplateCount() external view override returns (uint256) {
        return templateCount;
    }
} 