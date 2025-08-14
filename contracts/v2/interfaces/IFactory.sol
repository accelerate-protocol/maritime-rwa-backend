// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title IVaultFactory
 * @dev Vault工厂接口
 */
interface IVaultFactory {
    event TemplateAdded(uint256 indexed templateId, address indexed template);
    event VaultCreated(uint256 indexed templateId, address indexed vault, address indexed deployer);
    
    function createVault(uint256 templateId, bytes memory initData) external returns (address);
    function addTemplate(uint256 templateId, address template) external;
    function getTemplate(uint256 templateId) external view returns (address);
    function getTemplateCount() external view returns (uint256);
}

/**
 * @title ITokenFactory
 * @dev Token工厂接口
 */
interface ITokenFactory {
    event TemplateAdded(uint256 indexed templateId, address indexed template);
    event TokenCreated(uint256 indexed templateId, address indexed token, address indexed vault);
    
    function createToken(uint256 templateId, address vault, bytes memory initData) external returns (address);
    function addTemplate(uint256 templateId, address template) external;
    function getTemplate(uint256 templateId) external view returns (address);
    function getTemplateCount() external view returns (uint256);
}

/**
 * @title IFundFactory
 * @dev Fund工厂接口
 */
interface IFundFactory {
    event TemplateAdded(uint256 indexed templateId, address indexed template);
    event FundCreated(uint256 indexed templateId, address indexed fund, address indexed vault);
    
    function createFund(uint256 templateId, address vault, bytes memory initData) external returns (address);
    function addTemplate(uint256 templateId, address template) external;
    function getTemplate(uint256 templateId) external view returns (address);
    function getTemplateCount() external view returns (uint256);
}

/**
 * @title IYieldFactory
 * @dev Yield工厂接口
 */
interface IYieldFactory {
    event TemplateAdded(uint256 indexed templateId, address indexed template);
    event YieldCreated(uint256 indexed templateId, address indexed accumulatedYield, address indexed vault);
    
    function createYield(uint256 templateId, address vault, address token, bytes memory initData) external returns (address);
    function addTemplate(uint256 templateId, address template) external;
    function getTemplate(uint256 templateId) external view returns (address);
    function getTemplateCount() external view returns (uint256);
} 