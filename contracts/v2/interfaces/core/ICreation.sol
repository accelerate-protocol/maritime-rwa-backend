// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

/**
 * @title ICreation
 * @dev One-click deployment interface
 */
interface ICreation {
    // ============ Struct Definitions ============
    struct Project {
        string name;
        TemplateResult vault;
        TemplateResult token;
        TemplateResult fund;
        TemplateResult yield;
        uint256 createdAt;
        address guardian;
        address deployer;
    }

    struct DeployParams {
        uint8 vaultTemplateId;
        bytes vaultInitData;
        uint8 tokenTemplateId;
        bytes tokenInitData;
        uint8 fundTemplateId;
        bytes fundInitData;
        uint8 yieldTemplateId;
        bytes yieldInitData;
        address guardian;
    }

    struct TemplateResult {
        uint8 templateId;
        address template;
        address proxyAdmin;
    }
    struct DeploymentResult {
        address vault;
        address token;
        address fund;
        address yield;
    }
    // ============ Events ============
    event ProjectCreated(TemplateResult vault, TemplateResult token, TemplateResult fund, TemplateResult yield, address deployer);

    // ============ Management/Deployment Interfaces ============
    /**
     * @notice Deploy a new project with all modules in one transaction.
     * @param params The deployment parameters including template IDs and initialization data for each module.
    */
    function deployAll(
        DeployParams memory params
    ) external;

    
    // ============ Query Interfaces ============
    /**
     * @notice Get the addresses of all registry contracts.
     * @return vaultRegistry The address of the VaultRegistry contract.
     * @return tokenRegistry The address of the TokenRegistry contract.
     * @return fundRegistry The address of the FundRegistry contract.
     * @return yieldRegistry The address of the YieldRegistry contract.
     */
    function getRegistries() external view returns (
        address vaultRegistry,
        address tokenRegistry,
        address fundRegistry,
        address yieldRegistry
    );
}