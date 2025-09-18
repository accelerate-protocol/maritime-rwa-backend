import { expect } from "chai";
import { ethers, network } from "hardhat";
import { 
  createVault, 
  createShareToken, 
  deployValidatorRegistry, 
  createCrowdsale, 
  deployMockUSDT, 
  generateDepositSignature,
  sharePrice,
  minDepositAmount,
  currentTime,
  startTime,
  endTime,
  maxFundingAmount,
  softCap,
  manageFeeBps
} from "./helpers";
import { parseUSDT } from "../utils/usdt";

describe("Crowdsale", function () {
  // 测试账户
  let manager: any;
  let validator: any;
  let user1: any;
  let user2: any;
  
  // 合约实例
  let validatorRegistry: any;
  let coreVault: any;
  let shareToken: any;
  let crowdsale: any;
  let mockUSDT: any;
  
  
  beforeEach(async function () {
    // 获取测试账户
    [manager, validator, user1, user2] = await ethers.getSigners();
    
    // 部署MockUSDT
    mockUSDT = await deployMockUSDT();
    
    // 部署ValidatorRegistry
    validatorRegistry = await deployValidatorRegistry(validator, manager);
    
    // 部署CoreVault，禁用白名单
    const { coreVault: coreVaultInstance, proxyAdmin, vaultImpl, coreVaultTemplateFactory } = await createVault(manager, validatorRegistry, false, []);
    coreVault = coreVaultInstance
    // 部署ShareToken
    const { shareToken:shareTokenInstance, shareTokenTemplateFactory } = await createShareToken(coreVault, manager);
    shareToken = shareTokenInstance
    // 部署Crowdsale
    const crowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"],
      [startTime, endTime, await mockUSDT.getAddress(), maxFundingAmount, softCap, sharePrice, minDepositAmount, manageFeeBps, manager.address, manager.address, manager.address, manager.address]
    );

    // 部署Crowdsale
    const { crowdsale: crowdsaleInstance, crowdsaleTemplateFactory } = await createCrowdsale(coreVault, shareToken, manager, crowdsaleInitData);
    crowdsale = crowdsaleInstance
    // 配置模块
    await coreVault.connect(manager).configureModules(
      await shareToken.getAddress(),
      await crowdsale.getAddress(),
      ethers.ZeroAddress
    );
  
    // 给用户铸造USDT
    await mockUSDT.mint(user1.address, parseUSDT("1000"));
    await mockUSDT.mint(user2.address, parseUSDT("1000"));
    
    // 用户授权Crowdsale合约使用USDT
    await mockUSDT.connect(user1).approve(await crowdsale.getAddress(), ethers.MaxUint256);
    await mockUSDT.connect(user2).approve(await crowdsale.getAddress(), ethers.MaxUint256);
  });

  // 在所有测试结束后重置区块链
  afterEach(async function () {
    await network.provider.send("hardhat_reset");
  });
  
  describe("deposit功能测试", function () {
    let depositAmount: bigint;
    let nonce: number;
    beforeEach(async function () {
      depositAmount = parseUSDT("100");
      await mockUSDT.connect(user1).approve(await crowdsale.getAddress(), ethers.MaxUint256);
      await mockUSDT.connect(user2).approve(await crowdsale.getAddress(), ethers.MaxUint256);
    })
    it("未经管理员签名的deposit应该失败", async function () {
      nonce = await crowdsale.getCallerNonce(user1.address);
      // 使用错误的签名者
      const wrongSignature = await generateDepositSignature(
        user2, // 错误的签名者
        "deposit",
        depositAmount,
        user1.address,
        nonce, // nonce
        await ethers.provider.getNetwork().then(n => n.chainId),
        await crowdsale.getAddress()
      );
      
      // 尝试deposit，应该失败
      await expect(
        crowdsale.connect(user1).deposit(depositAmount, user1.address, wrongSignature)
      ).to.be.revertedWith("Crowdsale: invalid signature");
    });
    
    it("使用正确签名的deposit应该成功", async function () {
      nonce = await crowdsale.getCallerNonce(user1.address);
      // 获取用户初始余额
      const initialUSDTBalance = await mockUSDT.balanceOf(user1.address);
      const initialShareBalance = await shareToken.balanceOf(user1.address);
      
      // 获取管理员签名
      const signature = await generateDepositSignature(
        manager,
        "deposit",
        depositAmount,
        user1.address,
        nonce, // nonce
        await ethers.provider.getNetwork().then(n => n.chainId),
        await crowdsale.getAddress()
      );
      
      // 执行deposit
      await crowdsale.connect(user1).deposit(depositAmount, user1.address, signature);
      
      // 验证USDT余额减少
      expect(await mockUSDT.balanceOf(user1.address)).to.equal(initialUSDTBalance - depositAmount);
      
    });
    
    it("重复使用相同nonce的签名应该失败", async function () {
      nonce = await crowdsale.getCallerNonce(user1.address);
      // 获取验证者签名
      const signature = await generateDepositSignature(
        manager,
        "deposit",
        depositAmount,
        user1.address,
        nonce, 
        await ethers.provider.getNetwork().then(n => n.chainId),
        await crowdsale.getAddress()
      );

      // 首次deposit
      await crowdsale.connect(user1).deposit(depositAmount, user1.address, signature);
      
      // 重复尝试deposit，应该失败
      await expect(
        crowdsale.connect(user1).deposit(depositAmount, user1.address, signature)
      ).to.be.revertedWith("Crowdsale: invalid signature");
    });
    
    it("deposit应该正确计算并收取管理费", async function () {
      // 获取初始余额
      const initialManagerFeeBalance = await crowdsale.manageFee();
      nonce = await crowdsale.getCallerNonce(user2.address);
      // 获取验证者签名
      const signature = await generateDepositSignature(
        manager,
        "deposit",
        depositAmount,
        user2.address,
        nonce, // 新的nonce
        await ethers.provider.getNetwork().then(n => n.chainId),
        await crowdsale.getAddress()
      );
      
      // 执行deposit
      await crowdsale.connect(user2).deposit(depositAmount, user2.address, signature);
      
      // 获取管理费率
      const manageFeeBps = await crowdsale.manageFeeBps();
      const expectedFee = (depositAmount * manageFeeBps) / BigInt(10000);
      
      // 验证管理费是否正确收取
      expect(await crowdsale.manageFee()).to.equal(
        initialManagerFeeBalance + expectedFee
      );
    });

    it("当请求的份额超过剩余供应量时，deposit应该买满", async function () {
      // 计算当前剩余供应量
      const remainingSupply = await crowdsale.getRemainingSupply()
      // 计算用户deposit的最大数量
      const maxDepositAmount = remainingSupply * BigInt(10000) / manageFeeBps;
      const requestDepositAmount = maxDepositAmount + BigInt(100);

      await mockUSDT.mint(user2.address, requestDepositAmount);

      const initialUSDTBalance = await mockUSDT.balanceOf(user2.address);

      // 执行deposit
      nonce = await crowdsale.getCallerNonce(user2.address);
      // 获取验证者签名
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
      ).to.be.revertedWith("Pausable: paused");
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
        
        // 执行redeem
        await crowdsale.connect(user2).redeem(redeemAmount, user2.address, signature);
        
        // 记录赎回后的余额
        const currentUSDTBalance = await mockUSDT.balanceOf(user2.address);
        const currentShareBalance = await shareToken.balanceOf(user2.address);
        
        // 计算本次赎回的USDT金额
        const redeemUSDTAmount = currentUSDTBalance - previousUSDTBalance;
        redeemUSDTAmounts.push(redeemUSDTAmount);
        
        // 验证赎回结果
        expect(currentShareBalance).to.equal(previousShareBalance - redeemAmount);
        expect(redeemUSDTAmount).to.equal(depositAmount);
        
        // 更新上一次余额，用于下一轮计算
        previousUSDTBalance = currentUSDTBalance;
        previousShareBalance = currentShareBalance;
      }
      
      // 验证所有赎回的金额是否一样
      for (let i = 1n; i < BigInt(redeemUSDTAmounts.length); i++) {
        expect(redeemUSDTAmounts[Number(i)]).to.equal(redeemUSDTAmounts[0n]);
      }
    })
  })
  
  describe("offChainDeposit功能测试", function () {
    let depositAmount = parseUSDT("1000");
    it("不是管理员发起的offChainDeposit应该失败", async function () {
      // 尝试offChainDeposit，应该失败
      await expect(
        crowdsale.connect(user1).offChainDeposit(depositAmount, user1.address)
      ).to.be.revertedWith("Crowdsale: only offchain manager");
    });
    
    it("使用正确管理员的offChainDeposit应该成功", async function () {
      // 获取用户初始余额
      const initialUSDTBalance = await mockUSDT.balanceOf(manager.address);
      const initialShareBalance = await shareToken.balanceOf(user1.address);
      
      // 执行offChainDeposit
      await crowdsale.connect(manager).offChainDeposit(depositAmount, user1.address);
      
      // 验证USDT余额没变
      expect(await mockUSDT.balanceOf(manager.address)).to.equal(initialUSDTBalance);
      
      // 验证股份代币余额增加
      expect(await shareToken.balanceOf(user1.address)).to.equal(initialShareBalance + depositAmount);
      
      expect(await crowdsale.manageFee()).to.equal(0);
      expect(await crowdsale.fundingAssets()).to.equal(0);
    });
    
    it("合约暂停后offChainDeposit应该失败", async function () {
      // 暂停合约
      await crowdsale.connect(manager).pause();
    
      
      // 尝试offChainDeposit，应该失败
      await expect(
        crowdsale.connect(manager).offChainDeposit(depositAmount, user1.address)
      ).to.be.revertedWith("Pausable: paused");
    });
  });
  
  describe("offChainRedeem功能测试", function () {
    let depositAmount = parseUSDT("1000");
    beforeEach(async function () {
      await crowdsale.connect(manager).offChainDeposit(depositAmount, user1.address);
      //验证shareToken增加
      expect(await shareToken.balanceOf(user1.address)).to.equal(depositAmount);
      await shareToken.connect(user1).approve(await coreVault.getAddress(), depositAmount);

      // 增加时间超过结束时间(24小时+1秒)
      await network.provider.send("evm_increaseTime", [86401]); 
      await network.provider.send("evm_mine"); // 挖一个新区块使时间生效
      // 验证众筹期已结束
      expect(await crowdsale.isFundingPeriodActive()).to.be.false;
    });
    
    it("不通过管理员的offChainRedeem应该失败", async function () {
      // 尝试offChainRedeem，应该失败
      await expect(
        crowdsale.connect(user1).offChainRedeem(user1.address)
      ).to.be.revertedWith("Crowdsale: only offchain manager");
    });
    
    it("使用管理员发起的offChainRedeem应该成功", async function () {
      // 获取用户初始余额
      const initialUSDTBalance = await mockUSDT.balanceOf(user1.address);
      const initialShareBalance = await shareToken.balanceOf(user1.address);
      
      // 执行offChainRedeem
      await crowdsale.connect(manager).offChainRedeem(user1.address);
      
      // 验证USDT余额不变
      expect(await mockUSDT.balanceOf(user1.address)).to.equal(initialUSDTBalance);
      
      // 验证股份代币余额减少
      expect(await shareToken.balanceOf(user1.address)).to.equal(initialShareBalance - depositAmount);
    });
    
    it("合约暂停后offChainRedeem应该失败", async function () {
      // 暂停合约
      await crowdsale.connect(manager).pause();
      
      // 尝试offChainRedeem，应该失败
      await expect(
        crowdsale.connect(manager).offChainRedeem(user1.address)
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("withdrawFundingAssets功能测试", function () {
    let fundingAmount = parseUSDT("10000");
    
    beforeEach(async function () {
      // 通过deposit函数模拟筹集资金
      await mockUSDT.mint(user1.address, fundingAmount);
      await mockUSDT.connect(user1).approve(await crowdsale.getAddress(), fundingAmount);
      
      // 获取nonce
      const nonce = await crowdsale.getCallerNonce(user1.address);
      
      // 获取验证者签名
      const signature = await generateDepositSignature(
        manager,
        "deposit",
        fundingAmount,
        user1.address,
        nonce,
        await ethers.provider.getNetwork().then(n => n.chainId),
        await crowdsale.getAddress()
      );
      
      // 执行deposit
      await crowdsale.connect(user1).deposit(fundingAmount, user1.address, signature);
    });

    it("融资未成功时，提取资金应该失败", async function () {
      // 融资未成功，提取资金应该失败
      await expect(crowdsale.connect(manager).withdrawFundingAssets())
        .to.be.revertedWith("Crowdsale: funding was not successful");
    });
    
    it("只有fundingReceiver或manager可以提取筹集的资金", async function () {
      // 增加时间超过结束时间(24小时+1秒)，使众筹结束
      await network.provider.send("evm_increaseTime", [86401]); 
      await network.provider.send("evm_mine"); // 挖一个新区块使时间生效
      // 普通用户尝试提取筹集的资金，应该失败
      await expect(crowdsale.connect(user1).withdrawFundingAssets())
        .to.be.revertedWith("Crowdsale: only funding receiver or manager");
    });
    
    it("提取资金后不能再次提取", async function () {
      // 增加时间超过结束时间(24小时+1秒)，使众筹结束
      await network.provider.send("evm_increaseTime", [86401]); 
      await network.provider.send("evm_mine"); // 挖一个新区块使时间生效
      // 先提取一次筹集的资金
      await crowdsale.connect(manager).withdrawFundingAssets();
      
      // 尝试再次提取，应该失败
      await expect(crowdsale.connect(manager).withdrawFundingAssets())
        .to.be.revertedWith("Crowdsale: no funding assets");
    });
  });
  
  describe("withdrawManageFee功能测试", function () {
    let depositAmount = parseUSDT("10000");
    let manageFeeAmount: bigint;
    
    beforeEach(async function () {
      // 通过deposit函数模拟收取管理费
      await mockUSDT.mint(user1.address, depositAmount);
      await mockUSDT.connect(user1).approve(await crowdsale.getAddress(), depositAmount);
      
      // 获取nonce
      const nonce = await crowdsale.getCallerNonce(user1.address);
      
      // 获取验证者签名
      const signature = await generateDepositSignature(
        manager,
        "deposit",
        depositAmount,
        user1.address,
        nonce,
        await ethers.provider.getNetwork().then(n => n.chainId),
        await crowdsale.getAddress()
      );
      
      // 获取管理费率
      const manageFeeBps = await crowdsale.manageFeeBps();
      manageFeeAmount = (depositAmount * manageFeeBps) / BigInt(10000);
      
      // 执行deposit
      await crowdsale.connect(user1).deposit(depositAmount, user1.address, signature);     
    });
    
    it("融资未结束，提取管理费应该失败", async function () {
      await expect(crowdsale.connect(manager).withdrawManageFee())
        .to.be.revertedWith("Crowdsale: funding was not successful");
    })

    it("只有manageFeeReceiver或manager可以提取管理费", async function () {      
      // 增加时间超过结束时间(24小时+1秒)，使众筹结束
      await network.provider.send("evm_increaseTime", [86401]); 
      await network.provider.send("evm_mine"); // 挖一个新区块使时间生效
      // 普通用户尝试提取管理费，应该失败
      await expect(crowdsale.connect(user1).withdrawManageFee())
        .to.be.revertedWith("Crowdsale: only manage fee receiver or manager");
    });
    
    it("提取管理费后不能再次提取", async function () {
      // 增加时间超过结束时间(24小时+1秒)，使众筹结束
      await network.provider.send("evm_increaseTime", [86401]); 
      await network.provider.send("evm_mine"); // 挖一个新区块使时间生效
      // 先提取一次管理费
      await crowdsale.connect(manager).withdrawManageFee();
      
      // 尝试再次提取，应该失败
      await expect(crowdsale.connect(manager).withdrawManageFee())
        .to.be.revertedWith("Crowdsale: no manage fee");
    });
  });
  
  describe("setManager功能测试", function () {
    it("只有当前manager可以设置新的manager", async function () {
      // 普通用户尝试设置新的manager，应该失败
      await expect(crowdsale.connect(user1).setManager(user2.address))
        .to.be.revertedWith("Crowdsale: only manager");
    });
    
    it("manager可以成功设置新的manager", async function () {
      // 获取当前manager
      const oldManager = await crowdsale.manager();
      
      // 设置新的manager
      await crowdsale.connect(manager).setManager(user2.address);
      
      // 验证manager已经被更新
      expect(await crowdsale.manager()).to.equal(user2.address);
      expect(await crowdsale.manager()).to.not.equal(oldManager);
    });
    
    it("设置为零地址应该失败", async function () {
      // 尝试设置零地址作为manager，应该失败
      await expect(crowdsale.connect(manager).setManager(ethers.ZeroAddress))
        .to.be.revertedWith("Crowdsale: invalid manager address");
    });
    
    it("新manager应该能够执行manager权限的操作", async function () {
      // 设置新的manager
      await crowdsale.connect(manager).setManager(user2.address);
      
      // 新manager应该能够暂停合约
      await crowdsale.connect(user2).pause();
      expect(await crowdsale.paused()).to.be.true;
      
      // 新manager应该能够恢复合约
      await crowdsale.connect(user2).unpause();
      expect(await crowdsale.paused()).to.be.false;
    });
  });

  describe("初始化参数验证测试", function () {
    let invalidCrowdsaleInitData: string;
    
    it("开始时间晚于结束时间应该失败", async function () {
      // 设置开始时间晚于结束时间
      invalidCrowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"],
        [endTime, startTime, await mockUSDT.getAddress(), maxFundingAmount, softCap, sharePrice, minDepositAmount, manageFeeBps, manager.address, manager.address, manager.address, manager.address]
      );

      // 尝试部署Crowdsale，应该失败
      await expect(
        createCrowdsale(coreVault, shareToken, manager, invalidCrowdsaleInitData)
      ).to.be.revertedWith("Crowdsale: invalid time range");
    });
    
    it("结束时间早于当前时间应该失败", async function () {
      // 设置结束时间早于当前时间
      const pastEndTime = BigInt(currentTime - 86400); // 24小时前
      const startTime = BigInt(currentTime - 86400 * 2); // 24小时前的前一个小时
      invalidCrowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"],
        [startTime, pastEndTime, await mockUSDT.getAddress(), maxFundingAmount, softCap, sharePrice, minDepositAmount, manageFeeBps, manager.address, manager.address, manager.address, manager.address]
      );

      // 尝试部署Crowdsale，应该失败
      await expect(
        createCrowdsale(coreVault, shareToken, manager, invalidCrowdsaleInitData)
      ).to.be.revertedWith("Crowdsale: end time in past");
    });
    
    it("资产代币地址为零地址应该失败", async function () {
      // 设置资产代币地址为零地址
      invalidCrowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"],
        [startTime, endTime, ethers.ZeroAddress, maxFundingAmount, softCap, sharePrice, minDepositAmount, manageFeeBps, manager.address, manager.address, manager.address, manager.address]
      );

      // 尝试部署Crowdsale，应该失败
      await expect(
        createCrowdsale(coreVault, shareToken, manager, invalidCrowdsaleInitData)
      ).to.be.revertedWith("Crowdsale: invalid asset token");
    });
    
    it("最大供应量为0应该失败", async function () {
      // 设置最大供应量为0
      invalidCrowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"],
        [startTime, endTime, await mockUSDT.getAddress(), 0, softCap, sharePrice, minDepositAmount, manageFeeBps, manager.address, manager.address, manager.address, manager.address]
      );

      // 尝试部署Crowdsale，应该失败
      await expect(
        createCrowdsale(coreVault, shareToken, manager, invalidCrowdsaleInitData)
      ).to.be.revertedWith("Crowdsale: invalid max supply");
    });
    
    it("软上限大于最大供应量应该失败", async function () {
      // 设置软上限大于最大供应量
      const invalidSoftCap = maxFundingAmount + parseUSDT("1000");
      invalidCrowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"],
        [startTime, endTime, await mockUSDT.getAddress(), maxFundingAmount, invalidSoftCap, sharePrice, minDepositAmount, manageFeeBps, manager.address, manager.address, manager.address, manager.address]
      );

      // 尝试部署Crowdsale，应该失败
      await expect(
        createCrowdsale(coreVault, shareToken, manager, invalidCrowdsaleInitData)
      ).to.be.revertedWith("Crowdsale: invalid soft cap");
    });
    
    it("股价为0应该失败", async function () {
      // 设置股价为0
      invalidCrowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"],
        [startTime, endTime, await mockUSDT.getAddress(), maxFundingAmount, softCap, 0, minDepositAmount, manageFeeBps, manager.address, manager.address, manager.address, manager.address]
      );

      // 尝试部署Crowdsale，应该失败
      await expect(
        createCrowdsale(coreVault, shareToken, manager, invalidCrowdsaleInitData)
      ).to.be.revertedWith("Crowdsale: invalid share price");
    });
    
    it("最小存款金额为0应该失败", async function () {
      // 设置最小存款金额为0
      invalidCrowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"],
        [startTime, endTime, await mockUSDT.getAddress(), maxFundingAmount, softCap, sharePrice, 0, manageFeeBps, manager.address, manager.address, manager.address, manager.address]
      );

      // 尝试部署Crowdsale，应该失败
      await expect(
        createCrowdsale(coreVault, shareToken, manager, invalidCrowdsaleInitData)
      ).to.be.revertedWith("Crowdsale: invalid min deposit");
    });
    
    it("管理费率超过10000应该失败", async function () {
      // 设置管理费率超过10000
      const invalidManageFeeBps = BigInt(10001);
      invalidCrowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"],
        [startTime, endTime, await mockUSDT.getAddress(), maxFundingAmount, softCap, sharePrice, minDepositAmount, invalidManageFeeBps, manager.address, manager.address, manager.address, manager.address]
      );

      // 尝试部署Crowdsale，应该失败
      await expect(
        createCrowdsale(coreVault, shareToken, manager, invalidCrowdsaleInitData)
      ).to.be.revertedWith("Crowdsale: invalid manage fee");
    });
    
    it("资金接收者为零地址应该失败", async function () {
      // 设置资金接收者为零地址
      invalidCrowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"],
        [startTime, endTime, await mockUSDT.getAddress(), maxFundingAmount, softCap, sharePrice, minDepositAmount, manageFeeBps, ethers.ZeroAddress, manager.address, manager.address, manager.address]
      );

      // 尝试部署Crowdsale，应该失败
      await expect(
        createCrowdsale(coreVault, shareToken, manager, invalidCrowdsaleInitData)
      ).to.be.revertedWith("Crowdsale: invalid funding receiver");
    });
    
    it("管理费接收者为零地址应该失败", async function () {
      // 设置管理费接收者为零地址
      invalidCrowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"],
        [startTime, endTime, await mockUSDT.getAddress(), maxFundingAmount, softCap, sharePrice, minDepositAmount, manageFeeBps, manager.address, ethers.ZeroAddress, manager.address, manager.address]
      );

      // 尝试部署Crowdsale，应该失败
      await expect(
        createCrowdsale(coreVault, shareToken, manager, invalidCrowdsaleInitData)
      ).to.be.revertedWith("Crowdsale: invalid fee receiver");
    });
    
    it("管理员为零地址应该失败", async function () {
      // 设置管理员为零地址
      invalidCrowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"],
        [startTime, endTime, await mockUSDT.getAddress(), maxFundingAmount, softCap, sharePrice, minDepositAmount, manageFeeBps, manager.address, manager.address, ethers.ZeroAddress, manager.address]
      );

      // 尝试部署Crowdsale，应该失败
      await expect(
        createCrowdsale(coreVault, shareToken, manager, invalidCrowdsaleInitData)
      ).to.be.revertedWith("Crowdsale: invalid manager");
    });
  });

  describe("offchainManager相关测试", function () {
    let depositAmount = parseUSDT("100")
    it("非offchainManager调用offChainDeposit应该失败", async function () {
      // 普通用户尝试调用offChainDeposit，应该失败
      await expect(
        crowdsale.connect(user1).offChainDeposit(depositAmount, user1.address)
      ).to.be.revertedWith("Crowdsale: only offchain manager");

    });
    
    it("非offchainManager调用offChainRedeem应该失败", async function () {
      // 先确保有deposit
      await crowdsale.connect(manager).offChainDeposit(depositAmount, user1.address)
      // 增加时间超过结束时间，使众筹失败
      await network.provider.send("evm_increaseTime", [86401]); 
      await network.provider.send("evm_mine");
      
      // 普通用户尝试调用offChainRedeem，应该失败
      await expect(
        crowdsale.connect(user1).offChainRedeem(user1.address)
      ).to.be.revertedWith("Crowdsale: only offchain manager");

    });
    
    it("offchainManager应该能成功调用offChainDeposit", async function () {
      // 获取初始余额
      const initialShareBalance = await shareToken.balanceOf(user1.address);
      
      // offchainManager调用offChainDeposit
      await crowdsale.connect(manager).offChainDeposit(depositAmount, user1.address);
      
      // 验证股份代币余额增加
      expect(await shareToken.balanceOf(user1.address)).to.equal(initialShareBalance + depositAmount);
    });
    
    it("offchainManager应该能成功调用offChainRedeem", async function () {
      // 先进行存款
      await crowdsale.connect(manager).offChainDeposit(depositAmount, user1.address);
      
      // 增加时间超过结束时间，使众筹失败
      await network.provider.send("evm_increaseTime", [86401]); 
      await network.provider.send("evm_mine");
      
      await shareToken.connect(user1).approve(await coreVault.getAddress(), depositAmount);
      // offchainManager调用offChainRedeem
      await crowdsale.connect(manager).offChainRedeem(user1.address);
      
      // 验证股份代币余额减少
      expect(await shareToken.balanceOf(user1.address)).to.equal(0);
    });

    it("offchain manger变更后，新的offchainManager能处理，旧的offchainManager无法调用", async function () {
      // 设置offchainManager
      await crowdsale.connect(manager).setOffchainManager(validator.address);
      
      // 先进行存款
      await crowdsale.connect(validator).offChainDeposit(depositAmount, user1.address);
      
      // 增加时间超过结束时间，使众筹失败
      await network.provider.send("evm_increaseTime", [86401]); 
      await network.provider.send("evm_mine");
      
      // 变更offchainManager
      await crowdsale.connect(validator).setOffchainManager(user1.address);

      await shareToken.connect(user1).approve(await coreVault.getAddress(), depositAmount);
      
      // 新的offchainManager应该能处理
      await crowdsale.connect(user1).offChainRedeem(user1.address);
      
      // 旧的offchainManager应该不能处理
      await expect(
        crowdsale.connect(validator).offChainRedeem(user1.address)
      ).to.be.revertedWith("Crowdsale: only offchain manager");
    });
  });
});
