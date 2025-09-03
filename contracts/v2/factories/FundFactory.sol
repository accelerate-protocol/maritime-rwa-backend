// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IFactory.sol";

import "../interfaces/IFundTempFactory.sol";

contract FundFactory is IFundFactory, Ownable {
    using Clones for address;
    
    mapping(uint256 => address) public templates;
    uint256 public templateCount;
    
    function addTemplate(uint256 templateId, address template) external override onlyOwner {
        require(template != address(0), "FundFactory: invalid template");
        require(templates[templateId] == address(0), "FundFactory: template already exists");
        
        templates[templateId] = template;
        if (templateId >= templateCount) {
            templateCount = templateId + 1;
        }
        emit TemplateAdded(templateId, template);
    }
    
    function createFund(uint256 templateId, address vault,address token,bytes memory initData,address guardian) external override returns (address fund) {
        address template = templates[templateId];
        require(template != address(0), "FundFactory: template not found");

        (address fund,address proxyAdmin,address implementation) = IFundTempFactory(template).newFund(vault,token,initData,guardian);
        emit FundCreated(templateId, fund, msg.sender);
        
        // fund = template.clone();
        
        // (bool success, bytes memory returndata) = fund.call(
        //     abi.encodeWithSignature("initiate(address,address,bytes)", vault,token, initData)
        // );
        // if (!success) {
        //     if (returndata.length > 0) {
        //         string memory reason;
        //         assembly { returndata := add(returndata, 0x04) }
        //         reason = abi.decode(returndata, (string));
        //         revert(string(abi.encodePacked("FundFactory: initialization failed: ", reason)));
        //     } else {
        //         revert("FundFactory: initialization failed");
        //     }
        // }
    
        
        return fund;
    }
    
    function getTemplate(uint256 templateId) external view override returns (address) {
        return templates[templateId];
    }
    
    function getTemplateCount() external view override returns (uint256) {
        return templateCount;
    }
} 