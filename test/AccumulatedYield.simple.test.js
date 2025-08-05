const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AccumulatedYield - 完整流程测试", function () {
    let accumulatedYield;
    let shareToken;
    let rewardToken;
    let vault;
    
    let owner, manager, dividendReceiver, validator;
    let alice, bob, carol;

    beforeEach(async function () {
        [owner, manager, dividendReceiver, validator, alice, bob, carol] = await ethers.getSigners();

        // 部署Mock代币
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        shareToken = await MockERC20.deploy("Share Token", "SHARE", 18);
        rewardToken = await MockERC20.deploy("USDT", "USDT", 6);

        // 部署Mock Vault
        const MockVault = await ethers.getContractFactory("MockVault");
        vault = await MockVault.deploy();
        
        // 设置Vault的validator
        await vault.setValidator(validator.address);

        // 部署AccumulatedYield合约
        const AccumulatedYield = await ethers.getContractFactory("AccumulatedYield");
        accumulatedYield = await AccumulatedYield.deploy();

        // 初始化AccumulatedYield
        await accumulatedYield.initGlobalPool(
            vault.target || vault.address,
            manager.address,
            dividendReceiver.address,
            shareToken.target || shareToken.address,
            rewardToken.target || rewardToken.address
        );

        // 给用户铸造代币（模拟质押）
        await shareToken.mint(alice.address, ethers.parseUnits("1000", 18)); // Alice 1000 SHARE
        await shareToken.mint(bob.address, ethers.parseUnits("2000", 18));   // Bob 2000 SHARE
        
        // 给manager铸造足够的USDT用于派息
        await rewardToken.mint(manager.address, ethers.parseUnits("10000", 6)); // 10000 USDT
        
        // manager授权AccumulatedYield合约转账USDT
        await rewardToken.connect(manager).approve(
            accumulatedYield.target || accumulatedYield.address, 
            ethers.parseUnits("10000", 6)
        );
    });

    async function createSignature(vaultAddress, dividendAmount) {
        const payload = ethers.solidityPackedKeccak256(
            ["address", "uint256"],
            [vaultAddress, ethers.parseUnits(dividendAmount, 6)]
        );
        const signature = await validator.signMessage(ethers.getBytes(payload));
        return signature;
    }

    it("完整的质押-派息-转账-领取流程测试", async function () {
        console.log("\n=== AccumulatedYield 完整流程测试 ===\n");

        // ==================== 步骤1-2：验证初始状态 ====================
        console.log("步骤1-2：验证初始状态");
        
        const initialPool = await accumulatedYield.getGlobalPoolInfo();
        expect(initialPool.totalAccumulatedShares).to.equal(0);
        expect(initialPool.totalDividend).to.equal(0);
        
        const totalSupply = await shareToken.totalSupply();
        expect(totalSupply).to.equal(ethers.parseUnits("3000", 18));

        // 验证用户余额
        const aliceBalance = await shareToken.balanceOf(alice.address);
        const bobBalance = await shareToken.balanceOf(bob.address);
        const carolBalance = await shareToken.balanceOf(carol.address);
        
        expect(aliceBalance).to.equal(ethers.parseUnits("1000", 18));
        expect(bobBalance).to.equal(ethers.parseUnits("2000", 18));
        expect(carolBalance).to.equal(0);

        console.log(`  ✓ 代币总供应量: ${ethers.formatUnits(totalSupply, 18)}`);
        console.log(`  ✓ Alice余额: ${ethers.formatUnits(aliceBalance, 18)}`);
        console.log(`  ✓ Bob余额: ${ethers.formatUnits(bobBalance, 18)}`);
        console.log(`  ✓ Carol余额: ${ethers.formatUnits(carolBalance, 18)}`);

        // ==================== 步骤3：管理员派息1500 USDT ====================
        console.log("\n步骤3：管理员派息1500 USDT");
        
        const firstDividend = "1500";
        const signature1 = await createSignature(vault.target || vault.address, firstDividend);
        
        await expect(
            accumulatedYield.connect(manager).distributeDividend(
                ethers.parseUnits(firstDividend, 6),
                signature1
            )
        ).to.emit(accumulatedYield, "DividendDistributed");

        const poolAfterFirstDividend = await accumulatedYield.getGlobalPoolInfo();
        console.log(`  ✓ 总派息金额: ${ethers.formatUnits(poolAfterFirstDividend.totalDividend, 6)} USDT`);
        console.log(`  ✓ 总累积份额: ${poolAfterFirstDividend.totalAccumulatedShares.toString()}`);

        // ==================== 步骤4：Alice转账500个ShareToken给Carol ====================
        console.log("\n步骤4：Alice转账500个ShareToken给Carol");
        
        // 设置updateUserPoolsOnTransfer
        await shareToken.setAccumulatedYield(accumulatedYield.target || accumulatedYield.address);
        
        // 执行转账，会触发updateUserPoolsOnTransfer
        await shareToken.connect(alice).transfer(carol.address, ethers.parseUnits("500", 18));

        // 验证余额变化
        const aliceBalanceAfter = await shareToken.balanceOf(alice.address);
        const carolBalanceAfter = await shareToken.balanceOf(carol.address);
        
        console.log(`  ✓ Alice转账后余额: ${ethers.formatUnits(aliceBalanceAfter, 18)}`);
        console.log(`  ✓ Carol转账后余额: ${ethers.formatUnits(carolBalanceAfter, 18)}`);

        // ==================== 步骤5：管理员派息1000 USDT ====================
        console.log("\n步骤5：管理员派息1000 USDT");
        
        const secondDividend = "1000";
        const signature2 = await createSignature(vault.target || vault.address, secondDividend);
        
        await accumulatedYield.connect(manager).distributeDividend(
            ethers.parseUnits(secondDividend, 6),
            signature2
        );

        const poolAfterSecondDividend = await accumulatedYield.getGlobalPoolInfo();
        console.log(`  ✓ 总派息金额: ${ethers.formatUnits(poolAfterSecondDividend.totalDividend, 6)} USDT`);

        // ==================== 步骤6-8：用户领取收益 ====================
        console.log("\n步骤6-8：用户领取收益");

        // Alice领取收益
        const aliceUSDTBefore = await rewardToken.balanceOf(alice.address);
        await accumulatedYield.connect(alice).claimReward();
        const aliceUSDTAfter = await rewardToken.balanceOf(alice.address);
        const aliceReward = aliceUSDTAfter - aliceUSDTBefore;
        
        console.log(`  ✓ Alice领取收益: ${ethers.formatUnits(aliceReward, 6)} USDT`);

        // Bob领取收益
        const bobUSDTBefore = await rewardToken.balanceOf(bob.address);
        await accumulatedYield.connect(bob).claimReward();
        const bobUSDTAfter = await rewardToken.balanceOf(bob.address);
        const bobReward = bobUSDTAfter - bobUSDTBefore;
        
        console.log(`  ✓ Bob领取收益: ${ethers.formatUnits(bobReward, 6)} USDT`);

        // Carol领取收益
        const carolUSDTBefore = await rewardToken.balanceOf(carol.address);
        await accumulatedYield.connect(carol).claimReward();
        const carolUSDTAfter = await rewardToken.balanceOf(carol.address);
        const carolReward = carolUSDTAfter - carolUSDTBefore;
        
        console.log(`  ✓ Carol领取收益: ${ethers.formatUnits(carolReward, 6)} USDT`);

        // ==================== 最终验证 ====================
        console.log("\n=== 最终验证 ===");
        
        const totalRewards = aliceReward + bobReward + carolReward;
        const totalDistributed = ethers.parseUnits("2500", 6); // 1500 + 1000
        
        console.log(`总分配: ${ethers.formatUnits(totalDistributed, 6)} USDT`);
        console.log(`总领取: ${ethers.formatUnits(totalRewards, 6)} USDT`);
        
        const aliceRatio = (Number(aliceReward) * 100 / Number(totalDistributed)).toFixed(2);
        const bobRatio = (Number(bobReward) * 100 / Number(totalDistributed)).toFixed(2);
        const carolRatio = (Number(carolReward) * 100 / Number(totalDistributed)).toFixed(2);
        
        console.log(`Alice收益比例: ${aliceRatio}%`);
        console.log(`Bob收益比例: ${bobRatio}%`);
        console.log(`Carol收益比例: ${carolRatio}%`);

        // 验证总收益分配基本正确（允许微小误差）
        expect(Number(totalRewards)).to.be.closeTo(Number(totalDistributed), Number(ethers.parseUnits("5", 0)));
        
        console.log("\n✅ 完整流程测试通过！");
    });

    it("测试签名验证功能", async function () {
        console.log("\n=== 签名验证测试 ===");
        
        const dividendAmount = "1000";
        
        // 正确的签名
        const validSignature = await createSignature(vault.target || vault.address, dividendAmount);
        
        await expect(
            accumulatedYield.connect(manager).distributeDividend(
                ethers.parseUnits(dividendAmount, 6),
                validSignature
            )
        ).to.not.be.reverted;

        console.log("✓ 正确签名验证通过");

        // 错误的签名（不同的金额）
        const invalidSignature = await createSignature(vault.target || vault.address, "2000");
        
        await expect(
            accumulatedYield.connect(manager).distributeDividend(
                ethers.parseUnits(dividendAmount, 6),
                invalidSignature
            )
        ).to.be.revertedWith("AccumulatedYield: invalid drds signature");

        console.log("✓ 错误签名被正确拒绝");
    });

    it("测试累积份额计算", async function () {
        console.log("\n=== 累积份额计算测试 ===");
        
        // 派息1500 USDT
        const dividendAmount = "1500";
        const signature = await createSignature(vault.target || vault.address, dividendAmount);
        
        await accumulatedYield.connect(manager).distributeDividend(
            ethers.parseUnits(dividendAmount, 6),
            signature
        );

        // 测试calculateAccumulatedShares函数
        const aliceShares = await accumulatedYield.calculateAccumulatedShares(
            alice.address, 
            ethers.parseUnits("1000", 18)
        );
        
        console.log(`✓ Alice持有1000代币的累积份额: ${aliceShares.toString()}`);

        // 测试不同余额下的累积份额
        const aliceShares500 = await accumulatedYield.calculateAccumulatedShares(
            alice.address, 
            ethers.parseUnits("500", 18)
        );
        
        console.log(`✓ Alice持有500代币的累积份额: ${aliceShares500.toString()}`);

        // 验证份额计算逻辑正确
        expect(aliceShares500 * 2n).to.equal(aliceShares);
        console.log("✓ 份额计算比例正确");
    });
}); 