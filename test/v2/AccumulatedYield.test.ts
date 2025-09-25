import { expect } from "chai";
import { ethers, network } from "hardhat";
import { Signer, Contract } from "ethers";
import { 
  createVault, 
  createShareToken, 
  deployMockUSDT,
  deployValidatorRegistry, 
  deployShareToken,
  SHARE_TOKEN_DECIMALS,
  TOKEN_TRANSFER_ROLE,
  MANAGER_ROLE,
  DEFAULT_ADMIN_ROLE,
  createAccumulatedYield
} from "./helpers";

describe("AccumulatedYield", function () {
  // Test accounts
  let deployer: any;
  let manager: any;
  let validator: any;
  let user1: any;
  let user2: any;
  let user3: any;
  let dividendTreasury: any;
  let owner: any;
  
  // Contract instances
  let validatorRegistry: any;
  let coreVault: any;
  let crowdsale: any;
  let shareToken: any;
  let accumulatedYield: any;
  let mockUSDT: any;
  
  // Helper function to generate dividend signature
  async function generateDividendSignature(dividendAmount: bigint) {
    const nonce = await accumulatedYield.getDividendNonce();
    
    // Create signature data
    const payload = ethers.solidityPacked(
      ["address", "uint256", "uint256"],
      [await coreVault.getAddress(), dividendAmount, nonce]
    );
    
    // Calculate hash
    const messageHash = ethers.keccak256(payload);
    
    // Sign
    const signature = await validator.signMessage(ethers.getBytes(messageHash));
    
    return signature;
  }
  
  // Reset network and deploy contracts before each test
  beforeEach(async function() {
    [deployer, manager, validator, user1, user2, user3, dividendTreasury] = await ethers.getSigners();
    owner = manager;
    
    // Deploy MockUSDT as reward token
    mockUSDT = await deployMockUSDT();
   
    // Use temporary variable to store results for checking return values
    const result = await createAccumulatedYield(
      manager,
      validator,
      dividendTreasury,
      mockUSDT,
    );
    
    // Ensure all variables are correctly assigned
    validatorRegistry = result.validatorRegistry;
    coreVault = result.coreVault;
    shareToken = result.shareToken;
    crowdsale = result.crowdsale;
    accumulatedYield = result.accumulatedYield;
    
    // Check if accumulatedYield is properly initialized
    if (!accumulatedYield) {
      throw new Error("AccumulatedYield not properly initialized");
    }
    
    // Mint some USDT to dividendTreasury for dividends
    await mockUSDT.mint(await dividendTreasury.getAddress(), ethers.parseUnits("10000", 6));
    
    // Unpause ShareToken
    await coreVault.connect(manager).unpauseToken();
  });
  
  // Reset blockchain after all tests
  afterEach(async function () {
    // Reset Hardhat network
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    });
    
  });

  describe("Initialization and Deployment Tests", function () {
    it("should correctly initialize global pool information", async function () {
      const globalPool = await accumulatedYield.globalPool();
      expect(globalPool.totalAccumulatedShares).to.equal(0);
      expect(globalPool.totalDividend).to.equal(0);
      expect(globalPool.shareToken).to.equal(await shareToken.getAddress());
      expect(globalPool.rewardToken).to.equal(await mockUSDT.getAddress());
    });

    it("should set manager as owner", async function () {
      expect(await accumulatedYield.owner()).to.equal(manager.address);
    });

    it("should correctly set vault address", async function () {
      expect(await accumulatedYield.vault()).to.equal(await coreVault.getAddress());
    });

    it("should correctly set dividendTreasury address", async function () {
      expect(await accumulatedYield.dividendTreasury()).to.equal(dividendTreasury.address);
    });

    it("cannot be initialized twice", async function () {
      const initData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "address"],
        [await mockUSDT.getAddress(), manager.address, dividendTreasury.address]
      );

      await expect(
        accumulatedYield.initiate(await coreVault.getAddress(), await shareToken.getAddress(), initData)
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });
  
  describe("Dividend Tests", function () {
    it("dividend treasury can distribute dividends", async function () {
      // Prepare dividend amount
      const dividendAmount = ethers.parseUnits("100", 6);
      
      // Approve AccumulatedYield contract to use USDT
      await mockUSDT.connect(dividendTreasury).approve(
        await accumulatedYield.getAddress(),
        dividendAmount
      );
      
      // Generate signature
      const signature = await generateDividendSignature(dividendAmount);
      
      // State before distributing dividend
      const beforeTotalDividend = await accumulatedYield.totalDividend();
      const beforeTotalAccumulatedShares = await accumulatedYield.totalAccumulatedShares();
      const beforeNonce = await accumulatedYield.getDividendNonce();
      
      // Distribute dividend
      await accumulatedYield.connect(dividendTreasury).distributeDividend(dividendAmount, signature);
      
      // State after distributing dividend
      const afterTotalDividend = await accumulatedYield.totalDividend();
      const afterTotalAccumulatedShares = await accumulatedYield.totalAccumulatedShares();
      const afterNonce = await accumulatedYield.getDividendNonce();
      
      // Verify state changes
      expect(afterTotalDividend).to.equal(beforeTotalDividend + dividendAmount);
      expect(afterNonce).to.equal(beforeNonce + 1n);
      
      // Calculate expected accumulated shares increase
      const totalSupply = await shareToken.totalSupply();
      const expectedAccumulatedSharesIncrease = totalSupply * dividendAmount;
      
      expect(afterTotalAccumulatedShares).to.equal(beforeTotalAccumulatedShares + expectedAccumulatedSharesIncrease);
    });
    
    it("cannot distribute dividends with invalid signature", async function () {
      const dividendAmount = ethers.parseUnits("100", 6);
      
      // Use incorrect signer
      const invalidSignature = await user1.signMessage(ethers.getBytes(ethers.keccak256(
        ethers.solidityPacked(
          ["address", "uint256", "uint256"],
          [await coreVault.getAddress(), dividendAmount, await accumulatedYield.getDividendNonce()]
        )
      )));
      
      await expect(
        accumulatedYield.connect(dividendTreasury).distributeDividend(dividendAmount, invalidSignature)
      ).to.be.revertedWith("AccumulatedYield: invalid signature");
    });
    
    it("cannot reuse signature to distribute dividends", async function () {
      // Prepare dividend amount
      const dividendAmount = ethers.parseUnits("100", 6);
      
      // Approve AccumulatedYield contract to use USDT
      await mockUSDT.connect(dividendTreasury).approve(
        await accumulatedYield.getAddress(),
        dividendAmount * 2n
      );
      
      // Generate signature
      const signature = await generateDividendSignature(dividendAmount);
      
      // First distribution should succeed
      await accumulatedYield.connect(dividendTreasury).distributeDividend(dividendAmount, signature);
      
      // Attempt to use the same signature again, should fail
      await expect(
        accumulatedYield.connect(dividendTreasury).distributeDividend(dividendAmount, signature)
      ).to.be.revertedWith("AccumulatedYield: invalid signature");
    });
    
    it("cannot distribute dividends when paused", async function () {
      // Prepare dividend amount and signature
      const dividendAmount = ethers.parseUnits("100", 6);
      const signature = await generateDividendSignature(dividendAmount);
      
      // Pause contract
      await accumulatedYield.connect(manager).pause();
      
      // Attempt to distribute dividend, should fail
      await expect(
        accumulatedYield.connect(dividendTreasury).distributeDividend(dividendAmount, signature)
      ).to.be.revertedWithCustomError(accumulatedYield, "EnforcedPause");
    });

  });

  describe("Reward Claiming Tests", function () {
    let dividendAmount: bigint;
    let signature: string;
    beforeEach(async function() {
      // Fully funded, financing completed
      await crowdsale.connect(manager).offChainDeposit(ethers.parseUnits("20000", SHARE_TOKEN_DECIMALS), manager.address);
      
      // Transfer some tokens to users
      await shareToken.connect(manager).transfer(user1.address, ethers.parseUnits("2000", SHARE_TOKEN_DECIMALS));
      await shareToken.connect(manager).transfer(user2.address, ethers.parseUnits("1000", SHARE_TOKEN_DECIMALS));
      
      // Distribute some dividends
      dividendAmount = ethers.parseUnits("1500", 6);
      await mockUSDT.connect(dividendTreasury).approve(
        await accumulatedYield.getAddress(),
        dividendAmount
      );
    });
    
    it("users can query pending rewards", async function () {
      signature = await generateDividendSignature(dividendAmount);
      await accumulatedYield.connect(dividendTreasury).distributeDividend(dividendAmount, signature);
      const user1Balance = await shareToken.balanceOf(user1.address);
      const user2Balance = await shareToken.balanceOf(user2.address);

      const user1Pending = await accumulatedYield.pendingReward(user1.address);
      const user2Pending = await accumulatedYield.pendingReward(user2.address);
      
      // User1 holds 1000 tokens, User2 holds 500 tokens, total supply is 1500 tokens
      // For 1000 USDT dividend, User1 should get 1000 * (1000/1500) = 666.666... USDT
      // User2 should get 1000 * (500/1500) = 333.333... USDT
      const totalSupply = await shareToken.totalSupply();
      const expectedUser1Reward = dividendAmount * user1Balance / totalSupply;
      const expectedUser2Reward = dividendAmount * user2Balance / totalSupply;
      
      expect(user1Pending).to.be.closeTo(expectedUser1Reward, 10n); // Allow small error margin
      expect(user2Pending).to.be.closeTo(expectedUser2Reward, 10n); // Allow small error margin
    });
    
    it("users can claim rewards", async function () {
      signature = await generateDividendSignature(dividendAmount);
      await accumulatedYield.connect(dividendTreasury).distributeDividend(dividendAmount, signature);
      // Balance before claiming
      const beforeBalance = await mockUSDT.balanceOf(user1.address);
      const beforePending = await accumulatedYield.pendingReward(user1.address);
      
      // Claim reward
      await accumulatedYield.connect(user1).claimReward();
      
      // Balance after claiming
      const afterBalance = await mockUSDT.balanceOf(user1.address);
      const afterPending = await accumulatedYield.pendingReward(user1.address);
      
      // Verify balance changes
      expect(afterBalance - beforeBalance).to.equal(beforePending);
      expect(afterPending).to.equal(0);
      
      // Verify user info update
      const userInfo = await accumulatedYield.getUserInfo(user1.address);
      expect(userInfo.totalClaimed).to.equal(beforePending);
    });
    
    it("cannot claim when there is no pending reward", async function () {
      signature = await generateDividendSignature(dividendAmount);
      await accumulatedYield.connect(dividendTreasury).distributeDividend(dividendAmount, signature);
      // First claim the reward
      await accumulatedYield.connect(user1).claimReward();
      
      // Try to claim again, should fail
      await expect(
        accumulatedYield.connect(user1).claimReward()
      ).to.be.revertedWith("AccumulatedYield: no pending reward");
    });
    
    it("cannot claim rewards when paused", async function () {
      signature = await generateDividendSignature(dividendAmount);
      await accumulatedYield.connect(dividendTreasury).distributeDividend(dividendAmount, signature);
      // Pause the contract
      await accumulatedYield.connect(manager).pause();
      
      // Try to claim rewards, should fail
      await expect(
        accumulatedYield.connect(user1).claimReward()
      ).to.be.revertedWithCustomError(accumulatedYield, "EnforcedPause");
    });
    
    it("Can correctly accumulate and claim rewards after multiple dividends", async function () {
      signature = await generateDividendSignature(dividendAmount);
      await accumulatedYield.connect(dividendTreasury).distributeDividend(dividendAmount, signature);
      // First reward claim
      const firstPending = await accumulatedYield.pendingReward(user1.address);
      await accumulatedYield.connect(user1).claimReward();
      
      // Distribute dividend again
      dividendAmount = ethers.parseUnits("500", 6);
      await mockUSDT.connect(dividendTreasury).approve(
        await accumulatedYield.getAddress(),
        dividendAmount
      );
      
      signature = await generateDividendSignature(dividendAmount);
      await accumulatedYield.connect(dividendTreasury).distributeDividend(dividendAmount, signature);
      
      // Query the second pending reward
      const secondPending = await accumulatedYield.pendingReward(user1.address);
      
      // Second reward claim
      const beforeSecondBalance = await mockUSDT.balanceOf(user1.address);
      await accumulatedYield.connect(user1).claimReward();
      const afterSecondBalance = await mockUSDT.balanceOf(user1.address);
      
      // Verify the amount of the second claim
      expect(afterSecondBalance - beforeSecondBalance).to.equal(secondPending);
      
      // Verify user info update
      const userInfo = await accumulatedYield.getUserInfo(user1.address);
      expect(userInfo.totalClaimed).to.equal(firstPending + secondPending);
    });

    it("Can correctly handle accumulated shares when token transfers occur during dividend periods", async function () {
      // Set up three users: Alice(user1), Bob(user2) and Carol(new user)
      const alice = user1;
      const bob = user2;
      const carol = user3;
      
      // Initial state: Alice has 2000 tokens, Bob has 8000 tokens, Carol has no tokens
      // Re-mint tokens to ensure correct initial state
      await coreVault.connect(manager).grantRole(TOKEN_TRANSFER_ROLE, alice.address);
      await coreVault.connect(manager).grantRole(TOKEN_TRANSFER_ROLE, bob.address);
      await coreVault.connect(manager).grantRole(TOKEN_TRANSFER_ROLE, carol.address);
      
      // Clear existing tokens
      const aliceBalance = await shareToken.balanceOf(alice.address);
      const bobBalance = await shareToken.balanceOf(bob.address);
      if (aliceBalance > 0) {
        await shareToken.connect(alice).transfer(manager.address, aliceBalance);
      }
      if (bobBalance > 0) {
        await shareToken.connect(bob).transfer(manager.address, bobBalance);
      }
      
      await shareToken.connect(manager).transfer(alice.address, ethers.parseUnits("2000", SHARE_TOKEN_DECIMALS));
      await shareToken.connect(manager).transfer(bob.address, ethers.parseUnits("8000", SHARE_TOKEN_DECIMALS));
      
      // Verify initial state
      expect(await shareToken.balanceOf(alice.address)).to.equal(ethers.parseUnits("2000", SHARE_TOKEN_DECIMALS));
      expect(await shareToken.balanceOf(bob.address)).to.equal(ethers.parseUnits("8000", SHARE_TOKEN_DECIMALS));
      expect(await shareToken.balanceOf(carol.address)).to.equal(0);
      
      // Step 3: Admin distributes first dividend of 1500 USDT
      signature = await generateDividendSignature(dividendAmount);
      await accumulatedYield.connect(dividendTreasury).distributeDividend(dividendAmount, signature);
      expect(await mockUSDT.balanceOf(await accumulatedYield.getAddress())).to.equal(ethers.parseUnits("1500", 6));
      const globalPool = await accumulatedYield.globalPool();
      expect(globalPool.totalDividend).to.equal(ethers.parseUnits("1500", 6));

      // Step 4: Alice transfers 500 ShareTokens to Carol
      await shareToken.connect(alice).transfer(carol.address, ethers.parseUnits("500", SHARE_TOKEN_DECIMALS));
      
      // Verify balances after transfer
      expect(await shareToken.balanceOf(alice.address)).to.equal(ethers.parseUnits("1500", SHARE_TOKEN_DECIMALS));
      expect(await shareToken.balanceOf(carol.address)).to.equal(ethers.parseUnits("500", SHARE_TOKEN_DECIMALS));
      
      // Step 5: Admin distributes second dividend of 1000 USDT
      const secondDividendAmount = ethers.parseUnits("1000", 6);
      await mockUSDT.connect(dividendTreasury).approve(
        await accumulatedYield.getAddress(),
        secondDividendAmount
      );
      
      const secondSignature = await generateDividendSignature(secondDividendAmount);
      await accumulatedYield.connect(dividendTreasury).distributeDividend(secondDividendAmount, secondSignature);
      
      // Verify global pool status
      const globalPoolAfterSecondDividend = await accumulatedYield.globalPool();
      expect(globalPoolAfterSecondDividend.totalDividend).to.equal(dividendAmount + secondDividendAmount);
      
      // Step 6: Alice claims rewards
      const aliceBalanceBefore = await mockUSDT.balanceOf(alice.address);
      await accumulatedYield.connect(alice).claimReward();
      const aliceBalanceAfter = await mockUSDT.balanceOf(alice.address);
      const aliceReward = aliceBalanceAfter - aliceBalanceBefore;
      
      // Step 7: Bob claims rewards
      const bobBalanceBefore = await mockUSDT.balanceOf(bob.address);
      await accumulatedYield.connect(bob).claimReward();
      const bobBalanceAfter = await mockUSDT.balanceOf(bob.address);
      const bobReward = bobBalanceAfter - bobBalanceBefore;
      
      // Step 8: Carol claims rewards
      const carolBalanceBefore = await mockUSDT.balanceOf(carol.address);
      await accumulatedYield.connect(carol).claimReward();
      const carolBalanceAfter = await mockUSDT.balanceOf(carol.address);
      const carolReward = carolBalanceAfter - carolBalanceBefore;

      // Verify total distributed rewards
      const totalDistributed = dividendAmount + secondDividendAmount;
      const totalClaimed = aliceReward + bobReward + carolReward;
      
      // Allow small errors (due to integer division rounding)
      expect(totalClaimed).to.be.closeTo(totalDistributed, 10n);
      
      // Verify reward proportions
      // Assuming first dividend of 1500, with Alice and Bob's ShareToken ratio at 2000:8000, their reward ratio is 1:4
      // First dividend: AliceReward = 1500 * 2000 / (2000 + 8000) = 300
      // First dividend: BobReward = 1500 * 8000 / (2000 + 8000) = 1200
      // First dividend: CarolReward = 0
      // Second dividend: AliceReward = 1000 * 1500 / (1500 + 8000 + 500) = 150
      // Second dividend: BobReward = 1000 * 8000 / (1500 + 8000 + 500) = 800
      // Second dividend: CarolReward = 1000 * 500 / (1500 + 8000 + 500) = 50
      // AliceTotalReward = 300 + 150 = 450
      // BobTotalReward = 1200 + 800 = 2000
      // CarolTotalReward = 0 + 50 = 50
      expect(aliceReward).to.equal(ethers.parseUnits("450", 6));
      expect(bobReward).to.equal(ethers.parseUnits("2000", 6));
      expect(carolReward).to.equal(ethers.parseUnits("50", 6));

    })
  });
  
  describe("Token Transfer Tests", function () {
    beforeEach(async function() {
      // Mint some tokens for users
      await crowdsale.connect(manager).offChainDeposit(ethers.parseUnits("20000", SHARE_TOKEN_DECIMALS), manager.address);
      await shareToken.connect(manager).transfer(user1.address, ethers.parseUnits("1000", SHARE_TOKEN_DECIMALS));
      await shareToken.connect(manager).transfer(user2.address, ethers.parseUnits("500", SHARE_TOKEN_DECIMALS));
      // Distribute some dividends
      const dividendAmount = ethers.parseUnits("1000", 6);
      await mockUSDT.connect(dividendTreasury).approve(
        await accumulatedYield.getAddress(),
        dividendAmount
      );
      
      const signature = await generateDividendSignature(dividendAmount);
      await accumulatedYield.connect(dividendTreasury).distributeDividend(dividendAmount, signature);
    });
    
    it("Should correctly update user pool information during transfers", async function () {
      // Query user information before transfer
      const user1InfoBefore = await accumulatedYield.getUserInfo(user1.address);
      const user2InfoBefore = await accumulatedYield.getUserInfo(user2.address);
      const user1PendingBefore = await accumulatedYield.pendingReward(user1.address);
      const user2PendingBefore = await accumulatedYield.pendingReward(user2.address);
      const user1BalanceBefore = await shareToken.balanceOf(user1.address);
      const user2BalanceBefore = await shareToken.balanceOf(user2.address);
      
      // User1 transfers 300 tokens to User2
      const transferAmount = ethers.parseUnits("300", SHARE_TOKEN_DECIMALS);
      await shareToken.connect(user1).transfer(user2.address, transferAmount);
      
      // Query user information after transfer
      const user1InfoAfter = await accumulatedYield.getUserInfo(user1.address);
      const user2InfoAfter = await accumulatedYield.getUserInfo(user2.address);
      const user1PendingAfter = await accumulatedYield.pendingReward(user1.address);
      const user2PendingAfter = await accumulatedYield.pendingReward(user2.address);

      const accumulatedSharesBefore = user1InfoBefore.accumulatedShares;
      
      // Verify user balance changes
      expect(await shareToken.balanceOf(user1.address)).to.equal(ethers.parseUnits("700", SHARE_TOKEN_DECIMALS));
      expect(await shareToken.balanceOf(user2.address)).to.equal(ethers.parseUnits("800", SHARE_TOKEN_DECIMALS));
      
      // Verify pending rewards remain unchanged (transfers don't affect already calculated rewards)
      expect(user1PendingAfter).to.equal(user1PendingBefore);
      expect(user2PendingAfter).to.equal(user2PendingBefore);
      
      // Verify user pool information updates
      // deltaDiv = pool.totalDividend - user.lastClaimDividend 
     // user.accumulatedShares += balanceOf(user) * deltaDiv 


      const totalDividend = await accumulatedYield.totalDividend();
      const deltaDiv = totalDividend - user1InfoBefore.lastClaimDividend;;

      expect(user1InfoAfter.accumulatedShares).to.equal(accumulatedSharesBefore + (user1BalanceBefore * deltaDiv));
      expect(user2InfoAfter.accumulatedShares).to.equal(user2InfoBefore.accumulatedShares + (user2BalanceBefore * deltaDiv));
    });
    
    it("Should correctly calculate new reward distribution after transfers", async function () {
      // User1 transfers 300 tokens to User2
      const transferAmount = ethers.parseUnits("300", SHARE_TOKEN_DECIMALS);
      await shareToken.connect(user1).transfer(user2.address, transferAmount);
      
      // After transfer, User1 has 700 tokens, User2 has 800 tokens
      
      // Claim previous rewards
      await accumulatedYield.connect(user1).claimReward();
      await accumulatedYield.connect(user2).claimReward();
      
      // Distribute dividends again
      const dividendAmount = ethers.parseUnits("1500", 6);
      await mockUSDT.connect(dividendTreasury).approve(
        await accumulatedYield.getAddress(),
        dividendAmount
      );
      
      const signature = await generateDividendSignature(dividendAmount);
      await accumulatedYield.connect(dividendTreasury).distributeDividend(dividendAmount, signature);
      
      // Query new pending rewards
      const user1Pending = await accumulatedYield.pendingReward(user1.address);
      const user2Pending = await accumulatedYield.pendingReward(user2.address);
      
      // User1 has 700 tokens, User2 has 800 tokens, total supply is 1500 tokens
      // For 1500 USDT dividend, User1 should get 1500 * (700/1500) = 700 USDT
      // User2 should get 1500 * (800/1500) = 800 USDT
      const totalSupply = await shareToken.totalSupply();
      const expectedUser1Reward = dividendAmount * ethers.parseUnits("700", SHARE_TOKEN_DECIMALS) / totalSupply;
      const expectedUser2Reward = dividendAmount * ethers.parseUnits("800", SHARE_TOKEN_DECIMALS) / totalSupply;
      
      expect(user1Pending).to.be.closeTo(expectedUser1Reward, 10n); // Allow small errors
      expect(user2Pending).to.be.closeTo(expectedUser2Reward, 10n); // Allow small errors
    });
    
    it("Cannot transfer tokens when paused", async function () {
      // Pause the contract
      await accumulatedYield.connect(manager).pause();
      
      // Try to transfer, should fail
      const transferAmount = ethers.parseUnits("300", SHARE_TOKEN_DECIMALS);
      await expect(
        shareToken.connect(user1).transfer(user2.address, transferAmount)
      ).to.be.revertedWithCustomError(shareToken, "EnforcedPause");
    });
  });
  
  describe("Admin Management Tests", function () {
    it("Only manager can perform admin operations", async function () {
      // Non-manager tries to pause, should fail
      const MANAGER_ROLE = await accumulatedYield.MANAGER_ROLE();
      await expect(
        accumulatedYield.connect(user1).pause()
      ).to.be.revertedWithCustomError(accumulatedYield, "AccessControlUnauthorizedAccount")
        .withArgs(user1.address, MANAGER_ROLE);
      
      // Manager should be able to pause the contract
      await accumulatedYield.connect(manager).pause();
      expect(await accumulatedYield.paused()).to.be.true;
      
      // Manager should be able to unpause the contract
      await accumulatedYield.connect(manager).unpause();
      expect(await accumulatedYield.paused()).to.be.false;
    });
  });
  
  describe("Pause and Unpause Functionality Tests", function () {
    it("Only manager can pause the contract", async function () {
      // Non-manager tries to pause the contract, should fail
      const MANAGER_ROLE = await accumulatedYield.MANAGER_ROLE();
      await expect(
        accumulatedYield.connect(user1).pause()
      ).to.be.revertedWithCustomError(accumulatedYield, "AccessControlUnauthorizedAccount")
        .withArgs(user1.address, MANAGER_ROLE);
      
      // Manager pauses the contract, should succeed
      await accumulatedYield.connect(manager).pause();
      expect(await accumulatedYield.paused()).to.be.true;
    });
    
    it("Only manager can unpause the contract", async function () {
      // First pause the contract
      await accumulatedYield.connect(manager).pause();
      
      // Non-manager tries to unpause the contract, should fail
      const MANAGER_ROLE = await accumulatedYield.MANAGER_ROLE();
      await expect(
        accumulatedYield.connect(user1).unpause()
      ).to.be.revertedWithCustomError(accumulatedYield, "AccessControlUnauthorizedAccount")
        .withArgs(user1.address, MANAGER_ROLE);
      
      // Manager unpauses the contract, should succeed
      await accumulatedYield.connect(manager).unpause();
      expect(await accumulatedYield.paused()).to.be.false;
    });
    
    it("Cannot perform key operations when paused", async function () {
      // Allocate some tokens to users
      await crowdsale.connect(manager).offChainDeposit(ethers.parseUnits("20000", SHARE_TOKEN_DECIMALS), manager.address);
      await shareToken.connect(manager).transfer(user1.address, ethers.parseUnits("1000", SHARE_TOKEN_DECIMALS));
      const dividendAmount = ethers.parseUnits("1000", 6);
      await mockUSDT.connect(dividendTreasury).approve(
        await accumulatedYield.getAddress(),
        dividendAmount
      );
      
      const signature = await generateDividendSignature(dividendAmount);
      await accumulatedYield.connect(dividendTreasury).distributeDividend(dividendAmount, signature);
      
      // Pause the contract
      await accumulatedYield.connect(manager).pause();
      
      // Try to claim rewards, should fail
      await expect(
        accumulatedYield.connect(user1).claimReward()
      ).to.be.revertedWithCustomError(accumulatedYield, "EnforcedPause");
      
      // Try to distribute dividends, should fail
      const newDividendAmount = ethers.parseUnits("500", 6);
      const newSignature = await generateDividendSignature(newDividendAmount);
      await expect(
        accumulatedYield.connect(dividendTreasury).distributeDividend(newDividendAmount, newSignature)
      ).to.be.revertedWithCustomError(accumulatedYield, "EnforcedPause");
    });
    
    it("Can perform operations normally after unpausing", async function () {
      // Mint some tokens for users
      await crowdsale.connect(manager).offChainDeposit(ethers.parseUnits("20000", SHARE_TOKEN_DECIMALS), manager.address);
      await shareToken.connect(manager).transfer(user1.address, ethers.parseUnits("1000", SHARE_TOKEN_DECIMALS));
      // Pause the contract
      await accumulatedYield.connect(manager).pause();
      
      // Unpause the contract
      await accumulatedYield.connect(manager).unpause();
      
      // Distribute dividends, should succeed
      const dividendAmount = ethers.parseUnits("1000", 6);
      await mockUSDT.connect(dividendTreasury).approve(
        await accumulatedYield.getAddress(),
        dividendAmount
      );
      
      const signature = await generateDividendSignature(dividendAmount);
      await accumulatedYield.connect(dividendTreasury).distributeDividend(dividendAmount, signature);
      
      // Claim rewards, should succeed
      await accumulatedYield.connect(user1).claimReward();
      
    });
  });
});