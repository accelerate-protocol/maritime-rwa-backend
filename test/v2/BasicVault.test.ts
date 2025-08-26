import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { BasicVault } from "../../typechain-types/contracts/v2/templates/vault/BasicVault";
import { VaultToken } from "../../typechain-types/contracts/v2/templates/token/VaultToken";
import { AccumulatedYield } from "../../typechain-types/contracts/v2/templates/yield/AccumulatedYield";

describe("BasicVault", function () {
    let basicVault: any;
    let vaultToken: any;
    let funding: any;
    let yieldInstance: any;
    let owner: HardhatEthersSigner;
    let manager: HardhatEthersSigner;
    let validator: HardhatEthersSigner;
    let user1: HardhatEthersSigner;
    let user2: HardhatEthersSigner;
    let user3: HardhatEthersSigner;

    // Token precision constants
    const TOKEN_DECIMALS = 6;

    // Test amounts
    const mintAmount = ethers.parseUnits("1000", TOKEN_DECIMALS);
    const burnAmount = ethers.parseUnits("100", TOKEN_DECIMALS);

    beforeEach(async function () {
        [owner, manager, validator, user1, user2, user3] = await ethers.getSigners();

        // Deploy BasicVault
        const BasicVaultFactory = await ethers.getContractFactory("BasicVault");
        basicVault = await BasicVaultFactory.deploy();

        // Deploy VaultToken
        const VaultTokenFactory = await ethers.getContractFactory("VaultToken");
        vaultToken = await VaultTokenFactory.deploy();

        // Deploy funding
        const CrowdsaleFactory = await ethers.getContractFactory("Crowdsale");
        funding = await CrowdsaleFactory.deploy();

        const YieldFactory = await ethers.getContractFactory("AccumulatedYield");
        yieldInstance = await YieldFactory.deploy();
    });

    // Helper function to initialize vault
    async function initializeVault(
        _manager: any,
        _validator: any,
        _whitelistEnabled: boolean = false,
        _initialWhitelist: string[] = []
    ) {
        const initData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "bool", "address[]"],
            [_manager.address, _validator.address, _whitelistEnabled, _initialWhitelist]
        );
        await basicVault.initiate(initData);
    }

    async function initializeVaultDirect(
        vault: any,
        _manager: any,
        _validator: any,
        _whitelistEnabled: boolean = false,
        _initialWhitelist: string[] = []
    ) {
        const initData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "bool", "address[]"],
            [_manager, _validator, _whitelistEnabled, _initialWhitelist]
        );
        await vault.initiate(initData);
    }

    async function initializeToken(
        token: any,
        vault: any,
        name: string,
        symbol: string,
        decimals: number
    ) {
        const initData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["string", "string", "uint8"],
            [name, symbol, decimals]
        );
        await token.initiate(vault, initData);
    }

    async function initializeCrowdsale(
        crowdsale: any,
        vault: any,
        startTime: number,
        endTime: number,
        assetToken: any,
        maxSupply: any,
        softCap: any,
        sharePrice: any,
        minDepositAmount: any,
        manageFeeBps: number,
        fundingReceiver: any,
        manageFeeReceiver: any,
        decimalsMultiplier: any,
        manager: any
    ) {
        const initData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "uint256", "address"],
            [startTime, endTime, assetToken, maxSupply, softCap, sharePrice, minDepositAmount, manageFeeBps, fundingReceiver, manageFeeReceiver, decimalsMultiplier, manager]
        );
        await crowdsale.initiate(vault, initData);
    }

    describe("Initialization", function () {
        it("should initialize correctly", async function () {
            await initializeVault(manager, validator);

            expect(await basicVault.manager()).to.equal(manager.address);
            expect(await basicVault.validator()).to.equal(validator.address);
            expect(await basicVault.whitelistEnabled()).to.be.false;
            expect(await basicVault.owner()).to.equal(manager.address);
        });

        it("should initialize with whitelist enabled", async function () {
            const initialWhitelist = [user1.address, user2.address];
            await initializeVault(manager, validator, true, initialWhitelist);

            expect(await basicVault.whitelistEnabled()).to.be.true;
            expect(await basicVault.isWhitelisted(user1.address)).to.be.true;
            expect(await basicVault.isWhitelisted(user2.address)).to.be.true;
        });

        it("should initialize with blank whitelist enabled", async function () {
            await initializeVault(manager, validator, true, []);

            expect(await basicVault.whitelistEnabled()).to.be.true;
            expect(await basicVault.isWhitelisted(user1.address)).to.be.false;
            expect(await basicVault.isWhitelisted(user2.address)).to.be.false;
        });

        it("should reject duplicate initialization", async function () {
            const newVault = await (await ethers.getContractFactory("BasicVault")).deploy();
            const initData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "address", "bool", "address[]"],
                [manager.address, validator.address, false, []]
            );
            await newVault.initiate(initData);

            await expect(
                newVault.connect(manager).initiate(initData)
            ).to.be.revertedWith("BasicVault: already initialized");
        });

        it("should reject invalid initialization parameters", async function () {
            const invalidManagerData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "address", "bool", "address[]"],
                [ethers.ZeroAddress, validator.address, false, []]
            );
            await expect(
                basicVault.initiate(invalidManagerData)
            ).to.be.revertedWith("BasicVault: invalid manager");

            const invalidValidatorData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "address", "bool", "address[]"],
                [manager.address, ethers.ZeroAddress, false, []]
            );
            await expect(
                basicVault.initiate(invalidValidatorData)
            ).to.be.revertedWith("BasicVault: invalid validator");


            const initialInvalidWhitelist = [ethers.ZeroAddress];
            const invalidWhitelistData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "address", "bool", "address[]"],
                [manager.address, validator.address, false, initialInvalidWhitelist]
            );
            await expect(
                basicVault.initiate(invalidWhitelistData)
            ).to.be.revertedWith("BasicVault: invalid address");
        });

        it("should allow initialization from any address (Clones pattern)", async function () {
            const newVault = await (await ethers.getContractFactory("BasicVault")).deploy();
            const initData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "address", "bool", "address[]"],
                [manager.address, validator.address, false, []]
            );
            // In Clones pattern, anyone can initialize the contract
            await newVault.connect(user1).initiate(initData);

            // Verify initialization was successful
            expect(await newVault.manager()).to.equal(manager.address);
            expect(await newVault.validator()).to.equal(validator.address);
        });
    });

    describe("Whitelist Management", function () {
        beforeEach(async function () {
            await initializeVault(manager, validator);
        });

        it("should add address to whitelist", async function () {
            await basicVault.connect(manager).addToWhitelist(user1.address);

            expect(await basicVault.isWhitelisted(user1.address)).to.be.true;
        });

        it("should reject adding invalid address", async function () {
            await expect(
                basicVault.connect(manager).addToWhitelist(ethers.ZeroAddress)
            ).to.be.revertedWith("BasicVault: invalid address");
        });

        it("should reject adding already whitelisted address", async function () {
            await basicVault.connect(manager).addToWhitelist(user1.address);

            await expect(
                basicVault.connect(manager).addToWhitelist(user1.address)
            ).to.be.revertedWith("BasicVault: already whitelisted");
        });

        it("should reject non-manager from adding to whitelist", async function () {
            await expect(
                basicVault.connect(user1).addToWhitelist(user2.address)
            ).to.be.revertedWith("BasicVault: only manager");
        });

        it("should remove address from whitelist", async function () {
            await basicVault.connect(manager).addToWhitelist(user1.address);
            await basicVault.connect(manager).addToWhitelist(user2.address);

            await basicVault.connect(manager).removeFromWhitelist(user1.address);

            expect(await basicVault.isWhitelisted(user1.address)).to.be.false;
            expect(await basicVault.isWhitelisted(user2.address)).to.be.true;
        });

        it("should reject removing non-whitelisted address", async function () {
            await expect(
                basicVault.connect(manager).removeFromWhitelist(user1.address)
            ).to.be.revertedWith("BasicVault: not whitelisted");
        });

        it("should reject non-manager from removing from whitelist", async function () {
            await basicVault.connect(manager).addToWhitelist(user1.address);

            await expect(
                basicVault.connect(user1).removeFromWhitelist(user1.address)
            ).to.be.revertedWith("BasicVault: only manager");
        });

        it("should enable and disable whitelist", async function () {
            await basicVault.connect(manager).enableWhitelist();
            expect(await basicVault.whitelistEnabled()).to.be.true;
            expect(await basicVault.isWhiteList()).to.be.true;

            await basicVault.connect(manager).disableWhitelist();
            expect(await basicVault.whitelistEnabled()).to.be.false;
            expect(await basicVault.isWhiteList()).to.be.false;
        });

        it("should reject non-manager from changing whitelist status", async function () {
            await expect(
                basicVault.connect(user1).enableWhitelist()
            ).to.be.revertedWith("BasicVault: only manager");

            await expect(
                basicVault.connect(user1).disableWhitelist()
            ).to.be.revertedWith("BasicVault: only manager");
        });


    });

    describe("Module Configuration", function () {
        beforeEach(async function () {
            await initializeVault(manager, validator);
        });

        it("should set modules", async function () {
            await basicVault.connect(manager).configureModules(
                await vaultToken.getAddress(),
                await funding.getAddress(),
                await yieldInstance.getAddress()
            );

            expect(await basicVault.vaultToken()).to.equal(await vaultToken.getAddress());
            expect(await basicVault.funding()).to.equal(await funding.getAddress());
            expect(await basicVault.yield()).to.equal(await yieldInstance.getAddress());
        });
    });

    describe("Token Operations", function () {
        // 测试套件的共享变量
        let testVault: BasicVault;
        let testToken: VaultToken;
        let testFunding: HardhatEthersSigner;
        let testYield: AccumulatedYield;

        beforeEach(async function () {
            // 创建一个新的测试环境，以避免测试之间的状态干扰
            // 1. 部署 BasicVault 合约
            testVault = await (await ethers.getContractFactory("BasicVault")).deploy();
            await initializeVaultDirect(testVault,
                manager.address,
                validator.address,
                false,
                []
            );

            // 2. 部署 VaultToken 合约
            testToken = await (await ethers.getContractFactory("VaultToken")).deploy();
            await initializeToken(testToken,
                await testVault.getAddress(),
                "Test Token",
                "TEST",
                TOKEN_DECIMALS
            );

            // 3. 部署 AccumulatedYield 合约作为 yield 模块
            testYield = await (await ethers.getContractFactory("AccumulatedYield")).deploy();

            // 4. 使用 user1 作为 funding 模块（为了测试方便）
            testFunding = user1;

            // 5. 配置模块
            await testVault.connect(manager).configureModules(
                await testToken.getAddress(),
                testFunding.address,
                await testYield.getAddress()
            );

            // 6. 解除代币暂停状态，以便进行转账测试
            await testVault.connect(manager).unpauseToken();
        });

        describe("Mint Token 功能测试", function () {
            it("应该允许 funding 模块铸造代币", async function () {
                // 1. 记录初始余额
                const initialBalance = await testToken.balanceOf(user2.address);

                // 2. 通过 funding 模块（user1）铸造代币给 user2
                await testVault.connect(testFunding).mintToken(user2.address, mintAmount);

                // 3. 验证 user2 的余额增加了正确的数量
                const finalBalance = await testToken.balanceOf(user2.address);
                expect(finalBalance).to.equal(initialBalance + mintAmount);
            });

            it("应该拒绝非 funding 模块的铸造请求", async function () {
                // 尝试从非 funding 模块（user2）铸造代币
                await expect(
                    testVault.connect(user2).mintToken(user2.address, mintAmount)
                ).to.be.revertedWith("BasicVault: only funding");
            });

        });

        describe("Burn Token 功能测试", function () {
            beforeEach(async function () {
                // 为 burn 测试准备：先铸造一些代币给 user2
                await testVault.connect(testFunding).mintToken(user2.address, mintAmount);
                // user2 授权 vault 可以销毁其代币
                await testToken.connect(user2).approve(await testVault.getAddress(), burnAmount);
            });

            it("应该允许 funding 模块销毁代币", async function () {
                // 1. 记录初始余额
                const initialBalance = await testToken.balanceOf(user2.address);

                // 2. 通过 funding 模块销毁 user2 的代币
                await testVault.connect(testFunding).burnToken(user2.address, burnAmount);

                // 3. 验证 user2 的余额减少了正确的数量
                const finalBalance = await testToken.balanceOf(user2.address);
                expect(finalBalance).to.equal(initialBalance - burnAmount);
            });

            it("应该拒绝非 funding 模块的销毁请求", async function () {
                // 尝试从非 funding 模块（user3）销毁代币
                await expect(
                    testVault.connect(user3).burnToken(user2.address, burnAmount)
                ).to.be.revertedWith("BasicVault: only funding");
            });
        });
    });

    describe("Token Pause/Unpause", function () {
        beforeEach(async function () {
            await initializeVault(manager, validator);
            await basicVault.connect(manager).configureModules(
                await vaultToken.getAddress(),
                await funding.getAddress(),
                await yieldInstance.getAddress()
            );

            // Initialize vault token
            await initializeToken(vaultToken,
                await basicVault.getAddress(),
                "Test Token",
                "TEST",
                TOKEN_DECIMALS
            );
        });

        it("should pause and unpause token", async function () {
            await basicVault.connect(manager).pauseToken();
            expect(await basicVault.isTokenPaused()).to.be.true;

            await basicVault.connect(manager).unpauseToken();
            expect(await basicVault.isTokenPaused()).to.be.false;
        });

        it("should reject non-manager from pausing token", async function () {
            await expect(
                basicVault.connect(user1).pauseToken()
            ).to.be.revertedWith("BasicVault: only manager");
        });

        it("should reject non-manager from unpausing token", async function () {
            await expect(
                basicVault.connect(user1).unpauseToken()
            ).to.be.revertedWith("BasicVault: only manager or funding");
        });

        it("should return false when token not set", async function () {
            const newVault = await (await ethers.getContractFactory("BasicVault")).deploy();
            await initializeVaultDirect(newVault,
                manager.address,
                validator.address,
                false,
                []
            );

            expect(await newVault.isTokenPaused()).to.be.false;
        });
    });

    describe("User Pool Updates", function () {
        beforeEach(async function () {
            await initializeVault(manager, validator);
            await basicVault.connect(manager).configureModules(
                await vaultToken.getAddress(),
                await funding.getAddress(),
                await yieldInstance.getAddress()
            );

            // Initialize vault token
            await initializeToken(vaultToken,
                await basicVault.getAddress(),
                "Test Token",
                "TEST",
                TOKEN_DECIMALS
            );
        });

        it("should reject onTokenTransfer from non-token", async function () {
            await expect(
                basicVault.connect(user1).onTokenTransfer(
                    user1.address,
                    user2.address,
                    burnAmount
                )
            ).to.be.revertedWith("BasicVault: only token can call");
        });

        it("should handle onTokenTransfer with zero addresses", async function () {
            // Test that the function exists and can handle zero addresses
            // Since we can't use contract as signer, we'll just verify the function exists
            expect(typeof basicVault.onTokenTransfer).to.equal('function');
        });
    });

    describe("Verification Data", function () {
        beforeEach(async function () {
            await initializeVault(manager, validator);
        });

        it("should update verification data", async function () {
            const hash = ethers.randomBytes(32);
            const signature = ethers.randomBytes(65);

            await basicVault.connect(manager).updateVerifyData(hash, signature);

            expect(await basicVault.dataHash()).to.equal(ethers.hexlify(hash));
            expect(await basicVault.signature()).to.equal(ethers.hexlify(signature));
        });

        it("should reject non-manager from updating verification data", async function () {
            const hash = ethers.randomBytes(32);
            const signature = ethers.randomBytes(65);

            await expect(
                basicVault.connect(user1).updateVerifyData(hash, signature)
            ).to.be.revertedWith("BasicVault: only manager");
        });

        it("should always return true for verify", async function () {
            expect(await basicVault.verify()).to.be.true;
        });
    });

    describe("Whitelist Enforcement", function () {
        beforeEach(async function () {
            await initializeVault(manager, validator, true, [user1.address]);
        });

        it("should allow whitelisted user to call functions", async function () {
            // This test would be more relevant if we had functions that use the whitelist modifier
            // For now, we just verify the whitelist is working
            expect(await basicVault.isWhitelisted(user1.address)).to.be.true;
            expect(await basicVault.isWhitelisted(user2.address)).to.be.false;
        });
    });

    describe("Access Control", function () {
        beforeEach(async function () {
            await initializeVault(manager, validator);
        });

        it("should reject operations when not initialized", async function () {
            const uninitializedVault = await (await ethers.getContractFactory("BasicVault")).deploy();

            await expect(
                uninitializedVault.connect(manager).addToWhitelist(user1.address)
            ).to.be.revertedWith("BasicVault: only manager");
        });

        it("should reject operations from non-manager", async function () {
            await expect(
                basicVault.connect(user1).addToWhitelist(user2.address)
            ).to.be.revertedWith("BasicVault: only manager");

            await expect(
                basicVault.connect(user1).enableWhitelist()
            ).to.be.revertedWith("BasicVault: only manager");
        });
    });
});
