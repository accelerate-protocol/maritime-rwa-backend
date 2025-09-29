#!/usr/bin/env node

/**
 * ==============================================
 * V2 Architecture Contract ABI Extraction Script
 * According to deployment process order: 
 * 1. Template contracts 
 * 2. Factory contracts 
 * 3. Template registry contracts 
 * 4. Creation contract 
 * 5. Interface contracts 
 * 6. Mock contracts
 * 7. Common contracts
 * Extract all contracts based on artifacts/contracts/v2 directory structure
 * ==============================================
 */

const fs = require('fs');
const path = require('path');

// Color output utilities
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

// Utility functions
function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function logError(message) {
    log(`❌ Error: ${message}`, colors.red);
}

function logSuccess(message) {
    log(`✅ ${message}`, colors.green);
}

function logInfo(message) {
    log(`⏳ ${message}...`, colors.cyan);
}

function logWarning(message) {
    log(`⚠️ ${message}`, colors.yellow);
}

function logSection(message) {
    log(`${message}`, colors.yellow);
}

// Create directory if it doesn't exist
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// Extract ABI from artifact file
function extractABI(artifactPath, outputPath) {
    try {
        if (!fs.existsSync(artifactPath)) {
            logWarning(`${path.basename(artifactPath)} artifact not found`);
            return false;
        }

        const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
        fs.writeFileSync(outputPath, JSON.stringify(artifact.abi, null, 2));
        logSuccess(`${path.basename(outputPath)}`);
        return true;
    } catch (error) {
        logError(`Failed to extract ABI from ${artifactPath}: ${error.message}`);
        return false;
    }
}

// Extract bytecode from artifact file
function extractBytecode(artifactPath, outputPath) {
    try {
        if (!fs.existsSync(artifactPath)) {
            return false;
        }

        const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
        if (artifact.bytecode && artifact.bytecode !== '0x') {
            fs.writeFileSync(outputPath, artifact.bytecode);
            return true;
        }
        return false;
    } catch (error) {
        logError(`Failed to extract bytecode from ${artifactPath}: ${error.message}`);
        return false;
    }
}

// Contract definitions based on current architecture
const contractDefinitions = {
    templates: {
        vault: [
            { name: 'CoreVault', path: 'vault/CoreVault.sol' },
            { name: 'FundVault', path: 'vault/FundVault.sol' },
            { name: 'BaseVault', path: 'vault/BaseVault.sol' }
        ],
        token: [
            { name: 'ShareToken', path: 'token/ShareToken.sol' }
        ],
        funding: [
            { name: 'Crowdsale', path: 'funding/Crowdsale.sol' }
        ],
        yield: [
            { name: 'AccumulatedYield', path: 'yield/AccumulatedYield.sol' },
            { name: 'FundYield', path: 'yield/FundYield.sol' }
        ]
    },
    factories: {
        vault: [
            { name: 'CoreVaultTemplateFactory', path: 'vault/CoreVaultTemplateFactory.sol' },
            { name: 'FundVaultTemplateFactory', path: 'vault/FundVaultTemplateFactory.sol' }
        ],
        token: [
            { name: 'ShareTokenTemplateFactory', path: 'token/ShareTokenTemplateFactory.sol' }
        ],
        funding: [
            { name: 'CrowdsaleTemplateFactory', path: 'funding/CrowdsaleTemplateFactory.sol' }
        ],
        yield: [
            { name: 'AccumulatedYieldTemplateFactory', path: 'yield/AccumulatedYieldTemplateFactory.sol' },
            { name: 'FundYieldTemplateFactory', path: 'yield/FundYieldTemplateFactory.sol' }
        ]
    },
    registry: [
        { name: 'VaultTemplateRegistry', path: 'VaultTemplateRegistry.sol' },
        { name: 'TokenTemplateRegistry', path: 'TokenTemplateRegistry.sol' },
        { name: 'FundTemplateRegistry', path: 'FundTemplateRegistry.sol' },
        { name: 'YieldTemplateRegistry', path: 'YieldTemplateRegistry.sol' }
    ],
    creation: [
        { name: 'Creation', path: 'Creation.sol' }
    ],
    common: [
        { name: 'ValidatorRegistry', path: 'ValidatorRegistry.sol' }
    ],
    interfaces: {
        core: [
            { name: 'ICreation', path: 'core/ICreation.sol' },
            { name: 'IValidatorRegistry', path: 'core/IValidatorRegistry.sol' }
        ],
        factories: [
            { name: 'IVaultTemplateFactory', path: 'factories/IVaultTemplateFactory.sol' },
            { name: 'ITokenTemplateFactory', path: 'factories/ITokenTemplateFactory.sol' },
            { name: 'IFundTemplateFactory', path: 'factories/IFundTemplateFactory.sol' },
            { name: 'IYieldTemplateFactory', path: 'factories/IYieldTemplateFactory.sol' }
        ],
        templates: [
            { name: 'IVault', path: 'templates/IVault.sol' },
            { name: 'IToken', path: 'templates/IToken.sol' },
            { name: 'ICrowdsale', path: 'templates/ICrowdsale.sol' },
            { name: 'IAccumulatedYield', path: 'templates/IAccumulatedYield.sol' },
            { name: 'IFundVault', path: 'templates/IFundVault.sol' },
            { name: 'IFundYield', path: 'templates/IFundYield.sol' }
        ],
        registry: [
            { name: 'IRegistry', path: 'registry/IRegistry.sol' }
        ]
    },
    mocks: [
        { name: 'MockUSDT', path: 'MockUSDT.sol' },
        { name: 'MockUSDC', path: 'MockUSDC.sol' }
    ]
};

function main() {
    log('🚀 Starting to extract V2 architecture contract ABIs...', colors.blue);

    // Create directory structure
    const abiDir = path.join(process.cwd(), 'abis');
    const bytecodeDir = path.join(process.cwd(), 'bytecodes');
    
    ensureDir(abiDir);
    ensureDir(bytecodeDir);
    ensureDir(path.join(abiDir, 'templates'));
    ensureDir(path.join(abiDir, 'factories'));
    ensureDir(path.join(abiDir, 'registry'));
    ensureDir(path.join(abiDir, 'creation'));
    ensureDir(path.join(abiDir, 'common'));
    ensureDir(path.join(abiDir, 'interfaces'));
    ensureDir(path.join(abiDir, 'mocks'));

    logInfo('Directory creation completed');

    // 1. Extract Template Contract ABIs
    logSection('📄 1. Extracting Template Contract ABIs...');
    
    Object.keys(contractDefinitions.templates).forEach(category => {
        contractDefinitions.templates[category].forEach(contract => {
            const artifactPath = path.join(process.cwd(), 'artifacts', 'contracts', 'v2', 'templates', contract.path, `${contract.name}.json`);
            const abiPath = path.join(abiDir, 'templates', `${contract.name}.json`);
            const bytecodePath = path.join(bytecodeDir, `${contract.name}.bytecode`);
            
            extractABI(artifactPath, abiPath);
            extractBytecode(artifactPath, bytecodePath);
        });
    });

    // 2. Extract Factory Contract ABIs
    logSection('🏭 2. Extracting Factory Contract ABIs...');
    
    Object.keys(contractDefinitions.factories).forEach(category => {
        contractDefinitions.factories[category].forEach(contract => {
            const artifactPath = path.join(process.cwd(), 'artifacts', 'contracts', 'v2', 'factories', contract.path, `${contract.name}.json`);
            const abiPath = path.join(abiDir, 'factories', `${contract.name}.json`);
            const bytecodePath = path.join(bytecodeDir, `${contract.name}.bytecode`);
            
            extractABI(artifactPath, abiPath);
            extractBytecode(artifactPath, bytecodePath);
        });
    });

    // 3. Extract Template Registry Contract ABIs
    logSection('📋 3. Extracting Template Registry Contract ABIs...');
    
    contractDefinitions.registry.forEach(contract => {
        const artifactPath = path.join(process.cwd(), 'artifacts', 'contracts', 'v2', 'templateRegistry', contract.path, `${contract.name}.json`);
        const abiPath = path.join(abiDir, 'registry', `${contract.name}.json`);
        const bytecodePath = path.join(bytecodeDir, `${contract.name}.bytecode`);
        
        extractABI(artifactPath, abiPath);
        extractBytecode(artifactPath, bytecodePath);
    });

    // 4. Extract Creation Contract ABI
    logSection('🚀 4. Extracting Creation Contract ABI...');
    
    contractDefinitions.creation.forEach(contract => {
        const artifactPath = path.join(process.cwd(), 'artifacts', 'contracts', 'v2', 'creation', contract.path, `${contract.name}.json`);
        const abiPath = path.join(abiDir, 'creation', `${contract.name}.json`);
        const bytecodePath = path.join(bytecodeDir, `${contract.name}.bytecode`);
        
        extractABI(artifactPath, abiPath);
        extractBytecode(artifactPath, bytecodePath);
    });

    // 5. Extract Common Contract ABIs
    logSection('🔧 5. Extracting Common Contract ABIs...');
    
    contractDefinitions.common.forEach(contract => {
        const artifactPath = path.join(process.cwd(), 'artifacts', 'contracts', 'v2', 'common', contract.path, `${contract.name}.json`);
        const abiPath = path.join(abiDir, 'common', `${contract.name}.json`);
        const bytecodePath = path.join(bytecodeDir, `${contract.name}.bytecode`);
        
        extractABI(artifactPath, abiPath);
        extractBytecode(artifactPath, bytecodePath);
    });

    // 6. Extract Interface Contract ABIs
    logSection('🔄 6. Extracting Interface Contract ABIs...');
    
    Object.keys(contractDefinitions.interfaces).forEach(category => {
        contractDefinitions.interfaces[category].forEach(contract => {
            const artifactPath = path.join(process.cwd(), 'artifacts', 'contracts', 'v2', 'interfaces', contract.path, `${contract.name}.json`);
            const abiPath = path.join(abiDir, 'interfaces', `${contract.name}.json`);
            
            extractABI(artifactPath, abiPath);
        });
    });

    // 7. Extract Mock Contract ABIs
    logSection('🧪 7. Extracting Mock Contract ABIs...');
    
    contractDefinitions.mocks.forEach(contract => {
        const artifactPath = path.join(process.cwd(), 'artifacts', 'contracts', 'v2', 'mocks', contract.path, `${contract.name}.json`);
        const abiPath = path.join(abiDir, 'mocks', `${contract.name}.json`);
        const bytecodePath = path.join(bytecodeDir, `${contract.name}.bytecode`);
        
        extractABI(artifactPath, abiPath);
        extractBytecode(artifactPath, bytecodePath);
    });

    // Create index file
    logSection('📋 Creating ABI index file...');
    createIndexFile(abiDir);

    // Create README file
    logSection('📖 Creating ABI and Bytecode usage instructions...');
    createReadmeFile(abiDir);

    log('🎉 All contract ABIs and bytecodes extracted successfully!', colors.green);
}

function createIndexFile(abiDir) {
    const indexData = {
        description: "V2 Architecture Contract ABI Index",
        version: "2.0.0",
        timestamp: new Date().toISOString(),
        deployment_flow: [
            "1. Template Contracts",
            "2. Factory Contracts", 
            "3. Template Registry Contracts",
            "4. Creation Contract",
            "5. Common Contracts"
        ],
        contracts: {
            templates: {},
            factories: {},
            registry: {},
            creation: {},
            common: {},
            interfaces: {},
            mocks: {}
        }
    };

    // Add template contracts
    Object.keys(contractDefinitions.templates).forEach(category => {
        contractDefinitions.templates[category].forEach(contract => {
            indexData.contracts.templates[contract.name] = {
                abi: `templates/${contract.name}.json`,
                bytecode: `../bytecodes/${contract.name}.bytecode`
            };
        });
    });

    // Add factory contracts
    Object.keys(contractDefinitions.factories).forEach(category => {
        contractDefinitions.factories[category].forEach(contract => {
            indexData.contracts.factories[contract.name] = {
                abi: `factories/${contract.name}.json`,
                bytecode: `../bytecodes/${contract.name}.bytecode`
            };
        });
    });

    // Add registry contracts
    contractDefinitions.registry.forEach(contract => {
        indexData.contracts.registry[contract.name] = {
            abi: `registry/${contract.name}.json`,
            bytecode: `../bytecodes/${contract.name}.bytecode`
        };
    });

    // Add creation contracts
    contractDefinitions.creation.forEach(contract => {
        indexData.contracts.creation[contract.name] = {
            abi: `creation/${contract.name}.json`,
            bytecode: `../bytecodes/${contract.name}.bytecode`
        };
    });

    // Add common contracts
    contractDefinitions.common.forEach(contract => {
        indexData.contracts.common[contract.name] = {
            abi: `common/${contract.name}.json`,
            bytecode: `../bytecodes/${contract.name}.bytecode`
        };
    });

    // Add interface contracts
    Object.keys(contractDefinitions.interfaces).forEach(category => {
        contractDefinitions.interfaces[category].forEach(contract => {
            indexData.contracts.interfaces[contract.name] = {
                abi: `interfaces/${contract.name}.json`
            };
        });
    });

    // Add mock contracts
    contractDefinitions.mocks.forEach(contract => {
        indexData.contracts.mocks[contract.name] = {
            abi: `mocks/${contract.name}.json`,
            bytecode: `../bytecodes/${contract.name}.bytecode`
        };
    });

    fs.writeFileSync(path.join(abiDir, 'index.json'), JSON.stringify(indexData, null, 2));
    logSuccess('index.json');
}

function createReadmeFile(abiDir) {
    const readmeContent = `# V2 Architecture Contract ABI and Bytecode Files

This directory contains all ABI and Bytecode files for V2 architecture deployed contracts, organized according to the deployment process sequence.

## 📋 Deployment Process

\`\`\`
1. 📄 Template Contracts
   ├── CoreVault.json + CoreVault.bytecode
   ├── FundVault.json + FundVault.bytecode
   ├── BaseVault.json + BaseVault.bytecode
   ├── ShareToken.json + ShareToken.bytecode
   ├── Crowdsale.json + Crowdsale.bytecode
   ├── AccumulatedYield.json + AccumulatedYield.bytecode
   └── FundYield.json + FundYield.bytecode

2. 🏭 Factory Contracts
   ├── CoreVaultTemplateFactory.json + CoreVaultTemplateFactory.bytecode
   ├── FundVaultTemplateFactory.json + FundVaultTemplateFactory.bytecode
   ├── ShareTokenTemplateFactory.json + ShareTokenTemplateFactory.bytecode
   ├── CrowdsaleTemplateFactory.json + CrowdsaleTemplateFactory.bytecode
   ├── AccumulatedYieldTemplateFactory.json + AccumulatedYieldTemplateFactory.bytecode
   └── FundYieldTemplateFactory.json + FundYieldTemplateFactory.bytecode

3. 📋 Template Registry Contracts
   ├── VaultTemplateRegistry.json + VaultTemplateRegistry.bytecode
   ├── TokenTemplateRegistry.json + TokenTemplateRegistry.bytecode
   ├── FundTemplateRegistry.json + FundTemplateRegistry.bytecode
   └── YieldTemplateRegistry.json + YieldTemplateRegistry.bytecode

4. 🚀 Creation Contract
   └── Creation.json + Creation.bytecode

5. 🔧 Common Contracts
   └── ValidatorRegistry.json + ValidatorRegistry.bytecode

6. 🔄 Interface Contracts
   ├── ICreation.json
   ├── IValidatorRegistry.json
   ├── IVaultTemplateFactory.json
   ├── ITokenTemplateFactory.json
   ├── IFundTemplateFactory.json
   ├── IYieldTemplateFactory.json
   ├── IVault.json
   ├── IToken.json
   ├── ICrowdsale.json
   ├── IAccumulatedYield.json
   ├── IFundVault.json
   ├── IFundYield.json
   └── IRegistry.json

7. 🧪 Mock Contracts
   ├── MockUSDT.json + MockUSDT.bytecode
   └── MockUSDC.json + MockUSDC.bytecode
\`\`\`

## 📁 Directory Structure

\`\`\`
abis/
├── templates/          # Template Contract ABIs
├── factories/          # Factory Contract ABIs
├── registry/           # Template Registry Contract ABIs
├── creation/           # Creation Contract ABI
├── common/             # Common Contract ABIs
├── interfaces/         # Interface Contract ABIs
├── mocks/              # Mock Contract ABIs
├── index.json          # Contract index with metadata
└── README.md           # This file

bytecodes/              # Contract Bytecodes
├── CoreVault.bytecode
├── FundVault.bytecode
├── BaseVault.bytecode
├── ShareToken.bytecode
├── Crowdsale.bytecode
├── AccumulatedYield.bytecode
├── FundYield.bytecode
├── CoreVaultTemplateFactory.bytecode
├── FundVaultTemplateFactory.bytecode
├── ShareTokenTemplateFactory.bytecode
├── CrowdsaleTemplateFactory.bytecode
├── AccumulatedYieldTemplateFactory.bytecode
├── FundYieldTemplateFactory.bytecode
├── VaultTemplateRegistry.bytecode
├── TokenTemplateRegistry.bytecode
├── FundTemplateRegistry.bytecode
├── YieldTemplateRegistry.bytecode
├── Creation.bytecode
├── ValidatorRegistry.bytecode
├── MockUSDT.bytecode
└── MockUSDC.bytecode
\`\`\`

## 🚀 Usage

### Extract ABIs and Bytecodes

\`\`\`bash
# Run the extraction script
node scripts/extract-abis.js

# Or make it executable and run directly
chmod +x scripts/extract-abis.js
./scripts/extract-abis.js
\`\`\`

### Use in Your Project

\`\`\`javascript
// Load ABI
const coreVaultABI = require('./abis/templates/CoreVault.json');

// Load bytecode
const fs = require('fs');
const coreVaultBytecode = fs.readFileSync('./bytecodes/CoreVault.bytecode', 'utf8');

// Deploy contract
const CoreVault = new ethers.ContractFactory(coreVaultABI, coreVaultBytecode, signer);
const coreVault = await CoreVault.deploy();
\`\`\`

## 📝 Notes

- ABIs are stored as JSON files in the \`abis/\` directory
- Bytecodes are stored as plain text files in the \`bytecodes/\` directory
- Interface contracts only have ABIs (no bytecode)
- The \`index.json\` file provides a complete mapping of all contracts
- All files are automatically generated from Hardhat compilation artifacts

## 🔄 Updating

To update the extracted files after contract changes:

1. Compile contracts: \`npx hardhat compile\`
2. Run extraction script: \`node scripts/extract-abis.js\`

The script will automatically detect and extract all available contracts.
`;

    fs.writeFileSync(path.join(abiDir, 'README.md'), readmeContent);
    logSuccess('README.md');
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { main, extractABI, extractBytecode };