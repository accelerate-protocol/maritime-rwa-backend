import { expect, use } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Creation } from "../typechain-types/contracts/v2/creation/Creation";
import { BasicVault } from "../typechain-types/contracts/v2/templates/vault/BasicVault";
import { VaultToken } from "../typechain-types/contracts/v2/templates/token/VaultToken";
import { Crowdsale } from "../typechain-types/contracts/v2/templates/funding/Crowdsale";
import { AccumulatedYield } from "../typechain-types/contracts/v2/templates/yield/AccumulatedYield";
import { ZeroAddress } from "ethers";
import { userInfo } from "os";

describe("V2 架构完整业务流程测试-开放式", function () {
    // 代币精度常量
    const TOKEN_DECIMALS = 6;
    const VAULT_TOKEN_DECIMALS = 6;

    // 测试配置常量
    const TEST_CONFIG = {
        // 时间配置
        FUNDING_DURATION: 120, // 2min
        START_TIME_OFFSET: 10, // 10s后开始

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

        // 验证账户对应关系
        console.log("账户对应关系:");
        console.log("owner:", owner.address);
        console.log("manager:", manager.address);
        console.log("validator:", validator.address);
        console.log("user1:", user1.address);
        console.log("user2:", user2.address);
        console.log("user3:", user3.address);
        console.log("fundingReceiver:", fundingReceiver.address);
        console.log("manageFeeReceiver:", manageFeeReceiver.address);
        console.log("dividendTreasury:", dividendTreasury.address);

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
        console.log("USDT 合约地址:", await usdt.getAddress());


        // 给测试用户分配初始余额
        await usdt.mint(user1.address, ethers.parseUnits("1000000", TEST_CONFIG.TOKEN_DECIMALS));
        await usdt.mint(user2.address, ethers.parseUnits("1000000", TEST_CONFIG.TOKEN_DECIMALS));
        await usdt.mint(user3.address, ethers.parseUnits("1000000", TEST_CONFIG.TOKEN_DECIMALS));
        await usdt.mint(manager.address, ethers.parseUnits("1000000", TEST_CONFIG.TOKEN_DECIMALS));
        await usdt.mint(dividendTreasury.address, ethers.parseUnits("1000000", TEST_CONFIG.TOKEN_DECIMALS));

        // 部署模板合约
        const VaultTemplateFactory = await ethers.getContractFactory("BasicVault");
        const vaultTemplate = await VaultTemplateFactory.deploy();
        console.log("vaultTemplate 合约地址:", await vaultTemplate.getAddress());


        const TokenTemplateFactory = await ethers.getContractFactory("VaultToken");
        const tokenTemplate = await TokenTemplateFactory.deploy();
        console.log("tokenTemplate 合约地址:", await tokenTemplate.getAddress());

        const FundTemplateFactory = await ethers.getContractFactory("Crowdsale");
        const fundTemplate = await FundTemplateFactory.deploy();
        console.log("fundTemplate 合约地址:", await fundTemplate.getAddress());

        const YieldTemplateFactory = await ethers.getContractFactory("AccumulatedYield");
        const yieldTemplate = await YieldTemplateFactory.deploy();
        console.log("yieldTemplate 合约地址:", await yieldTemplate.getAddress());

        // 部署工厂合约
        const VaultFactoryFactory = await ethers.getContractFactory("contracts/v2/factories/VaultFactory.sol:VaultFactory");
        const vaultFactory = await VaultFactoryFactory.deploy();
        console.log("vaultFactory 合约地址:", await vaultFactory.getAddress());

        const TokenFactoryFactory = await ethers.getContractFactory("contracts/v2/factories/TokenFactory.sol:TokenFactory");
        const tokenFactory = await TokenFactoryFactory.deploy();
        console.log("tokenFactory 合约地址:", await tokenFactory.getAddress());

        const FundFactoryFactory = await ethers.getContractFactory("contracts/v2/factories/FundFactory.sol:FundFactory");
        const fundFactory = await FundFactoryFactory.deploy();
        console.log("fundFactory 合约地址:", await fundFactory.getAddress());

        const YieldFactoryFactory = await ethers.getContractFactory("contracts/v2/factories/YieldFactory.sol:YieldFactory");
        const yieldFactory = await YieldFactoryFactory.deploy();
        console.log("yieldFactory 合约地址:", await yieldFactory.getAddress());

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
        const projectName = `Open_${Date.now()}`; // 使用时间戳

        const tx = await creation.deployAll(
            projectName, // projectName
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
        // 激活收益模块（如果还没有激活）
        const globalPool = await accumulatedYield.getGlobalPoolInfo();
        if (!globalPool.isActive) {
            await accumulatedYield.connect(manager).updateGlobalPoolStatus(true);
        }

        const dividendAmount = ethers.parseUnits("10000", TEST_CONFIG.TOKEN_DECIMALS);
        const signature = await prepareDividendSignature(dividendAmount);
        await usdt.connect(manager).approve(await accumulatedYield.getAddress(), dividendAmount);
        return await accumulatedYield.connect(manager).distributeDividend(dividendAmount, signature);
    }

    async function distributeDividendWithAmount(amount: any) {
        // 激活收益模块（如果还没有激活）
        const globalPool = await accumulatedYield.getGlobalPoolInfo();
        if (!globalPool.isActive) {
            await accumulatedYield.connect(manager).updateGlobalPoolStatus(true);
        }

        // const dividendAmount = ethers.parseUnits(amount, TEST_CONFIG.TOKEN_DECIMALS);
        const signature = await prepareDividendSignature(amount);
        await usdt.connect(manager).approve(await accumulatedYield.getAddress(), amount);
        return await accumulatedYield.connect(manager).distributeDividend(amount, signature);
    }

    async function verifyFinalState() {
        expect(await token.paused()).to.be.false;
    }

    async function prepareOffDepositSignature(amount: any, receiver: any) {
        const messageHash = ethers.keccak256(ethers.solidityPacked(
            ["string", "uint256", "address", "uint256", "address"],
            ["offChainDeposit", amount, receiver, await ethers.provider.getNetwork().then(n => n.chainId), await fund.getAddress()]
        ));
        const ethSignedMessageHash = ethers.getBytes(messageHash);
        return await validator.signMessage(ethSignedMessageHash);
    }

    describe("10. 链下认购 Claim 操作测试", function () {

        it("应该成功领取分红", async function () {
            // 先进行deposit
            var depositAmount_user1 = ethers.parseUnits("10000", TEST_CONFIG.TOKEN_DECIMALS);
            var offDepositSignature = await prepareOffDepositSignature(depositAmount_user1, user1.address);
            await usdt.connect(user1).approve(await fund.getAddress(), depositAmount_user1);
            await fund.connect(manager).offChainDeposit(depositAmount_user1, user1.address, offDepositSignature);


            // var depositAmount_user2 = ethers.parseUnits("9000", TEST_CONFIG.TOKEN_DECIMALS);
            // offDepositSignature = await prepareOffDepositSignature(depositAmount_user2, user2.address);
            // await usdt.connect(user2).approve(await fund.getAddress(), depositAmount_user2);
            // await fund.connect(manager).offChainDeposit(depositAmount_user2, user2.address, offDepositSignature);

            // 等待融资期结束并解锁代币
            // await ethers.provider.send("evm_increaseTime", [TEST_CONFIG.FUNDING_DURATION + 1]);
            // await ethers.provider.send("evm_mine", []);
            await fund.connect(manager).unpauseTokenOnFundingSuccess();

            // 激活收益模块
            await accumulatedYield.connect(manager).updateGlobalPoolStatus(true);

            const dividendAmount = ethers.parseUnits("10000", TEST_CONFIG.TOKEN_DECIMALS);
            const signature2 = await prepareDividendSignature(dividendAmount);

            //执行分红
            await usdt.connect(manager).approve(await accumulatedYield.getAddress(), dividendAmount);
            var tx = await accumulatedYield.connect(manager).distributeDividend(dividendAmount, signature2);

            // 验证分红状态
            var globalPool = await accumulatedYield.getGlobalPoolInfo();
            var totalDividend = globalPool.totalDividend;
            var totalAccumulatedShares = globalPool.totalAccumulatedShares;
            expect(totalDividend).to.equal(dividendAmount);
            var expectTotalAccumulatedShares = TEST_CONFIG.MAX_SUPPLY * dividendAmount;
            expect(totalAccumulatedShares).to.be.equal(expectTotalAccumulatedShares);

            // 验证用户状态更新
            var user1Info = await accumulatedYield.getUserInfo(user1.address);
            var user1AccumulatedShares = user1Info.accumulatedShares;
            var user1LastClaimDividend = user1Info.lastClaimDividend;
            var user1TotalClaimed = user1Info.totalClaimed;
            expect(user1LastClaimDividend).to.be.equal(0);
            expect(user1AccumulatedShares).to.be.equal(0);
            expect(user1TotalClaimed).to.be.equal(0);
            
            //验证应分红数额
            var user1PendingReward = await accumulatedYield.pendingReward(user1.address);
            var expectUser1PendingReward = depositAmount_user1 * TEST_CONFIG.SHARE_PRICE_DENOMINATOR / TEST_CONFIG.SHARE_PRICE * dividendAmount / TEST_CONFIG.MAX_SUPPLY;
            expect(user1PendingReward).to.be.equal(expectUser1PendingReward);
            

            // user1领取分红
            var delDidUser1 = totalDividend - user1Info.lastClaimDividend;
            var actualSharesUser1 = await token.balanceOf(user1.address);
            var expectUser1AccumulatedShares = delDidUser1 * actualSharesUser1;
            const initialBalanceUser1 = await usdt.balanceOf(user1.address);
            tx = await accumulatedYield.connect(user1).claimReward();


            // 验证领取结果
            const finalBalanceUser1 = await usdt.balanceOf(user1.address);
            expect(finalBalanceUser1 - initialBalanceUser1).to.be.equal(user1PendingReward);

            //验证用户状态更新
            actualSharesUser1 = await token.balanceOf(user1.address);

            user1Info = await accumulatedYield.getUserInfo(user1.address);
            var expectUser1TotalClaimed = user1PendingReward;
            user1TotalClaimed = user1Info.totalClaimed;

            expect(user1TotalClaimed).to.be.equal(expectUser1TotalClaimed);
            user1AccumulatedShares = user1Info.accumulatedShares;
            expect(user1Info.lastClaimDividend).to.be.equal(totalDividend);
            expect(user1AccumulatedShares).to.be.equal(expectUser1AccumulatedShares);

            //转账后继续执行分红
            await distributeDividendWithAmount(dividendAmount);

            //验证分红状态
            globalPool = await accumulatedYield.getGlobalPoolInfo();
            expect(globalPool.totalDividend).to.equal(dividendAmount * 2n);
            totalAccumulatedShares = totalAccumulatedShares + TEST_CONFIG.MAX_SUPPLY * dividendAmount;
            expect(globalPool.totalAccumulatedShares).to.be.equal(totalAccumulatedShares);


            //验证应分红数额
            user1PendingReward = await accumulatedYield.pendingReward(user1.address);
            expectUser1PendingReward = actualSharesUser1 * dividendAmount / TEST_CONFIG.MAX_SUPPLY;
            expect(user1PendingReward).to.be.equal(expectUser1PendingReward);

            
            //继续执行分红
            await distributeDividendWithAmount(dividendAmount);

            //验证应分红数额
            user1PendingReward = await accumulatedYield.pendingReward(user1.address);
            expectUser1PendingReward = expectUser1PendingReward + actualSharesUser1 * dividendAmount / TEST_CONFIG.MAX_SUPPLY;
            expect(user1PendingReward).to.be.equal(expectUser1PendingReward);
            // user1领取分红
            tx = await accumulatedYield.connect(user1).claimReward();

            const balanceUser1 = await usdt.balanceOf(user1.address);
            expect(balanceUser1 - finalBalanceUser1).to.be.equal(user1PendingReward);

            //验证user1.totalClaimed
            user1Info = await accumulatedYield.getUserInfo(user1.address);
            user1TotalClaimed = user1TotalClaimed + user1PendingReward;
            expect(user1Info.totalClaimed).to.be.equal(user1TotalClaimed);

        });

    });
});

describe("V2 架构完整业务流程测试-白名单", function () {
    // 代币精度常量
    const TOKEN_DECIMALS = 6;
    const VAULT_TOKEN_DECIMALS = 6;

    // 测试配置常量
    const TEST_CONFIG = {
        // 时间配置
        FUNDING_DURATION: 120, // 2min
        START_TIME_OFFSET: 10, // 10s后开始

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

        const enableWhitelist = true;
        const initialWhitelist = enableWhitelist ? [user1.address, user2.address] : [];


        // 准备初始化数据
        const vaultInitData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "bool", "address[]"],
            [manager.address, validator.address, enableWhitelist, initialWhitelist]
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

        const projectName = `private_${Date.now()}`; // 使用时间戳
        const tx = await creation.deployAll(
            projectName, // projectName
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
        // 激活收益模块（如果还没有激活）
        const globalPool = await accumulatedYield.getGlobalPoolInfo();
        if (!globalPool.isActive) {
            await accumulatedYield.connect(manager).updateGlobalPoolStatus(true);
        }

        const dividendAmount = ethers.parseUnits("10000", TEST_CONFIG.TOKEN_DECIMALS);
        const signature = await prepareDividendSignature(dividendAmount);
        await usdt.connect(manager).approve(await accumulatedYield.getAddress(), dividendAmount);
        return await accumulatedYield.connect(manager).distributeDividend(dividendAmount, signature);
    }

    async function distributeDividendWithAmount(amount: any) {
        // 激活收益模块（如果还没有激活）
        const globalPool = await accumulatedYield.getGlobalPoolInfo();
        if (!globalPool.isActive) {
            await accumulatedYield.connect(manager).updateGlobalPoolStatus(true);
        }

        // const dividendAmount = ethers.parseUnits(amount, TEST_CONFIG.TOKEN_DECIMALS);
        const signature = await prepareDividendSignature(amount);
        await usdt.connect(manager).approve(await accumulatedYield.getAddress(), amount);
        return await accumulatedYield.connect(manager).distributeDividend(amount, signature);
    }

    async function verifyFinalState() {
        expect(await token.paused()).to.be.false;
    }

    async function prepareOffDepositSignature(amount: any, receiver: any) {
        const messageHash = ethers.keccak256(ethers.solidityPacked(
            ["string", "uint256", "address", "uint256", "address"],
            ["offChainDeposit", amount, receiver, await ethers.provider.getNetwork().then(n => n.chainId), await fund.getAddress()]
        ));
        const ethSignedMessageHash = ethers.getBytes(messageHash);
        return await validator.signMessage(ethSignedMessageHash);
    }

    // 添加 sleep 函数
    function sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }


    describe("8. 白名单模式下 offChainRedeem 操作测试", function () {

        //TODO：待验证bug
        it("应该成功处理融资失败后的offChainRedeem", async function () {
            // 先进行deposit
            const depositAmount = ethers.parseUnits("1000", TEST_CONFIG.TOKEN_DECIMALS);
            const offDepositSignature = await prepareOffDepositSignature(depositAmount, user1.address);
            await usdt.connect(user1).approve(await fund.getAddress(), depositAmount);
            await fund.connect(manager).offChainDeposit(depositAmount, user1.address, offDepositSignature);

            // 等待融资期结束（假设融资失败）
            // await ethers.provider.send("evm_increaseTime", [TEST_CONFIG.FUNDING_DURATION + 1]);
            // await ethers.provider.send("evm_mine", []);

            // 在需要等待的地方使用 sleep
            await sleep(120000); // 等待1秒

            const expectedShares = (depositAmount * TEST_CONFIG.SHARE_PRICE_DENOMINATOR) / BigInt(TEST_CONFIG.SHARE_PRICE);


            const userBalance = await token.balanceOf(user1.address);
            // console.log("userBalance",userBalance);

            expect(expectedShares).to.equal(userBalance);

            // 批准代币燃烧 - 需要批准给vault地址
            await token.connect(user1).approve(await vault.getAddress(), userBalance);

            const tx = await fund.connect(manager).offChainRedeem(user1.address);



            const userBalanceAfterRedeem = await token.balanceOf(user1.address);
            expect(0).to.be.equal(userBalanceAfterRedeem);

            // 验证资产返还
            // const finalUsdtBalance = await usdt.balanceOf(user1.address);
            // expect(finalUsdtBalance).to.be.gt(initialUsdtBalance);
        });

        it("应该拒绝非管理员执行offChainRedeem", async function () {
            // 先进行deposit
            const depositAmount = ethers.parseUnits("1000", TEST_CONFIG.TOKEN_DECIMALS);
            const offDepositSignature = await prepareOffDepositSignature(depositAmount, user1.address);
            await usdt.connect(user1).approve(await fund.getAddress(), depositAmount);
            await fund.connect(manager).offChainDeposit(depositAmount, user1.address, offDepositSignature);

            // 等待融资期结束（假设融资失败）
            await ethers.provider.send("evm_increaseTime", [TEST_CONFIG.FUNDING_DURATION + 1]);
            await ethers.provider.send("evm_mine", []);

            const expectedShares = (depositAmount * TEST_CONFIG.SHARE_PRICE_DENOMINATOR) / BigInt(TEST_CONFIG.SHARE_PRICE);


            const userBalance = await token.balanceOf(user1.address);

            expect(expectedShares).to.equal(userBalance);

            // 批准代币燃烧 - 需要批准给vault地址
            await token.connect(user1).approve(await vault.getAddress(), userBalance);

            await expect(
                fund.connect(user1).offChainRedeem(user1.address)
            ).to.be.revertedWith("Crowdsale: only manager");

            const userBalanceAfterRedeem = await token.balanceOf(user1.address);
            expect(userBalance).to.be.equal(userBalanceAfterRedeem);

        });

        it("应该拒绝在认购期内执行offChainRedeem", async function () {
            // 先进行deposit
            const depositAmount = ethers.parseUnits("1000", TEST_CONFIG.TOKEN_DECIMALS);
            const offDepositSignature = await prepareOffDepositSignature(depositAmount, user1.address);
            await usdt.connect(user1).approve(await fund.getAddress(), depositAmount);
            await fund.connect(manager).offChainDeposit(depositAmount, user1.address, offDepositSignature);

            // // 等待融资期结束（假设融资失败）
            // await ethers.provider.send("evm_increaseTime", [TEST_CONFIG.FUNDING_DURATION + 1]);
            // await ethers.provider.send("evm_mine", []);

            const expectedShares = (depositAmount * TEST_CONFIG.SHARE_PRICE_DENOMINATOR) / BigInt(TEST_CONFIG.SHARE_PRICE);


            const userBalance = await token.balanceOf(user1.address);

            expect(expectedShares).to.equal(userBalance);

            // 批准代币燃烧 - 需要批准给vault地址
            await token.connect(user1).approve(await vault.getAddress(), userBalance);

            await expect(
                fund.connect(manager).offChainRedeem(user1.address)
            ).to.be.revertedWith("Crowdsale: funding period not ended");

            const userBalanceAfterRedeem = await token.balanceOf(user1.address);
            expect(userBalance).to.be.equal(userBalanceAfterRedeem);

        });

        it("应该拒绝在融资成功且认购期没结束时执行offChainRedeem", async function () {
            // 先进行deposit
            const depositAmount = ethers.parseUnits("10000", TEST_CONFIG.TOKEN_DECIMALS);
            const offDepositSignature = await prepareOffDepositSignature(depositAmount, user1.address);
            await usdt.connect(user1).approve(await fund.getAddress(), depositAmount);
            await fund.connect(manager).offChainDeposit(depositAmount, user1.address, offDepositSignature);

            // // 等待融资期结束（假设融资失败）
            // await ethers.provider.send("evm_increaseTime", [TEST_CONFIG.FUNDING_DURATION + 1]);
            // await ethers.provider.send("evm_mine", []);

            const expectedShares = (depositAmount * TEST_CONFIG.SHARE_PRICE_DENOMINATOR) / BigInt(TEST_CONFIG.SHARE_PRICE);


            const userBalance = await token.balanceOf(user1.address);

            expect(expectedShares).to.equal(userBalance);

            // 批准代币燃烧 - 需要批准给vault地址
            await token.connect(user1).approve(await vault.getAddress(), userBalance);

            await expect(
                fund.connect(manager).offChainRedeem(user1.address)
            ).to.be.revertedWith("Crowdsale: funding was successful");

            const userBalanceAfterRedeem = await token.balanceOf(user1.address);
            expect(userBalance).to.be.equal(userBalanceAfterRedeem);

        });

        it("应该拒绝在融资成功且认购期结束后执行offChainRedeem", async function () {
            // 先进行deposit
            const depositAmount = ethers.parseUnits("10000", TEST_CONFIG.TOKEN_DECIMALS);
            const offDepositSignature = await prepareOffDepositSignature(depositAmount, user1.address);
            await usdt.connect(user1).approve(await fund.getAddress(), depositAmount);
            await fund.connect(manager).offChainDeposit(depositAmount, user1.address, offDepositSignature);

            // 等待融资期结束（假设融资失败）
            await ethers.provider.send("evm_increaseTime", [TEST_CONFIG.FUNDING_DURATION + 1]);
            await ethers.provider.send("evm_mine", []);

            const expectedShares = (depositAmount * TEST_CONFIG.SHARE_PRICE_DENOMINATOR) / BigInt(TEST_CONFIG.SHARE_PRICE);


            const userBalance = await token.balanceOf(user1.address);

            expect(expectedShares).to.equal(userBalance);

            // 批准代币燃烧 - 需要批准给vault地址
            await token.connect(user1).approve(await vault.getAddress(), userBalance);

            await expect(
                fund.connect(manager).offChainRedeem(user1.address)
            ).to.be.revertedWith("Crowdsale: funding was successful");

            const userBalanceAfterRedeem = await token.balanceOf(user1.address);
            expect(userBalance).to.be.equal(userBalanceAfterRedeem);

        });

        it("应该拒绝对零地址执行offChainRedeem", async function () {
            // 先进行deposit
            const depositAmount = ethers.parseUnits("1000", TEST_CONFIG.TOKEN_DECIMALS);
            const offDepositSignature = await prepareOffDepositSignature(depositAmount, user1.address);
            await usdt.connect(user1).approve(await fund.getAddress(), depositAmount);
            await fund.connect(manager).offChainDeposit(depositAmount, user1.address, offDepositSignature);

            // 等待融资期结束（假设融资失败）
            await ethers.provider.send("evm_increaseTime", [TEST_CONFIG.FUNDING_DURATION + 1]);
            await ethers.provider.send("evm_mine", []);

            const expectedShares = (depositAmount * TEST_CONFIG.SHARE_PRICE_DENOMINATOR) / BigInt(TEST_CONFIG.SHARE_PRICE);


            const userBalance = await token.balanceOf(user1.address);

            expect(expectedShares).to.equal(userBalance);

            // 批准代币燃烧 - 需要批准给vault地址
            await token.connect(user1).approve(await vault.getAddress(), userBalance);

            await expect(
                fund.connect(manager).offChainRedeem(ZeroAddress)
            ).to.be.revertedWith("Crowdsale: invalid receiver");

            const userBalanceAfterRedeem = await token.balanceOf(user1.address);
            expect(userBalance).to.be.equal(userBalanceAfterRedeem);

        });

        it("应该拒绝在未批准的情况下执行offChainRedeem", async function () {
            // 先进行deposit
            const depositAmount = ethers.parseUnits("1000", TEST_CONFIG.TOKEN_DECIMALS);
            const offDepositSignature = await prepareOffDepositSignature(depositAmount, user1.address);
            await usdt.connect(user1).approve(await fund.getAddress(), depositAmount);
            await fund.connect(manager).offChainDeposit(depositAmount, user1.address, offDepositSignature);

            // 等待融资期结束（假设融资失败）
            await ethers.provider.send("evm_increaseTime", [TEST_CONFIG.FUNDING_DURATION + 1]);
            await ethers.provider.send("evm_mine", []);

            const expectedShares = (depositAmount * TEST_CONFIG.SHARE_PRICE_DENOMINATOR) / BigInt(TEST_CONFIG.SHARE_PRICE);


            const userBalance = await token.balanceOf(user1.address);

            expect(expectedShares).to.equal(userBalance);

            // 批准代币燃烧 - 需要批准给vault地址
            // await token.connect(user1).approve(await vault.getAddress(), userBalance);            

            await expect(
                fund.connect(manager).offChainRedeem(user1.address)
            ).to.be.revertedWith("ERC20: insufficient allowance");

            const userBalanceAfterRedeem = await token.balanceOf(user1.address);
            expect(userBalance).to.be.equal(userBalanceAfterRedeem);

        });

        it("应该拒绝在批准的余额不足的情况下执行offChainRedeem", async function () {
            // 先进行deposit
            const depositAmount = ethers.parseUnits("1000", TEST_CONFIG.TOKEN_DECIMALS);
            const offDepositSignature = await prepareOffDepositSignature(depositAmount, user1.address);
            await usdt.connect(user1).approve(await fund.getAddress(), depositAmount);
            await fund.connect(manager).offChainDeposit(depositAmount, user1.address, offDepositSignature);

            // 等待融资期结束（假设融资失败）
            await ethers.provider.send("evm_increaseTime", [TEST_CONFIG.FUNDING_DURATION + 1]);
            await ethers.provider.send("evm_mine", []);

            const expectedShares = (depositAmount * TEST_CONFIG.SHARE_PRICE_DENOMINATOR) / BigInt(TEST_CONFIG.SHARE_PRICE);


            const userBalance = await token.balanceOf(user1.address);

            expect(expectedShares).to.equal(userBalance);

            // 批准代币燃烧 - 需要批准给vault地址
            await token.connect(user1).approve(await vault.getAddress(), userBalance - 1000000n);

            await expect(
                fund.connect(manager).offChainRedeem(user1.address)
            ).to.be.revertedWith("ERC20: insufficient allowance");

            const userBalanceAfterRedeem = await token.balanceOf(user1.address);
            expect(userBalance).to.be.equal(userBalanceAfterRedeem);

        });

        it("应该拒绝在账户未认购的情况下给该账户执行offChainRedeem", async function () {

            // 等待融资期结束（假设融资失败）
            await ethers.provider.send("evm_increaseTime", [TEST_CONFIG.FUNDING_DURATION + 1]);
            await ethers.provider.send("evm_mine", []);

            // const expectedShares = (depositAmount * TEST_CONFIG.SHARE_PRICE_DENOMINATOR) / BigInt(TEST_CONFIG.SHARE_PRICE);


            const userBalance = await token.balanceOf(user1.address);

            expect(0).to.equal(userBalance);

            // 批准代币燃烧 - 需要批准给vault地址
            await token.connect(user1).approve(await vault.getAddress(), userBalance);

            await expect(
                fund.connect(manager).offChainRedeem(user1.address)
            ).to.be.revertedWith("Crowdsale: no shares to redeem");

            const userBalanceAfterRedeem = await token.balanceOf(user1.address);
            expect(userBalance).to.be.equal(userBalanceAfterRedeem);

        });

    });

    describe("10. 白名单模式下链下认购 Claim 操作测试", function () {

        it("应该成功领取分红", async function () {
            // 先进行deposit
            var depositAmount_user1 = ethers.parseUnits("1000", TEST_CONFIG.TOKEN_DECIMALS);
            var offDepositSignature = await prepareOffDepositSignature(depositAmount_user1, user1.address);
            await usdt.connect(user1).approve(await fund.getAddress(), depositAmount_user1);
            await fund.connect(manager).offChainDeposit(depositAmount_user1, user1.address, offDepositSignature);


            var depositAmount_user2 = ethers.parseUnits("9000", TEST_CONFIG.TOKEN_DECIMALS);
            offDepositSignature = await prepareOffDepositSignature(depositAmount_user2, user2.address);
            await usdt.connect(user2).approve(await fund.getAddress(), depositAmount_user2);
            await fund.connect(manager).offChainDeposit(depositAmount_user2, user2.address, offDepositSignature);

            // // 等待融资期结束并解锁代币
            // await ethers.provider.send("evm_increaseTime", [TEST_CONFIG.FUNDING_DURATION + 1]);
            // await ethers.provider.send("evm_mine", []);
            await fund.connect(manager).unpauseTokenOnFundingSuccess();

            // 激活收益模块
            await accumulatedYield.connect(manager).updateGlobalPoolStatus(true);

            const dividendAmount = ethers.parseUnits("10000", TEST_CONFIG.TOKEN_DECIMALS);
            const signature2 = await prepareDividendSignature(dividendAmount);

            //执行分红
            await usdt.connect(manager).approve(await accumulatedYield.getAddress(), dividendAmount);
            var tx = await accumulatedYield.connect(manager).distributeDividend(dividendAmount, signature2);

            // 验证分红状态
            var globalPool = await accumulatedYield.getGlobalPoolInfo();
            var totalDividend = globalPool.totalDividend;
            var totalAccumulatedShares = globalPool.totalAccumulatedShares;
            expect(totalDividend).to.equal(dividendAmount);
            var expectTotalAccumulatedShares = TEST_CONFIG.MAX_SUPPLY * dividendAmount;
            expect(totalAccumulatedShares).to.be.equal(expectTotalAccumulatedShares);

            // 验证用户状态更新
            var user1Info = await accumulatedYield.getUserInfo(user1.address);
            var user1AccumulatedShares = user1Info.accumulatedShares;
            var user1LastClaimDividend = user1Info.lastClaimDividend;
            var user1TotalClaimed = user1Info.totalClaimed;
            expect(user1LastClaimDividend).to.be.equal(0);
            expect(user1AccumulatedShares).to.be.equal(0);
            expect(user1TotalClaimed).to.be.equal(0);
            var user2Info = await accumulatedYield.getUserInfo(user2.address);
            var user2accumulatedShares = user2Info.accumulatedShares;
            var user2LastClaimDividend = user2Info.lastClaimDividend;
            var user2TotalCLaimed = user2Info.totalClaimed;
            expect(user2accumulatedShares).to.be.equal(0);
            expect(user2LastClaimDividend).to.be.equal(0);
            expect(user2TotalCLaimed).to.be.equal(0);

            //验证应分红数额
            var user1PendingReward = await accumulatedYield.pendingReward(user1.address);
            var expectUser1PendingReward = depositAmount_user1 * TEST_CONFIG.SHARE_PRICE_DENOMINATOR / TEST_CONFIG.SHARE_PRICE * dividendAmount / TEST_CONFIG.MAX_SUPPLY;
            expect(user1PendingReward).to.be.equal(expectUser1PendingReward);
            var user2PendingReward = await accumulatedYield.pendingReward(user2.address);
            var expectUser2PendingReward = depositAmount_user2 * TEST_CONFIG.SHARE_PRICE_DENOMINATOR / TEST_CONFIG.SHARE_PRICE * dividendAmount / TEST_CONFIG.MAX_SUPPLY;
            expect(user2PendingReward).to.be.equal(expectUser2PendingReward);

            // user1领取分红
            var delDidUser1 = totalDividend - user1Info.lastClaimDividend;
            var actualSharesUser1 = await token.balanceOf(user1.address);
            var expectUser1AccumulatedShares = delDidUser1 * actualSharesUser1;
            const initialBalanceUser1 = await usdt.balanceOf(user1.address);
            tx = await accumulatedYield.connect(user1).claimReward();


            // 验证领取结果
            const finalBalanceUser1 = await usdt.balanceOf(user1.address);
            expect(finalBalanceUser1 - initialBalanceUser1).to.be.equal(user1PendingReward);

            //验证用户状态更新
            actualSharesUser1 = await token.balanceOf(user1.address);
            actualSharesUser2 = await token.balanceOf(user2.address);

            user1Info = await accumulatedYield.getUserInfo(user1.address);
            var expectUser1TotalClaimed = user1PendingReward;
            user1TotalClaimed = user1Info.totalClaimed;

            expect(user1TotalClaimed).to.be.equal(expectUser1TotalClaimed);
            user1AccumulatedShares = user1Info.accumulatedShares;
            expect(user1Info.lastClaimDividend).to.be.equal(totalDividend);
            expect(user1AccumulatedShares).to.be.equal(expectUser1AccumulatedShares);

            user2Info = await accumulatedYield.getUserInfo(user2.address);
            expect(user2Info.totalClaimed).to.be.equal(0);
            expect(user2Info.accumulatedShares).to.be.equal(0);
            expect(user2Info.lastClaimDividend).to.be.equal(0);


            // 执行转账
            expectUser1AccumulatedShares = user1AccumulatedShares;
            var delDidUser2 = totalDividend - user2Info.accumulatedShares;
            var expectUser2AccumulatedShares = delDidUser2 * actualSharesUser2;
            var transferAmount = ethers.parseUnits("100", TEST_CONFIG.VAULT_TOKEN_DECIMALS);

            await token.connect(user1).transfer(user2.address, transferAmount);

            actualSharesUser1 = await token.balanceOf(user1.address);
            expect(actualSharesUser1).to.be.equal(depositAmount_user1 - transferAmount);
            var actualSharesUser2 = await token.balanceOf(user2.address);
            expect(actualSharesUser2).to.be.equal(depositAmount_user2 + transferAmount);

            //验证用户状态更新
            user1Info = await accumulatedYield.getUserInfo(user1.address);
            user1AccumulatedShares = user1Info.accumulatedShares;
            expect(user1AccumulatedShares).to.be.equal(expectUser1AccumulatedShares);
            expect(user1Info.totalClaimed).to.be.equal(expectUser1TotalClaimed);


            user2Info = await accumulatedYield.getUserInfo(user2.address);
            expect(user2Info.accumulatedShares).to.be.equal(expectUser2AccumulatedShares);

            //转账后继续执行分红
            await distributeDividendWithAmount(dividendAmount);

            //验证分红状态
            globalPool = await accumulatedYield.getGlobalPoolInfo();
            expect(globalPool.totalDividend).to.equal(dividendAmount * 2n);
            totalAccumulatedShares = totalAccumulatedShares + TEST_CONFIG.MAX_SUPPLY * dividendAmount;
            expect(globalPool.totalAccumulatedShares).to.be.equal(totalAccumulatedShares);


            //验证应分红数额
            user1PendingReward = await accumulatedYield.pendingReward(user1.address);
            expectUser1PendingReward = actualSharesUser1 * dividendAmount / TEST_CONFIG.MAX_SUPPLY;
            expect(user1PendingReward).to.be.equal(expectUser1PendingReward);
            user2PendingReward = await accumulatedYield.pendingReward(user2.address);
            expectUser2PendingReward = expectUser2PendingReward + actualSharesUser2 * dividendAmount / TEST_CONFIG.MAX_SUPPLY;
            expect(user2PendingReward).to.be.equal(expectUser2PendingReward);

            //user2领取分红
            const initialBalanceUser2 = await usdt.balanceOf(user2.address);
            tx = await accumulatedYield.connect(user2).claimReward();

            //验证user2.totalClaimed
            const finalBalanceUser2 = await usdt.balanceOf(user2.address);
            var user2TotalClaimed = user2PendingReward;
            expect(finalBalanceUser2 - initialBalanceUser2).to.be.equal(user2TotalClaimed);

            user2Info = await accumulatedYield.getUserInfo(user2.address);
            expect(user2Info.totalClaimed).to.be.equal(user2PendingReward);

            //继续执行分红
            await distributeDividendWithAmount(dividendAmount);

            //验证应分红数额
            user1PendingReward = await accumulatedYield.pendingReward(user1.address);
            expectUser1PendingReward = expectUser1PendingReward + actualSharesUser1 * dividendAmount / TEST_CONFIG.MAX_SUPPLY;
            expect(user1PendingReward).to.be.equal(expectUser1PendingReward);
            user2PendingReward = await accumulatedYield.pendingReward(user2.address);
            expectUser2PendingReward = actualSharesUser2 * dividendAmount / TEST_CONFIG.MAX_SUPPLY;
            expect(user2PendingReward).to.be.equal(expectUser2PendingReward);

            // user1领取分红
            tx = await accumulatedYield.connect(user1).claimReward();

            const balanceUser1 = await usdt.balanceOf(user1.address);
            expect(balanceUser1 - finalBalanceUser1).to.be.equal(user1PendingReward);

            //验证user1.totalClaimed
            user1Info = await accumulatedYield.getUserInfo(user1.address);
            user1TotalClaimed = user1TotalClaimed + user1PendingReward;
            expect(user1Info.totalClaimed).to.be.equal(user1TotalClaimed);

            // user2领取分红
            tx = await accumulatedYield.connect(user2).claimReward();
            const balanceUser2 = await usdt.balanceOf(user2.address);
            expect(balanceUser2 - finalBalanceUser2).to.be.equal(user2PendingReward);

            //验证user2.totalClaimed
            user2Info = await accumulatedYield.getUserInfo(user2.address);
            user2TotalClaimed = user2TotalClaimed + user2PendingReward;
            expect(user2Info.totalClaimed).to.be.equal(user2TotalClaimed);

        });

    });

});