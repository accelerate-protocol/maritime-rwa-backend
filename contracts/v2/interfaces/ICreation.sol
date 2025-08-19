// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title ICreation
 * @dev One-click deployment interface
 */
interface ICreation {
    // ============ Struct Definitions ============
    struct Project {
        string name;
        address vault;
        address token;
        address fund;
        address accumulatedYield;
        uint256 createdAt;
        address deployer;
    }
    struct DeploymentResult {
        address vault;
        address token;
        address fund;
        address accumulatedYield;
    }
    // ============ Events ============
    event ProjectCreated(string projectName, address vault, address token, address fund, address accumulatedYield, address deployer);
    event FactoriesUpdated(address vaultFactory, address tokenFactory, address fundFactory, address dividendFactory);

    // ============ Management/Deployment Interfaces ============
    /**
     * @notice Deploy a new project with all modules in one transaction.
     * @param projectName The name of the project.
     * @param vaultTemplateId The template ID for the Vault module.
     * @param vaultInitData The initialization data for the Vault module.
     * @param tokenTemplateId The template ID for the Token module.
     * @param tokenInitData The initialization data for the Token module.
     * @param fundTemplateId The template ID for the Fund module.
     * @param fundInitData The initialization data for the Fund module.
     * @param dividendTemplateId The template ID for the Dividend module.
     * @param dividendInitData The initialization data for the Dividend module.
     */
    function deployAll(
        string memory projectName,
        uint256 vaultTemplateId,
        bytes memory vaultInitData,
        uint256 tokenTemplateId,
        bytes memory tokenInitData,
        uint256 fundTemplateId,
        bytes memory fundInitData,
        uint256 dividendTemplateId,
        bytes memory dividendInitData
    ) external;
    /**
     * @notice Set the addresses of all factory contracts.
     * @param _vaultFactory The address of the VaultFactory contract.
     * @param _tokenFactory The address of the TokenFactory contract.
     * @param _fundFactory The address of the FundFactory contract.
     * @param _dividendFactory The address of the DividendFactory contract.
     */
    function setFactories(
        address _vaultFactory,
        address _tokenFactory,
        address _fundFactory,
        address _dividendFactory
    ) external;
    /**
     * @notice Add a user to the whitelist.
     * @param user The address to add.
     */
    function addToWhitelist(address user) external;
    /**
     * @notice Remove a user from the whitelist.
     * @param user The address to remove.
     */
    function removeFromWhitelist(address user) external;

    // ============ Query Interfaces ============
    /**
     * @notice Get the addresses of all factory contracts.
     * @return vaultFactory The address of the VaultFactory contract.
     * @return tokenFactory The address of the TokenFactory contract.
     * @return fundFactory The address of the FundFactory contract.
     * @return dividendFactory The address of the DividendFactory contract.
     */
    function getFactories() external view returns (
        address vaultFactory,
        address tokenFactory,
        address fundFactory,
        address dividendFactory
    );
    /**
     * @notice Get project details by project name.
     * @param projectName The name of the project.
     * @return project The project struct.
     */
    function getProjectByName(string memory projectName) external view returns (Project memory project);
    /**
     * @notice Get project details by user address.
     * @param user The address of the user.
     * @return projects The array of project structs.
     */
    function getUserProjectDetails(address user) external view returns (Project[] memory);
} 