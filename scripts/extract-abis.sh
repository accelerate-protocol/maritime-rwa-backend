#!/bin/bash

# ==============================================
# V2 Architecture Contract ABI Extraction Script
# According to deployment process order: 1.Template contracts 2.Factory contracts 3.Template registry contracts 4.Creation contract 5.Interface contracts 6.Mock contracts
# Extract all contracts based on artifacts/contracts/v2 directory structure
# ==============================================

# Add error handling function
handle_error() {
    echo -e "\033[0;31m❌ Error: $1\033[0m"
    exit 1
}

# Add message output function
show_message() {
    local message=$1
    echo -e "\033[0;36m⏳ $message...\033[0m"
}

# Check if necessary commands exist
command -v jq >/dev/null 2>&1 || handle_error "jq command not found, please install first: brew install jq or apt-get install jq"


echo "🚀 Starting to extract V2 architecture contract ABIs..."

# Create abis directory
mkdir -p abis || handle_error "Failed to create abis directory"
mkdir -p abis/templates || handle_error "Failed to create templates directory"
mkdir -p abis/factories || handle_error "Failed to create factories directory"
mkdir -p abis/registry || handle_error "Failed to create registry directory"
mkdir -p abis/creation || handle_error "Failed to create creation directory"
mkdir -p abis/interfaces || handle_error "Failed to create interfaces directory"
mkdir -p abis/mocks || handle_error "Failed to create mocks directory"

show_message "Directory creation completed"

# Color output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}📁 Creating directory structure...${NC}"

# ==============================================
# 1. Extract Template Contract ABIs
# ==============================================

echo -e "${YELLOW}📄 1. Extracting Template Contract ABIs...${NC}"

# 1.1 CoreVault -> CoreVault
if [ -f "artifacts/contracts/v2/templates/vault/CoreVault.sol/CoreVault.json" ]; then
    # Extract ABI
    jq '.abi' artifacts/contracts/v2/templates/vault/CoreVault.sol/CoreVault.json > abis/templates/CoreVault.json || handle_error "Failed to extract CoreVault ABI"
    echo -e "${GREEN}✅ CoreVault.json${NC}"
    show_message "CoreVault extraction completed"
else
    echo -e "${YELLOW}⚠️ CoreVault artifact not found${NC}"
fi

# 1.2 ShareToken -> ShareToken
if [ -f "artifacts/contracts/v2/templates/token/ShareToken.sol/ShareToken.json" ]; then
    # Extract ABI
    jq '.abi' artifacts/contracts/v2/templates/token/ShareToken.sol/ShareToken.json > abis/templates/ShareToken.json || handle_error "Failed to extract ShareToken ABI"
    echo -e "${GREEN}✅ ShareToken.json${NC}"
    show_message "ShareToken extraction completed"
else
    echo -e "${YELLOW}⚠️ ShareToken artifact not found${NC}"
fi

# 1.3 Crowdsale -> Crowdsale
if [ -f "artifacts/contracts/v2/templates/funding/Crowdsale.sol/Crowdsale.json" ]; then
    # Extract ABI
    jq '.abi' artifacts/contracts/v2/templates/funding/Crowdsale.sol/Crowdsale.json > abis/templates/Crowdsale.json || handle_error "Failed to extract Crowdsale ABI"
    echo -e "${GREEN}✅ Crowdsale.json${NC}"
    show_message "Crowdsale extraction completed"
else
    echo -e "${YELLOW}⚠️ Crowdsale artifact not found${NC}"
fi

# 1.4 AccumulatedYield -> AccumulatedYield
if [ -f "artifacts/contracts/v2/templates/yield/AccumulatedYield.sol/AccumulatedYield.json" ]; then
    # Extract ABI
    jq '.abi' artifacts/contracts/v2/templates/yield/AccumulatedYield.sol/AccumulatedYield.json > abis/templates/AccumulatedYield.json || handle_error "Failed to extract AccumulatedYield ABI"
    echo -e "${GREEN}✅ AccumulatedYield.json${NC}"
    show_message "AccumulatedYield extraction completed"
else
    echo -e "${YELLOW}⚠️ AccumulatedYield artifact not found${NC}"
fi

# Template contract extraction completed
show_message "All template contracts extraction completed"

# ==============================================
# 2. Extract Factory Contract ABIs
# ==============================================

echo -e "${YELLOW}🏭 2. Extracting Factory Contract ABIs...${NC}"

# 2.1 CoreVaultTemplateFactory contract
if [ -f "artifacts/contracts/v2/factories/vault/CoreVaultTemplateFactory.sol/CoreVaultTemplateFactory.json" ]; then
    # Extract ABI
    jq '.abi' artifacts/contracts/v2/factories/vault/CoreVaultTemplateFactory.sol/CoreVaultTemplateFactory.json > abis/factories/CoreVaultTemplateFactory.json || handle_error "Failed to extract CoreVaultTemplateFactory ABI"
    echo -e "${GREEN}✅ CoreVaultTemplateFactory.json${NC}"
    show_message "CoreVaultTemplateFactory extraction completed"
else
    echo -e "${YELLOW}⚠️ CoreVaultTemplateFactory artifact not found${NC}"
fi

# 2.2 ShareTokenTemplateFactory contract
if [ -f "artifacts/contracts/v2/factories/token/ShareTokenTemplateFactory.sol/ShareTokenTemplateFactory.json" ]; then
    # Extract ABI
    jq '.abi' artifacts/contracts/v2/factories/token/ShareTokenTemplateFactory.sol/ShareTokenTemplateFactory.json > abis/factories/ShareTokenTemplateFactory.json || handle_error "Failed to extract ShareTokenTemplateFactory ABI"
    echo -e "${GREEN}✅ ShareTokenTemplateFactory.json${NC}"
    show_message "ShareTokenTemplateFactory extraction completed"
else
    echo -e "${YELLOW}⚠️ ShareTokenTemplateFactory artifact not found${NC}"
fi

# 2.3 CrowdsaleTemplateFactory contract
if [ -f "artifacts/contracts/v2/factories/funding/CrowdsaleTemplateFactory.sol/CrowdsaleTemplateFactory.json" ]; then
    # Extract ABI
    jq '.abi' artifacts/contracts/v2/factories/funding/CrowdsaleTemplateFactory.sol/CrowdsaleTemplateFactory.json > abis/factories/CrowdsaleTemplateFactory.json || handle_error "Failed to extract CrowdsaleTemplateFactory ABI"
    echo -e "${GREEN}✅ CrowdsaleTemplateFactory.json${NC}"
    show_message "CrowdsaleTemplateFactory extraction completed"
else
    echo -e "${YELLOW}⚠️ CrowdsaleTemplateFactory artifact not found${NC}"
fi

# 2.4 AccumulatedYieldTemplateFactory contract
if [ -f "artifacts/contracts/v2/factories/yield/AccumulatedYieldTemplateFactory.sol/AccumulatedYieldTemplateFactory.json" ]; then
    # Extract ABI
    jq '.abi' artifacts/contracts/v2/factories/yield/AccumulatedYieldTemplateFactory.sol/AccumulatedYieldTemplateFactory.json > abis/factories/AccumulatedYieldTemplateFactory.json || handle_error "Failed to extract AccumulatedYieldTemplateFactory ABI"
    echo -e "${GREEN}✅ AccumulatedYieldTemplateFactory.json${NC}"
    show_message "AccumulatedYieldTemplateFactory extraction completed"
else
    echo -e "${YELLOW}⚠️ AccumulatedYieldTemplateFactory artifact not found${NC}"
fi

# Factory contract extraction completed
show_message "All factory contracts extraction completed"

# ==============================================
# 3. Extract Template Registry Contract ABIs
# ==============================================

echo -e "${YELLOW}📋 3. Extracting Template Registry Contract ABIs...${NC}"

# 3.1 VaultTemplateRegistry contract
if [ -f "artifacts/contracts/v2/templateRegistry/VaultTemplateRegistry.sol/VaultTemplateRegistry.json" ]; then
    # Extract ABI
    jq '.abi' artifacts/contracts/v2/templateRegistry/VaultTemplateRegistry.sol/VaultTemplateRegistry.json > abis/registry/VaultTemplateRegistry.json || handle_error "Failed to extract VaultTemplateRegistry ABI"
    echo -e "${GREEN}✅ VaultTemplateRegistry.json${NC}"
    show_message "VaultTemplateRegistry extraction completed"
else
    echo -e "${YELLOW}⚠️ VaultTemplateRegistry artifact not found${NC}"
fi

# 3.2 TokenTemplateRegistry contract
if [ -f "artifacts/contracts/v2/templateRegistry/TokenTemplateRegistry.sol/TokenTemplateRegistry.json" ]; then
    # Extract ABI
    jq '.abi' artifacts/contracts/v2/templateRegistry/TokenTemplateRegistry.sol/TokenTemplateRegistry.json > abis/registry/TokenTemplateRegistry.json || handle_error "Failed to extract TokenTemplateRegistry ABI"
    echo -e "${GREEN}✅ TokenTemplateRegistry.json${NC}"
    show_message "TokenTemplateRegistry extraction completed"
else
    echo -e "${YELLOW}⚠️ TokenTemplateRegistry artifact not found${NC}"
fi

# 3.3 FundTemplateRegistry contract
if [ -f "artifacts/contracts/v2/templateRegistry/FundTemplateRegistry.sol/FundTemplateRegistry.json" ]; then
    # Extract ABI
    jq '.abi' artifacts/contracts/v2/templateRegistry/FundTemplateRegistry.sol/FundTemplateRegistry.json > abis/registry/FundTemplateRegistry.json || handle_error "Failed to extract FundTemplateRegistry ABI"
    echo -e "${GREEN}✅ FundTemplateRegistry.json${NC}"
    show_message "FundTemplateRegistry extraction completed"
else
    echo -e "${YELLOW}⚠️ FundTemplateRegistry artifact not found${NC}"
fi

# 3.4 YieldTemplateRegistry contract
if [ -f "artifacts/contracts/v2/templateRegistry/YieldTemplateRegistry.sol/YieldTemplateRegistry.json" ]; then
    # Extract ABI
    jq '.abi' artifacts/contracts/v2/templateRegistry/YieldTemplateRegistry.sol/YieldTemplateRegistry.json > abis/registry/YieldTemplateRegistry.json || handle_error "Failed to extract YieldTemplateRegistry ABI"
    echo -e "${GREEN}✅ YieldTemplateRegistry.json${NC}"
    show_message "YieldTemplateRegistry extraction completed"
else
    echo -e "${YELLOW}⚠️ YieldTemplateRegistry artifact not found${NC}"
fi

# Template registry contract extraction completed
show_message "All template registry contracts extraction completed"

# ==============================================
# 4. Extract Creation Contract ABI
# ==============================================

echo -e "${YELLOW}🚀 4. Extracting Creation Contract ABI...${NC}"

# 4.1 Creation contract
if [ -f "artifacts/contracts/v2/creation/Creation.sol/Creation.json" ]; then
    # Extract ABI
    jq '.abi' artifacts/contracts/v2/creation/Creation.sol/Creation.json > abis/creation/Creation.json || handle_error "Failed to extract Creation ABI"
    echo -e "${GREEN}✅ Creation.json${NC}"
    show_message "Creation extraction completed"
else
    echo -e "${YELLOW}⚠️ Creation artifact not found${NC}"
fi

# Creation contract extraction completed
show_message "Creation contract extraction completed"

# ==============================================
# 5. Extract Interface Contract ABIs
# ==============================================

echo -e "${YELLOW}🔄 5. Extracting Interface Contract ABIs...${NC}"

# 5.1 ICreation interface
if [ -f "artifacts/contracts/v2/interfaces/core/ICreation.sol/ICreation.json" ]; then
    # Extract ABI
    jq '.abi' artifacts/contracts/v2/interfaces/core/ICreation.sol/ICreation.json > abis/interfaces/ICreation.json || handle_error "Failed to extract ICreation ABI"
    echo -e "${GREEN}✅ ICreation.json${NC}"
    show_message "ICreation extraction completed"
else
    echo -e "${YELLOW}⚠️ ICreation artifact not found${NC}"
fi

# 5.2 Factory interfaces
for interface in IVaultTemplateFactory ITokenTemplateFactory IFundTemplateFactory IYieldTemplateFactory; do
    if [ -f "artifacts/contracts/v2/interfaces/factories/${interface}.sol/${interface}.json" ]; then
        # Extract ABI
        jq '.abi' artifacts/contracts/v2/interfaces/factories/${interface}.sol/${interface}.json > abis/interfaces/${interface}.json || handle_error "Failed to extract ${interface} ABI"
        echo -e "${GREEN}✅ ${interface}.json${NC}"
        show_message "${interface} extraction completed"
    else
        echo -e "${YELLOW}⚠️ ${interface} artifact not found${NC}"
    fi
done

# 5.3 Template interfaces
for interface in IVault IToken ICrowdsale IAccumulatedYield; do
    if [ -f "artifacts/contracts/v2/interfaces/templates/${interface}.sol/${interface}.json" ]; then
        # Extract ABI
        jq '.abi' artifacts/contracts/v2/interfaces/templates/${interface}.sol/${interface}.json > abis/interfaces/${interface}.json || handle_error "Failed to extract ${interface} ABI"
        echo -e "${GREEN}✅ ${interface}.json${NC}"
        sleep_with_message 1 "${interface} extraction completed"
    else
        echo -e "${YELLOW}⚠️ ${interface} artifact not found${NC}"
    fi
done

# 5.4 Registry interface
if [ -f "artifacts/contracts/v2/interfaces/registry/IRegistry.sol/IRegistry.json" ]; then
    # Extract ABI
    jq '.abi' artifacts/contracts/v2/interfaces/registry/IRegistry.sol/IRegistry.json > abis/interfaces/IRegistry.json || handle_error "Failed to extract IRegistry ABI"
    echo -e "${GREEN}✅ IRegistry.json${NC}"
    sleep_with_message 1 "IRegistry extraction completed"
else
    echo -e "${YELLOW}⚠️ IRegistry artifact not found${NC}"
fi

# Delay after interface contract extraction is completed
sleep_with_message 3 "All interface contracts extraction completed"

# ==============================================
# 6. Extract Mock Contract ABIs
# ==============================================

echo -e "${YELLOW}🧪 6. Extracting Mock Contract ABIs...${NC}"

# 6.1 MockUSDT contract (independent test token)
if [ -f "artifacts/contracts/v2/mocks/MockUSDT.sol/MockUSDT.json" ]; then
    # Extract ABI
    jq '.abi' artifacts/contracts/v2/mocks/MockUSDT.sol/MockUSDT.json > abis/mocks/MockUSDT.json || handle_error "Failed to extract MockUSDT ABI"
    echo -e "${GREEN}✅ MockUSDT.json${NC}"
    show_message "MockUSDT extraction completed"
else
    echo -e "${YELLOW}⚠️ MockUSDT artifact not found${NC}"
fi

# Mock contract extraction completed
show_message "Mock contract extraction completed"

# ==============================================
# Create ABI index file
# ==============================================

echo -e "${YELLOW}📋 Creating ABI index file...${NC}"

cat > abis/index.json << EOF || handle_error "Failed to create index file"
{
  "description": "V2 Architecture Contract ABI Index",
  "version": "2.0.0",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "deployment_flow": [
    "1. Template Contracts",
    "2. Factory Contracts",
    "3. Template Registry Contracts",
    "4. Creation Contract"
  ],
  "contracts": {
    "templates": {
      "CoreVault": {
        "abi": "templates/CoreVault.json"
      },
      "ShareToken": {
        "abi": "templates/ShareToken.json"
      },
      "Crowdsale": {
        "abi": "templates/Crowdsale.json"
      },
      "AccumulatedYield": {
        "abi": "templates/AccumulatedYield.json"
      }
    },
    "factories": {
      "CoreVaultTemplateFactory": {
        "abi": "factories/CoreVaultTemplateFactory.json"
      },
      "ShareTokenTemplateFactory": {
        "abi": "factories/ShareTokenTemplateFactory.json"
      },
      "CrowdsaleTemplateFactory": {
        "abi": "factories/CrowdsaleTemplateFactory.json"
      },
      "AccumulatedYieldTemplateFactory": {
        "abi": "factories/AccumulatedYieldTemplateFactory.json"
      }
    },
    "registry": {
      "VaultTemplateRegistry": {
        "abi": "registry/VaultTemplateRegistry.json"
      },
      "TokenTemplateRegistry": {
        "abi": "registry/TokenTemplateRegistry.json"
      },
      "FundTemplateRegistry": {
        "abi": "registry/FundTemplateRegistry.json"
      },
      "YieldTemplateRegistry": {
        "abi": "registry/YieldTemplateRegistry.json"
      }
    },
    "creation": {
      "Creation": {
        "abi": "creation/Creation.json"
      }
    },
    "interfaces": {
      "ICreation": {
        "abi": "interfaces/ICreation.json"
      },
      "IVaultTemplateFactory": {
        "abi": "interfaces/IVaultTemplateFactory.json"
      },
      "ITokenTemplateFactory": {
        "abi": "interfaces/ITokenTemplateFactory.json"
      },
      "IFundTemplateFactory": {
        "abi": "interfaces/IFundTemplateFactory.json"
      },
      "IYieldTemplateFactory": {
        "abi": "interfaces/IYieldTemplateFactory.json"
      },
      "IVault": {
        "abi": "interfaces/IVault.json"
      },
      "IToken": {
        "abi": "interfaces/IToken.json"
      },
      "ICrowdsale": {
        "abi": "interfaces/ICrowdsale.json"
      },
      "IAccumulatedYield": {
        "abi": "interfaces/IAccumulatedYield.json"
      },
      "IRegistry": {
        "abi": "interfaces/IRegistry.json"
      }
    },
    "mocks": {
      "MockUSDT": {
        "abi": "mocks/MockUSDT.json"
      }
    }
  },
  "deployment_addresses": {
    "hardhat_local": {
      "CoreVault": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      "ShareToken": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
      "Crowdsale": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
      "AccumulatedYield": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
      "MockUSDT": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
      "CoreVaultTemplateFactory": "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
      "ShareTokenTemplateFactory": "0x0165878A594ca255338adfa4d48449f69242Eb8F",
      "CrowdsaleTemplateFactory": "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853",
      "AccumulatedYieldTemplateFactory": "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6",
      "VaultTemplateRegistry": "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
      "TokenTemplateRegistry": "0xdD2FD4581271e230360230F9337D5c0430Bf44C0",
      "FundTemplateRegistry": "0xbDA5747bFD65F08deb54cb465eB87D40e51B197E",
      "YieldTemplateRegistry": "0xdDCbf776dF3dE60163066A5ddDF2277cB445E0F3",
      "Creation": "0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82"
    },
    "example_project": {
      "Vault": "0x61c36a8d610163660E21a8b7359e1Cac0C9133e1",
      "Token": "0x3B02fF1e626Ed7a8fd6eC5299e2C54e1421B626B",
      "Fund": "0x9bd03768a7DCc129555dE410FF8E85528A4F88b5",
      "AccumulatedYield": "0x94099942864EA81cCF197E9D71ac53310b1468D8"
    }
  }
}
EOF

show_message "Index file creation completed"
echo -e "${GREEN}✅ index.json${NC}"

# ==============================================
# Create README file
# ==============================================

echo -e "${YELLOW}📖 Creating ABI and Bytecode usage instructions...${NC}"

cat > abis/README.md << 'EOF' || handle_error "Failed to create README.md file"
# V2 Architecture Contract ABI and Bytecode Files

This directory contains all ABI and Bytecode files for V2 architecture deployed contracts, organized according to the deployment process sequence.

## 📋 Deployment Process

```
1. 📄 Template Contracts
   ├── CoreVault.json + CoreVault.bytecode
   ├── ShareToken.json + ShareToken.bytecode
   ├── Crowdsale.json + Crowdsale.bytecode
   └── AccumulatedYield.json + AccumulatedYield.bytecode

2. 🏭 Factory Contracts
   ├── CoreVaultTemplateFactory.json + CoreVaultTemplateFactory.bytecode
   ├── ShareTokenTemplateFactory.json + ShareTokenTemplateFactory.bytecode
   ├── CrowdsaleTemplateFactory.json + CrowdsaleTemplateFactory.bytecode
   └── AccumulatedYieldTemplateFactory.json + AccumulatedYieldTemplateFactory.bytecode

3. 📋 Template Registry Contracts
   ├── VaultTemplateRegistry.json + VaultTemplateRegistry.bytecode
   ├── TokenTemplateRegistry.json + TokenTemplateRegistry.bytecode
   ├── FundTemplateRegistry.json + FundTemplateRegistry.bytecode
   └── YieldTemplateRegistry.json + YieldTemplateRegistry.bytecode

4. 🚀 Creation Contract
   └── Creation.json + Creation.bytecode

5. 🔄 Interface Contracts
   ├── ICreation.json
   ├── IVaultTemplateFactory.json
   ├── ITokenTemplateFactory.json
   ├── IFundTemplateFactory.json
   ├── IYieldTemplateFactory.json
   ├── IVault.json
   ├── IToken.json
   ├── ICrowdsale.json
   ├── IAccumulatedYield.json
   └── IRegistry.json

6. 🧪 Mock Contracts
   └── MockUSDT.json + MockUSDT.bytecode
```

## 📁 Directory Structure

```
abis/
├── templates/          # Template Contract ABIs and Bytecode
│   ├── CoreVault.json
│   ├── CoreVault.bytecode
│   ├── ShareToken.json
│   ├── ShareToken.bytecode
│   ├── Crowdsale.json
│   ├── Crowdsale.bytecode
│   ├── AccumulatedYield.json
│   └── AccumulatedYield.bytecode
├── factories/          # Factory Contract ABIs and Bytecode
│   ├── CoreVaultTemplateFactory.json
│   ├── CoreVaultTemplateFactory.bytecode
│   ├── ShareTokenTemplateFactory.json
│   ├── ShareTokenTemplateFactory.bytecode
│   ├── CrowdsaleTemplateFactory.json
│   ├── CrowdsaleTemplateFactory.bytecode
│   ├── AccumulatedYieldTemplateFactory.json
│   └── AccumulatedYieldTemplateFactory.bytecode
├── registry/           # Template Registry Contract ABIs and Bytecode
│   ├── VaultTemplateRegistry.json
│   ├── VaultTemplateRegistry.bytecode
│   ├── TokenTemplateRegistry.json
│   ├── TokenTemplateRegistry.bytecode
│   ├── FundTemplateRegistry.json
│   ├── FundTemplateRegistry.bytecode
│   ├── YieldTemplateRegistry.json
│   └── YieldTemplateRegistry.bytecode
├── creation/           # Creation Contract ABI and Bytecode
│   ├── Creation.json
│   └── Creation.bytecode
├── interfaces/         # Interface Contract ABIs
│   ├── ICreation.json
│   ├── IVaultTemplateFactory.json
│   ├── ITokenTemplateFactory.json
│   ├── IFundTemplateFactory.json
│   ├── IYieldTemplateFactory.json
│   ├── IVault.json
│   ├── IToken.json
│   ├── ICrowdsale.json
│   ├── IAccumulatedYield.json
│   └── IRegistry.json
├── mocks/              # Mock Contract ABIs and Bytecode (for testing)
│   ├── MockUSDT.json
│   └── MockUSDT.bytecode
├── index.json          # ABI and Bytecode index file
└── README.md           # Usage instructions
```

## 🚀 Usage

### JavaScript/TypeScript

```javascript
// Using ethers.js v6
import { ethers } from 'ethers';
import BasicVaultABI from './abis/templates/BasicVault.json';
import BasicVaultBytecode from './abis/templates/BasicVault.bytecode';

const provider = new ethers.JsonRpcProvider('http://localhost:8545');

// Create contract instance
const vaultContract = new ethers.Contract(
  '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  BasicVaultABI,
  provider
);

// Call contract methods
const manager = await vaultContract.manager();
console.log('Manager:', manager);

// Deploy new contract
const factory = new ethers.ContractFactory(BasicVaultABI, BasicVaultBytecode, signer);
const newVault = await factory.deploy();
```

### Web3.js

```javascript
import Web3 from 'web3';
import BasicVaultABI from './abis/templates/BasicVault.json';
import BasicVaultBytecode from './abis/templates/BasicVault.bytecode';

const web3 = new Web3('http://localhost:8545');

// Create contract instance
const vaultContract = new web3.eth.Contract(
  BasicVaultABI,
  '0x5FbDB2315678afecb367f032d93F642f64180aa3'
);

// Call contract methods
const manager = await vaultContract.methods.manager().call();
console.log('Manager:', manager);

// Deploy new contract
const newVault = await web3.eth.contract(BasicVaultABI).deploy({
  data: BasicVaultBytecode,
  arguments: []
}).send({ from: deployer });
```

### Python (web3.py)

```python
from web3 import Web3
import json

# Connect to local node
w3 = Web3(Web3.HTTPProvider('http://localhost:8545'))

# Load ABI and Bytecode
with open('abis/templates/BasicVault.json', 'r') as f:
    vault_abi = json.load(f)

with open('abis/templates/BasicVault.bytecode', 'r') as f:
    vault_bytecode = f.read().strip('"')

# Create contract instance
vault_contract = w3.eth.contract(
    address='0x5FbDB2315678afecb367f032d93F642f64180aa3',
    abi=vault_abi
)

# Call contract methods
manager = vault_contract.functions.manager().call()
print(f'Manager: {manager}')

# Deploy new contract
new_vault = w3.eth.contract(abi=vault_abi, bytecode=vault_bytecode)
tx_hash = new_vault.constructor().transact({'from': deployer})
```

## 📋 Contract Addresses

### Hardhat Local Network (Template Contracts)

- **BasicVault**: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **VaultToken**: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
- **Crowdsale**: `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0`
- **AccumulatedYield**: `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9`
- **MockUSDT**: `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9`

### Factory Contracts

- **VaultFactory**: `0x5FC8d32690cc91D4c39d9d3abcBD16989F875707`
- **TokenFactory**: `0x0165878A594ca255338adfa4d48449f69242Eb8F`
- **FundFactory**: `0xa513E6E4b8f2a923D98304ec87F64353C4D5C853`
- **YieldFactory**: `0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6`

### Creation Contract

- **Creation**: `0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82`

### Example Project (Deployed via Creation)

- **Vault**: `0x61c36a8d610163660E21a8b7359e1Cac0C9133e1`
- **Token**: `0x3B02fF1e626Ed7a8fd6eC5299e2C54e1421B626B`
- **Fund**: `0x9bd03768a7DCc129555dE410FF8E85528A4F88b5`
- **AccumulatedYield**: `0x94099942864EA81cCF197E9D71ac53310b1468D8`

## 🔄 Update ABIs

To re-extract all ABI files, run:

```bash
bash scripts/extract-abis.sh
```
EOF

echo -e "${GREEN}✅ README.md${NC}"
show_message "README.md creation completed"

echo -e "${GREEN}===============================================${NC}"
echo -e "${GREEN}✅ All ABIs extraction completed${NC}"
echo -e "${GREEN}===============================================${NC}"
show_message "Script execution completed"

# ==============================================
# Notes and Development Suggestions
# ==============================================

echo -e "${YELLOW}📝 Notes and Development Suggestions:${NC}"

cat >> abis/README.md << 'EOF' || handle_error "Failed to add notes to README.md file"

## 📝 Notes

1. **Template Contracts**: Use actual contracts as templates for production environment deployment
2. **Factory Contracts**: Responsible for deploying and managing clone instances of template contracts
3. **Template Registry Contracts**: Manage and register template contracts, provide template query functionality
4. **Creation Contract**: Unified project deployment entry point, automatically handles contract dependencies
5. **Interface Contracts**: Define standard interfaces for contract interactions
6. **Mock Contracts**: Provide MockUSDT as a test token
7. **Bytecode Files**: Contain compiled bytecode of contracts for deployment
8. All ABI and Bytecode files are in JSON format and can be imported directly

## 🛠️ Development Suggestions

- For frontend projects, it's recommended to copy these ABI and Bytecode files to the frontend project's `src/abis/` directory
- When using TypeScript, you can generate type definition files for a better development experience
- It's recommended to maintain different contract address configuration files for different network environments
- Template contracts use actual versions suitable for production environment deployment
- Bytecode files can be used for contract verification and redeployment
EOF

echo -e "${GREEN}✅ README.md${NC}"
sleep_with_message 2 "README.md creation completed"

# ==============================================
# Statistics Results
# ==============================================

echo ""
echo -e "${BLUE}📊 Extraction Completion Statistics:${NC}"

# Use variables to store statistical results, to avoid script being affected by command execution errors
templates_json=$(ls abis/templates/*.json 2>/dev/null | wc -l | tr -d ' ') || echo "0"
templates_bytecode=$(ls abis/templates/*.bytecode 2>/dev/null | wc -l | tr -d ' ') || echo "0"
factories_json=$(ls abis/factories/*.json 2>/dev/null | wc -l | tr -d ' ') || echo "0"
factories_bytecode=$(ls abis/factories/*.bytecode 2>/dev/null | wc -l | tr -d ' ') || echo "0"
creation_json=$(ls abis/creation/*.json 2>/dev/null | wc -l | tr -d ' ') || echo "0"
creation_bytecode=$(ls abis/creation/*.bytecode 2>/dev/null | wc -l | tr -d ' ') || echo "0"
mocks_json=$(ls abis/mocks/*.json 2>/dev/null | wc -l | tr -d ' ') || echo "0"
mocks_bytecode=$(ls abis/mocks/*.bytecode 2>/dev/null | wc -l | tr -d ' ') || echo "0"
total_json=$(find abis -name "*.json" -not -name "index.json" 2>/dev/null | wc -l | tr -d ' ') || echo "0"
total_bytecode=$(find abis -name "*.bytecode" 2>/dev/null | wc -l | tr -d ' ') || echo "0"

registry_json=$(ls abis/registry/*.json 2>/dev/null | wc -l | tr -d ' ') || echo "0"
registry_bytecode=$(ls abis/registry/*.bytecode 2>/dev/null | wc -l | tr -d ' ') || echo "0"
interfaces_json=$(ls abis/interfaces/*.json 2>/dev/null | wc -l | tr -d ' ') || echo "0"

echo "Template Contracts: ${templates_json} ABIs + ${templates_bytecode} Bytecodes"
echo "Factory Contracts: ${factories_json} ABIs + ${factories_bytecode} Bytecodes"
echo "Template Registry Contracts: ${registry_json} ABIs + ${registry_bytecode} Bytecodes"
echo "Creation Contract: ${creation_json} ABIs + ${creation_bytecode} Bytecodes"
echo "Interface Contracts: ${interfaces_json} ABIs"
echo "Mock Contracts: ${mocks_json} ABIs + ${mocks_bytecode} Bytecodes"
echo "Total: ${total_json} ABI files + ${total_bytecode} Bytecode files"

echo ""
show_message "Statistics completed, script execution ended"
echo -e "${GREEN}🎉 All ABI files extraction completed!${NC}"
echo -e "${BLUE}📁 File location: ./abis/${NC}"
echo -e "${BLUE}📋 Index file: ./abis/index.json${NC}"
echo -e "${BLUE}📖 Usage instructions: ./abis/README.md${NC}"
echo ""
echo -e "${YELLOW}📋 Deployment Process Order:${NC}"
echo "1. 📄 Template Contracts"
echo "2. 🏭 Factory Contracts"
echo "3. 📋 Template Registry Contracts"
echo "4. 🚀 Creation Contract"
echo "5. 🔄 Interface Contracts"
echo "6. 🧪 Mock Contracts"