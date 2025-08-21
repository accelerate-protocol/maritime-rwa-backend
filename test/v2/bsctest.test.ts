import { expect, use } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Creation } from "../../typechain-types/contracts/v2/creation/Creation";
import { BasicVault } from "../../typechain-types/contracts/v2/templates/vault/BasicVault";
import { VaultToken } from "../../typechain-types/contracts/v2/templates/token/VaultToken";
import { Crowdsale } from "../../typechain-types/contracts/v2/templates/funding/Crowdsale";
import { AccumulatedYield } from "../../typechain-types/contracts/v2/templates/yield/AccumulatedYield";
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
    let creation: Creation;

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


        const usdtAddress = "0x5fF941A117555530eDE77E9D340396e2CD2e8f08"; // 替换为实际的 USDT 合约地址
        usdt = await ethers.getContractAt("contracts/v2/mocks/MockUSDT.sol:MockUSDT", usdtAddress);


        const vaultTemplateAddress = "0x8E44ba73EaE885D89c2eFBa5558Ad807203F56EB"; // 替换为实际的 BasicVault 合约地址
        const vaultTemplate = await ethers.getContractAt("BasicVault", vaultTemplateAddress);

        const tokenTemplateAddress = "0xD5dbC8823B1B02aD16C77e563ef5296Ea4A5eB7F"; // 替换为实际的 VaultToken 合约地址
        const tokenTemplate = await ethers.getContractAt("VaultToken", tokenTemplateAddress);

        const fundTemplateAddress = "0x13988Ba53B8e550CCAD837f744bC5DD3cfe4c42A"; // 替换为实际的 Crowdsale 合约地址
        const fundTemplate = await ethers.getContractAt("Crowdsale", fundTemplateAddress);



        const yieldTemplateAddress = "0xD328fEc86ba49ad373c185d4eB1D41Afd7198227"; // 替换为实际的 AccumulatedYield 合约地址
        const yieldTemplate = await ethers.getContractAt("AccumulatedYield", yieldTemplateAddress);


        const vaultFactoryAddress = "0x5CC7eAA1468bE6D87Bb5C509aD99a9D2A417d0D7"; // 替换为实际的 VaultFactory 合约地址
        const vaultFactory = await ethers.getContractAt("contracts/v2/factories/VaultFactory.sol:VaultFactory", vaultFactoryAddress);

        const tokenFactoryAddress = "0xcd2FFB1f5dA8F4735D6c0f6e287a1513162BdAEE"; // 替换为实际的 TokenFactory 合约地址
        const tokenFactory = await ethers.getContractAt("contracts/v2/factories/TokenFactory.sol:TokenFactory", tokenFactoryAddress);

        const fundFactoryAddress = "0xE3653d0ceDeb542a708D51a6BEbE1F835b8E354F"; // 替换为实际的 FundFactory 合约地址
        const fundFactory = await ethers.getContractAt("contracts/v2/factories/FundFactory.sol:FundFactory", fundFactoryAddress);

        const yieldFactoryAddress = "0xa9637053Ff9A651755ADB496Fad55C60c3f0D8b8"; // 替换为实际的 YieldFactory 合约地址
        const yieldFactory = await ethers.getContractAt("contracts/v2/factories/YieldFactory.sol:YieldFactory", yieldFactoryAddress);


        const creationAddress = "0x87dF768010Bfa87D14D0744F5e6bF94A65A64c58"; // 替换为实际的 Creation 合约地址
        creation = await ethers.getContractAt("Creation", creationAddress);

    });

    async function prepareDividendSignature(amount: any) {
        // AccumulatedYield 使用不同的签名方式：keccak256(abi.encodePacked(vault, dividendAmount))
        const nounce = await accumulatedYield.connect(dividendTreasury).getDividendNonce();
        const payload = ethers.keccak256(ethers.solidityPacked(
            ["address", "uint256", "uint256"],
            [await vault.getAddress(), amount, nounce]
        ));
        return await validator.signMessage(ethers.getBytes(payload));
    }

    async function distributeDividendWithAmount(amount: any) {
        // 激活收益模块（如果还没有激活）
        const globalPool = await accumulatedYield.getGlobalPoolInfo();
        if (!globalPool.isActive) {
            var tx = await accumulatedYield.connect(manager).updateGlobalPoolStatus(true);
            await tx.wait();
        }

        // const dividendAmount = ethers.parseUnits(amount, TEST_CONFIG.TOKEN_DECIMALS);
        const signature = await prepareDividendSignature(amount);
        var tx1 = await usdt.connect(dividendTreasury).approve(await accumulatedYield.getAddress(), amount);
        await tx1.wait();
        return await accumulatedYield.connect(dividendTreasury).distributeDividend(amount, signature);
    }

    async function prepareOffDepositSignature(amount: any, receiver: any) {
        const messageHash = ethers.keccak256(ethers.solidityPacked(
            ["string", "uint256", "address", "uint256", "address"],
            ["offChainDeposit", amount, receiver, await ethers.provider.getNetwork().then(n => n.chainId), await fund.getAddress()]
        ));
        const ethSignedMessageHash = ethers.getBytes(messageHash);
        return await validator.signMessage(ethSignedMessageHash);
    }

    describe("开放式-链下认购操作测试", function () {
        this.timeout(400000);
        this.beforeEach(async function () {
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
                    dividendTreasury.address // dividendTreasury
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
            // await vault.connect(manager).setVaultToken(await token.getAddress());
            // await vault.connect(manager).setFundingModule(await fund.getAddress());
            // await vault.connect(manager).setDividendModule(await accumulatedYield.getAddress());

            await vault.connect(manager).configureModules(await token.getAddress(), await fund.getAddress(), await accumulatedYield.getAddress());

        })
        it("应该成功领取分红", async function () {
            // 先进行deposit
            var depositAmount_user1 = ethers.parseUnits("1000", TEST_CONFIG.TOKEN_DECIMALS);
            var offDepositSignature = await prepareOffDepositSignature(depositAmount_user1, user1.address);
            var tx = await usdt.connect(user1).approve(await fund.getAddress(), depositAmount_user1);
            await tx.wait();
            tx = await fund.connect(manager).offChainDeposit(depositAmount_user1, user1.address, offDepositSignature);
            await tx.wait();

            var depositAmount_user2 = ethers.parseUnits("9000", TEST_CONFIG.TOKEN_DECIMALS);
            offDepositSignature = await prepareOffDepositSignature(depositAmount_user2, user2.address);
            tx = await usdt.connect(user2).approve(await fund.getAddress(), depositAmount_user2);
            await tx.wait();
            tx = await fund.connect(manager).offChainDeposit(depositAmount_user2, user2.address, offDepositSignature);
            await tx.wait();

            tx = await fund.connect(manager).unpauseTokenOnFundingSuccess();
            await tx.wait();

            // 激活收益模块
            tx = await accumulatedYield.connect(manager).updateGlobalPoolStatus(true);
            await tx.wait();

            const dividendAmount = ethers.parseUnits("10000", TEST_CONFIG.TOKEN_DECIMALS);
            const signature2 = await prepareDividendSignature(dividendAmount);

            //执行分红
            tx = await usdt.connect(dividendTreasury).approve(await accumulatedYield.getAddress(), dividendAmount);
            await tx.wait();
            tx = await accumulatedYield.connect(dividendTreasury).distributeDividend(dividendAmount, signature2);
            await tx.wait();

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
            await tx.wait();


            // 验证领取结果

            await sleep(3000);
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

            tx = await token.connect(user1).transfer(user2.address, transferAmount);
            await tx.wait();

            await sleep(3000);
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
            tx = await distributeDividendWithAmount(dividendAmount);
            await tx.wait();

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
            await tx.wait();

            //验证user2.totalClaimed
            await sleep(3000);
            const finalBalanceUser2 = await usdt.balanceOf(user2.address);
            var user2TotalClaimed = user2PendingReward;
            expect(finalBalanceUser2 - initialBalanceUser2).to.be.equal(user2TotalClaimed);

            user2Info = await accumulatedYield.getUserInfo(user2.address);
            expect(user2Info.totalClaimed).to.be.equal(user2PendingReward);

            //继续执行分红
            tx = await distributeDividendWithAmount(dividendAmount);
            await tx.wait();

            //验证应分红数额
            user1PendingReward = await accumulatedYield.pendingReward(user1.address);
            expectUser1PendingReward = expectUser1PendingReward + actualSharesUser1 * dividendAmount / TEST_CONFIG.MAX_SUPPLY;
            expect(user1PendingReward).to.be.equal(expectUser1PendingReward);
            user2PendingReward = await accumulatedYield.pendingReward(user2.address);
            expectUser2PendingReward = actualSharesUser2 * dividendAmount / TEST_CONFIG.MAX_SUPPLY;
            expect(user2PendingReward).to.be.equal(expectUser2PendingReward);

            // user1领取分红
            tx = await accumulatedYield.connect(user1).claimReward();
            await tx.wait();

            await sleep(3000);
            const balanceUser1 = await usdt.balanceOf(user1.address);
            expect(balanceUser1 - finalBalanceUser1).to.be.equal(user1PendingReward);

            //验证user1.totalClaimed
            user1Info = await accumulatedYield.getUserInfo(user1.address);
            user1TotalClaimed = user1TotalClaimed + user1PendingReward;
            expect(user1Info.totalClaimed).to.be.equal(user1TotalClaimed);

            // user2领取分红
            tx = await accumulatedYield.connect(user2).claimReward();
            await tx.wait();
            await sleep(3000);
            const balanceUser2 = await usdt.balanceOf(user2.address);
            expect(balanceUser2 - finalBalanceUser2).to.be.equal(user2PendingReward);

            //验证user2.totalClaimed
            user2Info = await accumulatedYield.getUserInfo(user2.address);
            user2TotalClaimed = user2TotalClaimed + user2PendingReward;
            expect(user2Info.totalClaimed).to.be.equal(user2TotalClaimed);

        });
    });

    describe("白名单模式下操作测试", function () {
        this.timeout(400000);
        this.beforeEach(async function () {

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
                    dividendTreasury.address // dividendTreasury
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
            // await vault.connect(manager).setVaultToken(await token.getAddress());
            // await vault.connect(manager).setFundingModule(await fund.getAddress());
            // await vault.connect(manager).setDividendModule(await accumulatedYield.getAddress());

            await vault.connect(manager).configureModules(await token.getAddress(), await fund.getAddress(), await accumulatedYield.getAddress());

        })
        it("应该成功处理融资失败后的offChainRedeem", async function () {
            // 先进行deposit
            const depositAmount = ethers.parseUnits("1000", TEST_CONFIG.TOKEN_DECIMALS);
            const offDepositSignature = await prepareOffDepositSignature(depositAmount, user1.address);
            var tx = await usdt.connect(user1).approve(await fund.getAddress(), depositAmount);
            await tx.wait();
            tx = await fund.connect(manager).offChainDeposit(depositAmount, user1.address, offDepositSignature);
            await tx.wait();

            const waitTime = (TEST_CONFIG.FUNDING_DURATION + 1) * 1000; // 转换为毫秒
            await new Promise(resolve => setTimeout(resolve, waitTime));


            const expectedShares = (depositAmount * TEST_CONFIG.SHARE_PRICE_DENOMINATOR) / BigInt(TEST_CONFIG.SHARE_PRICE);


            const userBalance = await token.balanceOf(user1.address);
            // console.log("userBalance",userBalance);

            expect(expectedShares).to.equal(userBalance);

            // 批准代币燃烧 - 需要批准给vault地址
            tx = await token.connect(user1).approve(await vault.getAddress(), userBalance);
            await tx.wait();
            tx = await fund.connect(manager).offChainRedeem(user1.address);
            await tx.wait();



            const userBalanceAfterRedeem = await token.balanceOf(user1.address);
            expect(0).to.be.equal(userBalanceAfterRedeem);

        });

        it("应该成功领取分红", async function () {
            // 先进行deposit
            var depositAmount_user1 = ethers.parseUnits("1000", TEST_CONFIG.TOKEN_DECIMALS);
            var offDepositSignature = await prepareOffDepositSignature(depositAmount_user1, user1.address);
            var tx = await usdt.connect(user1).approve(await fund.getAddress(), depositAmount_user1);
            await tx.wait();
            tx = await fund.connect(manager).offChainDeposit(depositAmount_user1, user1.address, offDepositSignature);
            await tx.wait();

            // console.log("totalSupply1", await token.totalSupply());

            var depositAmount_user2 = ethers.parseUnits("9000", TEST_CONFIG.TOKEN_DECIMALS);
            offDepositSignature = await prepareOffDepositSignature(depositAmount_user2, user2.address);
            tx = await usdt.connect(user2).approve(await fund.getAddress(), depositAmount_user2);
            await tx.wait();
            tx = await fund.connect(manager).offChainDeposit(depositAmount_user2, user2.address, offDepositSignature);
            await tx.wait();
            // console.log("totalSupply2", await token.totalSupply());
            expect(await fund.isFundingSuccessful()).to.be.true;

            tx = await fund.connect(manager).unpauseTokenOnFundingSuccess();
            await tx.wait();

            // 激活收益模块
            tx = await accumulatedYield.connect(manager).updateGlobalPoolStatus(true);
            await tx.wait();

            const dividendAmount = ethers.parseUnits("10000", TEST_CONFIG.TOKEN_DECIMALS);
            const signature2 = await prepareDividendSignature(dividendAmount);

            //执行分红
            tx = await usdt.connect(dividendTreasury).approve(await accumulatedYield.getAddress(), dividendAmount);
            await tx.wait();
            tx = await accumulatedYield.connect(dividendTreasury).distributeDividend(dividendAmount, signature2);
            await tx.wait();


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
            // console.log("user1PendingReward", user1PendingReward);
            var expectUser1PendingReward = depositAmount_user1 * TEST_CONFIG.SHARE_PRICE_DENOMINATOR / TEST_CONFIG.SHARE_PRICE * dividendAmount / TEST_CONFIG.MAX_SUPPLY;
            expect(user1PendingReward).to.be.equal(expectUser1PendingReward);
            var user2PendingReward = await accumulatedYield.pendingReward(user2.address);
            var expectUser2PendingReward = depositAmount_user2 * TEST_CONFIG.SHARE_PRICE_DENOMINATOR / TEST_CONFIG.SHARE_PRICE * dividendAmount / TEST_CONFIG.MAX_SUPPLY;
            expect(user2PendingReward).to.be.equal(expectUser2PendingReward);

            // user1领取分红
            var delDidUser1 = totalDividend - user1Info.lastClaimDividend;
            // console.log("delDidUser1", delDidUser1);
            var actualSharesUser1 = await token.balanceOf(user1.address);
            // console.log("actualSharesUser1", actualSharesUser1);
            var expectUser1AccumulatedShares = delDidUser1 * actualSharesUser1;
            // console.log("expectUser1AccumulatedShares", expectUser1AccumulatedShares);
            const initialBalanceUser1 = await usdt.balanceOf(user1.address);
            // console.log("initialBalanceUser1", initialBalanceUser1);
            tx = await accumulatedYield.connect(user1).claimReward();
            const receipt = await tx.wait();

            // console.log("receipt", receipt)
            // console.log("Operation tx hash:", tx.hash)


            // 验证领取结果
            // console.log("这里正在等待余额查询");
            await sleep(10000);
            const finalBalanceUser1 = await usdt.balanceOf(user1.address);
            // console.log("finalBalanceUser1", finalBalanceUser1);
            // console.log(user1PendingReward);
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

            tx = await token.connect(user1).transfer(user2.address, transferAmount);
            await tx.wait();


            await sleep(3000)
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
            tx = await distributeDividendWithAmount(dividendAmount);
            await tx.wait();

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
            await tx.wait();

            //验证user2.totalClaimed
            await sleep(3000);
            const finalBalanceUser2 = await usdt.balanceOf(user2.address);
            var user2TotalClaimed = user2PendingReward;
            expect(finalBalanceUser2 - initialBalanceUser2).to.be.equal(user2TotalClaimed);

            user2Info = await accumulatedYield.getUserInfo(user2.address);
            expect(user2Info.totalClaimed).to.be.equal(user2PendingReward);

            //继续执行分红
            tx = await distributeDividendWithAmount(dividendAmount);
            await tx.wait();

            //验证应分红数额
            user1PendingReward = await accumulatedYield.pendingReward(user1.address);
            expectUser1PendingReward = expectUser1PendingReward + actualSharesUser1 * dividendAmount / TEST_CONFIG.MAX_SUPPLY;
            expect(user1PendingReward).to.be.equal(expectUser1PendingReward);
            user2PendingReward = await accumulatedYield.pendingReward(user2.address);
            expectUser2PendingReward = actualSharesUser2 * dividendAmount / TEST_CONFIG.MAX_SUPPLY;
            expect(user2PendingReward).to.be.equal(expectUser2PendingReward);

            // user1领取分红
            tx = await accumulatedYield.connect(user1).claimReward();
            await tx.wait();

            await sleep(3000);
            const balanceUser1 = await usdt.balanceOf(user1.address);
            expect(balanceUser1 - finalBalanceUser1).to.be.equal(user1PendingReward);

            //验证user1.totalClaimed
            user1Info = await accumulatedYield.getUserInfo(user1.address);
            user1TotalClaimed = user1TotalClaimed + user1PendingReward;
            expect(user1Info.totalClaimed).to.be.equal(user1TotalClaimed);

            // user2领取分红
            tx = await accumulatedYield.connect(user2).claimReward();
            await tx.wait();
            await sleep(3000);
            const balanceUser2 = await usdt.balanceOf(user2.address);
            expect(balanceUser2 - finalBalanceUser2).to.be.equal(user2PendingReward);

            //验证user2.totalClaimed
            user2Info = await accumulatedYield.getUserInfo(user2.address);
            user2TotalClaimed = user2TotalClaimed + user2PendingReward;
            expect(user2Info.totalClaimed).to.be.equal(user2TotalClaimed);

        });
    });
});
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}



