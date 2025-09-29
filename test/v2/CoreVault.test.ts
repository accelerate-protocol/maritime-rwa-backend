import { expect } from "chai";
import { ethers, network } from "hardhat";
import { deployValidatorRegistry, createVault, createShareToken, createVaultEnvironment, TOKEN_TRANSFER_ROLE, MANAGER_ROLE, DEFAULT_ADMIN_ROLE } from "./helpers";
import { ZeroAddress } from "ethers";

describe("CoreVault", function () {
  // Test accounts
  let deployer: any;
  let manager: any;
  let validator: any;
  let funding: any;
  let user1: any;
  let user2: any;
  // Contract instances
  let coreVault: any;
  let shareToken: any;
  let validatorRegistry: any;
    
  
  // Get test accounts before all tests
  before(async function() {
    // Get test accounts
    [deployer, manager, validator, funding, user1, user2] = await ethers.getSigners();
  });
  
  // Reset network before each test
  beforeEach(async function() {
    // Reset Hardhat network
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    });
      // Initialize test environment
    const testEnv = await createVaultEnvironment(deployer, manager, validator, funding);
    coreVault = testEnv.coreVault;
    shareToken = testEnv.shareToken;
    validatorRegistry = testEnv.validatorRegistry;
  });
  
  describe("burnToken functionality tests", function () {
    beforeEach(async function() {
      // Grant TOKEN_TRANSFER_ROLE to user1, so they can receive and burn tokens
      const TOKEN_TRANSFER_ROLE = await coreVault.TOKEN_TRANSFER_ROLE();
      await coreVault.connect(manager).grantRole(TOKEN_TRANSFER_ROLE, user1.address);
      
      // First mint some tokens to user1 for subsequent burn tests
      await coreVault.connect(funding).mintToken(user1.address, ethers.parseUnits("100", 18));

      // Verify token balance
      expect(await shareToken.balanceOf(user1.address)).to.equal(ethers.parseUnits("100", 18));
    });
    
    it("Non-funding modules calling burnToken should fail", async function () {
      const BURN_ROLE = await coreVault.BURN_ROLE();
      await expect(
        coreVault.connect(manager).burnToken(user1.address, ethers.parseUnits("50", 18))
      ).to.be.revertedWithCustomError(coreVault, "AccessControlUnauthorizedAccount")
        .withArgs(manager.address, BURN_ROLE);
      
      await expect(
        coreVault.connect(user1).burnToken(user1.address, ethers.parseUnits("50", 18))
      ).to.be.revertedWithCustomError(coreVault, "AccessControlUnauthorizedAccount")
        .withArgs(user1.address, BURN_ROLE);
    });
    
    it("Funding module should be able to burn user tokens", async function () {
      // approve 50 tokens to the coreVault address (not the funding address)
      await shareToken.connect(user1).approve(await coreVault.getAddress(), ethers.parseUnits("50", 18));
      // funding module calls burnToken, should succeed
      await coreVault.connect(funding).burnToken(user1.address, ethers.parseUnits("50", 18));
      
      // Verify token balance decreased
      expect(await shareToken.balanceOf(user1.address)).to.equal(ethers.parseUnits("50", 18));
    });
    
    it("Burning unauthorized tokens should fail", async function () {
      // user1 has not approved the vault, should fail
      await expect(
        coreVault.connect(funding).burnToken(user1.address, ethers.parseUnits("50", 18))
      ).to.be.reverted; // ERC20: insufficient allowance
    });
    
    it("Should be able to burn tokens after approval", async function () {
      // user1 approves the vault
      await shareToken.connect(user1).approve(await coreVault.getAddress(), ethers.parseUnits("50", 18));
      
      // funding module calls burnToken, should succeed
      await coreVault.connect(funding).burnToken(user1.address, ethers.parseUnits("50", 18));
      
      // Verify token balance decreased
      expect(await shareToken.balanceOf(user1.address)).to.equal(ethers.parseUnits("50", 18));
    });
    
    it("Should not be able to burn tokens after contract is paused", async function () {
      // Approve tokens
      await shareToken.connect(user1).approve(await coreVault.getAddress(), ethers.parseUnits("50", 18));
      
      // Pause the contract
      await coreVault.connect(manager).pause();


      
      // Try to burn tokens, should fail
      await expect(
        coreVault.connect(funding).burnToken(user1.address, ethers.parseUnits("50", 18))
      ).to.be.revertedWithCustomError(coreVault, "EnforcedPause");
    });
  });
  
  describe("onTokenTransfer permission tests", function () {
    beforeEach(async function() {
      // Grant TOKEN_TRANSFER_ROLE to user1 and user2
      const TOKEN_TRANSFER_ROLE = await coreVault.TOKEN_TRANSFER_ROLE();
      await coreVault.connect(manager).grantRole(TOKEN_TRANSFER_ROLE, user1.address);
      await coreVault.connect(manager).grantRole(TOKEN_TRANSFER_ROLE, user2.address);
    });
    
    it("Non-token modules calling onTokenTransfer should fail", async function () {
      await expect(
        coreVault.connect(manager).onTokenTransfer(user1.address, user2.address, ethers.parseUnits("50", 18))
      ).to.be.revertedWith("CoreVault: only token can call");
      
      await expect(
        coreVault.connect(user1).onTokenTransfer(user1.address, user2.address, ethers.parseUnits("50", 18))
      ).to.be.revertedWith("CoreVault: only token can call");
      
      await expect(
        coreVault.connect(funding).onTokenTransfer(user1.address, user2.address, ethers.parseUnits("50", 18))
      ).to.be.revertedWith("CoreVault: only token can call");
    });
  });
  
  describe("configureModules functionality tests", function () {
    let newCoreVault: any;
    let newShareToken: any;
    
    beforeEach(async function() {
      // Deploy ValidatorRegistry
      const validatorRegistry = await deployValidatorRegistry(validator, manager);
      
      // Deploy CoreVault and related contracts
      const { coreVault, proxyAdmin, vaultImpl, coreVaultTemplateFactory } = await createVault(manager, validatorRegistry, true, []);
      
      // Deploy ShareToken
      const { shareToken, shareTokenTemplateFactory } = await createShareToken(coreVault, manager);
      newShareToken = shareToken;
      newCoreVault = coreVault;
    });
  
    it("Cannot configure modules multiple times", async function () {
      // First configuration
      await newCoreVault.connect(manager).configureModules(
        await newShareToken.getAddress(),
        funding,
        ZeroAddress,
      );
      
      // Try to configure again, should fail
      await expect(
        newCoreVault.connect(manager).configureModules(
          await newShareToken.getAddress(),
          funding,
          ZeroAddress,
        )
      ).to.be.revertedWith("Vault: token already set");
    });

  });
  
  describe("getValidator functionality tests", function () {
    let actualValidator: any;
    
    beforeEach(async function() {
      // Get the current validator registry address
      const contract = await ethers.getContractAt("ValidatorRegistry", await validatorRegistry.getAddress());
      actualValidator = await contract.getValidator();
    });
    
    it("Should return the correct validator registry address", async function () {
      // Verify the returned address matches the validator registry address deployed during test environment creation
      expect(actualValidator).to.equal(await validator.getAddress());
    });
    
    it("Any user should be able to call getValidator", async function () {
      // Regular user calls getValidator
      const validatorFromUser1 = await coreVault.connect(user1).getValidator();
      expect(validatorFromUser1).to.equal(validator);
      
      // funding module calls getValidator
      const validatorFromFunding = await coreVault.connect(funding).getValidator();
      expect(validatorFromFunding).to.equal(validator);
      
      // Manager calls getValidator
      const validatorFromManager = await coreVault.connect(manager).getValidator();
      expect(validatorFromManager).to.equal(validator);
    });
    
    it("Can still call getValidator after contract is paused", async function () {
      // Pause the contract
      await coreVault.connect(manager).pause();
      
      // Try to call getValidator, should succeed
      const validatorAfterPause = await coreVault.connect(user1).getValidator();
      expect(validatorAfterPause).to.equal(validator);
    });
  });
  
  describe("mintToken permission control tests", function () {
    it("Non-funding modules calling mintToken should fail", async function () {
      const MINT_ROLE = await coreVault.MINT_ROLE();
      await expect(
        coreVault.connect(manager).mintToken(user1.address, ethers.parseUnits("100", 18))
      ).to.be.revertedWithCustomError(coreVault, "AccessControlUnauthorizedAccount")
        .withArgs(manager.address, MINT_ROLE);
      
      await expect(
        coreVault.connect(user1).mintToken(user1.address, ethers.parseUnits("100", 18))
      ).to.be.revertedWithCustomError(coreVault, "AccessControlUnauthorizedAccount")
        .withArgs(user1.address, MINT_ROLE);
    });
    
    it("Users not added to whitelist should not be able to receive tokens", async function () {
      // Confirm user1 is not on the whitelist
      expect(await coreVault.hasRole(TOKEN_TRANSFER_ROLE, user1.address)).to.equal(false);
      
      // funding module calls mintToken, but recipient is not on whitelist, should fail
      await expect(
        coreVault.connect(funding).mintToken(user1.address, ethers.parseUnits("100", 18))
      ).to.be.revertedWith("Vault: not whitelisted");
    });
    
    it("Users should be able to receive tokens after being added to whitelist", async function () {
      // Grant TOKEN_TRANSFER_ROLE to user1
      await coreVault.connect(manager).grantRole(TOKEN_TRANSFER_ROLE, user1.address);
      
      // Confirm user1 is now on the whitelist
      expect(await coreVault.hasRole(TOKEN_TRANSFER_ROLE, user1.address)).to.equal(true);
      
      // funding module calls mintToken, recipient is on whitelist, should succeed
      await coreVault.connect(funding).mintToken(user1.address, ethers.parseUnits("100", 18));
      
      // Verify token balance
      expect(await shareToken.balanceOf(user1.address)).to.equal(ethers.parseUnits("100", 18));
    });
    
    it("Should not be able to mint tokens after contract is paused", async function () {
      // Pause the contract
      await coreVault.connect(manager).pause();
      // Grant TOKEN_TRANSFER_ROLE to user1
      await coreVault.connect(manager).grantRole(TOKEN_TRANSFER_ROLE, user1.address);
      
      // Confirm user1 is now on the whitelist
      expect(await coreVault.hasRole(TOKEN_TRANSFER_ROLE, user1.address)).to.equal(true);
      
      // Try to mint tokens, should fail
      await expect(
        coreVault.connect(funding).mintToken(user1.address, ethers.parseUnits("100", 18))
      ).to.be.revertedWithCustomError(coreVault, "EnforcedPause");
      
      // Unpause the contract
      await coreVault.connect(manager).unpause();
    });
    
    let newVault: any;
    let newShareToken: any;
    
    // Set up environment separately for this special test case
    beforeEach(async function() {
      // Confirm user2 is not on the whitelist
      expect(await coreVault.hasRole(TOKEN_TRANSFER_ROLE, user2.address)).to.equal(false);
      
      // Deploy a new vault with whitelist disabled
      const testEnv = await createVaultEnvironment(deployer, manager, validator, funding, false);
      newVault = testEnv.coreVault;
      newShareToken = testEnv.shareToken;
    });
    
    it("After disabling whitelist, users not on whitelist should also be able to receive tokens", async function () {
      // funding module calls mintToken, recipient is not on whitelist, but whitelist is disabled, should succeed
      await newVault.connect(funding).mintToken(user2.address, ethers.parseUnits("100", 18));
      
      // Verify token balance
      expect(await newShareToken.balanceOf(user2.address)).to.equal(ethers.parseUnits("100", 18));    
    });
  });

  describe("Role management tests", function () {
  it("Should correctly set initial roles", async function () {
    // Verify manager has MANAGER_ROLE
    expect(await coreVault.hasRole(MANAGER_ROLE, manager.address)).to.equal(true);
    // Verify that the admin of TOKEN_TRANSFER_ROLE is MANAGER_ROLE
    expect(await coreVault.getRoleAdmin(TOKEN_TRANSFER_ROLE)).to.equal(MANAGER_ROLE);
  });
  
  it("Non-administrators cannot grant or revoke roles", async function () {
    // Use globally defined role constants
    
    await expect(
      coreVault.connect(user1).grantRole(TOKEN_TRANSFER_ROLE, user2.address)
    ).to.be.reverted;
    
    // First have the administrator grant the role
    await coreVault.connect(manager).grantRole(TOKEN_TRANSFER_ROLE, user1.address);
    // Non-administrators cannot revoke roles
    await expect(
      coreVault.connect(user2).revokeRole(TOKEN_TRANSFER_ROLE, user1.address)
    ).to.be.reverted;
  });
  
  it("Administrators can grant and revoke roles", async function () {
    // Use globally defined role constants
    
    // Grant role
    await coreVault.connect(manager).grantRole(TOKEN_TRANSFER_ROLE, user1.address);
    expect(await coreVault.hasRole(TOKEN_TRANSFER_ROLE, user1.address)).to.equal(true);
    
    // Revoke role
    await coreVault.connect(manager).revokeRole(TOKEN_TRANSFER_ROLE, user1.address);
    expect(await coreVault.hasRole(TOKEN_TRANSFER_ROLE, user1.address)).to.equal(false);
  });
});

describe("Administrator functionality tests", function () {
  it("Should allow administrators to change manager address", async function () {
    // Verify event
    await expect(coreVault.connect(manager).grantRole(MANAGER_ROLE, user1.address))
      .to.emit(coreVault, "RoleGranted")
      .withArgs(MANAGER_ROLE, user1.address, manager.address);
    
    console.log("Manager change completed");
      expect(await coreVault.hasRole(MANAGER_ROLE, user1.address)).to.equal(true);
      
  });
  
  it("After manager change, operations can be performed using the new manager address", async function () {
    // Before change, cannot call unpauseToken
    await expect(
      coreVault.connect(user1).unpauseToken()
    ).to.be.revertedWithCustomError(coreVault, "AccessControlUnauthorizedAccount")
      .withArgs(user1.address, MANAGER_ROLE);

    // Change manager
    await expect(coreVault.connect(manager).grantRole(MANAGER_ROLE, user1.address))
      .to.emit(coreVault, "RoleGranted")
      .withArgs(MANAGER_ROLE, user1.address, manager.address);
    
    expect(await coreVault.hasRole(MANAGER_ROLE, user1.address)).to.equal(true);
    
    // New manager should be able to unpause token
    await coreVault.connect(user1).unpauseToken();
    expect(await coreVault.isTokenPaused()).to.equal(false);
  });

  it("After manager change, old manager can perform operations", async function () {
    // Change manager
    await expect(coreVault.connect(manager).grantRole(MANAGER_ROLE, user1.address))
      .to.emit(coreVault, "RoleGranted")
      .withArgs(MANAGER_ROLE, user1.address, manager.address);
    
    expect(await coreVault.hasRole(MANAGER_ROLE, user1.address)).to.equal(true);
    
    // Old manager should not be able to unpause token
    await coreVault.connect(manager).unpauseToken();
    expect(await coreVault.isTokenPaused()).to.equal(false);

  });

  it("After manager change, old manager can perform operations, untill revoke role", async function () {
    // Revoke role
    await coreVault.connect(manager).revokeRole(MANAGER_ROLE, manager.address);
    expect(await coreVault.hasRole(MANAGER_ROLE, manager.address)).to.equal(false);
    
    // Old manager should not be able to unpause token
    await expect(
      coreVault.connect(manager).unpauseToken()
    ).to.be.revertedWithCustomError(coreVault, "AccessControlUnauthorizedAccount")
      .withArgs(manager.address, MANAGER_ROLE);
  });

  
  it("Non-administrators cannot change manager address", async function () {
    const DEFAULT_ADMIN_ROLE = await coreVault.DEFAULT_ADMIN_ROLE();
    await expect(
      coreVault.connect(user1).grantRole(MANAGER_ROLE, user2.address)
    ).to.be.revertedWithCustomError(coreVault, "AccessControlUnauthorizedAccount")
      .withArgs(user1.address, DEFAULT_ADMIN_ROLE);
  });
  
  it("Can set manager to zero address", async function () {
    await coreVault.connect(manager).grantRole(MANAGER_ROLE, ethers.ZeroAddress);
    expect(await coreVault.hasRole(MANAGER_ROLE, ethers.ZeroAddress)).to.equal(true);
  });
  
  it("Should allow administrators to pause and unpause the contract", async function () {
    await coreVault.connect(manager).pause();
    expect(await coreVault.paused()).to.equal(true);
    
    await coreVault.connect(manager).unpause();
    expect(await coreVault.paused()).to.equal(false);
  });
  
  it("Non-administrators cannot pause and unpause the contract", async function () {
    const PAUSE_ROLE = await coreVault.PAUSE_ROLE();
    await expect(
      coreVault.connect(user1).pause()
    ).to.be.revertedWithCustomError(coreVault, "AccessControlUnauthorizedAccount")
      .withArgs(user1.address, PAUSE_ROLE);
    
    // First pause the contract
    await coreVault.connect(manager).pause();
    
    await expect(
      coreVault.connect(user1).unpause()
    ).to.be.revertedWithCustomError(coreVault, "AccessControlUnauthorizedAccount")
      .withArgs(user1.address, PAUSE_ROLE);
  });
  
  it("Should allow administrators to pause and unpause tokens", async function () {
    // First test unlock, because it's locked by default
    await coreVault.connect(manager).unpauseToken();
    expect(await coreVault.isTokenPaused()).to.equal(false);

    await coreVault.connect(manager).pauseToken();
    expect(await coreVault.isTokenPaused()).to.equal(true);
  });
  
  it("Non-administrators cannot pause and unpause tokens", async function () {
    const MANAGER_ROLE = await coreVault.MANAGER_ROLE();
    // Test that non-administrators cannot unlock tokens
    await expect(
      coreVault.connect(user1).unpauseToken()
    ).to.be.revertedWithCustomError(coreVault, "AccessControlUnauthorizedAccount")
      .withArgs(user1.address, MANAGER_ROLE);
    
    // First unlock tokens
    await coreVault.connect(manager).unpauseToken();
    
    // Test that non-administrators cannot pause tokens
    await expect(
      coreVault.connect(user1).pauseToken()
    ).to.be.revertedWithCustomError(coreVault, "AccessControlUnauthorizedAccount")
      .withArgs(user1.address, MANAGER_ROLE);
  });
});

});