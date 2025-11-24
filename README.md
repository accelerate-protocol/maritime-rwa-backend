# Accelerate-Protocol
# Overview
AXC is a Programmable Private Market RWA Launchpad 

In short, any enterprise (e.g., BTC mining facilities, AI data centers, etc.) with strong, consistent cash flow can compliantly launch a yield-bearing, revenue-sharing RWA token.

Keys to unlock distribution: 
a) Compliant: Tokenize RBF (Revenue Sharing) products issued by our licensed exchange partner MCEX (Founded by the Former CEO of Hong Kong Stock Exchange). 
b) Transparent: Authenticate private enterprises' RWA data within an open ledger system.
c) Liquid + Composable: DeFi primitive frameworks to restructure and distribute RWA tokens.

# Architecture

## V2 Architecture
The V2 architecture adopts a modular design with improved flexibility, scalability, and composability.

### Core Components

#### 1. Template Contracts
- **CoreVault**: Vault template contract for asset management
- **ShareToken**: Token template contract for tokenized shares
- **Crowdsale**: Crowdfunding template contract for fundraising
- **AccumulatedYield**: Yield template contract for dividend distribution

#### 2. Template Factories
- **CoreVaultTemplateFactory**: Creates vault instances
- **ShareTokenTemplateFactory**: Creates token instances
- **CrowdsaleTemplateFactory**: Creates crowdfunding instances
- **AccumulatedYieldTemplateFactory**: Creates yield instances

#### 3. Template Registries
- **VaultTemplateRegistry**: Manages vault templates
- **TokenTemplateRegistry**: Manages token templates
- **FundTemplateRegistry**: Manages crowdfunding templates
- **YieldTemplateRegistry**: Manages yield templates

#### 4. Creation Contract
- **Creation**: One-click deployment contract that integrates all template registries, enabling seamless deployment of complete projects

#### 5. Validator Registry
- **ValidatorRegistry**: Manages compliance verification for RWA asset deployment

### Deployment Process
1. Deploy template contracts (Templates)
2. Deploy template factories (TemplateFactories)
3. Deploy template registries (TemplateRegistry)
4. Add template factories to corresponding template registries
5. Deploy Creation contract, passing in addresses of each template registry

# Project Structure
```
.
├── contracts
│   └── v2/       # V2 architecture contracts
├── deploy
│   └── v2/       # V2 deployment scripts
├── deployments
├── test
│   └── v2/       # V2 tests
└── README.md
```
- `contracts` contains all smart contracts of the project
- `deploy` contains all scripts required to deploy the project factory
- `deployments` contains deployment information for supported chains
- `test` contains test code for the project

# Env Config
```bash
PRIVATE_KEY=
DRDS_ADDR=
```
You need to configure PRIVATE_KEY for deploying to both the mainnet and testnet. DRDS_ADDR should be set to a public key address, whose corresponding private key holder must perform compliance verification and sign the deployment data when deploying RWA assets.

# Local Development & Testing
## Run Local Node
```bash
npm install

npx hardhat node
```

## Run Tests
```bash
npx hardhat test --network localhost
```
