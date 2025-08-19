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
        const MockUSDTFactory = await ethers.getContractFactory("contracts/v2/mocks/MockUSDT.sol:MockUSDT");
        rewardToken = await MockUSDTFactory.deploy("Test USDT", "USDT");

        // Mint initial tokens
        await rewardToken.mint(manager.address, initialRewardTokenSupply);
        await rewardToken.mint(dividendTreasury.address, initialRewardTokenSupply);
        
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
    async function prepareOffChainDepositSignature(amount: any, receiver: any, crowdsaleAddress: any) {
        // Off-chain deposit signature: keccak256(abi.encodePacked("offChainDeposit", amount, receiver, chainId, contractAddress))
        const payload = ethers.keccak256(ethers.solidityPacked(
            ["string", "uint256", "address", "uint256", "address"],
            ["offChainDeposit", amount, receiver, await ethers.provider.getNetwork().then(net => net.chainId), crowdsaleAddress]
        ));
        return await validator.signMessage(ethers.getBytes(payload));
    }

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
        
        // Deploy Crowdsale contract
        const CrowdsaleFactory = await ethers.getContractFactory("Crowdsale");
        const newCrowdsale = await CrowdsaleFactory.deploy();
        
        // Initialize Crowdsale with test parameters
        const currentTime = Math.floor(Date.now() / 1000);
        const startTime = currentTime;
        const endTime = currentTime + 86400; // 24 hours from now
        const maxSupply = ethers.parseUnits("10000", SHARE_TOKEN_DECIMALS);
        const softCap = ethers.parseUnits("1000", SHARE_TOKEN_DECIMALS);
        const sharePrice = ethers.parseUnits("1", SHARE_TOKEN_DECIMALS); // 1 USDT per share, 6 decimals
        const minDepositAmount = ethers.parseUnits("10", 6); // 10 USDT minimum
        const manageFeeBps = 1000; // 10% management fee
        const decimalsMultiplier = 1; // 直接用 1，和 shareToken decimals 保持一致
        
        const crowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "uint256", "address"],
            [startTime, endTime, await rewardToken.getAddress(), maxSupply, softCap, sharePrice, minDepositAmount, manageFeeBps, manager.address, manager.address, decimalsMultiplier, manager.address]
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
        let modules: any;
        beforeEach(async function () {
            // Reset EVM time to a clean state
            await resetEVMTime();
            
            // Create new modules
            modules = await createModules(manager, validator, dividendTreasury);
        });

        it("should initialize global pool correctly", async function () {
            const yieldInitData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "address", "address"],
                [await rewardToken.getAddress(), manager.address, dividendTreasury.address]
            );
            await accumulatedYield.initiate(await modules.vault.getAddress(), await modules.shareToken.getAddress(), yieldInitData);

            const globalPool = await accumulatedYield.getGlobalPoolInfo();
            expect(globalPool.shareToken).to.equal(await modules.shareToken.getAddress());
            expect(globalPool.rewardToken).to.equal(await rewardToken.getAddress());
            expect(globalPool.isActive).to.be.false; // 初始化时应该为false
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
            await accumulatedYield.initiate(await modules.vault.getAddress(), await modules.shareToken.getAddress(), yieldInitData);

            await expect(
                accumulatedYield.connect(manager).initiate(await modules.vault.getAddress(), await modules.shareToken.getAddress(), yieldInitData)
            ).to.be.revertedWith("AccumulatedYield: already initialized");
        });

        it("should reject invalid initialization parameters", async function () {
            // Invalid vault address
            const yieldInitData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "address", "address"],
                [await rewardToken.getAddress(), manager.address, dividendTreasury.address]
            );
            await expect(
                accumulatedYield.initiate(ethers.ZeroAddress, await modules.shareToken.getAddress(), yieldInitData)
            ).to.be.revertedWith("AccumulatedYield: invalid vault");

            // Invalid manager address
            const invalidManagerYieldInitData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "address", "address"],
                [await rewardToken.getAddress(), ethers.ZeroAddress, dividendTreasury.address]
            );
            await expect(
                accumulatedYield.initiate(await modules.vault.getAddress(), await modules.shareToken.getAddress(), invalidManagerYieldInitData)
            ).to.be.revertedWith("AccumulatedYield: invalid manager");
        });
    });

    describe("Management Operations", function () {
        let testAccumulatedYield: any;
        let modules: any;

        beforeEach(async function () {
            // Reset EVM time to a clean state
            await resetEVMTime();
            
            // Create new modules
            modules = await createModules(manager, validator, dividendTreasury);
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
        let modules: any;

        beforeEach(async function () {
            // Reset EVM time to a clean state
            await resetEVMTime();
            
            // Create new modules
            modules = await createModules(manager, validator, dividendTreasury);
            testAccumulatedYield = modules.accumulatedYield;
            testVault = modules.vault;
            testShareToken = modules.shareToken;

            // Setup: give some share tokens to users through Crowdsale
            const depositAmount1 = ethers.parseUnits("5000", 6); // 5000 USDT for user1
            
            // Use off-chain deposit to mint tokens for users
            const offChainSignature1 = await prepareOffChainDepositSignature(depositAmount1, user1.address, await modules.crowdsale.getAddress());
            
            // Approve token for deposit
            await rewardToken.connect(manager).approve(await modules.crowdsale.getAddress(), depositAmount1);
            await modules.crowdsale.connect(manager).offChainDeposit(depositAmount1, user1.address, offChainSignature1);
        });

        it("should allow manager to distribute dividend with valid signature", async function () {
            // Activate pool
            await testAccumulatedYield.connect(manager).updateGlobalPoolStatus(true);
            expect(await modules.crowdsale.isFundingSuccessful()).to.be.true;

            // Create signature
            const dividendNonce = await testAccumulatedYield.connect(dividendTreasury).getDividendNonce();
            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256", "uint256"],
                [await testVault.getAddress(), dividendAmount, dividendNonce]
            );
            const signature = await validator.signMessage(ethers.getBytes(payload));

            // Approve reward tokens
            await rewardToken.connect(dividendTreasury).approve(await testAccumulatedYield.getAddress(), dividendAmount);

            await expect(
                testAccumulatedYield.connect(dividendTreasury).distributeDividend(dividendAmount, signature)
            ).to.emit(testAccumulatedYield, "DividendDistributed");

            expect(await testAccumulatedYield.totalDividend()).to.equal(dividendAmount);
        });

        it("should reject distribution with invalid signature", async function () {
            // Activate pool
            await testAccumulatedYield.connect(manager).updateGlobalPoolStatus(true);
            expect(await modules.crowdsale.isFundingSuccessful()).to.be.true;

            // Create invalid signature (wrong signer)
            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256"],
                [await vault.getAddress(), dividendAmount]
            );
            const signature = await user1.signMessage(ethers.getBytes(payload));

            await rewardToken.connect(dividendTreasury).approve(await testAccumulatedYield.getAddress(), dividendAmount);

            await expect(
                testAccumulatedYield.connect(dividendTreasury).distributeDividend(dividendAmount, signature)
            ).to.be.revertedWith("AccumulatedYield: invalid signature");
        });

        it("should reject distribution with zero amount", async function () {
            // Activate pool
            await testAccumulatedYield.connect(manager).updateGlobalPoolStatus(true);
            expect(await modules.crowdsale.isFundingSuccessful()).to.be.true;

            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256"],
                [await vault.getAddress(), 0]
            );
            const signature = await validator.signMessage(ethers.getBytes(payload));

            await expect(
                testAccumulatedYield.connect(dividendTreasury).distributeDividend(0, signature)
            ).to.be.revertedWith("AccumulatedYield: invalid dividend amount");
        });

        it("should reject distribution by non-manager", async function () {
            // Activate pool
            await testAccumulatedYield.connect(manager).updateGlobalPoolStatus(true);
            expect(await modules.crowdsale.isFundingSuccessful()).to.be.true;

            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256"],
                [await vault.getAddress(), dividendAmount]
            );
            const signature = await validator.signMessage(ethers.getBytes(payload));

            await rewardToken.connect(dividendTreasury).approve(await testAccumulatedYield.getAddress(), dividendAmount);

            await expect(
                testAccumulatedYield.connect(user1).distributeDividend(dividendAmount, signature)
            ).to.be.revertedWith("AccumulatedYield: only dividend treasury");
        });

        it("should reject distribution when pool is inactive", async function () {
            // Deactivate pool
            await testAccumulatedYield.connect(manager).updateGlobalPoolStatus(false);

            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256"],
                [await vault.getAddress(), dividendAmount]
            );
            const signature = await validator.signMessage(ethers.getBytes(payload));

            await rewardToken.connect(dividendTreasury).approve(await testAccumulatedYield.getAddress(), dividendAmount);

            await expect(
                testAccumulatedYield.connect(dividendTreasury).distributeDividend(dividendAmount, signature)
            ).to.be.revertedWith("AccumulatedYield: pool not active");
        });
    });

    describe("User Operations", function () {
        let testAccumulatedYield: any;
        let testVault: any;
        let testShareToken: any;
        let modules: any;

        beforeEach(async function () {
            // Reset EVM time to a clean state
            await resetEVMTime();
            
            // Create new modules
            modules = await createModules(manager, validator, dividendTreasury);
            testVault = modules.vault;
            testShareToken = modules.shareToken;
            testAccumulatedYield = modules.accumulatedYield;

            // Give users share tokens through Crowdsale (since only funding module can mint)
            const depositAmount1 = ethers.parseUnits("5000", 6); // 5000 USDT for user1
            
            // Use off-chain deposit to mint tokens for users
            const offChainSignature1 = await prepareOffChainDepositSignature(depositAmount1, user1.address, await modules.crowdsale.getAddress());
            
            // Approve token for deposit
            await rewardToken.connect(manager).approve(await modules.crowdsale.getAddress(), depositAmount1);
            await modules.crowdsale.connect(manager).offChainDeposit(depositAmount1, user1.address, offChainSignature1);
            // Simulate user transfer to trigger updateUserPoolsOnTransfer
            // Transfer a small amount to initialize user pools
            // record user1 user2 shareToken balance            
            
            // Now distribute dividends (after users have tokens)
            // Activate pool
            await testAccumulatedYield.connect(manager).updateGlobalPoolStatus(true);
            expect(await modules.crowdsale.isFundingSuccessful()).to.be.true;

            const dividendNonce = await testAccumulatedYield.connect(dividendTreasury).getDividendNonce();
            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256", "uint256"],
                [await testVault.getAddress(), dividendAmount, dividendNonce]
            );
        
            const signature = await validator.signMessage(ethers.getBytes(payload));
            await rewardToken.connect(dividendTreasury).approve(await testAccumulatedYield.getAddress(), dividendAmount);
            await testAccumulatedYield.connect(dividendTreasury).distributeDividend(dividendAmount, signature);
        });

        it("should allow user to claim rewards", async function () {
            // Activate pool
            await testAccumulatedYield.connect(manager).updateGlobalPoolStatus(true);
            expect(await modules.crowdsale.isFundingSuccessful()).to.be.true;

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
            // Activate pool
            await testAccumulatedYield.connect(manager).updateGlobalPoolStatus(true);
            expect(await modules.crowdsale.isFundingSuccessful()).to.be.true;

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
            // Activate pool
            await testAccumulatedYield.connect(manager).updateGlobalPoolStatus(true);
            expect(await modules.crowdsale.isFundingSuccessful()).to.be.true;

            // Simulate transfers to trigger updateUserPoolsOnTransfer
            await testShareToken.connect(user1).transfer(user2.address, ethers.parseUnits("1000", SHARE_TOKEN_DECIMALS));
            
            await testShareToken.connect(user1).transfer(user3.address, ethers.parseUnits("1", SHARE_TOKEN_DECIMALS));

            // distribute dividend
            const dividendNonce = await testAccumulatedYield.connect(dividendTreasury).getDividendNonce();
            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256", "uint256"],
                [await testVault.getAddress(), dividendAmount, dividendNonce]
            );
            const signature = await validator.signMessage(ethers.getBytes(payload));
            await rewardToken.connect(dividendTreasury).approve(await testAccumulatedYield.getAddress(), dividendAmount);
            await testAccumulatedYield.connect(dividendTreasury).distributeDividend(dividendAmount, signature);
            

            const user2Pending = await testAccumulatedYield.pendingReward(user2.address);
            const user3Pending = await testAccumulatedYield.pendingReward(user3.address);

            // User2 should have more pending rewards since they have more shares
            expect(user2Pending).to.be.gt(user3Pending);
        });
    });

        describe("Token Transfer Operations", function () {
        let testAccumulatedYield: any;
        let testVault: any;
        let testShareToken: any;
        let testCrowdsale: any;
        let modules: any;

        beforeEach(async function () {
            // Reset EVM time to a clean state
            await resetEVMTime();
            
            // Create new modules
            modules = await createModules(manager, validator, dividendTreasury);
            testAccumulatedYield = modules.accumulatedYield;
            testVault = modules.vault;
            testShareToken = modules.shareToken;
            testCrowdsale = modules.crowdsale;

            // Give users share tokens through Crowdsale (since only funding module can mint)
            const depositAmount1 = ethers.parseUnits("5000", 6); // 5000 USDT for user1
            
            // Use off-chain deposit to mint tokens for users
            const offChainSignature1 = await prepareOffChainDepositSignature(depositAmount1, user1.address, await modules.crowdsale.getAddress());
            
            // Approve token for deposit
            await rewardToken.connect(manager).approve(await modules.crowdsale.getAddress(), depositAmount1);
            await modules.crowdsale.connect(manager).offChainDeposit(depositAmount1, user1.address, offChainSignature1);

            // Setup: distribute some dividends
            // Activate pool
            await testAccumulatedYield.connect(manager).updateGlobalPoolStatus(true);
            expect(await modules.crowdsale.isFundingSuccessful()).to.be.true;

            const dividendNonce = await testAccumulatedYield.connect(dividendTreasury).getDividendNonce();
            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256", "uint256"],
                [await testVault.getAddress(), dividendAmount, dividendNonce]
            );
            const signature = await validator.signMessage(ethers.getBytes(payload));
            await rewardToken.connect(dividendTreasury).approve(await testAccumulatedYield.getAddress(), dividendAmount);
            await testAccumulatedYield.connect(dividendTreasury).distributeDividend(dividendAmount, signature);
        });

        it("should update user pools on token transfer after funding success", async function () {
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
            expect(updatedUser2Info.accumulatedShares).to.be.equal(0);
        });
    });

    describe("Query Interface", function () {
        let testAccumulatedYield: any;
        let testVault: any;
        let testShareToken: any;
        let modules: any;

        beforeEach(async function () {
            // Reset EVM time to a clean state
            await resetEVMTime();
            
            // Create new modules
            modules = await createModules(manager, validator, dividendTreasury);
            testAccumulatedYield = modules.accumulatedYield;
            testVault = modules.vault;
            testShareToken = modules.shareToken;
            // Crowdsale funding success
            const depositAmount = ethers.parseUnits("5000", 6);
            const offChainSignature = await prepareOffChainDepositSignature(depositAmount, user1.address, await modules.crowdsale.getAddress());
            // Approve token for deposit
            await rewardToken.connect(manager).approve(await modules.crowdsale.getAddress(), depositAmount);
            await modules.crowdsale.connect(manager).offChainDeposit(depositAmount, user1.address, offChainSignature);
        });

        it("should return correct global pool info", async function () {
            // Activate pool
            await testAccumulatedYield.connect(manager).updateGlobalPoolStatus(true);
            expect(await modules.crowdsale.isFundingSuccessful()).to.be.true;

            const globalPool = await testAccumulatedYield.getGlobalPoolInfo();
            
            expect(globalPool.shareToken).to.equal(await testShareToken.getAddress());
            expect(globalPool.rewardToken).to.equal(await rewardToken.getAddress());
            expect(globalPool.isActive).to.be.true;
            expect(globalPool.totalAccumulatedShares).to.equal(0);
            expect(globalPool.totalDividend).to.equal(0);
        });

        it("should return correct user info", async function () {
            // Activate pool
            await testAccumulatedYield.connect(manager).updateGlobalPoolStatus(true);
            expect(await modules.crowdsale.isFundingSuccessful()).to.be.true;

            const userInfo = await testAccumulatedYield.getUserInfo(user1.address);
            
            expect(userInfo.accumulatedShares).to.equal(0);
            expect(userInfo.lastClaimTime).to.equal(0);
            expect(userInfo.lastClaimDividend).to.equal(0);
            expect(userInfo.totalClaimed).to.equal(0);
        });



        it("should return correct total dividend", async function () {
            // Activate pool
            await testAccumulatedYield.connect(manager).updateGlobalPoolStatus(true);
            expect(await modules.crowdsale.isFundingSuccessful()).to.be.true;

            expect(await testAccumulatedYield.totalDividend()).to.equal(0);

            // After distributing dividends
            const dividendNonce = await testAccumulatedYield.connect(dividendTreasury).getDividendNonce();
            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256", "uint256"],
                [await testVault.getAddress(), dividendAmount, dividendNonce]
            );
            const signature = await validator.signMessage(ethers.getBytes(payload));
            await rewardToken.connect(dividendTreasury).approve(await testAccumulatedYield.getAddress(), dividendAmount);
            await testAccumulatedYield.connect(dividendTreasury).distributeDividend(dividendAmount, signature);

            expect(await testAccumulatedYield.totalDividend()).to.equal(dividendAmount);
        });



        it("should calculate accumulated shares correctly", async function () {
            // Activate pool
            await testAccumulatedYield.connect(manager).updateGlobalPoolStatus(true);
            expect(await modules.crowdsale.isFundingSuccessful()).to.be.true;

            // Distribute dividends first
            const dividendNonce = await testAccumulatedYield.connect(dividendTreasury).getDividendNonce();
            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256", "uint256"],
                [await testVault.getAddress(), dividendAmount, dividendNonce]
            );
            const signature = await validator.signMessage(ethers.getBytes(payload));
            await rewardToken.connect(dividendTreasury).approve(await testAccumulatedYield.getAddress(), dividendAmount);
            await testAccumulatedYield.connect(dividendTreasury).distributeDividend(dividendAmount, signature);

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


});
