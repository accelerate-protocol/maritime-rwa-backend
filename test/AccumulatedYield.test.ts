import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("AccumulatedYield", function () {
    let accumulatedYield: any;
    let vault: any;
    let shareToken: any;
    let rewardToken: any;
    let owner: HardhatEthersSigner;
    let manager: HardhatEthersSigner;
    let validator: HardhatEthersSigner;
    let dividendTreasury: HardhatEthersSigner;
    let user1: HardhatEthersSigner;
    let user2: HardhatEthersSigner;
    let user3: HardhatEthersSigner;

    // Token precision constants
    const TOKEN_DECIMALS = 6;
    const SHARE_TOKEN_DECIMALS = 6;

    // Test amounts
    const initialShareTokenSupply = ethers.parseUnits("1000000", SHARE_TOKEN_DECIMALS);
    const initialRewardTokenSupply = ethers.parseUnits("1000000", TOKEN_DECIMALS);
    const dividendAmount = ethers.parseUnits("10000", TOKEN_DECIMALS);
    const user1ShareAmount = ethers.parseUnits("1000", SHARE_TOKEN_DECIMALS);
    const user2ShareAmount = ethers.parseUnits("2000", SHARE_TOKEN_DECIMALS);

    beforeEach(async function () {
        [owner, manager, validator, dividendTreasury, user1, user2, user3] = await ethers.getSigners();

        // Deploy real BasicVault
        const BasicVaultFactory = await ethers.getContractFactory("BasicVault");
        vault = await BasicVaultFactory.deploy();
        
        // Initialize vault with validator
        const vaultInitData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "bool", "address[]"],
            [manager.address, validator.address, false, []]
        );
        await vault.initiate(vaultInitData);

        // Deploy mock share token (VaultToken)
        const VaultTokenFactory = await ethers.getContractFactory("VaultToken");
        shareToken = await VaultTokenFactory.deploy();
        const tokenInitData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["string", "string", "uint8"],
            ["Test Share Token", "TST", SHARE_TOKEN_DECIMALS]
        );
        await shareToken.initiate(await vault.getAddress(), tokenInitData);

        // Deploy mock reward token (MockUSDT)
        const MockUSDTFactory = await ethers.getContractFactory("contracts/mocks/MockUSDT.sol:MockUSDT");
        rewardToken = await MockUSDTFactory.deploy("Test USDT", "USDT");

        // Mint initial tokens
        await rewardToken.mint(manager.address, initialRewardTokenSupply);
        
        // Deploy AccumulatedYield for global tests
        const YieldFactory = await ethers.getContractFactory("AccumulatedYield");
        accumulatedYield = await YieldFactory.deploy();
    });

    // Helper function to reset EVM time to a clean state
    async function resetEVMTime() {
        const currentBlockTime = await ethers.provider.getBlock("latest").then(block => block?.timestamp || 0);
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

    // Helper function to create all modules with proper initialization
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
            ["Test Share Token", "TST", SHARE_TOKEN_DECIMALS]
        );
        await newShareToken.initiate(await newVault.getAddress(), tokenInitData);

        // Deploy AccumulatedYield
        const YieldFactory = await ethers.getContractFactory("AccumulatedYield");
        const newAccumulatedYield = await YieldFactory.deploy();
        
        const yieldInitData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "address"],
            [await rewardToken.getAddress(), manager.address, dividendTreasury.address]
        );
        await newAccumulatedYield.initiate(await newVault.getAddress(), await newShareToken.getAddress(), yieldInitData);
        
        // Set modules in vault (using manager as owner)
        await newVault.connect(manager).setVaultToken(await newShareToken.getAddress());
        await newVault.connect(manager).setDividendModule(await newAccumulatedYield.getAddress());
        await newVault.connect(manager).setFundingModule(manager.address);
        
        // Unpause token for testing (since it's paused during initialization)
        await newVault.connect(manager).unpauseToken();
        
        return {
            vault: newVault,
            shareToken: newShareToken,
            accumulatedYield: newAccumulatedYield
        };
    }

    describe("Initialization", function () {
        beforeEach(async function () {
            // Reset EVM time to a clean state
            await resetEVMTime();
        });

        it("should initialize global pool correctly", async function () {
            const yieldInitData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "address", "address"],
                [await rewardToken.getAddress(), manager.address, dividendTreasury.address]
            );
            await accumulatedYield.initiate(await vault.getAddress(), await shareToken.getAddress(), yieldInitData);

            const globalPool = await accumulatedYield.getGlobalPoolInfo();
            expect(globalPool.shareToken).to.equal(await shareToken.getAddress());
            expect(globalPool.rewardToken).to.equal(await rewardToken.getAddress());
            expect(globalPool.isActive).to.be.true;
            expect(globalPool.totalAccumulatedShares).to.equal(0);
            expect(globalPool.totalDividend).to.equal(0);
            expect(await accumulatedYield.getManager()).to.equal(manager.address);
            expect(await accumulatedYield.getDividendTreasury()).to.equal(dividendTreasury.address);
        });

        it("should reject duplicate initialization", async function () {
            const yieldInitData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "address", "address"],
                [await rewardToken.getAddress(), manager.address, dividendTreasury.address]
            );
            await accumulatedYield.initiate(await vault.getAddress(), await shareToken.getAddress(), yieldInitData);

            await expect(
                accumulatedYield.connect(manager).initiate(await vault.getAddress(), await shareToken.getAddress(), yieldInitData)
            ).to.be.revertedWith("AccumulatedYield: already initialized");
        });

        it("should reject invalid initialization parameters", async function () {
            // Invalid vault address
            const yieldInitData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "address", "address"],
                [await rewardToken.getAddress(), manager.address, dividendTreasury.address]
            );
            await expect(
                accumulatedYield.initiate(ethers.ZeroAddress, await shareToken.getAddress(), yieldInitData)
            ).to.be.revertedWith("AccumulatedYield: invalid vault");

            // Invalid manager address
            const invalidManagerYieldInitData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "address", "address"],
                [await rewardToken.getAddress(), ethers.ZeroAddress, dividendTreasury.address]
            );
            await expect(
                accumulatedYield.initiate(await vault.getAddress(), await shareToken.getAddress(), invalidManagerYieldInitData)
            ).to.be.revertedWith("AccumulatedYield: invalid manager");
        });
    });

    describe("Management Operations", function () {
        let testAccumulatedYield: any;

        beforeEach(async function () {
            // Reset EVM time to a clean state
            await resetEVMTime();
            
            // Create new modules
            const modules = await createModules(manager, validator, dividendTreasury);
            testAccumulatedYield = modules.accumulatedYield;
        });

        it("should allow manager to set new manager", async function () {
            await expect(
                testAccumulatedYield.connect(manager).setManager(user1.address)
            ).to.emit(testAccumulatedYield, "ManagerUpdated")
                .withArgs(manager.address, user1.address);

            expect(await testAccumulatedYield.getManager()).to.equal(user1.address);
        });

        it("should reject non-owner from setting manager", async function () {
            await expect(
                testAccumulatedYield.connect(user1).setManager(user2.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should reject setting invalid manager address", async function () {
            await expect(
                testAccumulatedYield.connect(manager).setManager(ethers.ZeroAddress)
            ).to.be.revertedWith("AccumulatedYield: invalid manager");
        });

        it("should allow manager to set dividend treasury", async function () {
            await expect(
                testAccumulatedYield.connect(manager).setDividendTreasury(user1.address)
            ).to.emit(testAccumulatedYield, "DividendTreasuryUpdated")
                .withArgs(dividendTreasury.address, user1.address);

            expect(await testAccumulatedYield.getDividendTreasury()).to.equal(user1.address);
        });

        it("should reject non-manager from setting dividend treasury", async function () {
            await expect(
                testAccumulatedYield.connect(user1).setDividendTreasury(user2.address)
            ).to.be.revertedWith("AccumulatedYield: only manager");
        });

        it("should reject setting invalid dividend treasury address", async function () {
            await expect(
                testAccumulatedYield.connect(manager).setDividendTreasury(ethers.ZeroAddress)
            ).to.be.revertedWith("AccumulatedYield: invalid dividend treasury");
        });

        it("should allow manager to update global pool status", async function () {
            await expect(
                testAccumulatedYield.connect(manager).updateGlobalPoolStatus(false)
            ).to.not.be.reverted;

            const globalPool = await testAccumulatedYield.getGlobalPoolInfo();
            expect(globalPool.isActive).to.be.false;
        });

        it("should reject non-manager from updating global pool status", async function () {
            await expect(
                testAccumulatedYield.connect(user1).updateGlobalPoolStatus(false)
            ).to.be.revertedWith("AccumulatedYield: only manager");
        });
    });

    describe("Dividend Distribution", function () {
        let testAccumulatedYield: any;
        let testVault: any;
        let testShareToken: any;

        beforeEach(async function () {
            // Reset EVM time to a clean state
            await resetEVMTime();
            
            // Create new modules
            const modules = await createModules(manager, validator, dividendTreasury);
            testAccumulatedYield = modules.accumulatedYield;
            testVault = modules.vault;
            testShareToken = modules.shareToken;

            // Setup: give some share tokens to users
            await modules.vault.connect(manager).mintToken(user1.address, user1ShareAmount);
            await modules.vault.connect(manager).mintToken(user2.address, user2ShareAmount);
        });

        it("should allow manager to distribute dividend with valid signature", async function () {
            // Create signature
            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256"],
                [await testVault.getAddress(), dividendAmount]
            );
            const signature = await validator.signMessage(ethers.getBytes(payload));

            // Approve reward tokens
            await rewardToken.connect(manager).approve(await testAccumulatedYield.getAddress(), dividendAmount);

            await expect(
                testAccumulatedYield.connect(manager).distributeDividend(dividendAmount, signature)
            ).to.emit(testAccumulatedYield, "DividendDistributed");

            expect(await testAccumulatedYield.totalDividend()).to.equal(dividendAmount);
        });

        it("should reject distribution with invalid signature", async function () {
            // Create invalid signature (wrong signer)
            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256"],
                [await vault.getAddress(), dividendAmount]
            );
            const signature = await user1.signMessage(ethers.getBytes(payload));

            await rewardToken.connect(manager).approve(await testAccumulatedYield.getAddress(), dividendAmount);

            await expect(
                testAccumulatedYield.connect(manager).distributeDividend(dividendAmount, signature)
            ).to.be.revertedWith("AccumulatedYield: invalid signature");
        });

        it("should reject distribution with zero amount", async function () {
            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256"],
                [await vault.getAddress(), 0]
            );
            const signature = await validator.signMessage(ethers.getBytes(payload));

            await expect(
                testAccumulatedYield.connect(manager).distributeDividend(0, signature)
            ).to.be.revertedWith("AccumulatedYield: invalid dividend amount");
        });

        it("should reject distribution by non-manager", async function () {
            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256"],
                [await vault.getAddress(), dividendAmount]
            );
            const signature = await validator.signMessage(ethers.getBytes(payload));

            await rewardToken.connect(manager).approve(await testAccumulatedYield.getAddress(), dividendAmount);

            await expect(
                testAccumulatedYield.connect(user1).distributeDividend(dividendAmount, signature)
            ).to.be.revertedWith("AccumulatedYield: only manager");
        });

        it("should reject distribution when pool is inactive", async function () {
            // Deactivate pool
            await testAccumulatedYield.connect(manager).updateGlobalPoolStatus(false);

            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256"],
                [await vault.getAddress(), dividendAmount]
            );
            const signature = await validator.signMessage(ethers.getBytes(payload));

            await rewardToken.connect(manager).approve(await testAccumulatedYield.getAddress(), dividendAmount);

            await expect(
                testAccumulatedYield.connect(manager).distributeDividend(dividendAmount, signature)
            ).to.be.revertedWith("AccumulatedYield: pool not active");
        });
    });

    describe("User Operations", function () {
        let testAccumulatedYield: any;
        let testVault: any;
        let testShareToken: any;

        beforeEach(async function () {
            // Reset EVM time to a clean state
            await resetEVMTime();
            
            // Create new modules
            const modules = await createModules(manager, validator, dividendTreasury);
            testVault = modules.vault;
            testShareToken = modules.shareToken;
            testAccumulatedYield = modules.accumulatedYield;

            // Give users share tokens through vault first
            await testVault.connect(manager).mintToken(user1.address, user1ShareAmount);
            await testVault.connect(manager).mintToken(user2.address, user2ShareAmount);
            
            // Simulate user transfer to trigger updateUserPoolsOnTransfer
            // Transfer a small amount to initialize user pools
            await testShareToken.connect(user1).transfer(user3.address, ethers.parseUnits("1", SHARE_TOKEN_DECIMALS));
            await testShareToken.connect(user2).transfer(user3.address, ethers.parseUnits("1", SHARE_TOKEN_DECIMALS));

            // Now distribute dividends (after users have tokens)
            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256"],
                [await testVault.getAddress(), dividendAmount]
            );
            const signature = await validator.signMessage(ethers.getBytes(payload));
            await rewardToken.connect(manager).approve(await testAccumulatedYield.getAddress(), dividendAmount);
            await testAccumulatedYield.connect(manager).distributeDividend(dividendAmount, signature);
        });

        it("should allow user to claim rewards", async function () {
            const initialBalance = await rewardToken.balanceOf(user1.address);
            const pendingReward = await testAccumulatedYield.pendingReward(user1.address);

            expect(pendingReward).to.be.gt(0);

            await expect(
                testAccumulatedYield.connect(user1).claimReward()
            ).to.emit(testAccumulatedYield, "RewardClaimed");

            expect(await rewardToken.balanceOf(user1.address)).to.equal(initialBalance + pendingReward);
            expect(await testAccumulatedYield.pendingReward(user1.address)).to.equal(0);
        });

        it("should reject claim when no pending rewards", async function () {
            // First claim the reward successfully
            const initialBalance = await rewardToken.balanceOf(user1.address);
            const pendingReward = await testAccumulatedYield.pendingReward(user1.address);
            
            await expect(
                testAccumulatedYield.connect(user1).claimReward()
            ).to.emit(testAccumulatedYield, "RewardClaimed");

            expect(await rewardToken.balanceOf(user1.address)).to.equal(initialBalance + pendingReward);
            expect(await testAccumulatedYield.pendingReward(user1.address)).to.equal(0);
            
            // Now try to claim again - should fail because no pending rewards
            await expect(
                testAccumulatedYield.connect(user1).claimReward()
            ).to.be.revertedWith("AccumulatedYield: no pending reward");
        });

        it("should reject claim when pool is inactive", async function () {
            // Deactivate pool
            await testAccumulatedYield.connect(manager).updateGlobalPoolStatus(false);

            await expect(
                testAccumulatedYield.connect(user1).claimReward()
            ).to.be.revertedWith("AccumulatedYield: pool not active");
        });

        it("should correctly calculate pending rewards for multiple users", async function () {
            // Simulate transfers to trigger updateUserPoolsOnTransfer
            await testShareToken.connect(user1).transfer(user3.address, ethers.parseUnits("1", SHARE_TOKEN_DECIMALS));
            await testShareToken.connect(user2).transfer(user3.address, ethers.parseUnits("1", SHARE_TOKEN_DECIMALS));

            const user1Pending = await testAccumulatedYield.pendingReward(user1.address);
            const user2Pending = await testAccumulatedYield.pendingReward(user2.address);

            // User2 should have more pending rewards since they have more shares
            expect(user2Pending).to.be.gt(user1Pending);
        });
    });

    describe("Token Transfer Operations", function () {
        let testAccumulatedYield: any;
        let testVault: any;
        let testShareToken: any;

        beforeEach(async function () {
            // Reset EVM time to a clean state
            await resetEVMTime();
            
            // Create new modules
            const modules = await createModules(manager, validator, dividendTreasury);
            testAccumulatedYield = modules.accumulatedYield;
            testVault = modules.vault;
            testShareToken = modules.shareToken;

            // Give users share tokens through vault first
            await testVault.connect(manager).mintToken(user1.address, user1ShareAmount);
            await testVault.connect(manager).mintToken(user2.address, user2ShareAmount);

            // Setup: distribute some dividends
            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256"],
                [await testVault.getAddress(), dividendAmount]
            );
            const signature = await validator.signMessage(ethers.getBytes(payload));
            await rewardToken.connect(manager).approve(await testAccumulatedYield.getAddress(), dividendAmount);
            await testAccumulatedYield.connect(manager).distributeDividend(dividendAmount, signature);
        });

        it("should update user pools on token transfer", async function () {
            // Initial state
            const initialUser1Info = await testAccumulatedYield.getUserInfo(user1.address);
            const initialUser2Info = await testAccumulatedYield.getUserInfo(user2.address);

            // Transfer tokens - this should trigger updateUserPoolsOnTransfer through VaultToken._beforeTokenTransfer
            const transferAmount = ethers.parseUnits("100", SHARE_TOKEN_DECIMALS);
            await testShareToken.connect(user1).transfer(user2.address, transferAmount);

            // Check that user pools were updated
            const updatedUser1Info = await testAccumulatedYield.getUserInfo(user1.address);
            const updatedUser2Info = await testAccumulatedYield.getUserInfo(user2.address);

            expect(updatedUser1Info.accumulatedShares).to.be.gt(initialUser1Info.accumulatedShares);
            expect(updatedUser2Info.accumulatedShares).to.be.gt(initialUser2Info.accumulatedShares);
        });

        it("should reject updateUserPoolsOnTransfer from non-share token", async function () {
            await expect(
                testAccumulatedYield.connect(user1).updateUserPoolsOnTransfer(
                    user1.address,
                    user2.address,
                    ethers.parseUnits("100", SHARE_TOKEN_DECIMALS)
                )
            ).to.be.revertedWith("AccumulatedYield: only vault can call");
        });

        it("should handle mint operations correctly", async function () {
            // Mint tokens to user1 - mint operations don't trigger updateUserPoolsOnTransfer
            const mintAmount = ethers.parseUnits("500", SHARE_TOKEN_DECIMALS);
            await testVault.connect(manager).mintToken(user1.address, mintAmount);

            // User should have tokens but no accumulated shares until they participate in dividends
            const userInfo = await testAccumulatedYield.getUserInfo(user1.address);
            expect(userInfo.accumulatedShares).to.equal(0);
            
            // After a transfer, user should have accumulated shares
            await testShareToken.connect(user1).transfer(user3.address, ethers.parseUnits("1", SHARE_TOKEN_DECIMALS));
            const updatedUserInfo = await testAccumulatedYield.getUserInfo(user1.address);
            expect(updatedUserInfo.accumulatedShares).to.be.gt(0);
        });

        it("should handle burn operations correctly", async function () {
            // First give user1 some tokens and trigger a transfer to initialize accumulated shares
            await testVault.connect(manager).mintToken(user1.address, user1ShareAmount);
            await testShareToken.connect(user1).transfer(user3.address, ethers.parseUnits("1", SHARE_TOKEN_DECIMALS));

            const initialUserInfo = await testAccumulatedYield.getUserInfo(user1.address);
            expect(initialUserInfo.accumulatedShares).to.be.gt(0);

            // Approve vault to burn tokens (required for burn operation)
            const user1Balance = await testShareToken.balanceOf(user1.address);
            await testShareToken.connect(user1).approve(await testVault.getAddress(), user1Balance);

            // Burn tokens from user1 - burn operations don't trigger updateUserPoolsOnTransfer
            const burnAmount = ethers.parseUnits("100", SHARE_TOKEN_DECIMALS);
            await testVault.connect(manager).burnToken(user1.address, burnAmount);

            // User should still have the same accumulated shares after burn
            const updatedUserInfo = await testAccumulatedYield.getUserInfo(user1.address);
            expect(updatedUserInfo.accumulatedShares).to.equal(initialUserInfo.accumulatedShares);
        });
    });

    describe("Query Interface", function () {
        let testAccumulatedYield: any;
        let testVault: any;
        let testShareToken: any;

        beforeEach(async function () {
            // Reset EVM time to a clean state
            await resetEVMTime();
            
            // Create new modules
            const modules = await createModules(manager, validator, dividendTreasury);
            testAccumulatedYield = modules.accumulatedYield;
            testVault = modules.vault;
            testShareToken = modules.shareToken;
        });

        it("should return correct global pool info", async function () {
            const globalPool = await testAccumulatedYield.getGlobalPoolInfo();
            
            expect(globalPool.shareToken).to.equal(await testShareToken.getAddress());
            expect(globalPool.rewardToken).to.equal(await rewardToken.getAddress());
            expect(globalPool.isActive).to.be.true;
            expect(globalPool.totalAccumulatedShares).to.equal(0);
            expect(globalPool.totalDividend).to.equal(0);
        });

        it("should return correct user info", async function () {
            const userInfo = await testAccumulatedYield.getUserInfo(user1.address);
            
            expect(userInfo.accumulatedShares).to.equal(0);
            expect(userInfo.lastClaimTime).to.equal(0);
            expect(userInfo.lastClaimDividend).to.equal(0);
            expect(userInfo.totalClaimed).to.equal(0);
        });

        it("should return correct pending rewards", async function () {
            // Initially no pending rewards
            expect(await testAccumulatedYield.pendingReward(user1.address)).to.equal(0);

            // First give user tokens
            await testVault.connect(manager).mintToken(user1.address, user1ShareAmount);
            
            // Then distribute dividends (this updates globalPool.totalAccumulatedShares based on totalSupply)
            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256"],
                [await testVault.getAddress(), dividendAmount]
            );
            const signature = await validator.signMessage(ethers.getBytes(payload));
            await rewardToken.connect(manager).approve(await testAccumulatedYield.getAddress(), dividendAmount);
            await testAccumulatedYield.connect(manager).distributeDividend(dividendAmount, signature);

            // Trigger transfer to update user pool (this updates user.accumulatedShares)
            await testShareToken.connect(user1).transfer(user3.address, ethers.parseUnits("1", SHARE_TOKEN_DECIMALS));

            const pendingReward = await testAccumulatedYield.pendingReward(user1.address);
            expect(pendingReward).to.be.gt(0);
        });

        it("should return correct total dividend", async function () {
            expect(await testAccumulatedYield.totalDividend()).to.equal(0);

            // After distributing dividends
            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256"],
                [await testVault.getAddress(), dividendAmount]
            );
            const signature = await validator.signMessage(ethers.getBytes(payload));
            await rewardToken.connect(manager).approve(await testAccumulatedYield.getAddress(), dividendAmount);
            await testAccumulatedYield.connect(manager).distributeDividend(dividendAmount, signature);

            expect(await testAccumulatedYield.totalDividend()).to.equal(dividendAmount);
        });

        it("should return correct total accumulated shares", async function () {
            expect(await testAccumulatedYield.totalAccumulatedShares()).to.equal(0);

            // First give user tokens
            await testVault.connect(manager).mintToken(user1.address, user1ShareAmount);
            
            // Then distribute dividends (this updates globalPool.totalAccumulatedShares based on totalSupply)
            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256"],
                [await testVault.getAddress(), dividendAmount]
            );
            const signature = await validator.signMessage(ethers.getBytes(payload));
            await rewardToken.connect(manager).approve(await testAccumulatedYield.getAddress(), dividendAmount);
            await testAccumulatedYield.connect(manager).distributeDividend(dividendAmount, signature);

            const totalShares = await testAccumulatedYield.totalAccumulatedShares();
            expect(totalShares).to.be.gt(0);
        });

        it("should calculate accumulated shares correctly", async function () {
            // Distribute dividends first
            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256"],
                [await testVault.getAddress(), dividendAmount]
            );
            const signature = await validator.signMessage(ethers.getBytes(payload));
            await rewardToken.connect(manager).approve(await testAccumulatedYield.getAddress(), dividendAmount);
            await testAccumulatedYield.connect(manager).distributeDividend(dividendAmount, signature);

            // Calculate accumulated shares for user with specific balance
            const userBalance = ethers.parseUnits("1000", SHARE_TOKEN_DECIMALS);
            const accumulatedShares = await testAccumulatedYield.calculateAccumulatedShares(user1.address, userBalance);
            
            expect(accumulatedShares).to.be.gt(0);
        });

        it("should return zero for uninitialized contract", async function () {
            const uninitializedYield = await (await ethers.getContractFactory("AccumulatedYield")).deploy();
            
            expect(await uninitializedYield.pendingReward(user1.address)).to.equal(0);
            expect(await uninitializedYield.calculateAccumulatedShares(user1.address, user1ShareAmount)).to.equal(0);
        });
    });

    describe("Complex Scenarios", function () {
        let testAccumulatedYield: any;
        let testVault: any;
        let testShareToken: any;

        beforeEach(async function () {
            // Reset EVM time to a clean state
            await resetEVMTime();
            
            // Create new modules
            const modules = await createModules(manager, validator, dividendTreasury);
            testAccumulatedYield = modules.accumulatedYield;
            testVault = modules.vault;
            testShareToken = modules.shareToken;
        });

        it("should handle multiple dividend distributions correctly", async function () {
            // Give users share tokens
            await testVault.connect(manager).mintToken(user1.address, user1ShareAmount);
            await testVault.connect(manager).mintToken(user2.address, user2ShareAmount);

            // First dividend distribution
            const dividend1 = ethers.parseUnits("5000", TOKEN_DECIMALS);
            const payload1 = ethers.solidityPackedKeccak256(
                ["address", "uint256"],
                [await testVault.getAddress(), dividend1]
            );
            const signature1 = await validator.signMessage(ethers.getBytes(payload1));
            await rewardToken.connect(manager).approve(await testAccumulatedYield.getAddress(), dividend1);
            await testAccumulatedYield.connect(manager).distributeDividend(dividend1, signature1);

            // Trigger transfers to update user pools
            await testShareToken.connect(user1).transfer(user3.address, ethers.parseUnits("1", SHARE_TOKEN_DECIMALS));
            await testShareToken.connect(user2).transfer(user3.address, ethers.parseUnits("1", SHARE_TOKEN_DECIMALS));

            // Second dividend distribution
            const dividend2 = ethers.parseUnits("3000", TOKEN_DECIMALS);
            const payload2 = ethers.solidityPackedKeccak256(
                ["address", "uint256"],
                [await testVault.getAddress(), dividend2]
            );
            const signature2 = await validator.signMessage(ethers.getBytes(payload2));
            await rewardToken.connect(manager).approve(await testAccumulatedYield.getAddress(), dividend2);
            await testAccumulatedYield.connect(manager).distributeDividend(dividend2, signature2);

            // Check total dividend
            expect(await testAccumulatedYield.totalDividend()).to.equal(dividend1 + dividend2);

            // Users should have pending rewards
            const user1Pending = await testAccumulatedYield.pendingReward(user1.address);
            const user2Pending = await testAccumulatedYield.pendingReward(user2.address);

            expect(user1Pending).to.be.gt(0);
            expect(user2Pending).to.be.gt(0);
            expect(user2Pending).to.be.gt(user1Pending); // User2 has more shares
        });

        it("should handle token transfers between users correctly", async function () {
            // Give users share tokens first
            await testVault.connect(manager).mintToken(user1.address, user1ShareAmount);
            await testVault.connect(manager).mintToken(user2.address, user2ShareAmount);
            
            // Then distribute dividends
            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256"],
                [await testVault.getAddress(), dividendAmount]
            );
            const signature = await validator.signMessage(ethers.getBytes(payload));
            await rewardToken.connect(manager).approve(await testAccumulatedYield.getAddress(), dividendAmount);
            await testAccumulatedYield.connect(manager).distributeDividend(dividendAmount, signature);

            // Trigger transfers to update initial pools
            await testShareToken.connect(user1).transfer(user3.address, ethers.parseUnits("1", SHARE_TOKEN_DECIMALS));
            await testShareToken.connect(user2).transfer(user3.address, ethers.parseUnits("1", SHARE_TOKEN_DECIMALS));

            // Transfer tokens from user1 to user2
            const transferAmount = ethers.parseUnits("100", SHARE_TOKEN_DECIMALS);
            await testShareToken.connect(user1).transfer(user2.address, transferAmount);

            // Both users should have accumulated shares
            const user1Info = await testAccumulatedYield.getUserInfo(user1.address);
            const user2Info = await testAccumulatedYield.getUserInfo(user2.address);

            expect(user1Info.accumulatedShares).to.be.gt(0);
            expect(user2Info.accumulatedShares).to.be.gt(0);
        });

        it("should handle claim and transfer sequence correctly", async function () {
            // Give user1 share tokens first
            await testVault.connect(manager).mintToken(user1.address, user1ShareAmount);
            
            // Then distribute dividends
            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256"],
                [await testVault.getAddress(), dividendAmount]
            );
            const signature = await validator.signMessage(ethers.getBytes(payload));
            await rewardToken.connect(manager).approve(await testAccumulatedYield.getAddress(), dividendAmount);
            await testAccumulatedYield.connect(manager).distributeDividend(dividendAmount, signature);

            // Trigger transfer to update user1's pool
            await testShareToken.connect(user1).transfer(user3.address, ethers.parseUnits("1", SHARE_TOKEN_DECIMALS));

            // User1 claims rewards
            const initialBalance = await rewardToken.balanceOf(user1.address);
            await testAccumulatedYield.connect(user1).claimReward();
            expect(await rewardToken.balanceOf(user1.address)).to.be.gt(initialBalance);

            // Transfer tokens to user2
            const transferAmount = ethers.parseUnits("100", SHARE_TOKEN_DECIMALS);
            await testShareToken.connect(user1).transfer(user2.address, transferAmount);

            // User2 should have tokens but no accumulated shares (since they had no tokens during dividend distribution)
            const user2Balance = await testShareToken.balanceOf(user2.address);
            const user2Info = await testAccumulatedYield.getUserInfo(user2.address);
            
            expect(user2Balance).to.equal(transferAmount);
            expect(user2Info.accumulatedShares).to.equal(0);
        });
    });
});
