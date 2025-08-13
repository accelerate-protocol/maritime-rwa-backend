import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Creation } from "../typechain-types/contracts/v2/creation/Creation";
import { BasicVault } from "../typechain-types/contracts/v2/templates/vault/BasicVault";
import { VaultToken } from "../typechain-types/contracts/v2/templates/token/VaultToken";
import { Crowdsale } from "../typechain-types/contracts/v2/templates/funding/Crowdsale";
import { AccumulatedYield } from "../typechain-types/contracts/v2/templates/yield/AccumulatedYield";

describe("V2 架构完整业务流程测试", function () {
    // 代币精度常量
    const TOKEN_DECIMALS = 6;
    const VAULT_TOKEN_DECIMALS = 6;
    
    // 测试配置常量
    const TEST_CONFIG = {
        // 时间配置
        FUNDING_DURATION: 3600, // 1小时
        START_TIME_OFFSET: 300, // 5分钟后开始
        
        // 金额配置
        MAX_SUPPLY: ethers.parseUnits("10000", VAULT_TOKEN_DECIMALS), // VaultToken 精度
        SOFT_CAP: ethers.parseUnits("9000", VAULT_TOKEN_DECIMALS), // VaultToken 精度
        ABOVE_SOFT_CAP_AMOUNT: ethers.parseUnits("20000", TOKEN_DECIMALS), // 确保达到softCap的金额 (USDT精度)
        SHARE_PRICE: 0n, // 将在 TEST_CONFIG 定义后设置
        MIN_DEPOSIT: ethers.parseUnits("10", TOKEN_DECIMALS), // 使用与代币相同的精度
        
        // 费用配置
        MANAGE_FEE_BPS: 1000, // 10%
        
        // 代币精度
        TOKEN_DECIMALS: TOKEN_DECIMALS,
        VAULT_TOKEN_DECIMALS: VAULT_TOKEN_DECIMALS,
        
        // 精度转换
        DECIMALS_MULTIPLIER: ethers.parseUnits("1", 0), // decimalsMultiplier
        SHARE_PRICE_DENOMINATOR: 10n ** 8n // SHARE_PRICE_DENOMINATOR = 10^8
    };

    // 设置 SHARE_PRICE = DECIMALS_MULTIPLIER * 10^8
    TEST_CONFIG.SHARE_PRICE = TEST_CONFIG.DECIMALS_MULTIPLIER * TEST_CONFIG.SHARE_PRICE_DENOMINATOR;

    // 合约实例
    let vault: BasicVault;
    let token: VaultToken;
    let fund: Crowdsale;
    let accumulatedYield: AccumulatedYield;
    let usdt: any; // 使用 any 类型避免类型问题

    // 用户账户
    let owner: HardhatEthersSigner;
    let manager: HardhatEthersSigner;
    let validator: HardhatEthersSigner;
    let user1: HardhatEthersSigner;
    let user2: HardhatEthersSigner;
    let user3: HardhatEthersSigner;
    let fundingReceiver: HardhatEthersSigner;
    let manageFeeReceiver: HardhatEthersSigner;
    let dividendTreasury: HardhatEthersSigner;

    // 时间变量
    let startTime: number;
    let endTime: number;

    beforeEach(async function () {
        [owner, manager, validator, user1, user2, user3, fundingReceiver, manageFeeReceiver, dividendTreasury] = await ethers.getSigners();

        // 设置时间 - 使用 Hardhat 网络时间，让融资立即开始
        const currentBlock = await ethers.provider.getBlock("latest");
        if (!currentBlock) {
            throw new Error("无法获取当前区块");
        }
        const currentTime = currentBlock.timestamp;
        startTime = currentTime; // 立即开始
        endTime = startTime + TEST_CONFIG.FUNDING_DURATION;

        // 部署测试代币
        const MockUSDTFactory = await ethers.getContractFactory("contracts/v2/mocks/MockUSDT.sol:MockUSDT");
        usdt = await MockUSDTFactory.deploy("Mock USDT", "USDT");
        
        // 给测试用户分配初始余额
        await usdt.mint(user1.address, ethers.parseUnits("1000000", TEST_CONFIG.TOKEN_DECIMALS));
        await usdt.mint(user2.address, ethers.parseUnits("1000000", TEST_CONFIG.TOKEN_DECIMALS));
        await usdt.mint(user3.address, ethers.parseUnits("1000000", TEST_CONFIG.TOKEN_DECIMALS));
        await usdt.mint(manager.address, ethers.parseUnits("1000000", TEST_CONFIG.TOKEN_DECIMALS));
        await usdt.mint(dividendTreasury.address, ethers.parseUnits("1000000", TEST_CONFIG.TOKEN_DECIMALS));

        // 部署模板合约
        const VaultTemplateFactory = await ethers.getContractFactory("BasicVault");
        const vaultTemplate = await VaultTemplateFactory.deploy();
        
        const TokenTemplateFactory = await ethers.getContractFactory("VaultToken");
        const tokenTemplate = await TokenTemplateFactory.deploy();
        
        const FundTemplateFactory = await ethers.getContractFactory("Crowdsale");
        const fundTemplate = await FundTemplateFactory.deploy();
        
        const YieldTemplateFactory = await ethers.getContractFactory("AccumulatedYield");
        const yieldTemplate = await YieldTemplateFactory.deploy();

        // 部署工厂合约
        const VaultFactoryFactory = await ethers.getContractFactory("contracts/v2/factories/VaultFactory.sol:VaultFactory");
        const vaultFactory = await VaultFactoryFactory.deploy();
        
        const TokenFactoryFactory = await ethers.getContractFactory("contracts/v2/factories/TokenFactory.sol:TokenFactory");
        const tokenFactory = await TokenFactoryFactory.deploy();
        
        const FundFactoryFactory = await ethers.getContractFactory("contracts/v2/factories/FundFactory.sol:FundFactory");
        const fundFactory = await FundFactoryFactory.deploy();
        
        const YieldFactoryFactory = await ethers.getContractFactory("contracts/v2/factories/YieldFactory.sol:YieldFactory");
        const yieldFactory = await YieldFactoryFactory.deploy();

        // 注册模板到工厂
        await vaultFactory.connect(owner).addTemplate(0, await vaultTemplate.getAddress());
        await tokenFactory.connect(owner).addTemplate(0, await tokenTemplate.getAddress());
        await fundFactory.connect(owner).addTemplate(0, await fundTemplate.getAddress());
        await yieldFactory.connect(owner).addTemplate(0, await yieldTemplate.getAddress());

        // 部署 Creation 合约
        const CreationFactory = await ethers.getContractFactory("Creation");
        const creation = await CreationFactory.deploy(
            await vaultFactory.getAddress(),
            await tokenFactory.getAddress(),
            await fundFactory.getAddress(),
            await yieldFactory.getAddress()
        );

        // 准备初始化数据
        const vaultInitData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "bool", "address[]"],
            [manager.address, validator.address, false, []]
        );

        const tokenInitData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["string", "string", "uint8"],
            ["Test Vault Token", "TVT", TEST_CONFIG.VAULT_TOKEN_DECIMALS]
        );

        const fundInitData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "uint256", "address"],
            [
                startTime,
                endTime,
                await usdt.getAddress(),
                TEST_CONFIG.MAX_SUPPLY,
                TEST_CONFIG.SOFT_CAP,
                TEST_CONFIG.SHARE_PRICE,
                TEST_CONFIG.MIN_DEPOSIT,
                TEST_CONFIG.MANAGE_FEE_BPS,
                fundingReceiver.address,
                manageFeeReceiver.address,
                TEST_CONFIG.DECIMALS_MULTIPLIER, // decimalsMultiplier
                manager.address // manager
            ]
        );

        const yieldInitData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "address"],
            [
                await usdt.getAddress(), // rewardToken
                manager.address, // rewardManager
                manager.address // dividendTreasury
            ]
        );

        // 使用 deployAll 方法部署
        const tx = await creation.deployAll(
            "CompleteFlowProject", // projectName
            0, // vaultTemplateId
            vaultInitData,
            0, // tokenTemplateId
            tokenInitData,
            0, // fundTemplateId
            fundInitData,
            0, // dividendTemplateId
            yieldInitData
        );
        
        // 等待交易确认并从事件中获取部署的地址
        const receipt = await tx.wait();
        if (!receipt) {
            throw new Error("部署交易失败");
        }
        
        // 从 ProjectCreated 事件中解析地址
        let vaultAddress, tokenAddress, fundAddress, yieldAddress;
        
        for (const log of receipt.logs) {
            try {
                const parsedLog = creation.interface.parseLog(log);
                if (parsedLog && parsedLog.name === "ProjectCreated") {
                    vaultAddress = parsedLog.args[1]; // vault
                    tokenAddress = parsedLog.args[2]; // token
                    fundAddress = parsedLog.args[3];  // fund
                    yieldAddress = parsedLog.args[4]; // yield
                    break;
                }
            } catch (e) {
                // 忽略无法解析的日志
            }
        }
        
        if (!vaultAddress || !tokenAddress || !fundAddress || !yieldAddress) {
            throw new Error("无法从事件中解析合约地址");
        }
        
        // 获取合约实例
        vault = await ethers.getContractAt("BasicVault", vaultAddress);
        token = await ethers.getContractAt("VaultToken", tokenAddress);
        fund = await ethers.getContractAt("Crowdsale", fundAddress);
        accumulatedYield = await ethers.getContractAt("AccumulatedYield", yieldAddress);

        // 手动配置模块间的依赖关系（以 manager 身份）
        await vault.connect(manager).setVaultToken(await token.getAddress());
        await vault.connect(manager).setFundingModule(await fund.getAddress());
        await vault.connect(manager).setDividendModule(await accumulatedYield.getAddress());

        // 注意：代币在初始化时被暂停，只有在融资成功后才应该解锁
        // 这里不直接解锁，而是在测试中通过正确的业务流程来解锁
    });

    // 工具函数
    async function prepareDepositSignature(user: any, amount: any, receiver: any, nonce?: any) {
        const currentNonce = nonce || await fund.getManagerNonce();
        const messageHash = await fund.getDepositSignatureMessage(amount, receiver, currentNonce);
        return await manager.signMessage(ethers.getBytes(messageHash));
    }

    async function prepareRedeemSignature(user: any, amount: any, receiver?: any, nonce?: any) {
        const currentNonce = nonce || await fund.getManagerNonce();
        const currentReceiver = receiver || user.address;
        const messageHash = await fund.getRedeemSignatureMessage(amount, currentReceiver, currentNonce);
        return await manager.signMessage(ethers.getBytes(messageHash));
    }

    async function prepareDividendSignature(amount: any) {
        // AccumulatedYield 使用不同的签名方式：keccak256(abi.encodePacked(vault, dividendAmount))
        const payload = ethers.keccak256(ethers.solidityPacked(
            ["address", "uint256"],
            [await vault.getAddress(), amount]
        ));
        return await validator.signMessage(ethers.getBytes(payload));
    }

    function calculateExpectedShares(amount: any) {
        const feeAmount = (BigInt(amount) * BigInt(TEST_CONFIG.MANAGE_FEE_BPS)) / 10000n;
        const netAmount = BigInt(amount) - feeAmount;
        
        // 1. 先对 netAmount 进行 scaleUp（乘以 decimalsMultiplier）
        // 2. 然后乘以 SHARE_PRICE_DENOMINATOR
        // 3. 最后除以 sharePrice
        const scaledAmount = netAmount * BigInt(TEST_CONFIG.DECIMALS_MULTIPLIER);
        const shares = (scaledAmount * TEST_CONFIG.SHARE_PRICE_DENOMINATOR) / BigInt(TEST_CONFIG.SHARE_PRICE);
        
        return shares;
    }

    function calculateRedeemAmount(shares: any) {
        return (shares * TEST_CONFIG.SHARE_PRICE) / (10n ** BigInt(TEST_CONFIG.VAULT_TOKEN_DECIMALS));
    }

    async function performLargeDeposit(amount: any) {
        const signature = await prepareDepositSignature(user1, amount, user1.address);
        await usdt.connect(user1).approve(await fund.getAddress(), amount);
        return await fund.connect(user1).deposit(amount, user1.address, signature);
    }

    async function distributeDividend() {
        const dividendAmount = ethers.parseUnits("10000", TEST_CONFIG.TOKEN_DECIMALS);
        const signature = await prepareDividendSignature(dividendAmount);
        await usdt.connect(manager).approve(await accumulatedYield.getAddress(), dividendAmount);
        return await accumulatedYield.connect(manager).distributeDividend(dividendAmount, signature);
    }

    async function verifyFinalState() {
        expect(await token.paused()).to.be.false;
    }

    describe("1. 基础设置测试", function () {
        it("应该成功部署完整的V2架构", async function () {
            expect(await vault.vaultToken()).to.equal(await token.getAddress());
            expect(await vault.funding()).to.equal(await fund.getAddress());
            expect(await vault.accumulatedYield()).to.equal(await accumulatedYield.getAddress());
        });

        it("应该正确设置初始参数", async function () {
            expect(await fund.maxSupply()).to.equal(TEST_CONFIG.MAX_SUPPLY);
            expect(await fund.softCap()).to.equal(TEST_CONFIG.SOFT_CAP);
            expect(await fund.manageFeeBps()).to.equal(TEST_CONFIG.MANAGE_FEE_BPS);
            expect(await fund.manager()).to.equal(manager.address);
            expect(await vault.manager()).to.equal(manager.address);
        });

        it("应该正确设置代币参数", async function () {
            expect(await token.name()).to.equal("Test Vault Token");
            expect(await token.symbol()).to.equal("TVT");
            expect(await token.decimals()).to.equal(TEST_CONFIG.VAULT_TOKEN_DECIMALS);
            expect(await token.vault()).to.equal(await vault.getAddress());
        });
    });

    describe("2. Deposit 操作测试", function () {
        it("应该成功处理正常deposit", async function () {
            const depositAmount = ethers.parseUnits("1000", TEST_CONFIG.TOKEN_DECIMALS);
            
            const signature = await prepareDepositSignature(user1, depositAmount, user1.address);
            
            await usdt.connect(user1).approve(await fund.getAddress(), depositAmount);
            const tx = await fund.connect(user1).deposit(depositAmount, user1.address, signature);
            
            // 验证份额计算
            const expectedShares = calculateExpectedShares(depositAmount);
            const actualShares = await token.balanceOf(user1.address);
            
            expect(actualShares).to.equal(expectedShares);
            
            // 验证费用扣除
            const expectedFee = (BigInt(depositAmount) * BigInt(TEST_CONFIG.MANAGE_FEE_BPS)) / 10000n;
            expect(await fund.manageFee()).to.equal(expectedFee);
            
            // 验证代币仍然处于暂停状态（融资期间）
            expect(await token.paused()).to.be.true;
        });

        it("应该正确处理供应量不足的情况", async function () {
            // 先进行大额deposit，接近最大供应量
            const largeAmount = ethers.parseUnits("8000", TEST_CONFIG.TOKEN_DECIMALS);
            await performLargeDeposit(largeAmount);
            
            // 尝试deposit一个较大的金额，但供应量不足
            const remainingAmount = ethers.parseUnits("5000", TEST_CONFIG.TOKEN_DECIMALS);
            const signature = await prepareDepositSignature(user2, remainingAmount, user2.address);
            
            await usdt.connect(user2).approve(await fund.getAddress(), remainingAmount);
            const tx = await fund.connect(user2).deposit(remainingAmount, user2.address, signature);
            
            // 验证用户获得了份额，但可能少于预期（因为供应量限制）
            expect(await token.balanceOf(user2.address)).to.be.gt(0);
            
            // 验证总供应量不超过最大供应量
            const totalSupply = await token.totalSupply();
            expect(totalSupply).to.be.lte(TEST_CONFIG.MAX_SUPPLY);
        });

        it("应该拒绝无效签名", async function () {
            const depositAmount = ethers.parseUnits("1000", TEST_CONFIG.TOKEN_DECIMALS);
            const invalidSignature = "0x" + "1".repeat(130); // 无效签名
            
            await usdt.connect(user1).approve(await fund.getAddress(), depositAmount);
            await expect(
                fund.connect(user1).deposit(depositAmount, user1.address, invalidSignature)
            ).to.be.revertedWith("ECDSA: invalid signature");
        });
        
        it("应该在融资期间拒绝代币转账", async function () {
            // 先进行deposit获得代币
            const depositAmount = ethers.parseUnits("1000", TEST_CONFIG.TOKEN_DECIMALS);
            const signature = await prepareDepositSignature(user1, depositAmount, user1.address);
            await usdt.connect(user1).approve(await fund.getAddress(), depositAmount);
            await fund.connect(user1).deposit(depositAmount, user1.address, signature);
            
            // 验证代币被暂停
            expect(await token.paused()).to.be.true;
            
            // 尝试转账（应该失败）
            const transferAmount = ethers.parseUnits("100", TEST_CONFIG.VAULT_TOKEN_DECIMALS);
            await expect(
                token.connect(user1).transfer(user2.address, transferAmount)
            ).to.be.revertedWith("VaultToken: token transfer while paused");
        });
    });

    describe("3. 融资成功解锁测试", function () {
        it("应该在融资成功后解锁代币交易", async function () {
            // 验证初始状态：代币被暂停
            expect(await token.paused()).to.be.true;
            
            // 先进行足够的deposit达到softCap
            await performLargeDeposit(TEST_CONFIG.ABOVE_SOFT_CAP_AMOUNT);
            
            // 等待融资期结束
            await ethers.provider.send("evm_increaseTime", [TEST_CONFIG.FUNDING_DURATION + 1]);
            await ethers.provider.send("evm_mine", []);
            
            // 验证融资成功条件
            const currentBlock = await ethers.provider.getBlock("latest");
            if (!currentBlock) { throw new Error("无法获取当前区块"); }
            expect(currentBlock.timestamp).to.be.gt(await fund.endTime());
            
            // 解锁代币交易
            const tx = await fund.connect(manager).unpauseTokenOnFundingSuccess();
            
            // 验证代币已解锁
            expect(await token.paused()).to.be.false;
            
            // 验证可以正常转账
            const transferAmount = ethers.parseUnits("100", TEST_CONFIG.VAULT_TOKEN_DECIMALS);
            await token.connect(user1).transfer(user2.address, transferAmount);
            expect(await token.balanceOf(user2.address)).to.equal(transferAmount);
        });
        
        it("应该在融资失败时拒绝解锁代币", async function () {
            // 验证初始状态：代币被暂停
            expect(await token.paused()).to.be.true;
            
            // 不进行足够的deposit，确保融资失败
            const smallAmount = ethers.parseUnits("1000", TEST_CONFIG.TOKEN_DECIMALS);
            await performLargeDeposit(smallAmount);
            
            // 等待融资期结束
            await ethers.provider.send("evm_increaseTime", [TEST_CONFIG.FUNDING_DURATION + 1]);
            await ethers.provider.send("evm_mine", []);
            
            // 尝试解锁代币（应该失败）
            await expect(
                fund.connect(manager).unpauseTokenOnFundingSuccess()
            ).to.be.revertedWith("Crowdsale: funding not successful");
            
            // 验证代币仍然被暂停
            expect(await token.paused()).to.be.true;
        });
    });

    describe("4. Redeem 操作测试", function () {
        it("应该成功处理融资失败后的redeem", async function () {
            // 先进行deposit
            const depositAmount = ethers.parseUnits("1000", TEST_CONFIG.TOKEN_DECIMALS);
            const signature = await prepareDepositSignature(user1, depositAmount, user1.address);
            await usdt.connect(user1).approve(await fund.getAddress(), depositAmount);
            await fund.connect(user1).deposit(depositAmount, user1.address, signature);
            
            // 等待融资期结束（假设融资失败）
            await ethers.provider.send("evm_increaseTime", [TEST_CONFIG.FUNDING_DURATION + 1]);
            await ethers.provider.send("evm_mine", []);
            
            const userBalance = await token.balanceOf(user1.address);
            const redeemSignature = await prepareRedeemSignature(user1, userBalance, user1.address);
            
            // 批准代币燃烧 - 需要批准给vault地址
            await token.connect(user1).approve(await vault.getAddress(), userBalance);
            
            const initialUsdtBalance = await usdt.balanceOf(user1.address);
            const tx = await fund.connect(user1).redeem(user1.address, redeemSignature);
            
            // 验证资产返还
            const finalUsdtBalance = await usdt.balanceOf(user1.address);
            expect(finalUsdtBalance).to.be.gt(initialUsdtBalance);
        });
    });

    describe("5. Dividend 操作测试", function () {
        it("应该成功分发分红", async function () {
            // 先进行deposit让用户持有代币
            const depositAmount = ethers.parseUnits("1000", TEST_CONFIG.TOKEN_DECIMALS);
            const signature = await prepareDepositSignature(user1, depositAmount, user1.address);
            await usdt.connect(user1).approve(await fund.getAddress(), depositAmount);
            await fund.connect(user1).deposit(depositAmount, user1.address, signature);
            
            const dividendAmount = ethers.parseUnits("10000", TEST_CONFIG.TOKEN_DECIMALS);
            const signature2 = await prepareDividendSignature(dividendAmount);
            
            await usdt.connect(manager).approve(await accumulatedYield.getAddress(), dividendAmount);
            const tx = await accumulatedYield.connect(manager).distributeDividend(dividendAmount, signature2);
            
            // 验证分红状态
            const globalPool = await accumulatedYield.getGlobalPoolInfo();
            expect(globalPool.totalDividend).to.equal(dividendAmount);
            expect(globalPool.totalAccumulatedShares).to.be.gt(0);
        });

        it("应该正确处理转账触发的分红更新", async function () {
            // 先解锁代币交易
            await performLargeDeposit(TEST_CONFIG.ABOVE_SOFT_CAP_AMOUNT);
            await ethers.provider.send("evm_increaseTime", [TEST_CONFIG.FUNDING_DURATION + 1]);
            await ethers.provider.send("evm_mine", []);
            await fund.connect(manager).unpauseTokenOnFundingSuccess();
            
            // 先分发分红
            await distributeDividend();
            
            // 执行转账
            const transferAmount = ethers.parseUnits("100", TEST_CONFIG.VAULT_TOKEN_DECIMALS);
            await token.connect(user1).transfer(user2.address, transferAmount);
            
            // 验证用户状态更新
            const user1Info = await accumulatedYield.getUserInfo(user1.address);
            const user2Info = await accumulatedYield.getUserInfo(user2.address);
            
            expect(user1Info.accumulatedShares).to.be.gt(0);
            expect(user2Info.accumulatedShares).to.equal(0); // 转账后才持有代币
        });
    });

    describe("6. Claim 操作测试", function () {
        it("应该成功领取分红", async function () {
            // 先进行deposit
            const depositAmount = ethers.parseUnits("1000", TEST_CONFIG.TOKEN_DECIMALS);
            const signature = await prepareDepositSignature(user1, depositAmount, user1.address);
            await usdt.connect(user1).approve(await fund.getAddress(), depositAmount);
            await fund.connect(user1).deposit(depositAmount, user1.address, signature);
            
            // 分发分红
            await distributeDividend();
            
            // 领取分红
            const initialBalance = await usdt.balanceOf(user1.address);
            const tx = await accumulatedYield.connect(user1).claimReward();
            
            // 验证领取结果
            const finalBalance = await usdt.balanceOf(user1.address);
            expect(finalBalance).to.be.gt(initialBalance);
            
            // 验证用户状态更新
            const userInfo = await accumulatedYield.getUserInfo(user1.address);
            expect(userInfo.lastClaimDividend).to.be.gt(0);
        });
    });
});
