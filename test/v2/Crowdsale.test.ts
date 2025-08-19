import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Crowdsale } from "../../typechain-types/contracts/v2/templates/funding/Crowdsale";
import { VaultToken } from "../../typechain-types/contracts/v2/templates/token/VaultToken";
import { BasicVault } from "../../typechain-types/contracts/v2/templates/vault/BasicVault";
import { MockUSDT } from "../../typechain-types/contracts/v2/mocks/MockUSDT";

describe("Crowdsale", function () {
    // Constants for token precision
    const TOKEN_DECIMALS = 6;
    const VAULT_TOKEN_DECIMALS = 6;
    
    let crowdsale: Crowdsale;
    let vaultToken: VaultToken;
    let vault: BasicVault;
    let assetToken: any;
    let owner: HardhatEthersSigner;
    let manager: HardhatEthersSigner;
    let validator: HardhatEthersSigner;
    let user1: HardhatEthersSigner;
    let user2: HardhatEthersSigner;
    let fundingReceiver: HardhatEthersSigner;
    let manageFeeReceiver: HardhatEthersSigner;

    let startTime: number;
    let endTime: number;
    const maxSupply = ethers.parseUnits("10000", TOKEN_DECIMALS);
    const softCap = ethers.parseUnits("5000", TOKEN_DECIMALS);
    const sharePrice = ethers.parseUnits("1", 8); // 1.0 with 8 decimals
    const minDepositAmount = ethers.parseUnits("100", TOKEN_DECIMALS); // 6 decimals for USDT
    const manageFeeBps = 500; // 5%
    const decimalsMultiplier = ethers.parseUnits("1", 0); // 0 decimals since both tokens are 6 decimals

    beforeEach(async function () {
        [owner, manager, validator, user1, user2, fundingReceiver, manageFeeReceiver] = await ethers.getSigners();
        
        // Each test will set its own time range
        // Don't set global time here

        // Deploy mock asset token
        const MockUSDTFactory = await ethers.getContractFactory("contracts/v2/mocks/MockUSDT.sol:MockUSDT");
        assetToken = await MockUSDTFactory.deploy("Mock USDT", "USDT");
        await assetToken.mint(user1.address, ethers.parseUnits("100000", TOKEN_DECIMALS));
        await assetToken.mint(user2.address, ethers.parseUnits("100000", TOKEN_DECIMALS));

        // Deploy vault token
        const VaultTokenFactory = await ethers.getContractFactory("VaultToken");
        vaultToken = await VaultTokenFactory.deploy();

        // Deploy basic vault
        const BasicVaultFactory = await ethers.getContractFactory("BasicVault");
        vault = await BasicVaultFactory.deploy();
        
        // Encode initialization data
        const initData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "bool", "address[]"],
            [manager.address, validator.address, false, []]
        );
        
        await vault.initiate(initData);

        // Initialize vault token
        const tokenInitData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["string", "string", "uint8"],
            ["Test Vault Token", "TVT", VAULT_TOKEN_DECIMALS]
        );
        await vaultToken.initiate(await vault.getAddress(), tokenInitData);

        // Deploy crowdsale
        const CrowdsaleFactory = await ethers.getContractFactory("Crowdsale");
        crowdsale = await CrowdsaleFactory.deploy();
        
        // Unpause token for testing (since it's paused during initialization)
        await vault.connect(manager).unpauseToken();

        await vault.configureModules(
            await vaultToken.getAddress(),
            await crowdsale.getAddress(),
            await accumulatedYield.getAddress()
        );
        
        // Don't initialize crowdsale in beforeEach - let each test handle its own initialization
    });

    // Helper function to reset EVM time to a clean state
    async function resetEVMTime() {
        const block = await ethers.provider.getBlock("latest");
        if (!block) {
            await ethers.provider.send("evm_mine", []);
            return;
        }
        
        const currentBlockTime = block.timestamp;
        const currentRealTime = Math.floor(Date.now() / 1000);
        if (currentBlockTime > currentRealTime) {
            // If block time is ahead, we can't reset it, so we'll work with it
            // Just mine a new block to ensure we have the latest state
            await ethers.provider.send("evm_mine", []);
        } else {
            // If block time is behind or equal, we can set it to current time
            await ethers.provider.send("evm_setNextBlockTimestamp", [currentRealTime]);
            await ethers.provider.send("evm_mine", []);
        }
    }

    // Helper function to create a new vault and crowdsale instance with proper initialization
    async function createModules(
        manager: any,
        validator: any,
        dividendTreasury: any
    ) {
        // Deploy BasicVault
        const BasicVaultFactory = await ethers.getContractFactory("BasicVault");
        const newVault = await BasicVaultFactory.deploy();

        // Initialize vault
        const vaultInitData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "bool", "address[]"],
            [manager.address, validator.address, false, []]
        );
        await newVault.initiate(vaultInitData);

        // Deploy VaultToken
        const VaultTokenFactory = await ethers.getContractFactory("VaultToken");
        const newShareToken = await VaultTokenFactory.deploy();
        const tokenInitData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["string", "string", "uint8"],
            ["Test Share Token", "TST", 6]
        );
        await newShareToken.initiate(await newVault.getAddress(), tokenInitData);

        // Deploy AccumulatedYield
        const YieldFactory = await ethers.getContractFactory("AccumulatedYield");
        const newAccumulatedYield = await YieldFactory.deploy();

        const yieldInitData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "address"],
            [await assetToken.getAddress(), manager.address, dividendTreasury.address]
        );
        await newAccumulatedYield.initiate(await newVault.getAddress(), await newShareToken.getAddress(), yieldInitData);

        // Deploy Crowdsale contract
        const CrowdsaleFactory = await ethers.getContractFactory("Crowdsale");
        const newCrowdsale = await CrowdsaleFactory.deploy();

        // Initialize Crowdsale with test parameters
        const currentTime = Math.floor(Date.now() / 1000);
        const startTime = currentTime;
        const endTime = currentTime + 86400; // 24 hours from now
        const maxSupply = ethers.parseUnits("10000", 6);
        const softCap = ethers.parseUnits("1000", 6);
        const sharePrice = ethers.parseUnits("1", 6); // 1 USDT per share, 6 decimals
        const minDepositAmount = ethers.parseUnits("10", 6); // 10 USDT minimum
        const manageFeeBps = 1000; // 10% management fee
        const decimalsMultiplier = 1; // 直接用 1，和 shareToken decimals 保持一致

        const crowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "uint256", "address"],
            [startTime, endTime, await assetToken.getAddress(), maxSupply, softCap, sharePrice, minDepositAmount, manageFeeBps, manager.address, manager.address, decimalsMultiplier, manager.address]
        );

        await newCrowdsale.initiate(await newVault.getAddress(), crowdsaleInitData);

        // Set modules in vault (using manager as owner)
        await newVault.connect(manager).configureModules(
            await newShareToken.getAddress(),
            await newCrowdsale.getAddress(),
            await newAccumulatedYield.getAddress()
        );
        // Unpause token for testing (since it's paused during initialization)
        await newVault.connect(manager).unpauseToken();

        return {
            vault: newVault,
            shareToken: newShareToken,
            accumulatedYield: newAccumulatedYield,
            crowdsale: newCrowdsale
        };
    }

    describe("Initialization", function () {
        beforeEach(async function () {
            // Set independent time for this test suite
            const baseTime = Math.floor(Date.now() / 1000) + 120;
            startTime = baseTime + 60;
            endTime = startTime + 86400;
        });

        it("should initialize crowdsale correctly", async function () {
            const crowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "uint256", "address"],
                [startTime, endTime, await assetToken.getAddress(), maxSupply, softCap, sharePrice, minDepositAmount, manageFeeBps, fundingReceiver.address, manageFeeReceiver.address, decimalsMultiplier, manager.address]
            );
            await crowdsale.initiate(await vault.getAddress(), crowdsaleInitData);

            expect(await crowdsale.vault()).to.equal(await vault.getAddress());
            expect(await crowdsale.startTime()).to.equal(startTime);
            expect(await crowdsale.endTime()).to.equal(endTime);
            expect(await crowdsale.assetToken()).to.equal(await assetToken.getAddress());
            expect(await crowdsale.maxSupply()).to.equal(maxSupply);
            expect(await crowdsale.softCap()).to.equal(softCap);
            expect(await crowdsale.sharePrice()).to.equal(sharePrice);
            expect(await crowdsale.minDepositAmount()).to.equal(minDepositAmount);
            expect(await crowdsale.manageFeeBps()).to.equal(manageFeeBps);
            expect(await crowdsale.fundingReceiver()).to.equal(fundingReceiver.address);
            expect(await crowdsale.manageFeeReceiver()).to.equal(manageFeeReceiver.address);
            expect(await crowdsale.decimalsMultiplier()).to.equal(decimalsMultiplier);
            expect(await crowdsale.manager()).to.equal(manager.address);
            expect(await crowdsale.isInitialized()).to.be.true;
        });

        it("should reject duplicate initialization", async function () {
            const crowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "uint256", "address"],
                [startTime, endTime, await assetToken.getAddress(), maxSupply, softCap, sharePrice, minDepositAmount, manageFeeBps, fundingReceiver.address, manageFeeReceiver.address, decimalsMultiplier, manager.address]
            );
            await crowdsale.initiate(await vault.getAddress(), crowdsaleInitData);

            await expect(
                crowdsale.connect(manager).initiate(await vault.getAddress(), crowdsaleInitData)
            ).to.be.revertedWith("Crowdsale: already initialized");
        });

        it("should reject invalid initialization parameters", async function () {
            // Invalid vault address
            const invalidVaultInitData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "uint256", "address"],
                [startTime, endTime, await assetToken.getAddress(), maxSupply, softCap, sharePrice, minDepositAmount, manageFeeBps, fundingReceiver.address, manageFeeReceiver.address, decimalsMultiplier, manager.address]
            );
            await expect(
                crowdsale.initiate(ethers.ZeroAddress, invalidVaultInitData)
            ).to.be.revertedWith("Crowdsale: invalid vault");

            // Invalid time range
            const invalidTimeInitData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "uint256", "address"],
                [endTime, startTime, await assetToken.getAddress(), maxSupply, softCap, sharePrice, minDepositAmount, manageFeeBps, fundingReceiver.address, manageFeeReceiver.address, decimalsMultiplier, manager.address]
            );
            await expect(
                crowdsale.initiate(await vault.getAddress(), invalidTimeInitData)
            ).to.be.revertedWith("Crowdsale: invalid time range");

            // End time in past
            const pastTime = Math.floor(Date.now() / 1000) - 86400; // 24 hours ago
            const pastStartTime = pastTime - 3600; // 1 hour before pastTime
            const pastTimeInitData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "uint256", "address"],
                [pastStartTime, pastTime, await assetToken.getAddress(), maxSupply, softCap, sharePrice, minDepositAmount, manageFeeBps, fundingReceiver.address, manageFeeReceiver.address, decimalsMultiplier, manager.address]
            );
            await expect(
                crowdsale.initiate(await vault.getAddress(), pastTimeInitData)
            ).to.be.revertedWith("Crowdsale: end time in past");

            // Invalid soft cap
            const invalidSoftCapInitData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "uint256", "address"],
                [startTime, endTime, await assetToken.getAddress(), maxSupply, maxSupply + ethers.parseEther("1000"), sharePrice, minDepositAmount, manageFeeBps, fundingReceiver.address, manageFeeReceiver.address, decimalsMultiplier, manager.address]
            );
            await expect(
                crowdsale.initiate(await vault.getAddress(), invalidSoftCapInitData)
            ).to.be.revertedWith("Crowdsale: invalid soft cap");
        });
    });

    describe("Deposit Operations", function () {
        beforeEach(async function () {
            // Set independent time for this test suite
            const baseTime = Math.floor(Date.now() / 1000) + 120;
            startTime = baseTime + 60;
            endTime = startTime + 86400;
            
            const crowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "uint256", "address"],
                [startTime, endTime, await assetToken.getAddress(), maxSupply, softCap, sharePrice, minDepositAmount, manageFeeBps, fundingReceiver.address, manageFeeReceiver.address, decimalsMultiplier, manager.address]
            );
            await crowdsale.initiate(await vault.getAddress(), crowdsaleInitData);

            // Set time to funding period - ensure we're in the funding period
            const currentBlock = await ethers.provider.getBlock("latest");
            if (!currentBlock) {
                throw new Error("Cannot get latest block");
            }
            const currentTime = currentBlock.timestamp;
            const timeToFunding = startTime + 60 - currentTime;
            if (timeToFunding > 0) {
                await ethers.provider.send("evm_increaseTime", [timeToFunding]);
                await ethers.provider.send("evm_mine", []);
            }

            // Approve asset token spending
            await assetToken.connect(user1).approve(await crowdsale.getAddress(), ethers.parseUnits("100000", TOKEN_DECIMALS));
        });

        it("should allow deposit with valid signature", async function () {
            const depositAmount = ethers.parseUnits("1000", TOKEN_DECIMALS);
            const receiver = user1.address;
            const nonce = await crowdsale.getManagerNonce();

            // Generate signature
            const messageHash = await crowdsale.getDepositSignatureMessage(
                depositAmount,
                receiver,
                nonce
            );
            const signature = await manager.signMessage(ethers.getBytes(messageHash));

            // Perform deposit
            const tx = await crowdsale.connect(user1).deposit(depositAmount, receiver, signature);
            
            // Calculate expected values after fee deduction
            const expectedManageFee = (depositAmount * BigInt(manageFeeBps)) / BigInt(10000);
            const expectedFundingAssets = depositAmount - expectedManageFee;
            
            // Check that tokens were minted (exact amount depends on calculation)
            const balance = await vaultToken.balanceOf(receiver);
            expect(balance).to.be.gt(0);
            
            expect(await crowdsale.fundingAssets()).to.equal(expectedFundingAssets);
            expect(await crowdsale.manageFee()).to.equal(expectedManageFee);
            
            // Verify event emission
            await expect(tx).to.emit(crowdsale, "Deposit")
              .withArgs(receiver, depositAmount, expectedManageFee, balance);
        });

        it("should reject deposit with invalid signature", async function () {
            const depositAmount = ethers.parseUnits("1000", TOKEN_DECIMALS);
            const receiver = user1.address;
            const nonce = await crowdsale.getManagerNonce();

            // Generate signature with wrong signer
            const messageHash = await crowdsale.getDepositSignatureMessage(
                depositAmount,
                receiver,
                nonce
            );
            const signature = await user2.signMessage(ethers.getBytes(messageHash));

            await expect(
                crowdsale.connect(user1).deposit(depositAmount, receiver, signature)
            ).to.be.revertedWith("Crowdsale: invalid signature");
        });

        it("should reject deposit below minimum amount", async function () {
            const depositAmount = ethers.parseUnits("50", 6); // Below minimum
            const receiver = user1.address;
            const nonce = await crowdsale.getManagerNonce();

            const messageHash = await crowdsale.getDepositSignatureMessage(
                depositAmount,
                receiver,
                nonce
            );
            const signature = await manager.signMessage(ethers.getBytes(messageHash));

            await expect(
                crowdsale.connect(user1).deposit(depositAmount, receiver, signature)
            ).to.be.revertedWith("Crowdsale: amount less than minimum");
        });

        it("should handle partial deposit when exceeding max supply", async function () {
            // First deposit to get close to softcap
            const firstDepositAmount = ethers.parseUnits("4000", TOKEN_DECIMALS);
            const nonce1 = await crowdsale.getManagerNonce();
            const messageHash1 = await crowdsale.getDepositSignatureMessage(
                firstDepositAmount,
                user1.address,
                nonce1
            );
            const signature1 = await manager.signMessage(ethers.getBytes(messageHash1));
            await assetToken.connect(user1).approve(await crowdsale.getAddress(), ethers.parseUnits("100000", TOKEN_DECIMALS));
            await crowdsale.connect(user1).deposit(firstDepositAmount, user1.address, signature1);

            // Second deposit that exceeds remaining supply
            const secondDepositAmount = ethers.parseUnits("6000", TOKEN_DECIMALS);
            const nonce2 = await crowdsale.getManagerNonce();
            const messageHash2 = await crowdsale.getDepositSignatureMessage(
                secondDepositAmount,
                user2.address,
                nonce2
            );
            const signature2 = await manager.signMessage(ethers.getBytes(messageHash2));
            await assetToken.connect(user2).approve(await crowdsale.getAddress(), ethers.parseUnits("100000", TOKEN_DECIMALS));

            await expect(
                crowdsale.connect(user2).deposit(secondDepositAmount, user2.address, signature2)
            ).to.emit(crowdsale, "Deposit");

            // Should only get remaining shares (partial deposit)
            const firstUserBalance = await vaultToken.balanceOf(user1.address);
            const remainingSupply = maxSupply - firstUserBalance;
            const secondUserBalance = await vaultToken.balanceOf(user2.address);
            expect(secondUserBalance).to.be.gt(0);
            expect(secondUserBalance).to.be.lte(remainingSupply);
            // Total supply should not exceed maxSupply
            expect(firstUserBalance + secondUserBalance).to.be.lte(maxSupply);
        });

        it("should reject deposit outside funding period", async function () {
            // Set time to before start
            await ethers.provider.send("evm_increaseTime", [startTime - 3600 - Math.floor(Date.now() / 1000)]);
            await ethers.provider.send("evm_mine", []);

            const depositAmount = ethers.parseUnits("1000", TOKEN_DECIMALS);
            const receiver = user1.address;
            const nonce = await crowdsale.getManagerNonce();

            const messageHash = await crowdsale.getDepositSignatureMessage(
                depositAmount,
                receiver,
                nonce
            );
            const signature = await manager.signMessage(ethers.getBytes(messageHash));

            await expect(
                crowdsale.connect(user1).deposit(depositAmount, receiver, signature)
            ).to.be.revertedWith("Crowdsale: not in funding period");
        });

        it("should allow off-chain deposit with valid DRDS signature", async function () {
            const depositAmount = ethers.parseUnits("1000", TOKEN_DECIMALS);
            const receiver = user1.address;

            // Generate DRDS signature (validator signature)
            const messageHash = ethers.keccak256(ethers.solidityPacked(
                ["string", "uint256", "address", "uint256", "address"],
                ["offChainDeposit", depositAmount, receiver, await ethers.provider.getNetwork().then(n => n.chainId), await crowdsale.getAddress()]
            ));
            const drdsSignature = await validator.signMessage(ethers.getBytes(messageHash));

            // Perform off-chain deposit
            const tx = await crowdsale.connect(manager).offChainDeposit(depositAmount, receiver, drdsSignature);
            
            // Check that tokens were minted
            const balance = await vaultToken.balanceOf(receiver);
            expect(balance).to.be.gt(0);
            
            // For off-chain deposits, no management fee is deducted and no fundingAssets update
            const expectedManageFee = 0n;
            const expectedFundingAssets = 0n; // No fundingAssets update for off-chain deposits
            
            expect(await crowdsale.fundingAssets()).to.equal(expectedFundingAssets);
            expect(await crowdsale.manageFee()).to.equal(expectedManageFee);
            
            // Verify event emission
            await expect(tx).to.emit(crowdsale, "OffChainDeposit")
              .withArgs(receiver, depositAmount, balance, drdsSignature);
        });

        it("should reject off-chain deposit with invalid DRDS signature", async function () {
            const depositAmount = ethers.parseUnits("1000", TOKEN_DECIMALS);
            const receiver = user1.address;

            // Generate signature with wrong signer
            const messageHash = ethers.keccak256(ethers.solidityPacked(
                ["string", "uint256", "address", "uint256", "address"],
                ["offChainDeposit", depositAmount, receiver, await ethers.provider.getNetwork().then(n => n.chainId), await crowdsale.getAddress()]
            ));
            const drdsSignature = await user2.signMessage(ethers.getBytes(messageHash));

            await expect(
                crowdsale.connect(manager).offChainDeposit(depositAmount, receiver, drdsSignature)
            ).to.be.revertedWith("Crowdsale: invalid drds signature");
        });

        it("should reject off-chain deposit from non-manager", async function () {
            const depositAmount = ethers.parseUnits("1000", TOKEN_DECIMALS);
            const receiver = user1.address;

            // Generate valid DRDS signature
            const messageHash = ethers.keccak256(ethers.solidityPacked(
                ["string", "uint256", "address", "uint256", "address"],
                ["offChainDeposit", depositAmount, receiver, await ethers.provider.getNetwork().then(n => n.chainId), await crowdsale.getAddress()]
            ));
            const drdsSignature = await validator.signMessage(ethers.getBytes(messageHash));

            await expect(
                crowdsale.connect(user1).offChainDeposit(depositAmount, receiver, drdsSignature)
            ).to.be.revertedWith("Crowdsale: only manager");
        });

        it("should reject off-chain deposit below minimum amount", async function () {
            const depositAmount = ethers.parseUnits("50", TOKEN_DECIMALS); // Below minimum
            const receiver = user1.address;

            // Generate valid DRDS signature
            const messageHash = ethers.keccak256(ethers.solidityPacked(
                ["string", "uint256", "address", "uint256", "address"],
                ["offChainDeposit", depositAmount, receiver, await ethers.provider.getNetwork().then(n => n.chainId), await crowdsale.getAddress()]
            ));
            const drdsSignature = await validator.signMessage(ethers.getBytes(messageHash));

            await expect(
                crowdsale.connect(manager).offChainDeposit(depositAmount, receiver, drdsSignature)
            ).to.be.revertedWith("Crowdsale: amount less than minimum");
        });

        it("should handle partial off-chain deposit when exceeding max supply", async function () {
            // First off-chain deposit to get close to softcap
            const firstDepositAmount = ethers.parseUnits("4000", TOKEN_DECIMALS);
            const messageHash1 = ethers.keccak256(ethers.solidityPacked(
                ["string", "uint256", "address", "uint256", "address"],
                ["offChainDeposit", firstDepositAmount, user1.address, await ethers.provider.getNetwork().then(n => n.chainId), await crowdsale.getAddress()]
            ));
            const drdsSignature1 = await validator.signMessage(ethers.getBytes(messageHash1));
            await crowdsale.connect(manager).offChainDeposit(firstDepositAmount, user1.address, drdsSignature1);

            // Second off-chain deposit that exceeds remaining supply
            const secondDepositAmount = ethers.parseUnits("6000", TOKEN_DECIMALS);
            const messageHash2 = ethers.keccak256(ethers.solidityPacked(
                ["string", "uint256", "address", "uint256", "address"],
                ["offChainDeposit", secondDepositAmount, user2.address, await ethers.provider.getNetwork().then(n => n.chainId), await crowdsale.getAddress()]
            ));
            const drdsSignature2 = await validator.signMessage(ethers.getBytes(messageHash2));

            await expect(
                crowdsale.connect(manager).offChainDeposit(secondDepositAmount, user2.address, drdsSignature2)
            ).to.emit(crowdsale, "OffChainDeposit");

            // Should only get remaining shares
            const firstUserBalance = await vaultToken.balanceOf(user1.address);
            const remainingSupply = maxSupply - firstUserBalance;
            expect(await vaultToken.balanceOf(user2.address)).to.equal(remainingSupply);
        });
    });

    describe("Redeem Operations", function () {
        let testCrowdsale: any;
        let testVault: any;
        let testVaultToken: any;
        
        beforeEach(async function () {
            // Reset EVM time to a clean state
            await resetEVMTime();
            
            // Set independent time for this test suite
            const currentBlock = await ethers.provider.getBlock("latest");
            if (!currentBlock) {
                throw new Error("Cannot get latest block");
            }
            const baseTime = currentBlock.timestamp + 120;
            startTime = baseTime + 60;
            endTime = startTime + 86400;
            
            // Create new vault and crowdsale instances using the helper function
            const { newVault, newVaultToken, newCrowdsale } = await createNewVaultAndCrowdsale(
                assetToken,
                fundingReceiver,
                manageFeeReceiver,
                manager,
                validator,
                startTime,
                endTime,
                maxSupply,
                softCap,
                sharePrice,
                minDepositAmount,
                manageFeeBps,
                decimalsMultiplier
            );
            
            testVault = newVault;
            testVaultToken = newVaultToken;
            testCrowdsale = newCrowdsale;

            // Move to funding period for deposit
            const currentBlockTime = await ethers.provider.getBlock("latest").then(block => block?.timestamp || 0);
            const timeToFunding = Math.max(0, startTime + 60 - currentBlockTime);
            await ethers.provider.send("evm_increaseTime", [timeToFunding]);
            await ethers.provider.send("evm_mine", []);
            
            // Setup: deposit some tokens first (during funding period)
            const depositAmount = ethers.parseUnits("1000", TOKEN_DECIMALS);
            const nonce = await testCrowdsale.getManagerNonce();
            const messageHash = await testCrowdsale.getDepositSignatureMessage(
                depositAmount,
                user1.address,
                nonce
            );
            const signature = await manager.signMessage(ethers.getBytes(messageHash));
            await assetToken.connect(user1).approve(await testCrowdsale.getAddress(), ethers.parseUnits("100000", TOKEN_DECIMALS));
            await testCrowdsale.connect(user1).deposit(depositAmount, user1.address, signature);

            // Move time to after funding period for redeem operations
            const currentBlockTimeAfterDeposit = await ethers.provider.getBlock("latest").then(block => block?.timestamp || 0);
            const timeToAfterFunding = Math.max(0, endTime + 3600 - currentBlockTimeAfterDeposit);
            await ethers.provider.send("evm_increaseTime", [timeToAfterFunding]);
            await ethers.provider.send("evm_mine", []);
        });

        it("should allow redeem with valid signature when funding fails", async function () {
            const receiver = user1.address;
            
            // Check initial balance
            const initialBalance = await testVaultToken.balanceOf(user1.address);
            console.log("Initial balance:", initialBalance.toString());
            
            // Generate signature for all shares (amount parameter is ignored but needed for signature)
            const nonce = await testCrowdsale.getManagerNonce();
            const messageHash = await testCrowdsale.getRedeemSignatureMessage(
                initialBalance, // Use actual balance for signature
                receiver,
                nonce
            );
            const signature = await manager.signMessage(ethers.getBytes(messageHash));
            
            // Calculate expected values for event verification
            const sharePrice = await testCrowdsale.sharePrice();
            const decimalsMultiplier = await testCrowdsale.decimalsMultiplier();
            const manageFeeBps = await testCrowdsale.manageFeeBps();
            
            // Calculate asset amount: shares * sharePrice / SHARE_PRICE_DENOMINATOR / decimalsMultiplier
            const expectedAssetAmount = (initialBalance * BigInt(sharePrice)) / (10n ** 8n) / BigInt(decimalsMultiplier);
            const expectedFeeAmount = (expectedAssetAmount * BigInt(manageFeeBps)) / 10000n;
            
            // Approve vault to burn tokens (required for redeem operation)
            await testVaultToken.connect(user1).approve(await testVault.getAddress(), initialBalance);
            
            // Perform redeem (will redeem all shares)
            await expect(
                testCrowdsale.connect(user1).redeem(receiver, signature)
            ).to.emit(testCrowdsale, "FundFailRedeem")
                .withArgs(receiver, initialBalance, expectedAssetAmount, expectedFeeAmount);

            // User should have no remaining balance after redeeming all shares
            expect(await testVaultToken.balanceOf(user1.address)).to.equal(0);
        });

        it("should allow off-chain redeem with valid manager", async function () {
            const receiver = user1.address;
            
            // Check initial balance
            const initialBalance = await testVaultToken.balanceOf(receiver);
            expect(initialBalance).to.be.gt(0);
            
            // Approve vault to burn tokens (required for offChainRedeem operation)
            await testVaultToken.connect(user1).approve(await testVault.getAddress(), initialBalance);
            
            // Calculate expected values for event verification
            const sharePrice = await testCrowdsale.sharePrice();
            const decimalsMultiplier = await testCrowdsale.decimalsMultiplier();
            
            // Calculate asset amount: shares * sharePrice / SHARE_PRICE_DENOMINATOR / decimalsMultiplier
            const expectedAssetAmount = (initialBalance * BigInt(sharePrice)) / (10n ** 8n) / BigInt(decimalsMultiplier);
            
            // Perform off-chain redeem (manager can redeem for any user)
            await expect(
                testCrowdsale.connect(manager).offChainRedeem(receiver)
            ).to.emit(testCrowdsale, "OffChainRedeem")
                .withArgs(receiver, expectedAssetAmount);

            // User should have no remaining balance after redeeming all shares
            expect(await testVaultToken.balanceOf(receiver)).to.equal(0);
        });

        it("should reject off-chain redeem from non-manager", async function () {
            const receiver = user1.address;
            
            // Non-manager should not be able to call offChainRedeem
            await expect(
                testCrowdsale.connect(user2).offChainRedeem(receiver)
            ).to.be.revertedWith("Crowdsale: only manager");
        });

        it("should reject off-chain redeem when funding is successful", async function () {
            // Create a new crowdsale setup where funding is successful
            const currentBlock = await ethers.provider.getBlock("latest");
            if (!currentBlock) {
                throw new Error("Cannot get latest block");
            }
            
            // Set fresh time for this test
            const freshBaseTime = currentBlock.timestamp + 120;
            const freshStartTime = freshBaseTime + 60;
            const freshEndTime = freshStartTime + 86400;
            
            const { newVault, newVaultToken, newCrowdsale } = await createNewVaultAndCrowdsale(
                assetToken,
                fundingReceiver,
                manageFeeReceiver,
                manager,
                validator,
                freshStartTime,
                freshEndTime,
                maxSupply,
                softCap,
                sharePrice,
                minDepositAmount,
                manageFeeBps,
                decimalsMultiplier
            );
            
            // Move to funding period
            const currentTime = await ethers.provider.getBlock("latest").then(block => block?.timestamp || 0);
            const timeToFunding = Math.max(0, freshStartTime + 60 - currentTime);
            await ethers.provider.send("evm_increaseTime", [timeToFunding]);
            await ethers.provider.send("evm_mine", []);
            
            // Make funding successful by depositing enough to reach soft cap
            const depositAmount = ethers.parseUnits("6000", TOKEN_DECIMALS);
            const nonce = await newCrowdsale.getManagerNonce();
            const messageHash = await newCrowdsale.getDepositSignatureMessage(
                depositAmount,
                user1.address,
                nonce
            );
            const signature = await manager.signMessage(ethers.getBytes(messageHash));
            await assetToken.connect(user1).approve(await newCrowdsale.getAddress(), ethers.parseUnits("100000", TOKEN_DECIMALS));
            await newCrowdsale.connect(user1).deposit(depositAmount, user1.address, signature);

            // Move time to after funding period
            const timeToAfterFunding = Math.max(0, freshEndTime + 3600 - await ethers.provider.getBlock("latest").then(block => block?.timestamp || 0));
            await ethers.provider.send("evm_increaseTime", [timeToAfterFunding]);
            await ethers.provider.send("evm_mine", []);
            
            // Verify funding is successful
            expect(await newCrowdsale.isFundingSuccessful()).to.be.true;
            
            // Should reject off-chain redeem when funding is successful
            await expect(
                newCrowdsale.connect(manager).offChainRedeem(user1.address)
            ).to.be.revertedWith("Crowdsale: funding was successful");
        });

        it("should reject off-chain redeem for user with no shares", async function () {
            const receiver = user2.address; // user2 has no shares
            
            // Should reject off-chain redeem for user with no shares
            await expect(
                testCrowdsale.connect(manager).offChainRedeem(receiver)
            ).to.be.revertedWith("Crowdsale: no shares to redeem");
        });

        it("should reject off-chain redeem with zero address receiver", async function () {
            // Should reject off-chain redeem with zero address
            await expect(
                testCrowdsale.connect(manager).offChainRedeem(ethers.ZeroAddress)
            ).to.be.revertedWith("Crowdsale: invalid receiver");
        });
    });

    describe("Fund Management", function () {
        let testCrowdsale: any;
        let testVault: any;
        let testVaultToken: any;
        
        beforeEach(async function () {
            // Reset EVM time to a clean state
            await resetEVMTime();
            
            // Set independent time for this test suite
            // Get current block time and ensure endTime is far enough in the future
            const currentBlockTime = await ethers.provider.getBlock("latest").then(block => block.timestamp);
            const baseTime = Math.max(currentBlockTime + 120, Math.floor(Date.now() / 1000) + 120);
            startTime = baseTime + 60;
            endTime = startTime + 86400;
            
            // Create new vault and crowdsale instances using the helper function
            const { newVault, newVaultToken, newCrowdsale } = await createNewVaultAndCrowdsale(
                assetToken,
                fundingReceiver,
                manageFeeReceiver,
                manager,
                validator,
                startTime,
                endTime,
                maxSupply,
                softCap,
                sharePrice,
                minDepositAmount,
                manageFeeBps,
                decimalsMultiplier
            );
            
            testVault = newVault;
            testVaultToken = newVaultToken;
            testCrowdsale = newCrowdsale;

            // Move to funding period for deposit
            const currentTime = await ethers.provider.getBlock("latest").then(block => block.timestamp);
            const timeToFunding = Math.max(0, startTime + 60 - currentTime);
            await ethers.provider.send("evm_increaseTime", [timeToFunding]);
            await ethers.provider.send("evm_mine", []);
            
            // Setup: make funding successful
            const depositAmount = ethers.parseUnits("6000", TOKEN_DECIMALS);
            const nonce = await testCrowdsale.getManagerNonce();
            const messageHash = await testCrowdsale.getDepositSignatureMessage(
                depositAmount,
                user1.address,
                nonce
            );
            const signature = await manager.signMessage(ethers.getBytes(messageHash));
            await assetToken.connect(user1).approve(await testCrowdsale.getAddress(), ethers.parseUnits("100000", TOKEN_DECIMALS));
            await testCrowdsale.connect(user1).deposit(depositAmount, user1.address, signature);

            // Move time to after funding period
            const currentTimeAfterDeposit = await ethers.provider.getBlock("latest").then(block => block.timestamp);
            const timeToAfterFunding = Math.max(0, endTime + 3600 - currentTimeAfterDeposit);
            await ethers.provider.send("evm_increaseTime", [timeToAfterFunding]);
            await ethers.provider.send("evm_mine", []);
        });

        it("should allow withdrawal of funding assets when successful", async function () {
            const initialBalance = await assetToken.balanceOf(fundingReceiver.address);
            const fundingAssets = await testCrowdsale.fundingAssets();

            await expect(
                testCrowdsale.connect(fundingReceiver).withdrawFundingAssets()
            ).to.emit(testCrowdsale, "FundingAssetsWithdrawn")
                .withArgs(fundingReceiver.address, fundingAssets);

            expect(await assetToken.balanceOf(fundingReceiver.address)).to.equal(initialBalance + fundingAssets);
            expect(await testCrowdsale.fundingAssets()).to.equal(0);
        });

        it("should allow withdrawal of management fee when successful", async function () {
            const initialBalance = await assetToken.balanceOf(manageFeeReceiver.address);
            const manageFee = await testCrowdsale.manageFee();

            await expect(
                testCrowdsale.connect(manageFeeReceiver).withdrawManageFee()
            ).to.emit(testCrowdsale, "ManageFeeWithdrawn")
                .withArgs(manageFeeReceiver.address, manageFee);

            expect(await assetToken.balanceOf(manageFeeReceiver.address)).to.equal(initialBalance + manageFee);
            expect(await testCrowdsale.manageFee()).to.equal(0);
        });

        it("should reject withdrawal when funding not successful", async function () {
            // Create new crowdsale that fails with fresh time settings
            const CrowdsaleFactory = await ethers.getContractFactory("Crowdsale");
            const failedCrowdsale = await CrowdsaleFactory.deploy();
            
            // Get current block time and set fresh time for the failed crowdsale
            const currentBlockTime = await ethers.provider.getBlock("latest").then(block => block.timestamp);
            const freshBaseTime = Math.max(currentBlockTime + 120, Math.floor(Date.now() / 1000) + 120);
            const freshStartTime = freshBaseTime + 60;
            const freshEndTime = freshStartTime + 86400;
            
            const failedCrowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "uint256", "address"],
                [freshStartTime, freshEndTime, await assetToken.getAddress(), maxSupply, softCap, sharePrice, minDepositAmount, manageFeeBps, fundingReceiver.address, manageFeeReceiver.address, decimalsMultiplier, manager.address]
            );
            await failedCrowdsale.initiate(await vault.getAddress(), failedCrowdsaleInitData);

            // Move time to after funding period
            const currentTimeAfterInit = await ethers.provider.getBlock("latest").then(block => block.timestamp);
            const timeToAfterFunding = Math.max(0, freshEndTime + 7200 - currentTimeAfterInit);
            await ethers.provider.send("evm_increaseTime", [timeToAfterFunding]);
            await ethers.provider.send("evm_mine", []);

            await expect(
                failedCrowdsale.connect(manager).withdrawFundingAssets()
            ).to.be.revertedWith("Crowdsale: funding was not successful");
        });

        it("should reject withdrawal by non-fundingReceiver", async function () {
            await expect(
                testCrowdsale.connect(user1).withdrawFundingAssets()
            ).to.be.revertedWith("Crowdsale: only funding receiver");
        });
    });

    describe("Status Queries", function () {
        let testCrowdsale: any;
        let testVault: any;
        let testVaultToken: any;
        
        beforeEach(async function () {
            // Reset EVM time to a clean state
            await resetEVMTime();
            
            // Set independent time for this test suite
            // Get current block time and ensure endTime is far enough in the future
            const currentBlockTime = await ethers.provider.getBlock("latest").then(block => block.timestamp);
            const baseTime = Math.max(currentBlockTime + 120, Math.floor(Date.now() / 1000) + 120);
            startTime = baseTime + 60;
            endTime = startTime + 86400;
            
            // Create new vault and crowdsale instances using the helper function
            const { newVault, newVaultToken, newCrowdsale } = await createNewVaultAndCrowdsale(
                assetToken,
                fundingReceiver,
                manageFeeReceiver,
                manager,
                validator,
                startTime,
                endTime,
                maxSupply,
                softCap,
                sharePrice,
                minDepositAmount,
                manageFeeBps,
                decimalsMultiplier
            );
            
            testVault = newVault;
            testVaultToken = newVaultToken;
            testCrowdsale = newCrowdsale;
        });

        it("should return correct funding status", async function () {
            expect(await testCrowdsale.isFundingSuccessful()).to.be.false;
            
            // Check current funding period status
            const currentStatus = await testCrowdsale.isFundingPeriodActive();
            console.log("Current funding period status:", currentStatus);
            
            // Move to funding period
            const currentTime = await ethers.provider.getBlock("latest").then(block => block.timestamp);
            const timeToFunding = Math.max(0, startTime + 3600 - currentTime);
            await ethers.provider.send("evm_increaseTime", [timeToFunding]);
            await ethers.provider.send("evm_mine", []);
            expect(await testCrowdsale.isFundingPeriodActive()).to.be.true;

            // Move after funding period
            const currentTimeAfterFunding = await ethers.provider.getBlock("latest").then(block => block.timestamp);
            const timeToAfterFunding = Math.max(0, endTime + 3600 - currentTimeAfterFunding);
            await ethers.provider.send("evm_increaseTime", [timeToAfterFunding]);
            await ethers.provider.send("evm_mine", []);
            expect(await testCrowdsale.isFundingPeriodActive()).to.be.false;
        });

        it("should return correct remaining supply", async function () {
            // Check initial remaining supply (should be maxSupply since no deposits yet)
            expect(await testCrowdsale.getRemainingSupply()).to.equal(maxSupply);

            // Move to funding period for deposit
            const currentTime = await ethers.provider.getBlock("latest").then(block => block.timestamp);
            const timeToFunding = Math.max(0, startTime + 60 - currentTime);
            await ethers.provider.send("evm_increaseTime", [timeToFunding]);
            await ethers.provider.send("evm_mine", []);
            
            // After some deposits
            const depositAmount = ethers.parseUnits("1000", TOKEN_DECIMALS);
            const nonce = await testCrowdsale.getManagerNonce();
            const messageHash = await testCrowdsale.getDepositSignatureMessage(
                depositAmount,
                user1.address,
                nonce
            );
            const signature = await manager.signMessage(ethers.getBytes(messageHash));
            await assetToken.connect(user1).approve(await testCrowdsale.getAddress(), ethers.parseUnits("100000", TOKEN_DECIMALS));
            await testCrowdsale.connect(user1).deposit(depositAmount, user1.address, signature);

            // Calculate expected remaining supply based on actual shares received
            const actualSharesReceived = await testVaultToken.balanceOf(user1.address);
            const expectedRemaining = maxSupply - actualSharesReceived;
            expect(await testCrowdsale.getRemainingSupply()).to.equal(expectedRemaining);
        });

        it("should return correct total raised", async function () {
            expect(await testCrowdsale.getTotalRaised()).to.equal(0);

            // Move to funding period for deposit
            const currentTime = await ethers.provider.getBlock("latest").then(block => block.timestamp);
            const timeToFunding = Math.max(0, startTime + 60 - currentTime);
            await ethers.provider.send("evm_increaseTime", [timeToFunding]);
            await ethers.provider.send("evm_mine", []);
            
            const depositAmount = ethers.parseUnits("1000", TOKEN_DECIMALS);
            const nonce = await testCrowdsale.getManagerNonce();
            const messageHash = await testCrowdsale.getDepositSignatureMessage(
                depositAmount,
                user1.address,
                nonce
            );
            const signature = await manager.signMessage(ethers.getBytes(messageHash));
            await assetToken.connect(user1).approve(await testCrowdsale.getAddress(), ethers.parseUnits("100000", TOKEN_DECIMALS));
            await testCrowdsale.connect(user1).deposit(depositAmount, user1.address, signature);

            // Total raised should be the net amount (after management fee)
            const expectedTotalRaised = await testCrowdsale.fundingAssets();
            expect(await testCrowdsale.getTotalRaised()).to.equal(expectedTotalRaised);
        });
    });

    describe("Signature Query Interface", function () {
        let testCrowdsale: any;
        let testVault: any;
        let testVaultToken: any;
        
        beforeEach(async function () {
            // Reset EVM time to a clean state
            await resetEVMTime();
            
            // Set independent time for this test suite
            // Get current block time and ensure endTime is far enough in the future
            const currentBlockTime = await ethers.provider.getBlock("latest").then(block => block.timestamp);
            const baseTime = Math.max(currentBlockTime + 120, Math.floor(Date.now() / 1000) + 120);
            startTime = baseTime + 60;
            endTime = startTime + 86400;
            
            // Create new vault and crowdsale instances using the helper function
            const { newVault, newVaultToken, newCrowdsale } = await createNewVaultAndCrowdsale(
                assetToken,
                fundingReceiver,
                manageFeeReceiver,
                manager,
                validator,
                startTime,
                endTime,
                maxSupply,
                softCap,
                sharePrice,
                minDepositAmount,
                manageFeeBps,
                decimalsMultiplier
            );
            
            testVault = newVault;
            testVaultToken = newVaultToken;
            testCrowdsale = newCrowdsale;
        });

        it("should return correct manager nonce", async function () {
            expect(await testCrowdsale.getManagerNonce()).to.equal(0);

            // Move to funding period for deposit
            const currentTime = await ethers.provider.getBlock("latest").then(block => block.timestamp);
            const timeToFunding = Math.max(0, startTime + 60 - currentTime);
            await ethers.provider.send("evm_increaseTime", [timeToFunding]);
            await ethers.provider.send("evm_mine", []);
            
            // After a deposit, nonce should increment
            const depositAmount = ethers.parseUnits("1000", TOKEN_DECIMALS);
            const nonce = await testCrowdsale.getManagerNonce();
            const messageHash = await testCrowdsale.getDepositSignatureMessage(
                depositAmount,
                user1.address,
                nonce
            );
            const signature = await manager.signMessage(ethers.getBytes(messageHash));
            await assetToken.connect(user1).approve(await testCrowdsale.getAddress(), ethers.parseUnits("100000", TOKEN_DECIMALS));
            await testCrowdsale.connect(user1).deposit(depositAmount, user1.address, signature);

            expect(await testCrowdsale.getManagerNonce()).to.equal(1);
        });

        it("should generate correct signature messages", async function () {
            const amount = ethers.parseUnits("1000", 6);
            const receiver = user1.address;
            const nonce = 0;

            const depositMessage = await testCrowdsale.getDepositSignatureMessage(amount, receiver, nonce);
            const redeemMessage = await testCrowdsale.getRedeemSignatureMessage(amount, receiver, nonce);

            expect(depositMessage).to.not.equal(ethers.ZeroHash);
            expect(redeemMessage).to.not.equal(ethers.ZeroHash);
            expect(depositMessage).to.not.equal(redeemMessage);
        });
    });
});
