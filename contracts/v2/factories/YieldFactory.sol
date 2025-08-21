// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IFactory.sol";

contract YieldFactory is IYieldFactory, Ownable {
    using Clones for address;
    
    mapping(uint256 => address) public templates;
    uint256 public templateCount;
    
    function addTemplate(uint256 templateId, address template) external override onlyOwner {
        require(template != address(0), "YieldFactory: invalid template");
        require(templates[templateId] == address(0), "YieldFactory: template already exists");
        
        templates[templateId] = template;
        if (templateId >= templateCount) {
            templateCount = templateId + 1;
        }
        emit TemplateAdded(templateId, template);
    }
    
    function createYield(uint256 templateId, address vault, address vaultToken, bytes memory initData) external override returns (address accumulatedYield) {
        address template = templates[templateId];
        require(template != address(0), "YieldFactory: template not found");
        
        accumulatedYield = template.clone();
        (bool success, bytes memory returndata) = accumulatedYield.call(
            abi.encodeWithSignature("initiate(address,address,bytes)", vault, vaultToken, initData)
        );
        if (!success) {
            if (returndata.length > 0) {
                string memory reason;
                assembly { returndata := add(returndata, 0x04) }
                reason = abi.decode(returndata, (string));
                revert(string(abi.encodePacked("YieldFactory: initialization failed: ", reason)));
            } else {
                revert("YieldFactory: initialization failed");
            }
        }
        
        emit YieldCreated(templateId, accumulatedYield, msg.sender);
        
        return accumulatedYield;
    }
    
    function getTemplate(uint256 templateId) external view override returns (address) {
        return templates[templateId];
    }
    
    function getTemplateCount() external view override returns (uint256) {
        return templateCount;
    }
} 