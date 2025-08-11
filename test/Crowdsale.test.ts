import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Crowdsale } from "../typechain-types/contracts/v2/templates/funding/Crowdsale";
import { VaultToken } from "../typechain-types/contracts/v2/templates/token/VaultToken";
import { BasicVault } from "../typechain-types/contracts/v2/templates/vault/BasicVault";
import { MockERC20 } from "../typechain-types/contracts/mocks/MockERC20";

describe("Crowdsale", function () {
    // Constants for token precision
    const TOKEN_DECIMALS = 6;
    const VAULT_TOKEN_DECIMALS = 6;
    
    let crowdsale: Crowdsale;
    let vaultToken: VaultToken;
    let vault: BasicVault;
    let assetToken: MockERC20;
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
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        assetToken = await MockERC20Factory.deploy();
        await assetToken.initToken(
            owner.address,
            "Mock USDT",
            "USDT",
            TOKEN_DECIMALS
        );
        await assetToken.mint(user1.address, ethers.parseUnits("100000", TOKEN_DECIMALS));
        await assetToken.mint(user2.address, ethers.parseUnits("100000", TOKEN_DECIMALS));

        // Deploy vault token
        const VaultTokenFactory = await ethers.getContractFactory("VaultToken");
        vaultToken = await VaultTokenFactory.deploy();

        // Deploy basic vault
        const BasicVaultFactory = await ethers.getContractFactory("BasicVault");
        vault = await BasicVaultFactory.deploy();
        await vault.initVault(
            manager.address,
            validator.address,
            false, // whitelist disabled
            [] // empty initial whitelist
        );

        // Initialize vault token
        await vaultToken.initToken(
            await vault.getAddress(),
            "Test Vault Token",
            "TVT",
            VAULT_TOKEN_DECIMALS
        );

        // Set vault token in vault (manager is the owner)
        await vault.connect(manager).setVaultToken(await vaultToken.getAddress());

        // Deploy crowdsale
        const CrowdsaleFactory = await ethers.getContractFactory("Crowdsale");
        crowdsale = await CrowdsaleFactory.deploy();
        
        // Set funding module in vault
        await vault.connect(manager).setFundingModule(await crowdsale.getAddress());
        
        // Don't initialize crowdsale in beforeEach - let each test handle its own initialization
    });

    // Helper function to reset EVM time to a clean state
    async function resetEVMTime() {
        const currentBlockTime = await ethers.provider.getBlock("latest").then(block => block.timestamp);
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

    // Helper function to create a new crowdsale instance with proper initialization
    async function createNewCrowdsale(
        vault: any,
        assetToken: any,
        fundingReceiver: any,
        manageFeeReceiver: any,
        manager: any,
        startTime: number,
        endTime: number,
        maxSupply: any,
        softCap: any,
        sharePrice: any,
        minDepositAmount: any,
        manageFeeBps: any,
        decimalsMultiplier: any
    ) {
        const CrowdsaleFactory = await ethers.getContractFactory("Crowdsale");
        const newCrowdsale = await CrowdsaleFactory.deploy();
        
        await newCrowdsale.initCrowdsale(
            await vault.getAddress(),
            startTime,
            endTime,
            await assetToken.getAddress(),
            maxSupply,
            softCap,
            sharePrice,
            minDepositAmount,
            manageFeeBps,
            fundingReceiver.address,
            manageFeeReceiver.address,
            decimalsMultiplier,
            manager.address
        );
        
        return newCrowdsale;
    }

    describe("Initialization", function () {
        beforeEach(async function () {
            // Set independent time for this test suite
            const baseTime = Math.floor(Date.now() / 1000) + 120;
            startTime = baseTime + 60;
            endTime = startTime + 86400;
        });

        it("should initialize crowdsale correctly", async function () {
            await crowdsale.initCrowdsale(
                await vault.getAddress(),
                startTime,
                endTime,
                await assetToken.getAddress(),
                maxSupply,
                softCap,
                sharePrice,
                minDepositAmount,
                manageFeeBps,
                fundingReceiver.address,
                manageFeeReceiver.address,
                decimalsMultiplier,
                manager.address
            );

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
            await crowdsale.initCrowdsale(
                await vault.getAddress(),
                startTime,
                endTime,
                await assetToken.getAddress(),
                maxSupply,
                softCap,
                sharePrice,
                minDepositAmount,
                manageFeeBps,
                fundingReceiver.address,
                manageFeeReceiver.address,
                decimalsMultiplier,
                manager.address
            );

            await expect(
                crowdsale.initCrowdsale(
                    await vault.getAddress(),
                    startTime,
                    endTime,
                    await assetToken.getAddress(),
                    maxSupply,
                    softCap,
                    sharePrice,
                    minDepositAmount,
                    manageFeeBps,
                    fundingReceiver.address,
                    manageFeeReceiver.address,
                    decimalsMultiplier,
                    manager.address
                )
            ).to.be.revertedWith("Crowdsale: already initialized");
        });

        it("should reject invalid initialization parameters", async function () {
            // Invalid vault address
            await expect(
                crowdsale.initCrowdsale(
                    ethers.ZeroAddress,
                    startTime,
                    endTime,
                    await assetToken.getAddress(),
                    maxSupply,
                    softCap,
                    sharePrice,
                    minDepositAmount,
                    manageFeeBps,
                    fundingReceiver.address,
                    manageFeeReceiver.address,
                    decimalsMultiplier,
                    manager.address
                )
            ).to.be.revertedWith("Crowdsale: invalid vault");

            // Invalid time range
            await expect(
                crowdsale.initCrowdsale(
                    await vault.getAddress(),
                    endTime,
                    startTime,
                    await assetToken.getAddress(),
                    maxSupply,
                    softCap,
                    sharePrice,
                    minDepositAmount,
                    manageFeeBps,
                    fundingReceiver.address,
                    manageFeeReceiver.address,
                    decimalsMultiplier,
                    manager.address
                )
            ).to.be.revertedWith("Crowdsale: invalid time range");

            // End time in past
            const pastTime = Math.floor(Date.now() / 1000) - 86400; // 24 hours ago
            const pastStartTime = pastTime - 3600; // 1 hour before pastTime
            await expect(
                crowdsale.initCrowdsale(
                    await vault.getAddress(),
                    pastStartTime,
                    pastTime,
                    await assetToken.getAddress(),
                    maxSupply,
                    softCap,
                    sharePrice,
                    minDepositAmount,
                    manageFeeBps,
                    fundingReceiver.address,
                    manageFeeReceiver.address,
                    decimalsMultiplier,
                    manager.address
                )
            ).to.be.revertedWith("Crowdsale: end time in past");

            // Invalid soft cap
            await expect(
                crowdsale.initCrowdsale(
                    await vault.getAddress(),
                    startTime,
                    endTime,
                    await assetToken.getAddress(),
                    maxSupply,
                    maxSupply + ethers.parseEther("1000"),
                    sharePrice,
                    minDepositAmount,
                    manageFeeBps,
                    fundingReceiver.address,
                    manageFeeReceiver.address,
                    decimalsMultiplier,
                    manager.address
                )
            ).to.be.revertedWith("Crowdsale: invalid soft cap");
        });
    });

    describe("Deposit Operations", function () {
        beforeEach(async function () {
            // Set independent time for this test suite
            const baseTime = Math.floor(Date.now() / 1000) + 120;
            startTime = baseTime + 60;
            endTime = startTime + 86400;
            
            await crowdsale.initCrowdsale(
                await vault.getAddress(),
                startTime,
                endTime,
                await assetToken.getAddress(),
                maxSupply,
                softCap,
                sharePrice,
                minDepositAmount,
                manageFeeBps,
                fundingReceiver.address,
                manageFeeReceiver.address,
                decimalsMultiplier,
                manager.address
            );

            // Set time to funding period
            const currentTime = Math.floor(Date.now() / 1000);
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
            await expect(
                crowdsale.connect(user1).deposit(depositAmount, receiver, signature)
            ).to.emit(crowdsale, "Deposit");

            // Check that tokens were minted (exact amount depends on calculation)
            const balance = await vaultToken.balanceOf(receiver);
            expect(balance).to.be.gt(0);
            
            // Calculate expected values after fee deduction
            const expectedManageFee = (depositAmount * BigInt(manageFeeBps)) / BigInt(10000);
            const expectedFundingAssets = depositAmount - expectedManageFee;
            
            expect(await crowdsale.fundingAssets()).to.equal(expectedFundingAssets);
            expect(await crowdsale.manageFee()).to.equal(expectedManageFee);
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
            // First deposit to get close to max supply
            const firstDepositAmount = ethers.parseUnits("9000", TOKEN_DECIMALS);
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
            const secondDepositAmount = ethers.parseUnits("2000", TOKEN_DECIMALS);
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

            // Should only get remaining shares
            // Calculate actual remaining supply based on first user's balance
            const firstUserBalance = await vaultToken.balanceOf(user1.address);
            const remainingSupply = maxSupply - firstUserBalance;
            expect(await vaultToken.balanceOf(user2.address)).to.equal(remainingSupply);
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
    });

    // Off-chain deposit operations removed as they are not implemented in the current contract

    describe("Redeem Operations", function () {
        let testCrowdsale: any;
        
        beforeEach(async function () {
            // Reset EVM time to a clean state
            await resetEVMTime();
            
            // Set independent time for this test suite
            const baseTime = Math.floor(Date.now() / 1000) + 120;
            startTime = baseTime + 60;
            endTime = startTime + 86400;
            
            // Create a new crowdsale instance using the helper function
            testCrowdsale = await createNewCrowdsale(
                vault,
                assetToken,
                fundingReceiver,
                manageFeeReceiver,
                manager,
                startTime,
                endTime,
                maxSupply,
                softCap,
                sharePrice,
                minDepositAmount,
                manageFeeBps,
                decimalsMultiplier
            );

            // Move to funding period for deposit
            const currentTime = Math.floor(Date.now() / 1000);
            const timeToFunding = Math.max(0, startTime + 60 - currentTime);
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
            const timeToAfterFunding = Math.max(0, endTime + 3600 - Math.floor(Date.now() / 1000));
            await ethers.provider.send("evm_increaseTime", [timeToAfterFunding]);
            await ethers.provider.send("evm_mine", []);
        });

        it("should allow redeem with valid signature when funding fails", async function () {
            const redeemAmount = ethers.parseUnits("500", TOKEN_DECIMALS);
            const receiver = user1.address;
            const nonce = await testCrowdsale.getManagerNonce();

            // Generate signature
            const messageHash = await testCrowdsale.getRedeemSignatureMessage(
                redeemAmount,
                receiver,
                nonce
            );
            const signature = await manager.signMessage(ethers.getBytes(messageHash));

            // Check initial balance
            const initialBalance = await vaultToken.balanceOf(user1.address);
            console.log("Initial balance:", initialBalance.toString());
            
            // Perform redeem
            await expect(
                testCrowdsale.connect(user1).redeem(redeemAmount, receiver, signature)
            ).to.emit(testCrowdsale, "Redeem")
                .withArgs(user1.address, redeemAmount, receiver);

            // User should have remaining balance after redeeming 500 shares
            const expectedRemainingBalance = initialBalance - redeemAmount;
            expect(await vaultToken.balanceOf(user1.address)).to.equal(expectedRemainingBalance);
        });
    });

    describe("Fund Management", function () {
        beforeEach(async function () {
            // Reset EVM time to a clean state first
            const currentBlockTime = await ethers.provider.getBlock("latest").then(block => block.timestamp);
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
            
            // Set independent time for this test suite
            const baseTime = Math.floor(Date.now() / 1000) + 120;
            startTime = baseTime + 60;
            endTime = startTime + 86400;
            
            await crowdsale.initCrowdsale(
                await vault.getAddress(),
                startTime,
                endTime,
                await assetToken.getAddress(),
                maxSupply,
                softCap,
                sharePrice,
                minDepositAmount,
                manageFeeBps,
                fundingReceiver.address,
                manageFeeReceiver.address,
                decimalsMultiplier,
                manager.address
            );

            // Move to funding period for deposit
            const currentTime = Math.floor(Date.now() / 1000);
            const timeToFunding = Math.max(0, startTime + 60 - currentTime);
            await ethers.provider.send("evm_increaseTime", [timeToFunding]);
            await ethers.provider.send("evm_mine", []);
            
            // Setup: make funding successful
            const depositAmount = ethers.parseUnits("6000", TOKEN_DECIMALS);
            const nonce = await crowdsale.getManagerNonce();
            const messageHash = await crowdsale.getDepositSignatureMessage(
                depositAmount,
                user1.address,
                nonce
            );
            const signature = await manager.signMessage(ethers.getBytes(messageHash));
            await assetToken.connect(user1).approve(await crowdsale.getAddress(), ethers.parseUnits("100000", TOKEN_DECIMALS));
            await crowdsale.connect(user1).deposit(depositAmount, user1.address, signature);

            // Move time to after funding period
            const timeToAfterFunding = Math.max(0, endTime + 3600 - Math.floor(Date.now() / 1000));
            await ethers.provider.send("evm_increaseTime", [timeToAfterFunding]);
            await ethers.provider.send("evm_mine", []);
        });

        it("should allow withdrawal of funding assets when successful", async function () {
            const initialBalance = await assetToken.balanceOf(fundingReceiver.address);
            const fundingAssets = await crowdsale.fundingAssets();

            await expect(
                crowdsale.connect(manager).withdrawFundingAssets()
            ).to.emit(crowdsale, "FundingAssetsWithdrawn")
                .withArgs(fundingReceiver.address, fundingAssets);

            expect(await assetToken.balanceOf(fundingReceiver.address)).to.equal(initialBalance + fundingAssets);
            expect(await crowdsale.fundingAssets()).to.equal(0);
        });

        it("should allow withdrawal of management fee when successful", async function () {
            const initialBalance = await assetToken.balanceOf(manageFeeReceiver.address);
            const manageFee = await crowdsale.manageFee();

            await expect(
                crowdsale.connect(manager).withdrawManageFee()
            ).to.emit(crowdsale, "ManageFeeWithdrawn")
                .withArgs(manageFeeReceiver.address, manageFee);

            expect(await assetToken.balanceOf(manageFeeReceiver.address)).to.equal(initialBalance + manageFee);
            expect(await crowdsale.manageFee()).to.equal(0);
        });

        it("should reject withdrawal when funding not successful", async function () {
            // Create new crowdsale that fails
            const CrowdsaleFactory = await ethers.getContractFactory("Crowdsale");
            const failedCrowdsale = await CrowdsaleFactory.deploy();
            await failedCrowdsale.initCrowdsale(
                await vault.getAddress(),
                startTime,
                endTime,
                await assetToken.getAddress(),
                maxSupply,
                softCap,
                sharePrice,
                minDepositAmount,
                manageFeeBps,
                fundingReceiver.address,
                manageFeeReceiver.address,
                decimalsMultiplier,
                manager.address
            );

            // Move time to after funding period
            await ethers.provider.send("evm_increaseTime", [endTime + 7200 - Math.floor(Date.now() / 1000)]);
            await ethers.provider.send("evm_mine", []);

            await expect(
                failedCrowdsale.connect(manager).withdrawFundingAssets()
            ).to.be.revertedWith("Crowdsale: funding not successful");
        });

        it("should reject withdrawal by non-manager", async function () {
            await expect(
                crowdsale.connect(user1).withdrawFundingAssets()
            ).to.be.revertedWith("Crowdsale: only manager");
        });
    });

    describe("Status Queries", function () {
        beforeEach(async function () {
            // Reset EVM time to a clean state first
            await ethers.provider.send("evm_setNextBlockTimestamp", [Math.floor(Date.now() / 1000)]);
            await ethers.provider.send("evm_mine", []);
            
            // Set independent time for this test suite
            const baseTime = Math.floor(Date.now() / 1000) + 120;
            startTime = baseTime + 60;
            endTime = startTime + 86400;
            
            await crowdsale.initCrowdsale(
                await vault.getAddress(),
                startTime,
                endTime,
                await assetToken.getAddress(),
                maxSupply,
                softCap,
                sharePrice,
                minDepositAmount,
                manageFeeBps,
                fundingReceiver.address,
                manageFeeReceiver.address,
                decimalsMultiplier,
                manager.address
            );
        });

        it("should return correct funding status", async function () {
            expect(await crowdsale.isFundingSuccessful()).to.be.false;
            
            // Check current funding period status
            const currentStatus = await crowdsale.isFundingPeriodActive();
            console.log("Current funding period status:", currentStatus);
            
            // Move to funding period
            const currentTime = Math.floor(Date.now() / 1000);
            const timeToFunding = Math.max(0, startTime + 3600 - currentTime);
            await ethers.provider.send("evm_increaseTime", [timeToFunding]);
            await ethers.provider.send("evm_mine", []);
            expect(await crowdsale.isFundingPeriodActive()).to.be.true;

            // Move after funding period
            const timeToAfterFunding = Math.max(0, endTime + 3600 - Math.floor(Date.now() / 1000));
            await ethers.provider.send("evm_increaseTime", [timeToAfterFunding]);
            await ethers.provider.send("evm_mine", []);
            expect(await crowdsale.isFundingPeriodActive()).to.be.false;
        });

        it("should return correct remaining supply", async function () {
            // Check initial remaining supply (should be maxSupply since no deposits yet)
            expect(await crowdsale.getRemainingSupply()).to.equal(maxSupply);

            // Move to funding period for deposit
            await ethers.provider.send("evm_increaseTime", [startTime + 60 - Math.floor(Date.now() / 1000)]);
            await ethers.provider.send("evm_mine", []);
            
            // After some deposits
            const depositAmount = ethers.parseUnits("1000", TOKEN_DECIMALS);
            const nonce = await crowdsale.getManagerNonce();
            const messageHash = await crowdsale.getDepositSignatureMessage(
                depositAmount,
                user1.address,
                nonce
            );
            const signature = await manager.signMessage(ethers.getBytes(messageHash));
            await assetToken.connect(user1).approve(await crowdsale.getAddress(), ethers.parseUnits("100000", TOKEN_DECIMALS));
            await crowdsale.connect(user1).deposit(depositAmount, user1.address, signature);

            // Calculate expected remaining supply based on actual shares received
            const actualSharesReceived = await vaultToken.balanceOf(user1.address);
            const expectedRemaining = maxSupply - actualSharesReceived;
            expect(await crowdsale.getRemainingSupply()).to.equal(expectedRemaining);
        });

        it("should return correct total raised", async function () {
            expect(await crowdsale.getTotalRaised()).to.equal(0);

            // Move to funding period for deposit
            await ethers.provider.send("evm_increaseTime", [startTime + 60 - Math.floor(Date.now() / 1000)]);
            await ethers.provider.send("evm_mine", []);
            
            const depositAmount = ethers.parseUnits("1000", TOKEN_DECIMALS);
            const nonce = await crowdsale.getManagerNonce();
            const messageHash = await crowdsale.getDepositSignatureMessage(
                depositAmount,
                user1.address,
                nonce
            );
            const signature = await manager.signMessage(ethers.getBytes(messageHash));
            await assetToken.connect(user1).approve(await crowdsale.getAddress(), ethers.parseUnits("100000", TOKEN_DECIMALS));
            await crowdsale.connect(user1).deposit(depositAmount, user1.address, signature);

            // Total raised should be the net amount (after management fee)
            const expectedTotalRaised = await crowdsale.fundingAssets();
            expect(await crowdsale.getTotalRaised()).to.equal(expectedTotalRaised);
        });
    });

    describe("Signature Query Interface", function () {
        beforeEach(async function () {
            // Reset EVM time to a clean state first
            await ethers.provider.send("evm_setNextBlockTimestamp", [Math.floor(Date.now() / 1000)]);
            await ethers.provider.send("evm_mine", []);
            
            // Set independent time for this test suite
            const baseTime = Math.floor(Date.now() / 1000) + 120;
            startTime = baseTime + 60;
            endTime = startTime + 86400;
            
            await crowdsale.initCrowdsale(
                await vault.getAddress(),
                startTime,
                endTime,
                await assetToken.getAddress(),
                maxSupply,
                softCap,
                sharePrice,
                minDepositAmount,
                manageFeeBps,
                fundingReceiver.address,
                manageFeeReceiver.address,
                decimalsMultiplier,
                manager.address
            );
        });

        it("should return correct manager nonce", async function () {
            expect(await crowdsale.getManagerNonce()).to.equal(0);

            // Move to funding period for deposit
            await ethers.provider.send("evm_increaseTime", [startTime + 60 - Math.floor(Date.now() / 1000)]);
            await ethers.provider.send("evm_mine", []);
            
            // After a deposit, nonce should increment
            const depositAmount = ethers.parseUnits("1000", TOKEN_DECIMALS);
            const nonce = await crowdsale.getManagerNonce();
            const messageHash = await crowdsale.getDepositSignatureMessage(
                depositAmount,
                user1.address,
                nonce
            );
            const signature = await manager.signMessage(ethers.getBytes(messageHash));
            await assetToken.connect(user1).approve(await crowdsale.getAddress(), ethers.parseUnits("100000", TOKEN_DECIMALS));
            await crowdsale.connect(user1).deposit(depositAmount, user1.address, signature);

            expect(await crowdsale.getManagerNonce()).to.equal(1);
        });

        it("should generate correct signature messages", async function () {
            const amount = ethers.parseUnits("1000", 6);
            const receiver = user1.address;
            const nonce = 0;

            const depositMessage = await crowdsale.getDepositSignatureMessage(amount, receiver, nonce);
            const redeemMessage = await crowdsale.getRedeemSignatureMessage(amount, receiver, nonce);

            expect(depositMessage).to.not.equal(ethers.ZeroHash);
            expect(redeemMessage).to.not.equal(ethers.ZeroHash);
            expect(depositMessage).to.not.equal(redeemMessage);
        });
    });
});
