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

    });

    describe("部署合约", function () {

        it("应部署合约", async function () {
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
            console.log("creation 合约地址:", await creation.getAddress());

        });

    });

});

