import { expect } from "chai";
import { ethers, network } from "hardhat";
import { 
  createVault, 
  createShareToken, 
  deployValidatorRegistry, 
  createCrowdsale, 
  deployMockUSDT, 
  generateDepositSignature,
  generateOffChainDepositSignature,
  sharePrice,
  minDepositAmount,
  currentTime,
  startTime,
  endTime,
  maxFundingAmount,
  softCap,
  manageFeeBps,
  MANAGER_ROLE,
  TEST_PROOF_HASH
} from "./helpers";
import { parseUSDT } from "../utils/usdt";

describe("Crowdsale", function () {
  // Test accounts
  let manager: any;
  let offchainManager: any;
  let fundingReceiver: any;
  let manageFeeReceiver: any;
  let validator: any;
  let user1: any;
  let user2: any;
  
  // Contract instances
  let validatorRegistry: any;
  let coreVault: any;
  let shareToken: any;
  let crowdsale: any;
  let mockUSDT: any;
  
  
  beforeEach(async function () {
    // Get test accounts
    [manager, offchainManager, fundingReceiver, manageFeeReceiver, validator, user1, user2] = await ethers.getSigners();
    
    // Deploy MockUSDT
    mockUSDT = await deployMockUSDT();
    
    // Deploy ValidatorRegistry
    validatorRegistry = await deployValidatorRegistry(validator, manager);
    
    // Deploy CoreVault, disable whitelist
    const { coreVault: coreVaultInstance, proxyAdmin, vaultImpl, coreVaultTemplateFactory } = await createVault(manager, validatorRegistry, false, []);
    coreVault = coreVaultInstance
    // Deploy ShareToken
    const { shareToken:shareTokenInstance, shareTokenTemplateFactory } = await createShareToken(coreVault, manager);
    shareToken = shareTokenInstance
    // Deploy Crowdsale
    const crowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"],
      [startTime, endTime, await mockUSDT.getAddress(), maxFundingAmount, softCap, sharePrice, minDepositAmount, manageFeeBps, 
        fundingReceiver.address, manageFeeReceiver.address, manager.address, offchainManager.address]
    );

    // Deploy Crowdsale
    const { crowdsale: crowdsaleInstance, crowdsaleTemplateFactory } = await createCrowdsale(coreVault, shareToken, manager, crowdsaleInitData);
    crowdsale = crowdsaleInstance
    // Configure modules
    await coreVault.connect(manager).configureModules(
      await shareToken.getAddress(),
      await crowdsale.getAddress(),
      ethers.ZeroAddress
    );
  
    // Mint USDT for users
    await mockUSDT.mint(user1.address, parseUSDT("1000"));
    await mockUSDT.mint(user2.address, parseUSDT("1000"));
    
    // Users authorize Crowdsale contract to use USDT
    await mockUSDT.connect(user1).approve(await crowdsale.getAddress(), ethers.MaxUint256);
    await mockUSDT.connect(user2).approve(await crowdsale.getAddress(), ethers.MaxUint256);
  });

  // Reset blockchain after all tests
  afterEach(async function () {
    await network.provider.send("hardhat_reset");
  });
  
  describe("Deposit function test", function () {
    let depositAmount: bigint;
    let nonce: number;
    beforeEach(async function () {
      depositAmount = parseUSDT("100");
      await mockUSDT.connect(user1).approve(await crowdsale.getAddress(), ethers.MaxUint256);
      await mockUSDT.connect(user2).approve(await crowdsale.getAddress(), ethers.MaxUint256);
    })
    it("Deposit without administrator signature should fail", async function () {
      nonce = await crowdsale.getCallerNonce(user1.address);
      // Use wrong signer
      const wrongSignature = await generateDepositSignature(
        user2, // Wrong signer
        "deposit",
        depositAmount,
        user1.address,
        nonce, // nonce
        await ethers.provider.getNetwork().then(n => n.chainId),
        await crowdsale.getAddress()
      );
      
      // Try deposit, should fail
      await expect(
        crowdsale.connect(user1).deposit(depositAmount, user1.address, wrongSignature)
      ).to.be.revertedWith("Crowdsale: invalid signature");
    });
    
    it("Deposit with correct signature should succeed", async function () {
      nonce = await crowdsale.getCallerNonce(user1.address);
      // Get user's initial balance
      const initialUSDTBalance = await mockUSDT.balanceOf(user1.address);
      const initialShareBalance = await shareToken.balanceOf(user1.address);
      
      // Get administrator signature
      const signature = await generateDepositSignature(
        manager,
        "deposit",
        depositAmount,
        user1.address,
        nonce, // nonce
        await ethers.provider.getNetwork().then(n => n.chainId),
        await crowdsale.getAddress()
      );
      
      // Execute deposit
      await crowdsale.connect(user1).deposit(depositAmount, user1.address, signature);
      
      // Verify USDT balance decrease
      expect(await mockUSDT.balanceOf(user1.address)).to.equal(initialUSDTBalance - depositAmount);
      
    });
    
    it("Reusing the same nonce signature should fail", async function () {
      nonce = await crowdsale.getCallerNonce(user1.address);
      // Get validator signature
      const signature = await generateDepositSignature(
        manager,
        "deposit",
        depositAmount,
        user1.address,
        nonce, 
        await ethers.provider.getNetwork().then(n => n.chainId),
        await crowdsale.getAddress()
      );

      // First deposit
      await crowdsale.connect(user1).deposit(depositAmount, user1.address, signature);
      
      // Try deposit again, should fail
      await expect(
        crowdsale.connect(user1).deposit(depositAmount, user1.address, signature)
      ).to.be.revertedWith("Crowdsale: invalid signature");
    });
    
    it("Deposit should correctly calculate and charge management fee", async function () {
      // Get initial balance
      const initialManagerFeeBalance = await crowdsale.manageFee();
      nonce = await crowdsale.getCallerNonce(user2.address);
      // Get validator signature
      const signature = await generateDepositSignature(
        manager,
        "deposit",
        depositAmount,
        user2.address,
        nonce, // New nonce
        await ethers.provider.getNetwork().then(n => n.chainId),
        await crowdsale.getAddress()
      );
      
      // Execute deposit
      await crowdsale.connect(user2).deposit(depositAmount, user2.address, signature);
      
      // Get management fee rate
      const manageFeeBps = await crowdsale.manageFeeBps();
      const expectedFee = (depositAmount * manageFeeBps) / BigInt(10000);
      
      // Verify management fee is correctly charged
      expect(await crowdsale.manageFee()).to.equal(
        initialManagerFeeBalance + expectedFee
      );
    });

    it("When requested shares exceed remaining supply, deposit should buy to full capacity", async function () {
      // Calculate current remaining supply
      const remainingSupply = await crowdsale.getRemainingSupply()
      // Calculate user's maximum deposit amount
      const maxDepositAmount = remainingSupply * BigInt(10000) / manageFeeBps;
      const requestDepositAmount = maxDepositAmount + BigInt(100);

      await mockUSDT.mint(user2.address, requestDepositAmount);

      const initialUSDTBalance = await mockUSDT.balanceOf(user2.address);

      // Execute deposit
      nonce = await crowdsale.getCallerNonce(user2.address);
      // Get validator signature
      const signature = await generateDepositSignature(
        manager,
        "deposit",
        requestDepositAmount,
        user2.address,
        nonce, // New nonce
        await ethers.provider.getNetwork().then(n => n.chainId),
        await crowdsale.getAddress()
      );
      // Execute deposit
      await crowdsale.connect(user2).deposit(requestDepositAmount, user2.address, signature);
      // Verify shareToken balance equals remaining supply
      expect(await shareToken.balanceOf(user2.address)).to.equal(remainingSupply);
      // Verify USDT balance reduction is less than expected requestDepositAmount
      const usdChange = initialUSDTBalance - await mockUSDT.balanceOf(user2.address);
      expect(usdChange).to.be.lt(requestDepositAmount);
    })

    it("When staked amount is less than minimum investment, should revert", async function () {
      let minAmount = minDepositAmount - BigInt(1);
      // Execute deposit
      nonce = await crowdsale.getCallerNonce(user2.address);
      // Get validator signature
      const signature = await generateDepositSignature(
        manager,
        "deposit",
        minAmount,
        user2.address,
        nonce, // New nonce
        await ethers.provider.getNetwork().then(n => n.chainId),
        await crowdsale.getAddress()
      );
      // Execute deposit
      await expect(
        crowdsale.connect(user2).deposit(minAmount, user2.address, signature)
      ).to.be.revertedWith("Crowdsale: amount less than minimum");
    })

    it("When remaining purchasable amount is below minimum deposit, if user stakes more than minimum investment, should revert", async function () {
       // Calculate current remaining supply
      const remainingSupply = await crowdsale.getRemainingSupply()
      // Calculate maximum deposit amount for user
      const maxDepositAmount = remainingSupply * BigInt(10000) / (BigInt(10000)-manageFeeBps);
      const firstDepositAmount = maxDepositAmount - minDepositAmount + BigInt(1);
      await mockUSDT.mint(user2.address, maxDepositAmount);
      // First deposit execution, making remaining purchasable amount below minimum deposit
      nonce = await crowdsale.getCallerNonce(user2.address);
      const signature = await generateDepositSignature(
        manager,
        "deposit",
        firstDepositAmount,
        user2.address,
        nonce, // New nonce
        await ethers.provider.getNetwork().then(n => n.chainId),
        await crowdsale.getAddress()
      );
      // Execute deposit
      await crowdsale.connect(user2).deposit(firstDepositAmount, user2.address, signature);      // Verify remaining amount is less than minimum investment
      expect(await crowdsale.getRemainingSupply()).to.be.lt(minDepositAmount);
      expect(await crowdsale.isFundingSuccessful()).to.be.false;

      let secondDepositAmount = minDepositAmount + BigInt(1);
      // Second deposit execution, should revert
      nonce = await crowdsale.getCallerNonce(user2.address);
      const signature2 = await generateDepositSignature(
        manager,
        "deposit",
        secondDepositAmount,
        user2.address,
        nonce, // New nonce
        await ethers.provider.getNetwork().then(n => n.chainId),
        await crowdsale.getAddress()
      );
      // Execute deposit
      await expect(
        crowdsale.connect(user2).deposit(secondDepositAmount, user2.address, signature2)
      ).to.be.revertedWith("Crowdsale: remaining amount below minimum");
    })

    it("sharePrice is 0.1, correctly calculate shareAmount", async function () {
      let newCrowdsale: any;
      let newShareToken: any;
      // Deploy new Crowdsale, set sharePrice to 0.1
      const newSharePrice = ethers.parseUnits("1", 7); // 0.1 USDT per share
      // Deploy ValidatorRegistry
      validatorRegistry = await deployValidatorRegistry(validator, manager);
      
      // Deploy CoreVault, disable whitelist
      const { coreVault, proxyAdmin, vaultImpl, coreVaultTemplateFactory } = await createVault(manager, validatorRegistry, false, []);
      
      // Deploy ShareToken
      const { shareToken:shareTokenInstance, shareTokenTemplateFactory } = await createShareToken(coreVault, manager);
      newShareToken = shareTokenInstance
      // Deploy Crowdsale
      const crowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"],
        [startTime, endTime, await mockUSDT.getAddress(), maxFundingAmount, softCap, newSharePrice, minDepositAmount, manageFeeBps, manager.address, manager.address, manager.address, manager.address]
      );

      // Deploy Crowdsale
      const { crowdsale: crowdsaleInstance, crowdsaleTemplateFactory } = await createCrowdsale(coreVault, shareToken, manager, crowdsaleInitData);
      newCrowdsale = crowdsaleInstance
      // Configure modules
      await coreVault.connect(manager).configureModules(
        await newShareToken.getAddress(),
        await newCrowdsale.getAddress(),
        ethers.ZeroAddress
      );

          // Mint USDT for users
      await mockUSDT.mint(user1.address, parseUSDT("1000"));
      await mockUSDT.mint(user2.address, parseUSDT("1000"));
      
      // Users authorize Crowdsale contract to use USDT
      await mockUSDT.connect(user1).approve(await newCrowdsale.getAddress(), ethers.MaxUint256);
      await mockUSDT.connect(user2).approve(await newCrowdsale.getAddress(), ethers.MaxUint256);
    
      // Get initial balance
      const initialShareBalance = await newShareToken.balanceOf(user2.address);
      nonce = await newCrowdsale.getCallerNonce(user2.address);
      // Get validator signature
      const signature = await generateDepositSignature(
        manager,
        "deposit",
        depositAmount,
        user2.address,
        nonce, // New nonce
        await ethers.provider.getNetwork().then(n => n.chainId),
        await newCrowdsale.getAddress()
      );
      
      // Execute deposit
      await newCrowdsale.connect(user2).deposit(depositAmount, user2.address, signature);
      
      const expectedShareAmount = ethers.parseUnits("900", 6); // 900 shares
      // Verify share token balance increase
      expect(await newShareToken.balanceOf(user2.address)).to.equal(initialShareBalance + expectedShareAmount);
    });
  });
    
  
  describe("Redeem function test", function () {
    let depositAmount = parseUSDT("1000");
    let redeemAmount: any;
    let nonce: any;
    // Make deposit before testing
    beforeEach(async function () {
      // Get validator signature, using new nonce
      const signature = await generateDepositSignature(
        manager,
        "deposit",
        depositAmount,
        user1.address,
        0, // Using new nonce
        await ethers.provider.getNetwork().then(n => n.chainId),
        await crowdsale.getAddress()
      );
      
      // Execute deposit
      await crowdsale.connect(user1).deposit(depositAmount, user1.address, signature);

      redeemAmount = await shareToken.balanceOf(user1.address);
      
      // approve max value
      await shareToken.connect(user1).approve(await coreVault.getAddress(), ethers.MaxUint256);
    });

    it("Funding not ended, redeem not supported", async function () {
      nonce = await crowdsale.getCallerNonce(user1.address);
      // Get validator signature
      const signature = await generateDepositSignature(
        manager,
        "redeem",
        redeemAmount,
        user1.address,
        nonce, // nonce
        await ethers.provider.getNetwork().then(n => n.chainId),
        await crowdsale.getAddress()
      );
      // Try redeem, should fail
      await expect(
        crowdsale.connect(user1).redeem(redeemAmount, user1.address, signature)
      ).to.be.revertedWith("Crowdsale: funding period not ended");
    })
    
    it("Redeem without administrator signature should fail", async function () {
      // Increase time beyond end time (24 hours + 1 second)
      await network.provider.send("evm_increaseTime", [86401]); 
      await network.provider.send("evm_mine"); // Mine a new block to make time effective
      nonce = await crowdsale.getCallerNonce(user1.address);
      // Use incorrect signer
      const wrongSignature = await generateDepositSignature(
        user2, // Wrong signer
        "redeem",
        nonce,
        user1.address,
        nonce, // nonce
        await ethers.provider.getNetwork().then(n => n.chainId),
        await crowdsale.getAddress()
      );
      
      // Try redeem, should fail
      await expect(
        crowdsale.connect(user1).redeem(redeemAmount, user1.address, wrongSignature)
      ).to.be.revertedWith("Crowdsale: invalid signature");
    });
    
    it("Redeem with correct signature should succeed", async function () {
      // Increase time beyond end time (24 hours + 1 second)
      await network.provider.send("evm_increaseTime", [86401]); 
      await network.provider.send("evm_mine"); // Mine a new block to make time effective
      
      // Verify funding period has ended
      expect(await crowdsale.isFundingPeriodActive()).to.be.false;
      nonce = await crowdsale.getCallerNonce(user1.address);
      // Get user's initial balance
      const initialUSDTBalance = await mockUSDT.balanceOf(user1.address);
      
      // Get validator signature
      const signature = await generateDepositSignature(
        manager,
        "redeem",
        redeemAmount,
        user1.address,
        nonce, // nonce
        await ethers.provider.getNetwork().then(n => n.chainId),
        await crowdsale.getAddress()
      );
      
      // Execute redeem
      await crowdsale.connect(user1).redeem(redeemAmount, user1.address, signature);
      
      // Calculate expected return amount
      const expectedReturnAmount = depositAmount;
      
      // Verify USDT balance increase
      expect(await mockUSDT.balanceOf(user1.address)).to.equal(initialUSDTBalance + expectedReturnAmount);
      
      // Verify share token balance decrease
      expect(await shareToken.balanceOf(user1.address)).to.equal(0);
    });
    
    it("Reusing redeem signature with the same nonce should fail", async function () {
      // Increase time beyond end time (24 hours + 1 second)
      await network.provider.send("evm_increaseTime", [86401]); 
      await network.provider.send("evm_mine"); // Mine a new block to make time effective
      
      // Verify funding period has ended
      expect(await crowdsale.isFundingPeriodActive()).to.be.false;
      nonce = await crowdsale.getCallerNonce(user1.address);
      let batchRedeemAmount = redeemAmount/2n;
      // Get validator signature
      const signature = await generateDepositSignature(
        manager,
        "redeem",
        batchRedeemAmount,
        user1.address,
        nonce,
        await ethers.provider.getNetwork().then(n => n.chainId),
        await crowdsale.getAddress()
      );
      
      // First execute redeem once
      await crowdsale.connect(user1).redeem(batchRedeemAmount, user1.address, signature);
      
      // Try to use redeem with the same nonce again, should fail
      await expect(
        crowdsale.connect(user1).redeem(batchRedeemAmount, user1.address, signature)
      ).to.be.revertedWith("Crowdsale: invalid signature");
    });
    
    it("Redeem should fail after contract is paused", async function () {
      // Increase time beyond end time (24 hours + 1 second)
      await network.provider.send("evm_increaseTime", [86401]); 
      await network.provider.send("evm_mine"); // Mine a new block to make time effective
      
      // Verify funding period has ended
      expect(await crowdsale.isFundingPeriodActive()).to.be.false;
      // Pause contract
      await crowdsale.connect(manager).pause();
      nonce = await crowdsale.getCallerNonce(user1.address);
      // Get validator signature
      const signature = await generateDepositSignature(
        manager,
        "redeem",
        redeemAmount,
        user1.address,
        nonce, // New nonce
        await ethers.provider.getNetwork().then(n => n.chainId),
        await crowdsale.getAddress()
      );
      
      // Try redeem, should fail
      await expect(
        crowdsale.connect(user1).redeem(redeemAmount, user1.address, signature)
      ).to.be.revertedWithCustomError(crowdsale, "EnforcedPause");
    });

    it("Multiple redemptions", async function () {
      // Increase time beyond end time (24 hours + 1 second)
      await network.provider.send("evm_increaseTime", [86401]); 
      await network.provider.send("evm_mine"); // Mine a new block to make time effective
      
      // Verify funding period has ended
      expect(await crowdsale.isFundingPeriodActive()).to.be.false;
      // Get user's initial balance
      const initialUSDTBalance = await mockUSDT.balanceOf(user1.address);
      const initialShareBalance = await shareToken.balanceOf(user1.address);
    
      nonce = await crowdsale.getCallerNonce(user1.address);
      let amount1 = redeemAmount - parseUSDT(100);
      let amount2 = redeemAmount - amount1;
      // Get validator signature
      const signature = await generateDepositSignature(
        manager,
        "redeem",
        amount1,
        user1.address,
        nonce, // New nonce
        await ethers.provider.getNetwork().then(n => n.chainId),
        await crowdsale.getAddress()
      );
      
      // Execute redeem
      await crowdsale.connect(user1).redeem(amount1, user1.address, signature);
      
      // Verify shares
      expect(await shareToken.balanceOf(user1.address)).to.equal(initialShareBalance - amount1);


      const signature2 = await generateDepositSignature(
        manager,
        "redeem",
        amount2,
        user1.address,
        nonce+1n, // New nonce
        await ethers.provider.getNetwork().then(n => n.chainId),
        await crowdsale.getAddress()
      );
      // Execute redeem
      await crowdsale.connect(user1).redeem(amount2, user1.address, signature2);
      // Verify shares
      expect(await shareToken.balanceOf(user1.address)).to.equal(0);
 
    });
  })

  describe("Multiple redemptions after multiple stakes", function () {
    const rounds = 3n; // Set number of staking and redemption rounds, using BigInt
    let depositAmount = parseUSDT("1000");
    let redeemAmount: any;
    let nonce: any;
    // Make multiple deposits before testing
    beforeEach(async function () {
      await mockUSDT.mint(user1.address, rounds*depositAmount);      
      await mockUSDT.connect(user1).approve(await crowdsale.getAddress(), rounds*depositAmount);
      nonce = await crowdsale.getCallerNonce(user2.address);
      
      // Use loop for multiple stakes
      for (let i = 0n; i < rounds; i++) {
        // Get validator signature, using incremental nonce
        const signature = await generateDepositSignature(
          manager,
          "deposit",
          depositAmount,
          user2.address,
          nonce + i,
          await ethers.provider.getNetwork().then(n => n.chainId),
          await crowdsale.getAddress()
        );
        
        // Execute deposit, stake to user2 address
        await crowdsale.connect(user1).deposit(depositAmount, user2.address, signature);
      }

      // redeemAmount = balance/rounds
      redeemAmount = await shareToken.balanceOf(user2.address)/rounds;
      
      await shareToken.connect(user2).approve(await coreVault.getAddress(), rounds*redeemAmount);

      // Increase time beyond end time (24 hours + 1 second)
      await network.provider.send("evm_increaseTime", [86401]); 
      await network.provider.send("evm_mine"); // Mine a new block to make time effective
      
      // Verify funding period has ended
      expect(await crowdsale.isFundingPeriodActive()).to.be.false;
    });
    
    it("Multiple redemption amounts should be the same", async function () {
      // Get user's initial balance
      const initialUSDTBalance = await mockUSDT.balanceOf(user2.address);
      const initialShareBalance = await shareToken.balanceOf(user2.address);
      
      // Store each redemption amount for later comparison
      const redeemUSDTAmounts: bigint[] = [];
      let previousUSDTBalance = initialUSDTBalance;
      let previousShareBalance = initialShareBalance;
      
      // Get validator signature, using new nonce
      nonce = await crowdsale.getCallerNonce(user2.address);
      // Use loop for multiple redemptions
      for (let i = 0n; i < rounds; i++) {

        const signature = await generateDepositSignature(
          manager,
          "redeem",
          redeemAmount,
          user2.address,
          nonce+i,
          await ethers.provider.getNetwork().then(n => n.chainId),
          await crowdsale.getAddress()
        );
        
        // Execute redeem
        await crowdsale.connect(user2).redeem(redeemAmount, user2.address, signature);
        
        // Record balance after redemption
        const currentUSDTBalance = await mockUSDT.balanceOf(user2.address);
        const currentShareBalance = await shareToken.balanceOf(user2.address);
        
        // Calculate USDT amount for this redemption
        const redeemUSDTAmount = currentUSDTBalance - previousUSDTBalance;
        redeemUSDTAmounts.push(redeemUSDTAmount);
        
        // Verify redemption result
        expect(currentShareBalance).to.equal(previousShareBalance - redeemAmount);
        expect(redeemUSDTAmount).to.equal(depositAmount);
        
        // Update previous balance for next round calculation
        previousUSDTBalance = currentUSDTBalance;
        previousShareBalance = currentShareBalance;
      }
      
      // Verify all redemption amounts are the same
      for (let i = 1n; i < BigInt(redeemUSDTAmounts.length); i++) {
        expect(redeemUSDTAmounts[Number(i)]).to.equal(redeemUSDTAmounts[0n]);
      }
    })
  })
  
  describe("offChainDeposit function test", function () {
    let depositAmount = parseUSDT("1000");
    it("offChainDeposit initiated by non-admin should fail", async function () {
      // Try offChainDeposit, should fail
      const OFFCHAIN_MANAGER_ROLE = await crowdsale.OFFCHAIN_MANAGER_ROLE();
      await expect(
        crowdsale.connect(user1).offChainDeposit(depositAmount, user1.address,"0x", "0x0000000000000000000000000000000000000000000000000000000000000000")
      ).to.be.revertedWithCustomError(crowdsale, "AccessControlUnauthorizedAccount")
        .withArgs(user1.address, OFFCHAIN_MANAGER_ROLE);
    });

    it("offChainDeposit with empty signature should fail", async function () {
      // empty signature
      const emptySignature = "0x";

      // Try offChainDeposit, should fail
      await expect(
        crowdsale.connect(offchainManager).offChainDeposit(depositAmount, user1.address, emptySignature, "0x0000000000000000000000000000000000000000000000000000000000000000")
      ).to.be.revertedWithCustomError(crowdsale, "ECDSAInvalidSignatureLength")
        .withArgs(0);
    });

    it("offChainDeposit with invalid signature should fail", async function () {
      // Get current nonce
      const currentNonce = await crowdsale.getOffchainNonce();
      
      // Generate signature with wrong signer (user1 instead of validator)
      const invalidSignature = await generateOffChainDepositSignature(
        user1, // Wrong signer
        depositAmount,
        user1.address,
        Number(currentNonce),
        BigInt(await ethers.provider.getNetwork().then(n => n.chainId)),
        await crowdsale.getAddress(),
        TEST_PROOF_HASH
      );

      // Try offChainDeposit with invalid signature, should fail
      await expect(
        crowdsale.connect(offchainManager).offChainDeposit(depositAmount, user1.address, invalidSignature, TEST_PROOF_HASH)
      ).to.be.revertedWith("Crowdsale: invalid offchain signature");
    });
    
    it("offChainDeposit with correct signature should succeed", async function () {
      // Get user's initial balance
      const initialUSDTBalance = await mockUSDT.balanceOf(offchainManager.address);
      const initialShareBalance = await shareToken.balanceOf(user1.address);
      
      // Get current nonce
      const currentNonce = await crowdsale.getOffchainNonce();
      
      // Generate valid signature
      const validSignature = await generateOffChainDepositSignature(
        validator, // Correct signer
        depositAmount,
        user1.address,
        Number(currentNonce),
        BigInt(await ethers.provider.getNetwork().then(n => n.chainId)),
        await crowdsale.getAddress(),
        TEST_PROOF_HASH
      );
      
      // Execute offChainDeposit
      await crowdsale.connect(offchainManager).offChainDeposit(depositAmount, user1.address, validSignature, TEST_PROOF_HASH);
      
      // Verify USDT balance unchanged (no actual USDT transfer for off-chain deposits)
      expect(await mockUSDT.balanceOf(offchainManager.address)).to.equal(initialUSDTBalance);
      
      // Verify share token balance increased
      expect(await shareToken.balanceOf(user1.address)).to.equal(initialShareBalance + depositAmount);
      
      // Verify no management fee for off-chain deposits
      expect(await crowdsale.manageFee()).to.equal(0);
      expect(await crowdsale.fundingAssets()).to.equal(0);
      
      // Verify nonce was incremented
      expect(await crowdsale.getOffchainNonce()).to.equal(currentNonce + 1n);
    });

    it("offChainDeposit with reused signature should fail", async function () {
      // Get current nonce
      const currentNonce = await crowdsale.getOffchainNonce();
      
      // Generate signature
      const signature = await generateOffChainDepositSignature(
        validator,
        depositAmount,
        user1.address,
        Number(currentNonce),
        BigInt(await ethers.provider.getNetwork().then(n => n.chainId)),
        await crowdsale.getAddress(),
        TEST_PROOF_HASH
      );
      
      // First deposit should succeed
      await crowdsale.connect(offchainManager).offChainDeposit(depositAmount, user1.address, signature, TEST_PROOF_HASH);
      
      // Try to reuse the same signature, should fail
      await expect(
        crowdsale.connect(offchainManager).offChainDeposit(depositAmount, user1.address, signature, TEST_PROOF_HASH)
      ).to.be.revertedWith("Crowdsale: invalid offchain signature");
    });
    
    it("offChainDeposit should fail when contract is paused", async function () {
      // Pause contract
      await crowdsale.connect(manager).pause();
    
      // Get current nonce
      const currentNonce = await crowdsale.getOffchainNonce();
      
      // Generate valid signature
      const validSignature = await generateOffChainDepositSignature(
        validator,
        depositAmount,
        user1.address,
        Number(currentNonce),
        BigInt(await ethers.provider.getNetwork().then(n => n.chainId)),
        await crowdsale.getAddress(),
        TEST_PROOF_HASH
      );

      // Try offChainDeposit, should fail due to pause
      await expect(
        crowdsale.connect(offchainManager).offChainDeposit(depositAmount, user1.address, validSignature, TEST_PROOF_HASH)
      ).to.be.revertedWithCustomError(crowdsale, "EnforcedPause");
    });

  });
  
  describe("offChainRedeem function test", function () {
    let depositAmount = parseUSDT("1000");
    beforeEach(async function () {
      // Get current nonce
      const currentNonce = await crowdsale.getOffchainNonce();
      
      // Generate valid signature for offChainDeposit
      const validSignature = await generateOffChainDepositSignature(
        validator,
        depositAmount,
        user1.address,
        Number(currentNonce),
        BigInt(await ethers.provider.getNetwork().then(n => n.chainId)),
        await crowdsale.getAddress(),
        TEST_PROOF_HASH
      );
      
      await crowdsale.connect(offchainManager).offChainDeposit(depositAmount, user1.address, validSignature, TEST_PROOF_HASH);
      // Verify shareToken increased
      expect(await shareToken.balanceOf(user1.address)).to.equal(depositAmount);
      await shareToken.connect(user1).approve(await coreVault.getAddress(), depositAmount);

      // Increase time beyond end time (24 hours + 1 second)
      await network.provider.send("evm_increaseTime", [86401]); 
      await network.provider.send("evm_mine"); // Mine a new block to make time effective
      // Verify funding period has ended
      expect(await crowdsale.isFundingPeriodActive()).to.be.false;
    });
    
    it("offChainRedeem without offchainManager should fail", async function () {
      // Try offChainRedeem, should fail
      const OFFCHAIN_MANAGER_ROLE = await crowdsale.OFFCHAIN_MANAGER_ROLE();
      await expect(
        crowdsale.connect(user1).offChainRedeem(user1.address)
      ).to.be.revertedWithCustomError(crowdsale, "AccessControlUnauthorizedAccount")
        .withArgs(user1.address, OFFCHAIN_MANAGER_ROLE);
    });
    
    it("offChainRedeem initiated by offchainManager should succeed", async function () {
      // Get user's initial balance
      const initialUSDTBalance = await mockUSDT.balanceOf(user1.address);
      const initialShareBalance = await shareToken.balanceOf(user1.address);
      
      // Execute offChainRedeem
      await crowdsale.connect(offchainManager).offChainRedeem(user1.address);
      
      // Verify USDT balance unchanged
      expect(await mockUSDT.balanceOf(user1.address)).to.equal(initialUSDTBalance);
      
      // Verify share token balance decreased
      expect(await shareToken.balanceOf(user1.address)).to.equal(initialShareBalance - depositAmount);
    });
    
    it("offChainRedeem should fail when contract is paused", async function () {
      // Pause contract
      await crowdsale.connect(manager).pause();
      
      // Try offChainRedeem, should fail
      await expect(
        crowdsale.connect(offchainManager).offChainRedeem(user1.address)
      ).to.be.revertedWithCustomError(crowdsale, "EnforcedPause");
    });
  });

  describe("withdrawFundingAssets function test", function () {
    let fundingAmount = parseUSDT("10000");
    
    beforeEach(async function () {
      // Simulate raising funds through deposit function
      await mockUSDT.mint(user1.address, fundingAmount);
      await mockUSDT.connect(user1).approve(await crowdsale.getAddress(), fundingAmount);
      
      // Get nonce
      const nonce = await crowdsale.getCallerNonce(user1.address);
      
      // Get validator signature
      const signature = await generateDepositSignature(
        manager,
        "deposit",
        fundingAmount,
        user1.address,
        nonce,
        await ethers.provider.getNetwork().then(n => n.chainId),
        await crowdsale.getAddress()
      );
      
      // Execute deposit
      await crowdsale.connect(user1).deposit(fundingAmount, user1.address, signature);
    });

    it("Withdrawal should fail when funding is not successful", async function () {
      // Funding not successful, withdrawal should fail
      await expect(crowdsale.connect(manager).withdrawFundingAssets())
        .to.be.revertedWith("Crowdsale: funding was not successful");
    });
    
    it("Only fundingReceiver or manager can withdraw raised funds", async function () {
      // Increase time beyond end time (24 hours + 1 second) to end crowdsale
      await network.provider.send("evm_increaseTime", [86401]); 
      await network.provider.send("evm_mine"); // Mine a new block to make time effective
      // Regular user tries to withdraw raised funds, should fail
      await expect(crowdsale.connect(user1).withdrawFundingAssets())
        .to.be.revertedWith("Crowdsale: unauthorized");
    });
    
    it("Cannot withdraw funds again after withdrawal", async function () {
      // Increase time beyond end time (24 hours + 1 second) to end crowdsale
      await network.provider.send("evm_increaseTime", [86401]); 
      await network.provider.send("evm_mine"); // Mine a new block to make time effective
      // First withdrawal of raised funds
      await crowdsale.connect(manager).withdrawFundingAssets();
      
      // Try to withdraw again, should fail
      await expect(crowdsale.connect(manager).withdrawFundingAssets())
        .to.be.revertedWith("Crowdsale: no funding assets");
    });
  });
  
  describe("withdrawManageFee function test", function () {
    let depositAmount = parseUSDT("10000");
    let manageFeeAmount: bigint;
    
    beforeEach(async function () {
      // Simulate collecting management fee through deposit function
      await mockUSDT.mint(user1.address, depositAmount);
      await mockUSDT.connect(user1).approve(await crowdsale.getAddress(), depositAmount);
      
      // Get nonce
      const nonce = await crowdsale.getCallerNonce(user1.address);
      
      // Get validator signature
      const signature = await generateDepositSignature(
        manager,
        "deposit",
        depositAmount,
        user1.address,
        nonce,
        await ethers.provider.getNetwork().then(n => n.chainId),
        await crowdsale.getAddress()
      );
      
      // Get management fee rate
      const manageFeeBps = await crowdsale.manageFeeBps();
      manageFeeAmount = (depositAmount * manageFeeBps) / BigInt(10000);
      
      // Execute deposit
      await crowdsale.connect(user1).deposit(depositAmount, user1.address, signature);     
    });
    
    it("Withdrawal of management fee should fail when funding is not ended", async function () {
      await expect(crowdsale.connect(manager).withdrawManageFee())
        .to.be.revertedWith("Crowdsale: funding was not successful");
    })

    it("Only manageFeeReceiver or manager can withdraw management fee", async function () {      
      // Increase time beyond end time (24 hours + 1 second) to end crowdsale
      await network.provider.send("evm_increaseTime", [86401]); 
      await network.provider.send("evm_mine"); // Mine a new block to make time effective
      // Regular user tries to withdraw management fee, should fail
      await expect(crowdsale.connect(user1).withdrawManageFee())
        .to.be.revertedWith("Crowdsale: unauthorized");
    });
    
    it("Cannot withdraw management fee again after withdrawal", async function () {
      // Increase time beyond end time (24 hours + 1 second) to end crowdsale
      await network.provider.send("evm_increaseTime", [86401]); 
      await network.provider.send("evm_mine"); // Mine a new block to make time effective
      // First withdrawal of management fee
      await crowdsale.connect(manager).withdrawManageFee();
      
      // Try to withdraw again, should fail
      await expect(crowdsale.connect(manager).withdrawManageFee())
        .to.be.revertedWith("Crowdsale: no manage fee");
    });
  });
  
  describe("Manager Role function test", function () {
    it("Only accounts with Default Admin Role can set new manager", async function () {
      // Regular user tries to set new manager, should fail
      const DEFAULT_ADMIN_ROLE = await crowdsale.DEFAULT_ADMIN_ROLE();
      await expect(crowdsale.connect(user1).grantRole(MANAGER_ROLE, user2.address))
        .to.be.revertedWithCustomError(crowdsale, "AccessControlUnauthorizedAccount")
        .withArgs(user1.address, DEFAULT_ADMIN_ROLE);
    });
    
    it("Default Admin can set new manager", async function () {
      // Verify user2 doesn't have MANAGER_ROLE
      expect(await crowdsale.hasRole(MANAGER_ROLE, user2.address)).to.equal(false);
      
      // Grant user2 MANAGER_ROLE
      await expect(crowdsale.connect(manager).grantRole(MANAGER_ROLE, user2.address))
        .to.emit(crowdsale, "RoleGranted")
        .withArgs(MANAGER_ROLE, user2.address, manager.address);
      
      // Verify user2 has obtained MANAGER_ROLE
      expect(await crowdsale.hasRole(MANAGER_ROLE, user2.address)).to.equal(true);
    });
  
    
    it("New manager should be able to perform manager privilege operations", async function () {
      // Grant user2 MANAGER_ROLE
      await expect(crowdsale.connect(manager).grantRole(MANAGER_ROLE, user2.address))
        .to.emit(crowdsale, "RoleGranted")
        .withArgs(MANAGER_ROLE, user2.address, manager.address);
      
      // Verify user2 has obtained MANAGER_ROLE
      expect(await crowdsale.hasRole(MANAGER_ROLE, user2.address)).to.equal(true);
      
      // New manager should be able to pause contract
      await crowdsale.connect(user2).setOnChainSignValidator(user1.address);
      expect(await crowdsale.onChainSignValidator()).to.equal(user1.address);
      });
  });

  describe("Initialization parameter validation test", function () {
    let invalidCrowdsaleInitData: string;
    
    it("Start time later than end time should fail", async function () {
      // Set start time later than end time
      invalidCrowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"],
        [endTime, startTime, await mockUSDT.getAddress(), maxFundingAmount, softCap, sharePrice, minDepositAmount, manageFeeBps, manager.address, manager.address, manager.address, manager.address]
      );

      // Try to deploy Crowdsale, should fail
      await expect(
        createCrowdsale(coreVault, shareToken, manager, invalidCrowdsaleInitData)
      ).to.be.revertedWith("Crowdsale: invalid time range");
    });
    
    it("End time earlier than current time should fail", async function () {
      // Set end time earlier than current time
      const pastEndTime = BigInt(currentTime - 86400); // 24 hours ago
      const startTime = BigInt(currentTime - 86400 * 2); // One hour before 24 hours ago
      invalidCrowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"],
        [startTime, pastEndTime, await mockUSDT.getAddress(), maxFundingAmount, softCap, sharePrice, minDepositAmount, manageFeeBps, manager.address, manager.address, manager.address, manager.address]
      );

      // Try to deploy Crowdsale, should fail
      await expect(
        createCrowdsale(coreVault, shareToken, manager, invalidCrowdsaleInitData)
      ).to.be.revertedWith("Crowdsale: end time in past");
    });
    
    it("Asset token address as zero address should fail", async function () {
      // Set asset token address as zero address
      invalidCrowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"],
        [startTime, endTime, ethers.ZeroAddress, maxFundingAmount, softCap, sharePrice, minDepositAmount, manageFeeBps, manager.address, manager.address, manager.address, manager.address]
      );

      // Try to deploy Crowdsale, should fail
      await expect(
        createCrowdsale(coreVault, shareToken, manager, invalidCrowdsaleInitData)
      ).to.be.revertedWith("Crowdsale: invalid asset token");
    });
    
    it("Maximum supply as 0 should fail", async function () {
      // Set maximum supply as 0
      invalidCrowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"],
        [startTime, endTime, await mockUSDT.getAddress(), 0, softCap, sharePrice, minDepositAmount, manageFeeBps, manager.address, manager.address, manager.address, manager.address]
      );

      // Try to deploy Crowdsale, should fail
      await expect(
        createCrowdsale(coreVault, shareToken, manager, invalidCrowdsaleInitData)
      ).to.be.revertedWith("Crowdsale: invalid max supply");
    });
    
    it("Soft cap greater than maximum supply should fail", async function () {
      // Set soft cap greater than maximum supply
      const invalidSoftCap = maxFundingAmount + parseUSDT("1000");
      invalidCrowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"],
        [startTime, endTime, await mockUSDT.getAddress(), maxFundingAmount, invalidSoftCap, sharePrice, minDepositAmount, manageFeeBps, manager.address, manager.address, manager.address, manager.address]
      );

      // Try to deploy Crowdsale, should fail
      await expect(
        createCrowdsale(coreVault, shareToken, manager, invalidCrowdsaleInitData)
      ).to.be.revertedWith("Crowdsale: invalid soft cap");
    });
    
    it("Share price as 0 should fail", async function () {
      // Set share price as 0
      invalidCrowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"],
        [startTime, endTime, await mockUSDT.getAddress(), maxFundingAmount, softCap, 0, minDepositAmount, manageFeeBps, manager.address, manager.address, manager.address, manager.address]
      );

      // Try to deploy Crowdsale, should fail
      await expect(
        createCrowdsale(coreVault, shareToken, manager, invalidCrowdsaleInitData)
      ).to.be.revertedWith("Crowdsale: invalid share price");
    });
    
    it("Minimum deposit amount as 0 should fail", async function () {
      // Set minimum deposit amount as 0
      invalidCrowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"],
        [startTime, endTime, await mockUSDT.getAddress(), maxFundingAmount, softCap, sharePrice, 0, manageFeeBps, manager.address, manager.address, manager.address, manager.address]
      );

      // Try to deploy Crowdsale, should fail
      await expect(
        createCrowdsale(coreVault, shareToken, manager, invalidCrowdsaleInitData)
      ).to.be.revertedWith("Crowdsale: invalid min deposit");
    });
    
    it("Management fee rate exceeding 10000 should fail", async function () {
      // Set management fee rate exceeding 10000
      const invalidManageFeeBps = BigInt(10001);
      invalidCrowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"],
        [startTime, endTime, await mockUSDT.getAddress(), maxFundingAmount, softCap, sharePrice, minDepositAmount, invalidManageFeeBps, manager.address, manager.address, manager.address, manager.address]
      );

      // Try to deploy Crowdsale, should fail
      await expect(
        createCrowdsale(coreVault, shareToken, manager, invalidCrowdsaleInitData)
      ).to.be.revertedWith("Crowdsale: invalid manage fee");
    });
    
    it("Funding receiver as zero address should fail", async function () {
      // Set funding receiver as zero address
      invalidCrowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"],
        [startTime, endTime, await mockUSDT.getAddress(), maxFundingAmount, softCap, sharePrice, minDepositAmount, manageFeeBps, ethers.ZeroAddress, manager.address, manager.address, manager.address]
      );

      // Try to deploy Crowdsale, should fail
      await expect(
        createCrowdsale(coreVault, shareToken, manager, invalidCrowdsaleInitData)
      ).to.be.revertedWith("Crowdsale: invalid funding receiver");
    });
    
    it("Management fee receiver as zero address should fail", async function () {
      // Set management fee receiver as zero address
      invalidCrowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"],
        [startTime, endTime, await mockUSDT.getAddress(), maxFundingAmount, softCap, sharePrice, minDepositAmount, manageFeeBps, manager.address, ethers.ZeroAddress, manager.address, manager.address]
      );

      // Try to deploy Crowdsale, should fail
      await expect(
        createCrowdsale(coreVault, shareToken, manager, invalidCrowdsaleInitData)
      ).to.be.revertedWith("Crowdsale: invalid fee receiver");
    });
    
    it("Manager as zero address should fail", async function () {
      // Set manager as zero address
      invalidCrowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"],
        [startTime, endTime, await mockUSDT.getAddress(), maxFundingAmount, softCap, sharePrice, minDepositAmount, manageFeeBps, manager.address, manager.address, ethers.ZeroAddress, manager.address]
      );

      // Try to deploy Crowdsale, should fail
      await expect(
        createCrowdsale(coreVault, shareToken, manager, invalidCrowdsaleInitData)
      ).to.be.revertedWith("Crowdsale: invalid manager");
    });
  });

  describe("offchainManager related tests", function () {
    let depositAmount = parseUSDT("100")
    it("Non-offchainManager calling offChainDeposit should fail", async function () {
      // Get current nonce
      const currentNonce = await crowdsale.getOffchainNonce();
      
      // Generate valid signature
      const validSignature = await generateOffChainDepositSignature(
        validator,
        depositAmount,
        user1.address,
        Number(currentNonce),
        BigInt(await ethers.provider.getNetwork().then(n => n.chainId)),
        await crowdsale.getAddress(),
        TEST_PROOF_HASH
      );
      
      // Regular user tries to call offChainDeposit, should fail
      const OFFCHAIN_MANAGER_ROLE = await crowdsale.OFFCHAIN_MANAGER_ROLE();
      await expect(
        crowdsale.connect(user1).offChainDeposit(depositAmount, user1.address, validSignature, TEST_PROOF_HASH)
      ).to.be.revertedWithCustomError(crowdsale, "AccessControlUnauthorizedAccount")
        .withArgs(user1.address, OFFCHAIN_MANAGER_ROLE);

    });
    
    it("Non-offchainManager calling offChainRedeem should fail", async function () {
      // Get current nonce
      const currentNonce = await crowdsale.getOffchainNonce();
      
      // Generate valid signature
      const validSignature = await generateOffChainDepositSignature(
        validator,
        depositAmount,
        user1.address,
        Number(currentNonce),
        BigInt(await ethers.provider.getNetwork().then(n => n.chainId)),
        await crowdsale.getAddress(),
        TEST_PROOF_HASH
      );
      
      // First ensure there is a deposit
      await crowdsale.connect(offchainManager).offChainDeposit(depositAmount, user1.address, validSignature, TEST_PROOF_HASH)
      // Increase time beyond end time to make crowdsale fail
      await network.provider.send("evm_increaseTime", [86401]); 
      await network.provider.send("evm_mine");
      
      // Regular user tries to call offChainRedeem, should fail
      const OFFCHAIN_MANAGER_ROLE = await crowdsale.OFFCHAIN_MANAGER_ROLE();
      await expect(
        crowdsale.connect(user1).offChainRedeem(user1.address)
      ).to.be.revertedWithCustomError(crowdsale, "AccessControlUnauthorizedAccount")
        .withArgs(user1.address, OFFCHAIN_MANAGER_ROLE);

    });
    
    it("offchainManager should be able to successfully call offChainDeposit", async function () {
      // Get initial balance
      const initialShareBalance = await shareToken.balanceOf(user1.address);
      
      // Get current nonce
      const currentNonce = await crowdsale.getOffchainNonce();
      
      // Generate valid signature
      const validSignature = await generateOffChainDepositSignature(
        validator,
        depositAmount,
        user1.address,
        Number(currentNonce),
        BigInt(await ethers.provider.getNetwork().then(n => n.chainId)),
        await crowdsale.getAddress(),
        TEST_PROOF_HASH
      );
      
      // offchainManager calls offChainDeposit
      await crowdsale.connect(offchainManager).offChainDeposit(depositAmount, user1.address, validSignature, TEST_PROOF_HASH);
      
      // Verify share token balance increased
      expect(await shareToken.balanceOf(user1.address)).to.equal(initialShareBalance + depositAmount);
    });
    
    it("offchainManager should be able to successfully call offChainRedeem", async function () {
      // Get current nonce
      const currentNonce = await crowdsale.getOffchainNonce();
      
      // Generate valid signature
      const validSignature = await generateOffChainDepositSignature(
        validator,
        depositAmount,
        user1.address,
        Number(currentNonce),
        BigInt(await ethers.provider.getNetwork().then(n => n.chainId)),
        await crowdsale.getAddress(),
        TEST_PROOF_HASH
      );
      
      // First make a deposit
      await crowdsale.connect(offchainManager).offChainDeposit(depositAmount, user1.address, validSignature, TEST_PROOF_HASH);
      
      // Increase time beyond end time to make crowdsale fail
      await network.provider.send("evm_increaseTime", [86401]); 
      await network.provider.send("evm_mine");
      
      await shareToken.connect(user1).approve(await coreVault.getAddress(), depositAmount);
      // offchainManager calls offChainRedeem
      await crowdsale.connect(offchainManager).offChainRedeem(user1.address);
      
      // Verify share token balance decreased
      expect(await shareToken.balanceOf(user1.address)).to.equal(0);
    });

    it("After offchain manager change, new offchainManager can handle, and old offchainManager can also call", async function () {
      // First grant role to original offchainManager
      const OFFCHAIN_MANAGER_ROLE = await crowdsale.OFFCHAIN_MANAGER_ROLE();
      
      // Set user1 as offchainManager
      await crowdsale.connect(manager).grantRole(OFFCHAIN_MANAGER_ROLE, user1.address);
      
      // Get current nonce for first deposit
      let currentNonce = await crowdsale.getOffchainNonce();
      
      // Generate valid signature for first deposit
      let validSignature = await generateOffChainDepositSignature(
        validator,
        depositAmount,
        user2.address,
        Number(currentNonce),
        BigInt(await ethers.provider.getNetwork().then(n => n.chainId)),
        await crowdsale.getAddress(),
        TEST_PROOF_HASH
      );
      
      // First make a deposit
      await crowdsale.connect(user1).offChainDeposit(depositAmount, user2.address, validSignature, TEST_PROOF_HASH);
      
      // Get current nonce for second deposit
      currentNonce = await crowdsale.getOffchainNonce();
      
      // Generate valid signature for second deposit
      validSignature = await generateOffChainDepositSignature(
        validator,
        depositAmount,
        user2.address,
        Number(currentNonce),
        BigInt(await ethers.provider.getNetwork().then(n => n.chainId)),
        await crowdsale.getAddress(),
        TEST_PROOF_HASH
      );
      
      // Old offchainManager should also be able to handle (because role was not revoked)
      await crowdsale.connect(offchainManager).offChainDeposit(depositAmount, user2.address, validSignature, TEST_PROOF_HASH);
      
      // Increase time beyond end time to make crowdsale fail
      await network.provider.send("evm_increaseTime", [86401]); 
      await network.provider.send("evm_mine");
      
      // Change offchainManager - grant role to user2
      await crowdsale.connect(manager).grantRole(OFFCHAIN_MANAGER_ROLE, user2.address);

      await shareToken.connect(user2).approve(await coreVault.getAddress(), 2n * depositAmount);
      
      // New offchainManager should be able to handle
      await crowdsale.connect(user2).offChainRedeem(user2.address);
    
    });
  });
});
