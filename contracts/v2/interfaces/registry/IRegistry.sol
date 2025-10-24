// SPDX-License-Identifier: MIT
/**
    ___                         __                         __
   /   |  _____  _____  ___    / /  ___    _____  ____ _  / /_  ___
  / /| | / ___/ / ___/ / _ \  / /  / _ \  / ___/ / __ `/ / __/ / _ \
 / ___ |/ /__  / /__  /  __/ / /  /  __/ / /    / /_/ / / /_  /  __/
/_/  |_|\___/  \___/  \___/ /_/   \___/ /_/     \__,_/  \__/  \___/
*/
pragma solidity ^0.8.26;

/**
 * @title IVaultRegistry
 * @dev Vault registry interface
 */
interface IVaultRegistry {
    event TemplateAdded(uint256 indexed templateId, address indexed template);
    event VaultCreated(uint256 indexed templateId, address indexed vault, address indexed deployer);
    
    function createVault(uint256 templateId, bytes memory initData,address guardian) external returns (address, address);
    function addTemplate(uint256 templateId, address template) external;
    function getTemplate(uint256 templateId) external view returns (address);
    function getTemplateCount() external view returns (uint256);
}

/**
 * @title ITokenRegistry
 * @dev Token registry interface
 */
interface ITokenRegistry {
    event TemplateAdded(uint256 indexed templateId, address indexed template);
    event TokenCreated(uint256 indexed templateId, address indexed token, address indexed vault);
    
    function createToken(uint256 templateId, address vault, bytes memory initData,address guardian) external returns (address, address);
    function addTemplate(uint256 templateId, address template) external;
    function getTemplate(uint256 templateId) external view returns (address);
    function getTemplateCount() external view returns (uint256);
}

/**
 * @title IFundRegistry
 * @dev Fund registry interface
 */
interface IFundRegistry {
    event TemplateAdded(uint256 indexed templateId, address indexed template);
    event FundCreated(uint256 indexed templateId, address indexed fund, address indexed vault);
    
    function createFund(uint256 templateId, address vault,address token, bytes memory initData,address guardian) external returns (address, address);
    function addTemplate(uint256 templateId, address template) external;
    function getTemplate(uint256 templateId) external view returns (address);
    function getTemplateCount() external view returns (uint256);
}

/**
 * @title IYieldRegistry
 * @dev Yield registry interface
 */
interface IYieldRegistry {
    event TemplateAdded(uint256 indexed templateId, address indexed template);
    event YieldCreated(uint256 indexed templateId, address indexed yield, address indexed vault);
    
    function createYield(uint256 templateId, address vault, address token, bytes memory initData,address guardian) external returns (address, address);
    function addTemplate(uint256 templateId, address template) external;
    function getTemplate(uint256 templateId) external view returns (address);
    function getTemplateCount() external view returns (uint256);
}


