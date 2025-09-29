# Scripts Directory

This directory contains utility scripts for managing and interacting with the Accelerate Protocol smart contracts. Each script serves a specific purpose in the contract lifecycle, from deployment to monitoring and management.

## Table of Contents

- [Contract Status Scripts](#contract-status-scripts)
- [Deployment Scripts](#deployment-scripts)
- [Role Management Scripts](#role-management-scripts)
- [Lifecycle Management Scripts](#lifecycle-management-scripts)
- [Utility Scripts](#utility-scripts)
- [Development Scripts](#development-scripts)

---

## Contract Status Scripts

### 1. accumulatedYield-status.js

**Purpose**: Query and display the status of AccumulatedYield contracts, including pool information and yield distribution details.

**Features**:
- Check yield pool active status
- Display token information and balances
- Show yield distribution metrics
- Validate contract deployment

**Usage**:
```bash
# Using default address
npx hardhat run scripts/accumulatedYield-status.js --network <network>

# Using custom contract address
npx hardhat run scripts/accumulatedYield-status.js --address=0x3dE2Da43d4c1B137E385F36b400507c1A24401f8 --network <network>
```

**Environment Variables**: None required

---

### 2. funding-status.js

**Purpose**: Monitor crowdfunding campaign status, including funding progress, caps, and fee information.

**Features**:
- Display funding period status (active/inactive)
- Show funding success status
- Progress bars for soft cap and maximum supply
- Management fee calculations
- Time-based funding information

**Usage**:
```bash
npx hardhat run scripts/funding-status.js --network <network>
```

**Configuration**: 
- Edit the `fundAddress` variable in the script to target your specific Crowdsale contract

**Sample Output**:
```
🔍 Crowdfunding Quick Status Query
==================================================
Crowdfunding period: 🟢 Active
Crowdfunding result: ⏳ In progress/Failed

💰 Funding Status:
Total raised: 1000000.000000 asset
Soft cap: 500000.000000 asset
Management fee percentage: 2.50%
```

---

### 3. vault-status.js

**Purpose**: Quick status check for CoreVault contracts, displaying key contract addresses and validator information.

**Features**:
- Display vault token address
- Show funding contract address
- Display yield contract address
- Show validator registry and validator addresses

**Usage**:
```bash
npx hardhat run scripts/vault-status.js --network <network>
```

**Configuration**: 
- Edit the `vaultAddress` variable in the script to target your specific CoreVault contract

---

## Deployment Scripts

### 4. deploy-mock-tokens.js

**Purpose**: Deploy MockUSDT and MockUSDC tokens for testing purposes, with automatic token minting for development.

**Features**:
- Deploy MockUSDT and MockUSDC contracts
- Mint 100M tokens to all Hardhat signers (localhost/hardhat networks only)
- Save deployment information to JSON file
- Network-aware deployment (only on test networks)

**Usage**:
```bash
# Deploy on localhost/hardhat (with automatic minting)
npx hardhat run scripts/deploy-mock-tokens.js --network localhost

# Deploy on testnet (without minting)
npx hardhat run scripts/deploy-mock-tokens.js --network sepolia
```

**Output**: Creates `deployments/mock-tokens-deployment.json` with contract addresses

---

## Role Management Scripts

### 5. grant-role.js

**Purpose**: Advanced role management system for granting various roles across different contract types.

**Features**:
- Grant roles for Creation contracts (MANAGER_ROLE, VAULT_LAUNCH_ROLE)
- Grant roles for Vault contracts (TOKEN_TRANSFER_ROLE, MINT_ROLE, BURN_ROLE, PAUSE_ROLE)
- Grant roles for Crowdsale contracts (MANAGER_ROLE, PAUSER_ROLE, etc.)
- Grant roles for Yield contracts (FEEDER_ROLE, WITHDRAW_ASSET_ROLE, etc.)
- Grant roles for ValidatorRegistry contracts (MANAGER_ROLE, PAUSER_ROLE)
- Automatic role checking to prevent duplicate grants

**Usage**:
```bash
# Using environment variables
CREATION_ADDRESS=0x... VAULT_ADDRESS=0x... npx hardhat run scripts/grant-role.js --network <network>

# The script will prompt for missing addresses or use deployment information
npx hardhat run scripts/grant-role.js --network <network>
```

**Environment Variables**:
- `CREATION_ADDRESS`: Creation contract address
- `VAULT_ADDRESS`: Vault contract address  
- `CROWDSALE_ADDRESS`: Crowdsale contract address
- `YIELD_ADDRESS`: Yield contract address
- `VALIDATOR_REGISTRY_ADDRESS`: ValidatorRegistry contract address

**Example Output**:
```
🔍 Checking MANAGER_ROLE for 0x... on Creation...
🚀 Granting MANAGER_ROLE to 0x...
✅ Successfully granted MANAGER_ROLE to 0x...
📝 Transaction hash: 0x...
```

---

### 6. grant-transfer-role.js

**Purpose**: Specialized script for granting TOKEN_TRANSFER_ROLE to specific users on CoreVault contracts.

**Features**:
- Grant TOKEN_TRANSFER_ROLE to predefined user addresses
- Support for multiple networks (BSC, Base, etc.)
- Automatic role checking

**Usage**:
```bash
# Using environment variable
COREVAULT_ADDRESS=0x... npx hardhat run scripts/grant-transfer-role.js --network <network>

# Using deployment information
npx hardhat run scripts/grant-transfer-role.js --network <network>
```

**Configuration**: 
- Edit the `usersToGrant` array in the script to specify target addresses

---

## Lifecycle Management Scripts

### 7. fund-vault-lifecycle.js

**Purpose**: Complete fund vault lifecycle management including deployment, investment, and yield distribution.

**Features**:
- Deploy new fund projects with all required contracts
- Handle investment operations
- Manage yield distribution
- Multi-network support with automatic USDT selection
- Stage-based execution (deploy/invest/yield)

**Usage**:
```bash
# Deploy new project
VAULT_LIFECYCLE_STAGE=deploy PROJECT_NAME="MyProject" npx hardhat run scripts/fund-vault-lifecycle.js --network <network>

# Investment stage
VAULT_LIFECYCLE_STAGE=invest npx hardhat run scripts/fund-vault-lifecycle.js --network <network>

# Yield distribution stage  
VAULT_LIFECYCLE_STAGE=yield npx hardhat run scripts/fund-vault-lifecycle.js --network <network>
```

**Environment Variables**:
- `VAULT_LIFECYCLE_STAGE`: Execution stage (deploy/invest/yield)
- `PROJECT_NAME`: Name for new project deployment
- `USDT_ADDRESS`: Custom USDT address (optional)
- `VALIDATOR_ADDRESS`: Validator address (optional)
- `MAINNET_USDT_ADDRESS`: Mainnet USDT address for production

---

### 8. vault-lifecycle.js

**Purpose**: Core vault lifecycle management with deployment, investment, and dividend distribution capabilities.

**Features**:
- Deploy new vault projects
- Handle investment operations
- Distribute dividends to investors
- Network-aware USDT handling
- Command-line parameter support

**Usage**:
```bash
# Deploy stage
VAULT_LIFECYCLE_STAGE=deploy PROJECT_NAME="MyProject" npx hardhat run scripts/vault-lifecycle.js --network <network>

# Investment stage
VAULT_LIFECYCLE_STAGE=invest npx hardhat run scripts/vault-lifecycle.js --network <network>

# Dividend stage
VAULT_LIFECYCLE_STAGE=dividend npx hardhat run scripts/vault-lifecycle.js --network <network>
```

**Environment Variables**:
- `VAULT_LIFECYCLE_STAGE`: Execution stage (deploy/invest/dividend)
- `PROJECT_NAME`: Project name for deployment
- `USDT_ADDRESS`: Custom USDT address
- `VALIDATOR_ADDRESS`: Validator address
- `MAINNET_USDT_ADDRESS`: Production USDT address

---

## Utility Scripts

### 9. proxy-update.js

**Purpose**: Upgrade proxy contracts to new implementation addresses using ProxyAdmin.

**Features**:
- Upgrade proxy contracts safely
- Address validation
- Contract existence verification
- Transaction confirmation

**Usage**:
```bash
npx hardhat run scripts/proxy-update.js --network <network>
```

**Configuration**: 
- Edit the hardcoded addresses in the script:
  - `proxyAdminAddress`: ProxyAdmin contract address
  - `proxyAddress`: Target proxy contract address  
  - `newImplementationAddress`: New implementation contract address

**Security Note**: This script performs critical upgrades. Always verify addresses before execution.

---

## Development Scripts

### 10. extract-abis.js

**Purpose**: Extract ABIs and bytecodes from compiled contracts for frontend integration and deployment verification.

**Features**:
- Extract ABIs for all V2 architecture contracts
- Generate bytecode files for deployment verification
- Create organized directory structure
- Generate index files for easy imports
- Support for templates, factories, registries, and interfaces

**Usage**:
```bash
# Extract all ABIs and bytecodes
npx hardhat run scripts/extract-abis.js

# Or run directly
node scripts/extract-abis.js
```

**Output Structure**:
```
abis/
├── templates/
├── factories/  
├── registry/
├── creation/
├── interfaces/
├── mocks/
├── common/
├── index.js
└── README.md
```

**Features**:
- Automatic directory creation
- Error handling for missing artifacts
- Colored console output for better visibility
- Comprehensive documentation generation

---

## General Usage Notes

### Network Configuration

Most scripts support multiple networks:
- `localhost` / `hardhat`: Local development with MockUSDT
- `sepolia` / `goerli`: Testnets with custom USDT
- `mainnet` / `bsc`: Production networks with real USDT

### Environment Variables

Create a `.env` file in the project root:
```env
# Contract Addresses
CREATION_ADDRESS=0x...
VAULT_ADDRESS=0x...
CROWDSALE_ADDRESS=0x...
YIELD_ADDRESS=0x...
VALIDATOR_REGISTRY_ADDRESS=0x...

# Token Addresses
USDT_ADDRESS=0x...
MAINNET_USDT_ADDRESS=0x...

# Project Configuration
PROJECT_NAME=MyProject
VALIDATOR_ADDRESS=0x...
```

### Common Patterns

1. **Address Configuration**: Scripts prioritize environment variables, then deployment files, then hardcoded defaults
2. **Network Detection**: Automatic network detection for appropriate contract selection
3. **Error Handling**: Comprehensive error handling with descriptive messages
4. **Transaction Confirmation**: All state-changing operations wait for transaction confirmation
5. **Role Checking**: Role management scripts check existing roles before granting

### Prerequisites

Before running scripts:
1. Compile contracts: `npx hardhat compile`
2. Deploy contracts (if needed): `npx hardhat deploy --network <network>`
3. Configure environment variables
4. Ensure sufficient gas and token balances

### Troubleshooting

Common issues and solutions:
- **"Contract not deployed"**: Verify contract addresses and network
- **"Insufficient permissions"**: Check if deployer has required roles
- **"Invalid address"**: Ensure addresses are valid Ethereum addresses
- **"Network mismatch"**: Verify you're using the correct network parameter

For additional support, check the contract deployment logs and Hardhat configuration.