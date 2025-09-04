const { ethers } = require("hardhat");

async function main() {
    // ============ 配置区域 - 在这里修改参数 ============
    
    // Yield 合约地址 - 请根据实际情况修改
    const YIELD_ADDRESS = "0x143eA0c93e167a8E147EC0dBd5dD7Be0450E7068"; // 替换为实际的 Yield 合约地址
    
    // 要查询的用户地址（可选）
    const USER_ADDRESS = "0xa1FE4Ed4D662eCa52DEA7b934E429b98AAFF7533"; // 替换为要查询的用户地址，留空则不查询用户信息
    
    // ============ 脚本逻辑 ============
    
    console.log("🌾 Yield 合约数据查询脚本");
    console.log("=".repeat(60));
    console.log(`Yield 合约地址: ${YIELD_ADDRESS}`);
    if (USER_ADDRESS !== "0x...") {
        console.log(`查询用户地址: ${USER_ADDRESS}`);
    }
    console.log("=".repeat(60));
    
    try {
        // 验证地址格式
        if (!ethers.isAddress(YIELD_ADDRESS)) {
            throw new Error("Yield 合约地址格式无效");
        }
        
        if (USER_ADDRESS !== "0x..." && !ethers.isAddress(USER_ADDRESS)) {
            throw new Error("用户地址格式无效");
        }
        
        // 连接合约
        const yield = await ethers.getContractAt("IAccumulatedYield", YIELD_ADDRESS);
        console.log("✅ 合约连接成功");
        
        // 检查合约是否已部署
        const code = await ethers.provider.getCode(YIELD_ADDRESS);
        if (code === "0x") {
            throw new Error("Yield 合约地址无效或未部署");
        }
        
        // 获取签名者信息
        const [signer] = await ethers.getSigners();
        console.log(`🔑 当前签名者: ${signer.address}`);
        
        // 查询基本信息
        await queryBasicInfo(yield);
        
        // 查询全局池信息
        await queryGlobalPoolInfo(yield);
        
        // 查询用户信息（如果提供了用户地址）
        if (USER_ADDRESS !== "0x...") {
            await queryUserInfo(yield, USER_ADDRESS);
        }
        
        // 查询其他相关信息
        await queryAdditionalInfo(yield);
        
        console.log("\n🎉 查询完成!");
        
    } catch (error) {
        console.error("\n❌ 查询失败:", error.message);
        console.error("错误详情:", error);
        process.exit(1);
    }
}

// 查询基本信息
async function queryBasicInfo(yield) {
    console.log("\n📋 基本信息");
    console.log("-".repeat(40));
    
    try {
        const manager = await yield.getManager();
        console.log(`👨‍💼 管理员地址: ${manager}`);
        
        const treasury = await yield.getDividendTreasury();
        console.log(`🏦 分红金库地址: ${treasury}`);
        
        const dividendNonce = await yield.getDividendNonce();
        console.log(`🔢 分红 Nonce: ${dividendNonce}`);
        
    } catch (error) {
        console.log("❌ 基本信息查询失败:", error.message);
    }
}

// 查询全局池信息
async function queryGlobalPoolInfo(yield) {
    console.log("\n🌍 全局池信息");
    console.log("-".repeat(40));
    
    try {
        const globalPool = await yield.getGlobalPoolInfo();
        
        console.log(`📊 总累积份额: ${globalPool.totalAccumulatedShares}`);
        console.log(`💰 总分红金额: ${ethers.formatUnits(globalPool.totalDividend, 6)}`);
        console.log(`⏰ 最后分红时间: ${new Date(Number(globalPool.lastDividendTime) * 1000).toLocaleString()}`);
        console.log(`🔄 池状态: ${globalPool.isActive ? "活跃" : "非活跃"}`);
        console.log(`🪙 份额代币: ${globalPool.shareToken}`);
        console.log(`🎁 奖励代币: ${globalPool.rewardToken}`);
        
        // 查询总累积份额和总分红（备用方法）
        try {
            const totalShares = await yield.totalAccumulatedShares();
            const totalDividend = await yield.totalDividend();
            console.log(`📈 总累积份额 (直接查询): ${totalShares}`);
            console.log(`💵 总分红金额 (直接查询): ${ethers.formatUnits(totalDividend, 6)}`);
        } catch (error) {
            console.log("⚠️  直接查询方法失败:", error.message);
        }
        
    } catch (error) {
        console.log("❌ 全局池信息查询失败:", error.message);
    }
}

// 查询用户信息
async function queryUserInfo(yield, userAddress) {
    console.log(`\n👤 用户信息 (${userAddress})`);
    console.log("-".repeat(40));
    
    try {
        const userInfo = await yield.getUserInfo(userAddress);
        
        console.log(`📊 累积份额: ${ethers.formatUnits(userInfo.accumulatedShares, 6)}`);
        console.log(`⏰ 最后领取时间: ${new Date(Number(userInfo.lastClaimTime) * 1000).toLocaleString()}`);
        console.log(`💰 上次领取时的分红: ${ethers.formatUnits(userInfo.lastClaimDividend, 6)}`);
        console.log(`🎁 总领取金额: ${ethers.formatUnits(userInfo.totalClaimed, 6)}`);
        
        // 查询待领取奖励
        try {
            const pendingReward = await yield.pendingReward(userAddress);
            console.log(`⏳ 待领取奖励: ${ethers.formatUnits(pendingReward, 6)}`);
        } catch (error) {
            console.log("⚠️  待领取奖励查询失败:", error.message);
        }
        
        // 查询用户当前余额对应的累积份额
        try {
            // 获取用户的代币余额（需要连接到 shareToken 合约）
            const shareTokenAddress = await yield.getGlobalPoolInfo().then(info => info.shareToken);
            const shareToken = await ethers.getContractAt("IERC20", shareTokenAddress);
            const userBalance = await shareToken.balanceOf(userAddress);
            
            console.log(`💎 当前代币余额: ${ethers.formatUnits(userBalance, 6)}`);
            
            const calculatedShares = await yield.calculateAccumulatedShares(userAddress, userBalance);
            console.log(`🧮 计算得出的累积份额: ${ethers.formatUnits(calculatedShares, 6)}`);
            
        } catch (error) {
            console.log("⚠️  用户余额查询失败:", error.message);
        }
        
    } catch (error) {
        console.log("❌ 用户信息查询失败:", error.message);
    }
}

// 查询其他相关信息
async function queryAdditionalInfo(yield) {
    console.log("\n🔍 其他信息");
    console.log("-".repeat(40));
    
    try {
        // 尝试获取代币信息
        const globalPool = await yield.getGlobalPoolInfo();
        
        if (globalPool.shareToken !== ethers.ZeroAddress) {
            console.log("\n🪙 份额代币信息:");
            try {
                // 尝试使用 IERC20Metadata 接口（包含 name, symbol, decimals）
                const shareToken = await ethers.getContractAt("IERC20Metadata", globalPool.shareToken);
                
                const shareName = await shareToken.name();
                const shareSymbol = await shareToken.symbol();
                const shareDecimals = await shareToken.decimals();
                const shareTotalSupply = await shareToken.totalSupply();
                
                console.log(`  名称: ${shareName}`);
                console.log(`  符号: ${shareSymbol}`);
                console.log(`  精度: ${shareDecimals}`);
                console.log(`  总供应量: ${ethers.formatUnits(shareTotalSupply, shareDecimals)}`);
            } catch (error) {
                // 如果 IERC20Metadata 失败，回退到 IERC20
                try {
                    const shareToken = await ethers.getContractAt("IERC20", globalPool.shareToken);
                    const shareTotalSupply = await shareToken.totalSupply();
                    console.log(`  地址: ${globalPool.shareToken}`);
                    console.log(`  总供应量: ${ethers.formatUnits(shareTotalSupply, 6)} (假设精度为6)`);
                    console.log("  ⚠️  无法获取名称、符号和精度信息");
                } catch (fallbackError) {
                    console.log("  ❌  份额代币信息查询完全失败:", fallbackError.message);
                }
            }
        }
        
        if (globalPool.rewardToken !== ethers.ZeroAddress) {
            console.log("\n🎁 奖励代币信息:");
            try {
                // 尝试使用 IERC20Metadata 接口（包含 name, symbol, decimals）
                const rewardToken = await ethers.getContractAt("IERC20Metadata", globalPool.rewardToken);
                
                const rewardName = await rewardToken.name();
                const rewardSymbol = await rewardToken.symbol();
                const rewardDecimals = await rewardToken.decimals();
                const rewardTotalSupply = await rewardToken.totalSupply();
                
                console.log(`  名称: ${rewardName}`);
                console.log(`  符号: ${rewardSymbol}`);
                console.log(`  精度: ${rewardDecimals}`);
                console.log(`  总供应量: ${ethers.formatUnits(rewardTotalSupply, rewardDecimals)}`);
            } catch (error) {
                // 如果 IERC20Metadata 失败，回退到 IERC20
                try {
                    const rewardToken = await ethers.getContractAt("IERC20", globalPool.rewardToken);
                    const rewardTotalSupply = await rewardToken.totalSupply();
                    console.log(`  地址: ${globalPool.rewardToken}`);
                    console.log(`  总供应量: ${ethers.formatUnits(rewardTotalSupply, 6)} (假设精度为6)`);
                    console.log("  ⚠️  无法获取名称、符号和精度信息");
                } catch (fallbackError) {
                    console.log("  ❌  奖励代币信息查询完全失败:", fallbackError.message);
                }
            }
        }
        
    } catch (error) {
        console.log("❌ 其他信息查询失败:", error.message);
    }
}

// 运行脚本
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ 脚本执行失败:", error);
        process.exit(1);
    });
