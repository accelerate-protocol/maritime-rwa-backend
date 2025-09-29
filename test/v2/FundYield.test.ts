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
  createAccumulatedYield,
  createFundYield,
  SETTLE_ROLE,
  PAUSE_ROLE,
  endTime
} from "./helpers";

describe("FundYield", function () {
  let deployer: any;
  let manager: any;
  let validator: any;
  let user1: any;
  let user2: any;
  let user3: any;
  let settleCaller: any;
  let owner: any;

  // Contract instances
  let validatorRegistry: any;
  let fundVault: any;
  let crowdsale: any;
  let shareToken: any;
  let fundYield: any;
  let mockUSDT: any;

  async function generateFinishEpochSignature(
    epochId: bigint,
    dividendAmount: bigint
  ) {
    // Create signature data
    const payload = ethers.solidityPacked(
      ["address", "uint256", "uint256"],
      [await fundVault.getAddress(), epochId, dividendAmount]
    );

    // Calculate hash
    const messageHash = ethers.keccak256(payload);

    // Sign
    const signature = await validator.signMessage(ethers.getBytes(messageHash));

    return signature;
  }

  beforeEach(async function () {
    [deployer, manager, validator, user1, user2, user3, settleCaller] =
      await ethers.getSigners();
    owner = manager;

    // Deploy MockUSDT as reward token
    mockUSDT = await deployMockUSDT();

    // Use temporary variable to store results for checking return values
    const result = await createFundYield(
      manager,
      validator,
      settleCaller,
      mockUSDT
    );

    // Ensure all variables are correctly assigned
    validatorRegistry = result.validatorRegistry;
    fundVault = result.fundVault;
    shareToken = result.shareToken;
    crowdsale = result.crowdsale;
    fundYield = result.fundYield;

    // Check if fundYield is properly initialized
    if (!fundYield) {
      throw new Error("AccumulatedYield not properly initialized");
    }

    // Mint some USDT to dividendTreasury for dividends
    await mockUSDT.mint(
      await settleCaller.getAddress(),
      ethers.parseUnits("10000", 6)
    );

    // Unpause ShareToken
    await fundVault.connect(manager).unpauseToken();
  });

  afterEach(async function () {
    // Reset Hardhat network
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    });
    
  });

  describe("Initialization and Deployment Tests", function () {
    it("correctly init", async function () {
      var currentEpoch = await fundYield.currentEpochId();
      var minRedemptionAmount = await fundYield.minRedemptionAmount();
      var startTime = await fundYield.startTime();

      expect(currentEpoch).to.equal(0);
      expect(minRedemptionAmount).to.equal(0);
      expect(startTime).to.equal(0);

      expect(await fundYield.owner()).to.equal(manager.address);

      expect(
        await fundYield.hasRole(DEFAULT_ADMIN_ROLE, manager.address)
      ).to.equal(true);
      expect(await fundYield.hasRole(MANAGER_ROLE, manager.address)).to.equal(
        true
      );
      expect(await fundYield.hasRole(PAUSE_ROLE, manager.address)).to.equal(
        true
      );
      expect(
        await fundYield.hasRole(SETTLE_ROLE, settleCaller.address)
      ).to.equal(true);
      expect(await fundYield.getRoleAdmin(MANAGER_ROLE)).to.equal(
        DEFAULT_ADMIN_ROLE
      );
      expect(await fundYield.getRoleAdmin(PAUSE_ROLE)).to.equal(
        DEFAULT_ADMIN_ROLE
      );
      expect(await fundYield.getRoleAdmin(SETTLE_ROLE)).to.equal(MANAGER_ROLE);

    });

    it("Should grant role test", async function () {
      expect(
        await fundYield.connect(manager).grantRole(MANAGER_ROLE, user1.address)
      ).to.not.be.reverted;

      expect(await fundYield.hasRole(MANAGER_ROLE, user1.address)).to.equal(
        true
      );

      expect(
        await fundYield.connect(manager).revokeRole(MANAGER_ROLE, user1.address)
      ).to.not.be.reverted;
      expect(await fundYield.hasRole(MANAGER_ROLE, user1.address)).to.equal(
        false
      );

      expect(
        await fundYield.connect(manager).grantRole(PAUSE_ROLE, user1.address)
      ).to.not.be.reverted;

      expect(await fundYield.hasRole(PAUSE_ROLE, user1.address)).to.equal(true);

      expect(
        await fundYield.connect(manager).revokeRole(PAUSE_ROLE, user1.address)
      ).to.not.be.reverted;
      expect(await fundYield.hasRole(PAUSE_ROLE, user1.address)).to.equal(
        false
      );

      expect(
        await fundYield
          .connect(manager)
          .revokeRole(MANAGER_ROLE, manager.address)
      ).to.not.be.reverted;
      expect(await fundYield.hasRole(MANAGER_ROLE, manager.address)).to.equal(
        false
      );

      await expect(
        fundYield.connect(manager).grantRole(SETTLE_ROLE, user1.address)
      )
        .to.be.revertedWithCustomError(
          fundYield,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(manager.address, MANAGER_ROLE);

      expect(
        await fundYield
          .connect(manager)
          .grantRole(MANAGER_ROLE, manager.address)
      ).to.not.be.reverted;

      await expect(
        fundYield.connect(user1).grantRole(MANAGER_ROLE, manager.address)
      )
        .to.be.revertedWithCustomError(
          fundYield,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(user1.address, DEFAULT_ADMIN_ROLE);

      await expect(
        fundYield.connect(user1).grantRole(SETTLE_ROLE, manager.address)
      )
        .to.be.revertedWithCustomError(
          fundYield,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(user1.address, MANAGER_ROLE);
    });

    it("pause test", async function () {
      expect(await fundYield.hasRole(PAUSE_ROLE, manager.address)).to.equal(
        true
      );

      var paused = await fundYield.paused();
      expect(paused).to.equal(false);

      await expect(
        fundYield.connect(manager).unpause()
      ).to.be.revertedWithCustomError(fundYield, "ExpectedPause");

      await expect(fundYield.connect(user1).pause())
        .to.be.revertedWithCustomError(
          fundYield,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(user1.address, PAUSE_ROLE);

      expect(await fundYield.connect(manager).pause()).to.not.be.reverted;
      paused = await fundYield.paused();
      expect(paused).to.equal(true);

      await expect(
        fundYield.connect(manager).requestRedemption(10000)
      ).to.be.revertedWithCustomError(fundYield, "EnforcedPause");
      await expect(
        fundYield.connect(manager).cancelRedemption()
      ).to.be.revertedWithCustomError(fundYield, "EnforcedPause");
      await expect(
        fundYield.connect(manager).changeEpoch()
      ).to.be.revertedWithCustomError(fundYield, "EnforcedPause");
      await expect(
        fundYield.connect(manager).finishRedemptionEpoch(0, 1000,await generateFinishEpochSignature(0n, 1000n))
      ).to.be.revertedWithCustomError(fundYield, "EnforcedPause");
      await expect(
        fundYield.connect(manager).claimRedemption(0)
      ).to.be.revertedWithCustomError(fundYield, "EnforcedPause");

      await expect(
        fundYield.connect(manager).pause()
      ).to.be.revertedWithCustomError(fundYield, "EnforcedPause");

      await expect(fundYield.connect(user1).unpause())
        .to.be.revertedWithCustomError(
          fundYield,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(user1.address, PAUSE_ROLE);

      await expect(fundYield.connect(manager).unpause()).not.to.be.reverted;
    });

    it("fund not suucess test", async function () {
        await expect(
        fundYield.connect(manager).requestRedemption(10000)
      ).to.be.revertedWith("FundYield: fund not successful");
    });

  });


  describe("Reward Claiming Tests", function () {

    var dividendAmount;
    beforeEach(async function() {
      // Fully funded, financing completed
      await crowdsale.connect(manager).offChainDeposit(ethers.parseUnits("20000", SHARE_TOKEN_DECIMALS), manager.address);
      
      // Transfer some tokens to users
      await shareToken.connect(manager).transfer(user1.address, ethers.parseUnits("2000", SHARE_TOKEN_DECIMALS));
      await shareToken.connect(manager).transfer(user2.address, ethers.parseUnits("1000", SHARE_TOKEN_DECIMALS));
      
      // Distribute some dividends
      dividendAmount = ethers.parseUnits("1500", 6);
      await mockUSDT.connect(settleCaller).approve(
        await fundYield.getAddress(),
        dividendAmount
      );
    });

    it("should set start time", async function () {
        var epochId = await fundYield.currentEpochId();
        var startTime = await fundYield.startTime();
        expect(epochId).to.equal(0);
        expect(startTime).to.equal(0);
        await expect(fundYield.connect(user1).setStartTime(endTime)).to.be.revertedWithCustomError(fundYield, "AccessControlUnauthorizedAccount").withArgs(user1.address, MANAGER_ROLE);
        await expect(fundYield.connect(manager).setStartTime(endTime)).to.be.not.reverted;
        startTime = await fundYield.startTime();
        expect(startTime).to.equal(endTime);

        await expect(
        fundYield.connect(manager).requestRedemption(10000)
      ).to.be.revertedWith("FundYield: not started");
      await expect(
        fundYield.connect(manager).cancelRedemption()
      ).to.be.revertedWith("FundYield: not started");
      await expect(
        fundYield.connect(manager).changeEpoch()
      ).to.be.revertedWith("FundYield: not started");
      await expect(
        fundYield.connect(manager).finishRedemptionEpoch(0, 1000,await generateFinishEpochSignature(0n, 1000n))
      ).to.be.revertedWith("FundYield: not started");
      await expect(
        fundYield.connect(manager).claimRedemption(0)
      ).to.be.revertedWith("FundYield: not started");

      await expect(fundYield.connect(manager).setStartTime(0)).to.be.not.reverted;

    });

    

    it("should start redeem", async function () { 
        var epochId = await fundYield.currentEpochId();
        console.log("epochId",epochId);

        var epochData=await fundYield.getEpochData(epochId);
        console.log("epochData",epochData);
        var redeemReq=await fundYield.getRedemptionRequest(epochId);
        console.log("redeemReq",redeemReq);

        var pendingRedeem=await fundYield.pendingReward(user1.address,epochId);
        console.log("pendingRedeem",pendingRedeem);

        fundYield.connect(user1).requestRedemption(ethers.parseUnits("2000", SHARE_TOKEN_DECIMALS))
        await expect(
            fundYield.connect(user1).requestRedemption(ethers.parseUnits("2000", SHARE_TOKEN_DECIMALS))
        ).to.be.not.reverted;
        var epochData=await fundYield.getEpochData(epochId);
        console.log("epochData",epochData);
        var redeemReq=await fundYield.getRedemptionRequest(epochId);
        console.log("redeemReq",redeemReq);

        var pendingRedeem=await fundYield.pendingReward(user1.address);
        console.log("pendingRedeem",pendingRedeem);








        











        


    });








  })
});
