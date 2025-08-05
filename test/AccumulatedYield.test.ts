import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("AccumulatedYield", function () {
    let accumulatedYield: any;
    let shareToken: any; // 份额代币
    let rewardToken: any; // 收益代币(USDT)
    let vault: any;
    
    let owner: HardhatEthersSigner;
    let manager: HardhatEthersSigner;
    let dividendReceiver: HardhatEthersSigner;
    let validator: HardhatEthersSigner; // 签名验证者
    let alice: HardhatEthersSigner;
    let bob: HardhatEthersSigner;
    let carol: HardhatEthersSigner;

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
            vault.address,
            manager.address,
            dividendReceiver.address,
            shareToken.address,
            rewardToken.address
        );

        // 给用户铸造代币（模拟质押）
        await shareToken.mint(alice.address, ethers.utils.parseUnits("1000", 18)); // Alice 1000 SHARE
        await shareToken.mint(bob.address, ethers.utils.parseUnits("2000", 18));   // Bob 2000 SHARE
        
        // 给manager铸造足够的USDT用于派息
        await rewardToken.mint(manager.address, ethers.utils.parseUnits("10000", 6)); // 10000 USDT
        
        // manager授权AccumulatedYield合约转账USDT
        await rewardToken.connect(manager).approve(accumulatedYield.address, ethers.utils.parseUnits("10000", 6));
    });

    async function createSignature(vaultAddress: string, dividendAmount: string): Promise<string> {
        const payload = ethers.utils.solidityKeccak256(
            ["address", "uint256"],
            [vaultAddress, ethers.utils.parseUnits(dividendAmount, 6)]
        );
        const signature = await validator.signMessage(ethers.utils.arrayify(payload));
        return signature;
    }

    describe("完整流程测试", function () {
        it("步骤1-2：验证初始状态", async function () {
            // 验证初始池子状态
            const initialPool = await accumulatedYield.getGlobalPoolInfo();
            expect(initialPool.totalAccumulatedShares).to.equal(0);
            expect(initialPool.totalDividend).to.equal(0);
            expect(await shareToken.totalSupply()).to.equal(ethers.utils.parseUnits("3000", 18));

            // 验证用户余额
            expect(await shareToken.balanceOf(alice.address)).to.equal(ethers.utils.parseUnits("1000", 18));
            expect(await shareToken.balanceOf(bob.address)).to.equal(ethers.utils.parseUnits("2000", 18));
            expect(await shareToken.balanceOf(carol.address)).to.equal(0);

            // 验证用户信息（初始状态）
            const aliceInfo = await accumulatedYield.getUserInfo(alice.address);
            const bobInfo = await accumulatedYield.getUserInfo(bob.address);

            expect(aliceInfo.accumulatedShares).to.equal(0);
            expect(aliceInfo.lastClaimDividend).to.equal(0);
            expect(aliceInfo.totalClaimed).to.equal(0);

            expect(bobInfo.accumulatedShares).to.equal(0);
            expect(bobInfo.lastClaimDividend).to.equal(0);
            expect(bobInfo.totalClaimed).to.equal(0);

            console.log("✓ 步骤1-2：初始状态验证通过");
        });

        it("步骤3：管理员派息1500 USDT", async function () {
            const firstDividend = "1500";
            const signature1 = await createSignature(vault.address, firstDividend);
            
            await expect(
                accumulatedYield.connect(manager).distributeDividend(
                    ethers.utils.parseUnits(firstDividend, 6),
                    signature1
                )
            ).to.emit(accumulatedYield, "DividendDistributed");

            // 验证池子状态更新
            const poolAfterFirstDividend = await accumulatedYield.getGlobalPoolInfo();
            expect(poolAfterFirstDividend.totalDividend).to.equal(ethers.utils.parseUnits(firstDividend, 6));
            
            // totalAccumulatedShares = 3000 * 1500 = 4,500,000
            const expectedShares = ethers.utils.parseUnits("3000", 18).mul(ethers.utils.parseUnits(firstDividend, 6));
            expect(poolAfterFirstDividend.totalAccumulatedShares).to.equal(expectedShares);

            console.log("✓ 步骤3：第一次派息1500 USDT完成");
            console.log(`  - totalDividend: ${ethers.utils.formatUnits(poolAfterFirstDividend.totalDividend, 6)} USDT`);
            console.log(`  - totalAccumulatedShares: ${poolAfterFirstDividend.totalAccumulatedShares.toString()}`);
        });

        it("步骤4：Alice转账500个ShareToken给Carol", async function () {
            // 先派息
            const firstDividend = "1500";
            const signature1 = await createSignature(vault.address, firstDividend);
            await accumulatedYield.connect(manager).distributeDividend(
                ethers.utils.parseUnits(firstDividend, 6),
                signature1
            );

            // 设置updateUserPoolsOnTransfer
            await shareToken.setAccumulatedYield(accumulatedYield.address);
            
            // 执行转账，会触发updateUserPoolsOnTransfer
            await shareToken.connect(alice).transfer(carol.address, ethers.utils.parseUnits("500", 18));

            // 验证余额变化
            expect(await shareToken.balanceOf(alice.address)).to.equal(ethers.utils.parseUnits("500", 18));
            expect(await shareToken.balanceOf(carol.address)).to.equal(ethers.utils.parseUnits("500", 18));

            // 验证用户信息更新
            const aliceAfterTransfer = await accumulatedYield.getUserInfo(alice.address);
            const carolAfterTransfer = await accumulatedYield.getUserInfo(carol.address);

            // Alice: accumulatedShares = 0 + 1000 * (1500 - 0) = 1,500,000
            const expectedAliceShares = ethers.utils.parseUnits("1000", 18).mul(ethers.utils.parseUnits(firstDividend, 6));
            expect(aliceAfterTransfer.accumulatedShares).to.equal(expectedAliceShares);
            expect(aliceAfterTransfer.lastClaimDividend).to.equal(ethers.utils.parseUnits(firstDividend, 6));

            // Carol: lastClaimDividend更新为当前总派息
            expect(carolAfterTransfer.accumulatedShares).to.equal(0);
            expect(carolAfterTransfer.lastClaimDividend).to.equal(ethers.utils.parseUnits(firstDividend, 6));

            console.log("✓ 步骤4：Alice转账500个ShareToken给Carol完成");
            console.log(`  - Alice balance: ${ethers.utils.formatUnits(await shareToken.balanceOf(alice.address), 18)}`);
            console.log(`  - Carol balance: ${ethers.utils.formatUnits(await shareToken.balanceOf(carol.address), 18)}`);
            console.log(`  - Alice accumulatedShares: ${aliceAfterTransfer.accumulatedShares.toString()}`);
        });

        it("步骤5-8：第二次派息和收益领取", async function () {
            // 先完成前面的步骤
            const firstDividend = "1500";
            const signature1 = await createSignature(vault.address, firstDividend);
            await accumulatedYield.connect(manager).distributeDividend(
                ethers.utils.parseUnits(firstDividend, 6),
                signature1
            );

            await shareToken.setAccumulatedYield(accumulatedYield.address);
            await shareToken.connect(alice).transfer(carol.address, ethers.utils.parseUnits("500", 18));

            // 步骤5：第二次派息1000 USDT
            const secondDividend = "1000";
            const signature2 = await createSignature(vault.address, secondDividend);
            
            await accumulatedYield.connect(manager).distributeDividend(
                ethers.utils.parseUnits(secondDividend, 6),
                signature2
            );

            // 验证池子状态
            const poolAfterSecondDividend = await accumulatedYield.getGlobalPoolInfo();
            expect(poolAfterSecondDividend.totalDividend).to.equal(ethers.utils.parseUnits("2500", 6)); // 1500 + 1000

            console.log("✓ 步骤5：第二次派息1000 USDT完成");

            // 步骤6：Alice领取收益
            const aliceBalanceBefore = await rewardToken.balanceOf(alice.address);
            await accumulatedYield.connect(alice).claimReward();
            const aliceBalanceAfter = await rewardToken.balanceOf(alice.address);
            const aliceReward = aliceBalanceAfter.sub(aliceBalanceBefore);

            console.log(`✓ 步骤6：Alice领取收益 ${ethers.utils.formatUnits(aliceReward, 6)} USDT`);

            // 步骤7：Bob领取收益
            const bobBalanceBefore = await rewardToken.balanceOf(bob.address);
            await accumulatedYield.connect(bob).claimReward();
            const bobBalanceAfter = await rewardToken.balanceOf(bob.address);
            const bobReward = bobBalanceAfter.sub(bobBalanceBefore);

            console.log(`✓ 步骤7：Bob领取收益 ${ethers.utils.formatUnits(bobReward, 6)} USDT`);

            // 步骤8：Carol领取收益
            const carolBalanceBefore = await rewardToken.balanceOf(carol.address);
            await accumulatedYield.connect(carol).claimReward();
            const carolBalanceAfter = await rewardToken.balanceOf(carol.address);
            const carolReward = carolBalanceAfter.sub(carolBalanceBefore);

            console.log(`✓ 步骤8：Carol领取收益 ${ethers.utils.formatUnits(carolReward, 6)} USDT`);

            // 最终验证
            const totalRewards = aliceReward.add(bobReward).add(carolReward);
            const totalDistributed = ethers.utils.parseUnits("2500", 6);
            
            console.log(`\n=== 最终验证 ===`);
            console.log(`总分配: ${ethers.utils.formatUnits(totalDistributed, 6)} USDT`);
            console.log(`总领取: ${ethers.utils.formatUnits(totalRewards, 6)} USDT`);
            console.log(`Alice收益比例: ${aliceReward.mul(10000).div(totalDistributed).toNumber() / 100}%`);
            console.log(`Bob收益比例: ${bobReward.mul(10000).div(totalDistributed).toNumber() / 100}%`);
            console.log(`Carol收益比例: ${carolReward.mul(10000).div(totalDistributed).toNumber() / 100}%`);

            // 验证总收益分配正确（允许微小误差）
            expect(totalRewards).to.be.closeTo(totalDistributed, ethers.utils.parseUnits("3", 0));
        });

        it("测试累积份额计算", async function () {
            // 派息1500 USDT
            const dividendAmount = "1500";
            const signature = await createSignature(vault.address, dividendAmount);
            
            await accumulatedYield.connect(manager).distributeDividend(
                ethers.utils.parseUnits(dividendAmount, 6),
                signature
            );

            // 测试calculateAccumulatedShares函数
            const aliceShares = await accumulatedYield.calculateAccumulatedShares(
                alice.address, 
                ethers.utils.parseUnits("1000", 18)
            );
            
            // Alice: accumulatedShares = 0 + 1000 * (1500 - 0) = 1,500,000
            const expected = ethers.utils.parseUnits("1000", 18).mul(ethers.utils.parseUnits(dividendAmount, 6));
            expect(aliceShares).to.equal(expected);

            console.log(`✓ calculateAccumulatedShares测试通过`);
            console.log(`  - 用户余额1000，累积份额: ${aliceShares.toString()}`);

            // 测试不同余额下的累积份额
            const aliceShares500 = await accumulatedYield.calculateAccumulatedShares(
                alice.address, 
                ethers.utils.parseUnits("500", 18)
            );
            
            const expected500 = ethers.utils.parseUnits("500", 18).mul(ethers.utils.parseUnits(dividendAmount, 6));
            expect(aliceShares500).to.equal(expected500);

            console.log(`  - 用户余额500，累积份额: ${aliceShares500.toString()}`);
        });

        it("测试签名验证", async function () {
            const dividendAmount = "1000";
            
            // 正确的签名
            const validSignature = await createSignature(vault.address, dividendAmount);
            
            await expect(
                accumulatedYield.connect(manager).distributeDividend(
                    ethers.utils.parseUnits(dividendAmount, 6),
                    validSignature
                )
            ).to.not.be.reverted;

            console.log("✓ 正确签名验证通过");

            // 错误的签名（不同的金额）
            const invalidSignature = await createSignature(vault.address, "2000");
            
            await expect(
                accumulatedYield.connect(manager).distributeDividend(
                    ethers.utils.parseUnits(dividendAmount, 6),
                    invalidSignature
                )
            ).to.be.revertedWith("AccumulatedYield: invalid drds signature");

            console.log("✓ 错误签名被正确拒绝");
        });
    });
}); 