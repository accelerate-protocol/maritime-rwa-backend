import { expect } from "chai";
import { ethers, network } from "hardhat";
import {
  deployValidatorRegistry,
  createFundVault,
  createShareToken,
  createFundVaultEnvironment,
  TOKEN_TRANSFER_ROLE,
  MANAGER_ROLE,
  PAUSE_ROLE,
  FEEDER_ROLE,
  DEFAULT_ADMIN_ROLE,
} from "./helpers";
import { ZeroAddress } from "ethers";

describe("FundVault", function () {
  // Test accounts
  let deployer: any;
  let manager: any;
  let validator: any;
  let funding: any;
  let yieldModel: any;
  let user1: any;
  let user2: any;
  // Contract instances
  let fundVault: any;
  let shareToken: any;
  let validatorRegistry: any;

  // Get test accounts before all tests
  before(async function () {
    // Get test accounts
    [deployer, manager, validator, funding, yieldModel, user1, user2] =
      await ethers.getSigners();
  });

  beforeEach(async function () {
    // Reset Hardhat network
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    });

    console.log("createVaultEnvironment");
    // Initialize test environment
    const testEnv = await createFundVaultEnvironment(
      deployer,
      manager,
      validator,
      funding,
      yieldModel
    );
    fundVault = testEnv.fundVault;
    shareToken = testEnv.shareToken;
    validatorRegistry = testEnv.validatorRegistry;
  });

  describe("burnToken functionality tests", function () {
    beforeEach(async function () {
      // Grant TOKEN_TRANSFER_ROLE to user1, so they can receive and burn tokens
      const TOKEN_TRANSFER_ROLE = await fundVault.TOKEN_TRANSFER_ROLE();
      await fundVault
        .connect(manager)
        .grantRole(TOKEN_TRANSFER_ROLE, user1.address);

      // First mint some tokens to user1 for subsequent burn tests
      await fundVault
        .connect(funding)
        .mintToken(user1.address, ethers.parseUnits("100", 18));

      // Verify token balance
      expect(await shareToken.balanceOf(user1.address)).to.equal(
        ethers.parseUnits("100", 18)
      );
    });

    it("Non-funding modules calling burnToken should fail", async function () {
      console.log("burnToken");
      const BURN_ROLE = await fundVault.BURN_ROLE();
      await expect(
        fundVault
          .connect(manager)
          .burnToken(user1.address, ethers.parseUnits("50", 18))
      )
        .to.be.revertedWithCustomError(
          fundVault,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(manager.address, BURN_ROLE);

      await expect(
        fundVault
          .connect(user1)
          .burnToken(user1.address, ethers.parseUnits("50", 18))
      )
        .to.be.revertedWithCustomError(
          fundVault,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(user1.address, BURN_ROLE);
    });

    it("Funding module should be able to burn user tokens", async function () {
      // approve 50 tokens to the fundVault address (not the funding address)
      await shareToken
        .connect(user1)
        .approve(await fundVault.getAddress(), ethers.parseUnits("50", 18));
      // funding module calls burnToken, should succeed
      await fundVault
        .connect(funding)
        .burnToken(user1.address, ethers.parseUnits("50", 18));

      // Verify token balance decreased
      expect(await shareToken.balanceOf(user1.address)).to.equal(
        ethers.parseUnits("50", 18)
      );
    });

    it("Yield module should be able to burn user tokens", async function () {
      // approve 50 tokens to the fundVault address (not the funding address)
      await shareToken
        .connect(user1)
        .approve(await fundVault.getAddress(), ethers.parseUnits("50", 18));
      // funding module calls burnToken, should succeed
      await fundVault
        .connect(yieldModel)
        .burnToken(user1.address, ethers.parseUnits("50", 18));

      // Verify token balance decreased
      expect(await shareToken.balanceOf(user1.address)).to.equal(
        ethers.parseUnits("50", 18)
      );
    });

    it("Burning unauthorized tokens should fail", async function () {
      // user1 has not approved the vault, should fail
      await expect(
        fundVault
          .connect(funding)
          .burnToken(user1.address, ethers.parseUnits("50", 18))
      ).to.be.reverted; // ERC20: insufficient allowance
    });

    it("Should be able to burn tokens after approval", async function () {
      // user1 approves the vault
      await shareToken
        .connect(user1)
        .approve(await fundVault.getAddress(), ethers.parseUnits("50", 18));

      // funding module calls burnToken, should succeed
      await fundVault
        .connect(funding)
        .burnToken(user1.address, ethers.parseUnits("50", 18));

      // Verify token balance decreased
      expect(await shareToken.balanceOf(user1.address)).to.equal(
        ethers.parseUnits("50", 18)
      );
    });

    it("Should not be able to burn tokens after contract is paused", async function () {
      // Approve tokens
      await shareToken
        .connect(user1)
        .approve(await fundVault.getAddress(), ethers.parseUnits("50", 18));

      // Pause the contract
      await fundVault.connect(manager).pause();

      // Try to burn tokens, should fail
      await expect(
        fundVault
          .connect(funding)
          .burnToken(user1.address, ethers.parseUnits("50", 18))
      ).to.be.revertedWithCustomError(fundVault, "EnforcedPause");
    });
  });

  describe("onTokenTransfer permission tests", function () {
    beforeEach(async function () {
      // Grant TOKEN_TRANSFER_ROLE to user1 and user2
      const TOKEN_TRANSFER_ROLE = await fundVault.TOKEN_TRANSFER_ROLE();
      await fundVault
        .connect(manager)
        .grantRole(TOKEN_TRANSFER_ROLE, user1.address);
      await fundVault
        .connect(manager)
        .grantRole(TOKEN_TRANSFER_ROLE, user2.address);
    });

    it("Non-token modules calling onTokenTransfer should fail", async function () {
      await expect(
        fundVault
          .connect(manager)
          .onTokenTransfer(
            user1.address,
            user2.address,
            ethers.parseUnits("50", 18)
          )
      ).to.be.revertedWith("Vault: only token can call");

      await expect(
        fundVault
          .connect(user1)
          .onTokenTransfer(
            user1.address,
            user2.address,
            ethers.parseUnits("50", 18)
          )
      ).to.be.revertedWith("Vault: only token can call");

      await expect(
        fundVault
          .connect(funding)
          .onTokenTransfer(
            user1.address,
            user2.address,
            ethers.parseUnits("50", 18)
          )
      ).to.be.revertedWith("Vault: only token can call");
    });
  });

  describe("configureModules functionality tests", function () {
    let newCoreVault: any;
    let newShareToken: any;

    beforeEach(async function () {
      // Deploy ValidatorRegistry
      const validatorRegistry = await deployValidatorRegistry(
        validator,
        manager
      );

      // Deploy CoreVault and related contracts
      const { fundVault, proxyAdmin, vaultImpl, fundVaultTemplateFactory } =
        await createFundVault(manager, validatorRegistry, true, []);

      // Deploy ShareToken
      const { shareToken, shareTokenTemplateFactory } = await createShareToken(
        fundVault,
        manager
      );
      newShareToken = shareToken;
      newCoreVault = fundVault;
    });

    it("Cannot configure modules multiple times", async function () {
      // First configuration
      await newCoreVault
        .connect(manager)
        .configureModules(
          await newShareToken.getAddress(),
          funding,
          ZeroAddress
        );

      // Try to configure again, should fail
      await expect(
        newCoreVault
          .connect(manager)
          .configureModules(
            await newShareToken.getAddress(),
            funding,
            ZeroAddress
          )
      ).to.be.revertedWith("Vault: token already set");
    });
  });

  describe("getValidator functionality tests", function () {
    let actualValidator: any;

    beforeEach(async function () {
      // Get the current validator registry address
      const contract = await ethers.getContractAt(
        "ValidatorRegistry",
        await validatorRegistry.getAddress()
      );
      actualValidator = await contract.getValidator();
    });

    it("Should return the correct validator registry address", async function () {
      // Verify the returned address matches the validator registry address deployed during test environment creation
      expect(actualValidator).to.equal(await validator.getAddress());
    });

    it("Any user should be able to call getValidator", async function () {
      // Regular user calls getValidator
      const validatorFromUser1 = await fundVault.connect(user1).getValidator();
      expect(validatorFromUser1).to.equal(validator);

      // funding module calls getValidator
      const validatorFromFunding = await fundVault
        .connect(funding)
        .getValidator();
      expect(validatorFromFunding).to.equal(validator);

      // Manager calls getValidator
      const validatorFromManager = await fundVault
        .connect(manager)
        .getValidator();
      expect(validatorFromManager).to.equal(validator);
    });

    it("Can still call getValidator after contract is paused", async function () {
      // Pause the contract
      await fundVault.connect(manager).pause();

      // Try to call getValidator, should succeed
      const validatorAfterPause = await fundVault.connect(user1).getValidator();
      expect(validatorAfterPause).to.equal(validator);
    });
  });

  describe("mintToken permission control tests", function () {
    it("Non-funding modules calling mintToken should fail", async function () {
      const MINT_ROLE = await fundVault.MINT_ROLE();
      await expect(
        fundVault
          .connect(manager)
          .mintToken(user1.address, ethers.parseUnits("100", 18))
      )
        .to.be.revertedWithCustomError(
          fundVault,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(manager.address, MINT_ROLE);

      await expect(
        fundVault
          .connect(user1)
          .mintToken(user1.address, ethers.parseUnits("100", 18))
      )
        .to.be.revertedWithCustomError(
          fundVault,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(user1.address, MINT_ROLE);
    });

    it("Users not added to whitelist should not be able to receive tokens", async function () {
      // Confirm user1 is not on the whitelist
      expect(
        await fundVault.hasRole(TOKEN_TRANSFER_ROLE, user1.address)
      ).to.equal(false);

      // funding module calls mintToken, but recipient is not on whitelist, should fail
      await expect(
        fundVault
          .connect(funding)
          .mintToken(user1.address, ethers.parseUnits("100", 18))
      ).to.be.revertedWith("Vault: not whitelisted");
    });

    it("Users should be able to receive tokens after being added to whitelist", async function () {
      // Grant TOKEN_TRANSFER_ROLE to user1
      await fundVault
        .connect(manager)
        .grantRole(TOKEN_TRANSFER_ROLE, user1.address);

      // Confirm user1 is now on the whitelist
      expect(
        await fundVault.hasRole(TOKEN_TRANSFER_ROLE, user1.address)
      ).to.equal(true);

      // funding module calls mintToken, recipient is on whitelist, should succeed
      await fundVault
        .connect(funding)
        .mintToken(user1.address, ethers.parseUnits("100", 18));

      // Verify token balance
      expect(await shareToken.balanceOf(user1.address)).to.equal(
        ethers.parseUnits("100", 18)
      );
    });

    it("Should not be able to mint tokens after contract is paused", async function () {
      // Pause the contract
      await fundVault.connect(manager).pause();
      // Grant TOKEN_TRANSFER_ROLE to user1
      await fundVault
        .connect(manager)
        .grantRole(TOKEN_TRANSFER_ROLE, user1.address);

      // Confirm user1 is now on the whitelist
      expect(
        await fundVault.hasRole(TOKEN_TRANSFER_ROLE, user1.address)
      ).to.equal(true);

      // Try to mint tokens, should fail
      await expect(
        fundVault
          .connect(funding)
          .mintToken(user1.address, ethers.parseUnits("100", 18))
      ).to.be.revertedWithCustomError(fundVault, "EnforcedPause");

      // Unpause the contract
      await fundVault.connect(manager).unpause();
    });

    let newVault: any;
    let newShareToken: any;

    // Set up environment separately for this special test case
    beforeEach(async function () {
      // Confirm user2 is not on the whitelist

      expect(
        await fundVault.hasRole(TOKEN_TRANSFER_ROLE, user2.address)
      ).to.equal(false);

      // Deploy a new vault with whitelist disabled
      const testEnv = await createFundVaultEnvironment(
        deployer,
        manager,
        validator,
        funding,
        yieldModel,
        false
      );
      newVault = testEnv.fundVault;
      newShareToken = testEnv.shareToken;
    });

    it("After disabling whitelist, users not on whitelist should also be able to receive tokens", async function () {
      // funding module calls mintToken, recipient is not on whitelist, but whitelist is disabled, should succeed
      await newVault
        .connect(funding)
        .mintToken(user2.address, ethers.parseUnits("100", 18));

      // Verify token balance
      expect(await newShareToken.balanceOf(user2.address)).to.equal(
        ethers.parseUnits("100", 18)
      );
    });
  });

  describe("Role management tests", function () {
    it("Should correctly set initial roles", async function () {
      // Verify manager has MANAGER_ROLE
      expect(await fundVault.hasRole(MANAGER_ROLE, manager.address)).to.equal(
        true
      );
      // Verify that the admin of TOKEN_TRANSFER_ROLE is MANAGER_ROLE
      expect(await fundVault.getRoleAdmin(TOKEN_TRANSFER_ROLE)).to.equal(
        MANAGER_ROLE
      );

      expect(await fundVault.hasRole(DEFAULT_ADMIN_ROLE, manager.address)).to.equal(true);

      expect(await fundVault.getRoleAdmin(PAUSE_ROLE)).to.equal(
        DEFAULT_ADMIN_ROLE
      );

      expect(await fundVault.getRoleAdmin(MANAGER_ROLE)).to.equal(
        DEFAULT_ADMIN_ROLE
      );

    });

    

    it("Non-administrators cannot grant or revoke roles", async function () {
      // Use globally defined role constants

      await expect(
        fundVault.connect(user1).grantRole(TOKEN_TRANSFER_ROLE, user2.address)
      ).to.be.reverted;

      // First have the administrator grant the role
      await fundVault
        .connect(manager)
        .grantRole(TOKEN_TRANSFER_ROLE, user1.address);
      // Non-administrators cannot revoke roles
      await expect(
        fundVault.connect(user2).revokeRole(TOKEN_TRANSFER_ROLE, user1.address)
      ).to.be.reverted;
    });

    it("Administrators can grant and revoke roles", async function () {
      // Use globally defined role constants

      // Grant role
      await fundVault
        .connect(manager)
        .grantRole(TOKEN_TRANSFER_ROLE, user1.address);
      expect(
        await fundVault.hasRole(TOKEN_TRANSFER_ROLE, user1.address)
      ).to.equal(true);

      // Revoke role
      await fundVault
        .connect(manager)
        .revokeRole(TOKEN_TRANSFER_ROLE, user1.address);
      expect(
        await fundVault.hasRole(TOKEN_TRANSFER_ROLE, user1.address)
      ).to.equal(false);
    });


    it("Administrators can grant and revoke roles manager", async function () {
      // Use globally defined role constants

      // Grant role
      await fundVault
        .connect(manager)
        .grantRole(TOKEN_TRANSFER_ROLE, user1.address);
      expect(
        await fundVault.hasRole(TOKEN_TRANSFER_ROLE, user1.address)
      ).to.equal(true);

      // Revoke role
      await fundVault
        .connect(manager)
        .revokeRole(TOKEN_TRANSFER_ROLE, user1.address);
      expect(
        await fundVault.hasRole(TOKEN_TRANSFER_ROLE, user1.address)
      ).to.equal(false);


      await fundVault
        .connect(manager)
        .revokeRole(PAUSE_ROLE, manager.address);
      expect(
        await fundVault.hasRole(PAUSE_ROLE, manager.address)
      ).to.equal(false);


      await fundVault
        .connect(manager)
        .grantRole(PAUSE_ROLE, manager.address);
      expect(
        await fundVault.hasRole(PAUSE_ROLE, manager.address)
      ).to.equal(true);


       await fundVault
        .connect(manager)
        .revokeRole(MANAGER_ROLE, manager.address);
      expect(
        await fundVault.hasRole(MANAGER_ROLE, manager.address)
      ).to.equal(false);


      await fundVault
        .connect(manager)
        .grantRole(MANAGER_ROLE, manager.address);
      expect(
        await fundVault.hasRole(MANAGER_ROLE, manager.address)
      ).to.equal(true);
    });

  });


  describe("FundVault function tests", function () { 

    it("Should correctly set initial roles", async function () {
    // Verify manager has MANAGER_ROLE
    expect(await fundVault.hasRole(FEEDER_ROLE, manager.address)).to.equal(true);
    // Verify that the admin of TOKEN_TRANSFER_ROLE is MANAGER_ROLE
    expect(await fundVault.getRoleAdmin(FEEDER_ROLE)).to.equal(MANAGER_ROLE);
    expect(await fundVault.priceDecimals()).to.equal(8);
  });

    it("get data and price test", async function () { 
        var lastRoundId=await fundVault.latestRoundId();
        expect(lastRoundId).to.equal(0);
        var priceData=await fundVault.lastestRoundData();
        var priceRoundData=await fundVault.getRoundData(lastRoundId);
        expect(priceData.price).to.equal(priceRoundData.price);
        expect(priceData.startedAt).to.equal(priceRoundData.startedAt);

        await fundVault.connect(manager).addPrice(1000000000);
        var newRoundId=await fundVault.latestRoundId();
        expect(newRoundId).to.equal(1);
        var newPriceData=await fundVault.lastestRoundData();
        var newPriceRoundData=await fundVault.getRoundData(newRoundId);
        expect(newPriceData.price).to.equal(newPriceRoundData.price);
        expect(newPriceData.startedAt).to.equal(newPriceRoundData.startedAt);
        expect(newPriceData.price).to.equal(1000000000);
    });

    it("FEEDER_ROLE grant role test", async function () {
        await expect(
            fundVault.connect(user1).grantRole(FEEDER_ROLE, user1.address)
        ).to.be.revertedWithCustomError(fundVault, "AccessControlUnauthorizedAccount").withArgs(user1.address, MANAGER_ROLE);
        var lastRoundId=await fundVault.latestRoundId();

        await expect(
            fundVault.connect(user1).addPrice(2000000000)
        ).to.be.revertedWithCustomError(fundVault, "AccessControlUnauthorizedAccount").withArgs(user1.address, FEEDER_ROLE);

        await expect(
            fundVault.connect(manager).grantRole(FEEDER_ROLE, user1.address)
        ).to.be.not.reverted;

        await expect(
            fundVault.connect(user1).addPrice(2000000000)
        ).to.be.not.reverted;

         var newRoundId=await fundVault.latestRoundId();
        expect(newRoundId).to.equal(lastRoundId+1n);
        var newPriceData=await fundVault.lastestRoundData();
        var newPriceRoundData=await fundVault.getRoundData(newRoundId);
        expect(newPriceData.price).to.equal(newPriceRoundData.price);
        expect(newPriceData.startedAt).to.equal(newPriceRoundData.startedAt);
        expect(newPriceData.price).to.equal(2000000000);
    })






  });


  



});
