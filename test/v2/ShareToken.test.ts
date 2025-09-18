import { expect } from "chai";
import { ethers, network } from "hardhat";
import { 
  createVault, 
  createShareToken, 
  deployValidatorRegistry, 
  deployShareToken,
  SHARE_TOKEN_DECIMALS,
  TOKEN_TRANSFER_ROLE,
  MANAGER_ROLE,
  DEFAULT_ADMIN_ROLE
} from "./helpers";

describe("ShareToken", function () {
  // Test accounts
  let deployer: any;
  let manager: any;
  let validator: any;
  let vault: any;
  let user1: any;
  let user2: any;
  
  // Contract instances
  let validatorRegistry: any;
  let coreVault: any;
  let shareToken: any;
  
  // Get test accounts before all tests
  before(async function() {
    // Get test accounts
    [deployer, manager, validator, vault, user1, user2] = await ethers.getSigners();
  });
  
  // Reset network and deploy contracts before each test
  beforeEach(async function() {
    // Reset Hardhat network
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    });
    
    // 部署ValidatorRegistry
    validatorRegistry = await deployValidatorRegistry(validator, manager);
    
    // 部署CoreVault，禁用白名单
    const { coreVault: coreVaultInstance } = await createVault(manager, validatorRegistry, false, []);
    coreVault = coreVaultInstance;
    
    // 部署ShareToken
    const { shareToken: shareTokenInstance } = await createShareToken(coreVault, manager);
    shareToken = shareTokenInstance;
  });
  
  // Reset blockchain after all tests
  afterEach(async function () {
    await network.provider.send("hardhat_reset");
  });

  describe("Initialization and Deployment Tests", function () {
    it("should correctly initialize token name, symbol and decimals", async function () {
      expect(await shareToken.name()).to.equal("Test Share Token");
      expect(await shareToken.symbol()).to.equal("TST");
      expect(await shareToken.decimals()).to.equal(SHARE_TOKEN_DECIMALS);
    });

    it("should set vault as owner", async function () {
      expect(await shareToken.owner()).to.equal(await coreVault.getAddress());
    });

    it("should correctly set vault address", async function () {
      expect(await shareToken.vault()).to.equal(await coreVault.getAddress());
    });

    it("should be paused after initialization", async function () {
      expect(await shareToken.paused()).to.be.true;
    });

    it("cannot be initialized twice", async function () {
      const tokenInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "string", "uint8"],
        ["Test Share Token 2", "TST2", SHARE_TOKEN_DECIMALS]
      );

      await expect(
        shareToken.initiate(await coreVault.getAddress(), tokenInitData)
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });

  describe("Mint Function Tests", function () {
    it("non-vault address calling mint should fail", async function () {
      await expect(
        shareToken.connect(manager).mint(user1.address, ethers.parseUnits("100", SHARE_TOKEN_DECIMALS))
      ).to.be.revertedWith("ShareToken: only vault");

      await expect(
        shareToken.connect(user1).mint(user1.address, ethers.parseUnits("100", SHARE_TOKEN_DECIMALS))
      ).to.be.revertedWith("ShareToken: only vault");
    });
  });

  describe("BurnFrom Function Tests", function () {
    const mintAmount = ethers.parseUnits("100", SHARE_TOKEN_DECIMALS);
    const burnAmount = ethers.parseUnits("50", SHARE_TOKEN_DECIMALS);

    it("non-vault address calling burnFrom should fail", async function () {
      await shareToken.connect(user1).approve(await coreVault.getAddress(), burnAmount);
      
      await expect(
        shareToken.connect(manager).burnFrom(user1.address, burnAmount)
      ).to.be.revertedWith("ShareToken: only vault");

      await expect(
        shareToken.connect(user2).burnFrom(user1.address, burnAmount)
      ).to.be.revertedWith("ShareToken: only vault");
    });
  });
});