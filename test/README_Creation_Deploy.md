# Creation Contract Deployment Guide

## Overview

This guide demonstrates how to deploy and test the V2 Creation contract, which provides a one-click deployment solution for the complete V2 architecture.

## Prerequisites

1. Node.js and npm installed
2. Hardhat development environment set up
3. Local blockchain network running (Hardhat Network, Ganache, etc.)

## Deployment Steps

### 1. Deploy Templates

First, deploy all template contracts:

```javascript
// Deploy token template
const TokenFactory = await ethers.getContractFactory("VaultToken");
const tokenTemplate = await TokenFactory.deploy();

// Deploy vault template  
const VaultFactory = await ethers.getContractFactory("BasicVault");
const vaultTemplate = await VaultFactory.deploy();

// Deploy yield template
const YieldFactory = await ethers.getContractFactory("AccumulatedYield");
const yieldTemplate = await YieldFactory.deploy();

// Deploy funding template
const FundingFactory = await ethers.getContractFactory("Crowdsale");
const fundingTemplate = await FundingFactory.deploy();
```

### 2. Deploy Factories

Deploy factory contracts that will clone the templates:

```javascript
// Deploy token factory
const TokenFactoryContract = await ethers.getContractFactory("TokenFactory");
const tokenFactory = await TokenFactoryContract.deploy(tokenTemplate.address);

// Deploy vault factory
const VaultFactoryContract = await ethers.getContractFactory("VaultFactory");
const vaultFactory = await VaultFactoryContract.deploy(vaultTemplate.address);

// Deploy yield factory
const YieldFactoryContract = await ethers.getContractFactory("YieldFactory");
const yieldFactory = await YieldFactoryContract.deploy(yieldTemplate.address);

// Deploy funding factory
const FundingFactoryContract = await ethers.getContractFactory("FundFactory");
const fundingFactory = await FundingFactoryContract.deploy(fundingTemplate.address);
```

### 3. Deploy Creation Contract

Deploy the main Creation contract that orchestrates everything:

```javascript
const CreationFactory = await ethers.getContractFactory("Creation");
const creation = await CreationFactory.deploy(
    tokenFactory.address,
    vaultFactory.address,
    yieldFactory.address,
    fundingFactory.address
);
```

### 4. Set Factory Addresses

Configure the Creation contract with factory addresses:

```javascript
await creation.setTokenFactory(tokenFactory.address);
await creation.setVaultFactory(vaultFactory.address);
await creation.setYieldFactory(yieldFactory.address);
await creation.setFundingFactory(fundingFactory.address);
```

## One-Click Project Deployment

### Basic Project Deployment

Deploy a complete project with minimal configuration:

```javascript
const projectData = {
    name: "My Test Project",
    symbol: "MTP",
    decimals: 18,
    assetToken: usdt.address, // USDT address
    manager: manager.address,
    validator: validator.address
};

const tx = await creation.deployProject(projectData);
const receipt = await tx.wait();

// Get deployed contract addresses from events
const event = receipt.events?.find(e => e.event === "ProjectDeployed");
const deployedAddresses = event.args;
```

### Advanced Project Deployment

Deploy with custom configuration:

```javascript
const advancedProjectData = {
    name: "Advanced Project",
    symbol: "ADV",
    decimals: 18,
    assetToken: usdt.address,
    manager: manager.address,
    validator: validator.address,
    // Custom parameters
    customParams: {
        vaultParams: {
            // Vault specific parameters
        },
        yieldParams: {
            // Yield specific parameters  
        },
        fundingParams: {
            // Funding specific parameters
        }
    }
};

const tx = await creation.deployAdvancedProject(advancedProjectData);
```

## Contract Initialization

### Token Initialization

```javascript
// Function signature: initToken(address vault, string name, string symbol, uint8 decimals)
const tokenInitData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "string", "string", "uint8"],
    [vaultAddress, "Project Token", "PTK", 18]
);
```

### Vault Initialization

```javascript
// Function signature: initVault(address assetToken, address manager, address validator)
const vaultInitData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "address"],
    [assetTokenAddress, managerAddress, validatorAddress]
);
```

### Yield Initialization

```javascript
// Function signature: initGlobalPool(address vault, address manager, address dividendTreasury, address shareToken, address rewardToken)
const yieldInitData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "address", "address", "address"],
    [vaultAddress, managerAddress, dividendTreasuryAddress, shareTokenAddress, rewardTokenAddress]
);
```

## Testing

### Run All Tests

```bash
npx hardhat test
```

### Run Specific Test

```bash
npx hardhat test test/Creation.deploy.test.js
```

### Test Individual Components

```bash
# Test token functionality
npx hardhat test test/VaultToken.test.ts

# Test yield functionality  
npx hardhat test test/AccumulatedYield.test.ts

# Test vault functionality
npx hardhat test test/BasicVault.test.ts
```

## Verification

### Verify Contract Deployment

```javascript
// Check if all factories are set
const tokenFactory = await creation.tokenFactory();
const vaultFactory = await creation.vaultFactory();
const yieldFactory = await creation.yieldFactory();
const fundingFactory = await creation.fundingFactory();

console.log("Token Factory:", tokenFactory);
console.log("Vault Factory:", vaultFactory);
console.log("Yield Factory:", yieldFactory);
console.log("Funding Factory:", fundingFactory);
```

### Verify Project Deployment

```javascript
// Get deployed project addresses
const projectAddresses = await creation.getProjectAddresses(projectId);

console.log("Token:", projectAddresses.token);
console.log("Vault:", projectAddresses.vault);
console.log("Yield:", projectAddresses.yield);
console.log("Funding:", projectAddresses.funding);
```

## Error Handling

### Common Errors

1. **Factory not set**: Ensure all factory addresses are set before deployment
2. **Invalid parameters**: Check that all required parameters are provided
3. **Permission denied**: Ensure the caller has the required permissions
4. **Template not found**: Verify that template contracts are deployed and accessible

### Debugging

```javascript
// Enable detailed logging
const tx = await creation.deployProject(projectData, { gasLimit: 5000000 });
const receipt = await tx.wait();

// Check for events
receipt.events?.forEach(event => {
    console.log("Event:", event.event, event.args);
});
```

## Best Practices

1. **Always test on local network first**
2. **Use proper error handling**
3. **Verify all contract addresses**
4. **Check gas limits for complex deployments**
5. **Monitor events for deployment status**

## Security Considerations

1. **Validate all input parameters**
2. **Use proper access controls**
3. **Test with different account roles**
4. **Verify contract interactions**
5. **Monitor for unexpected behavior**

## Troubleshooting

### Deployment Fails

1. Check if all templates are deployed
2. Verify factory addresses are correct
3. Ensure sufficient gas for deployment
4. Check network connectivity

### Initialization Fails

1. Verify contract addresses are valid
2. Check parameter types and values
3. Ensure proper permissions
4. Review error messages

### Integration Issues

1. Verify contract interfaces match
2. Check event signatures
3. Ensure proper function calls
4. Validate data encoding 