# Accelerate-Protocal
# Overview
Accelerate-Protocol is a modular on-chain protocol for tokenized fundraising, asset custody, and dividend distribution. It is built around a Vault-based architecture that supports compliant capital management through a series of upgradeable and composable contracts.
Each Vault represents an independent fundraising instance with integrated support for whitelist-based subscription, fund collection, share minting, redemption, and revenue distribution. The protocol also introduces RBF contracts for managing asset inflows, dividend allocations, and valuation tracking.

Dividend distributions follow a scheduled model and are processed during asset maturity.


# Contracts
## RBF
RBF is a redeemable token contract designed for asset tokenization, supporting on-chain deposits, share minting, NAV calculation, and dividend distribution. It works in tandem with the Vault contract to handle capital deployment and reward allocation. With robust role-based access control and integrated price oracle support, RBF provides a secure and flexible foundation for compliant fundraising and tokenized asset management.

## RBFRouter
RBFRouter is a router contract responsible for securely deploying RBF contracts. It coordinates the creation of associated escrow and price feed modules, leveraging a whitelist and multi-signature verification mechanism to ensure secure and compliant deployments. By decoupling deployment logic from core business contracts, RBFRouter provides a modular, auditable, and governance-friendly system for compliant tokenized asset issuance and lifecycle management.

## Vault
Vault is an upgradeable smart contract designed for tokenized fundraising. It supports both on-chain and off-chain whitelisted subscriptions, asset custody, share minting, redemption, and dividend distribution. The contract is primarily intended for small-scale, compliance-driven fundraising scenarios. It features robust access control, investment strategy execution via integration with the RBF (Return-Based Financing) contract, refund mechanisms in case of failed fundraising, and profit-sharing upon successful fundraising.
## VaultRouter
VaultRouter is a smart contract responsible for orchestrating the deployment and configuration of fundraising vaults (Vault) along with their associated escrow contracts (Escrow). Only the owner of a given RBF contract is authorized to trigger the deployment process. During deployment, the router creates a dedicated dividend escrow, configures permissions, and records vault metadata for future retrieval.


# Project Structure
```
.
├── contracts
├── deploy
├── deployments
├── test
└── README.md
- `contracts` contains all smart contracts of the project
- `deploy` contains all scripts required to deploy the project factory
- `deployments` contains deployment information for supported chains
- `test` contains test code for the project


```

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
