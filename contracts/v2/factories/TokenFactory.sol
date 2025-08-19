// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IFactory.sol";

contract TokenFactory is ITokenFactory, Ownable {
    using Clones for address;
    
    mapping(uint256 => address) public templates;
    uint256 public templateCount;
    
    function addTemplate(uint256 templateId, address template) external override onlyOwner {
        require(template != address(0), "TokenFactory: invalid template");
        require(templates[templateId] == address(0), "TokenFactory: template already exists");
        
        templates[templateId] = template;
        if (templateId >= templateCount) {
            templateCount = templateId + 1;
        }
        emit TemplateAdded(templateId, template);
    }
    
    function createToken(uint256 templateId, address vault, bytes memory initData) external override returns (address token) {
        address template = templates[templateId];
        require(template != address(0), "TokenFactory: template not found");
        
        token = template.clone();
        (bool success, bytes memory returndata) = token.call(
            abi.encodeWithSignature("initiate(address,bytes)", vault, initData)
        );
        if (!success) {
            if (returndata.length > 0) {
                string memory reason;
                assembly { returndata := add(returndata, 0x04) }
                reason = abi.decode(returndata, (string));
                revert(string(abi.encodePacked("TokenFactory: initialization failed: ", reason)));
            } else {
                revert("TokenFactory: initialization failed");
            }
        }
        
        emit TokenCreated(templateId, token, msg.sender);
        
        return token;
    }
    
    function getTemplate(uint256 templateId) external view override returns (address) {
        return templates[templateId];
    }
    
    function getTemplateCount() external view override returns (uint256) {
        return templateCount;
    }
} 