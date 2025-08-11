import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { AccumulatedYield } from "../typechain-types/contracts/v2/templates/yield/AccumulatedYield";

describe("AccumulatedYield", function () {
    let accumulatedYield: AccumulatedYield;
    let shareToken: any; // Share token
    let rewardToken: any; // Reward token (USDT)
    let mockVault: any; // Mock Vault
    let owner: HardhatEthersSigner;
    let manager: HardhatEthersSigner;
    let dividendTreasury: HardhatEthersSigner;
    let validator: HardhatEthersSigner; // Signature validator
    let alice: HardhatEthersSigner;
    let bob: HardhatEthersSigner;
    let carol: HardhatEthersSigner;

    beforeEach(async function () {
        [owner, manager, dividendTreasury, validator, alice, bob, carol] = await ethers.getSigners();

        // Deploy Mock tokens
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        shareToken = await MockERC20Factory.deploy();
        rewardToken = await MockERC20Factory.deploy();

        // Deploy Mock Vault
        const MockVaultFactory = await ethers.getContractFactory("MockBasicVault");
        mockVault = await MockVaultFactory.deploy();

        // Set Vault's validator
        await mockVault.setValidator(validator.address);

        // Deploy AccumulatedYield contract
        const AccumulatedYieldFactory = await ethers.getContractFactory("AccumulatedYield");
        accumulatedYield = await AccumulatedYieldFactory.deploy();

        // Initialize AccumulatedYield
        await accumulatedYield.initGlobalPool(
            mockVault.address,
            manager.address,
            dividendTreasury.address,
            shareToken.address,
            rewardToken.address
        );

        // Mint tokens to users (simulate staking)
        await shareToken.mint(alice.address, ethers.parseEther("1000"));
        await shareToken.mint(bob.address, ethers.parseEther("2000"));

        // Mint enough USDT to manager for dividend distribution
        await rewardToken.mint(manager.address, ethers.parseUnits("10000", 6));

        // Manager authorizes AccumulatedYield contract to transfer USDT
        await rewardToken.connect(manager).approve(
            accumulatedYield.target,
            ethers.parseUnits("10000", 6)
        );

        // Set AccumulatedYield in share token
        await shareToken.setAccumulatedYield(accumulatedYield.target);
    });

    describe("Complete Flow Test", function () {
        it("Step 1-2: Verify initial state", async function () {
            // Verify initial pool state
            const poolInfo = await accumulatedYield.getGlobalPoolInfo();
            expect(poolInfo.isActive).to.be.true;
            expect(poolInfo.totalDividend).to.equal(0);
            expect(poolInfo.shareToken).to.equal(shareToken.address);
            expect(poolInfo.rewardToken).to.equal(rewardToken.address);

            // Verify user balances
            expect(await shareToken.balanceOf(alice.address)).to.equal(ethers.parseEther("1000"));
            expect(await shareToken.balanceOf(bob.address)).to.equal(ethers.parseEther("2000"));

            // Verify user information (initial state)
            const aliceInfo = await accumulatedYield.getUserInfo(alice.address);
            const bobInfo = await accumulatedYield.getUserInfo(bob.address);
            expect(aliceInfo.accumulatedShares).to.equal(0);
            expect(bobInfo.accumulatedShares).to.equal(0);
            expect(aliceInfo.totalClaimed).to.equal(0);
            expect(bobInfo.totalClaimed).to.equal(0);

            console.log("✓ Step 1-2: Initial state verification passed");
        });

        it("Step 3: Distribute dividend", async function () {
            const dividendAmount = ethers.parseUnits("1500", 6);

            // Create signature for dividend distribution
            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256"],
                [mockVault.address, dividendAmount]
            );
            const signature = await validator.signMessage(ethers.getBytes(payload));

            // Distribute dividend
            await accumulatedYield.connect(manager).distributeDividend(dividendAmount, signature);

            // Verify pool state after dividend
            const poolInfo = await accumulatedYield.getGlobalPoolInfo();
            expect(poolInfo.totalDividend).to.equal(dividendAmount);

            console.log("✓ Step 3: Dividend distribution passed");
        });

        it("Step 4: Alice transfers tokens to Carol", async function () {
            const transferAmount = ethers.parseEther("500");

            // Alice transfers 500 tokens to Carol
            await shareToken.connect(alice).transfer(carol.address, transferAmount);

            // Verify balances after transfer
            expect(await shareToken.balanceOf(alice.address)).to.equal(ethers.parseEther("500"));
            expect(await shareToken.balanceOf(carol.address)).to.equal(ethers.parseEther("500"));

            console.log("✓ Step 4: Token transfer passed");
        });

        it("Step 5: Claim rewards", async function () {
            // First distribute dividend
            const dividendAmount = ethers.parseUnits("1500", 6);
            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256"],
                [mockVault.address, dividendAmount]
            );
            const signature = await validator.signMessage(ethers.getBytes(payload));
            await accumulatedYield.connect(manager).distributeDividend(dividendAmount, signature);

            // Record initial balances
            const aliceInitialBalance = await rewardToken.balanceOf(alice.address);
            const bobInitialBalance = await rewardToken.balanceOf(bob.address);

            // Alice claims rewards
            await accumulatedYield.connect(alice).claimReward();

            // Bob claims rewards
            await accumulatedYield.connect(bob).claimReward();

            // Verify rewards were claimed
            expect(await rewardToken.balanceOf(alice.address)).to.be.gt(aliceInitialBalance);
            expect(await rewardToken.balanceOf(bob.address)).to.be.gt(bobInitialBalance);

            console.log("✓ Step 5: Reward claiming passed");
        });
    });

    describe("Signature Verification Test", function () {
        it("should verify signature correctly", async function () {
            const dividendAmount = ethers.parseUnits("1000", 6);
            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256"],
                [mockVault.address, dividendAmount]
            );
            const signature = await validator.signMessage(ethers.getBytes(payload));

            // Should succeed with valid signature
            await expect(
                accumulatedYield.connect(manager).distributeDividend(dividendAmount, signature)
            ).to.not.be.reverted;

            // Should fail with invalid signature
            const invalidSignature = await alice.signMessage(ethers.getBytes(payload));
            await expect(
                accumulatedYield.connect(manager).distributeDividend(dividendAmount, invalidSignature)
            ).to.be.revertedWith("AccumulatedYield: invalid signature");
        });
    });

    describe("Accumulated Shares Calculation Test", function () {
        it("should calculate accumulated shares correctly", async function () {
            // Distribute dividend first
            const dividendAmount = ethers.parseUnits("1500", 6);
            const payload = ethers.solidityPackedKeccak256(
                ["address", "uint256"],
                [mockVault.address, dividendAmount]
            );
            const signature = await validator.signMessage(ethers.getBytes(payload));
            await accumulatedYield.connect(manager).distributeDividend(dividendAmount, signature);

            // Calculate accumulated shares for Alice with 1000 tokens
            const aliceShares = await accumulatedYield.calculateAccumulatedShares(
                alice.address,
                ethers.parseEther("1000")
            );

            // Calculate accumulated shares for Bob with 2000 tokens
            const bobShares = await accumulatedYield.calculateAccumulatedShares(
                bob.address,
                ethers.parseEther("2000")
            );

            // Bob should have twice the shares of Alice (2x tokens)
            expect(bobShares).to.equal(aliceShares * 2n);

            console.log("✓ Accumulated shares calculation passed");
        });
    });
}); 