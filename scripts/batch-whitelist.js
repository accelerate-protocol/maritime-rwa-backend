const { ethers } = require("hardhat");

async function main() {
    // Creation 合约地址 - 请根据实际情况修改
    // const creationAddress = "0x3CF67A5F2A82778421B5D51c7eE5C6F27FF22A0C"; // baseSepolia Creation 合约地址
    const creationAddress = "0x0cCF320D7028D39b12e49aFAB1d681801E8c5f2a"; // bcsTestnet Creation 合约地址
    
    // 批量添加的地址列表 - 直接在这里修改
    const addressesToAdd = [
        // 在这里添加要加入白名单的地址
        "0x949D6BA676aF4455a705324bB380ca7df2D7FD7d",
        // 可以继续添加更多地址...
    ];
    
    console.log("🔐 批量白名单管理脚本");
    console.log("Creation 合约地址:", creationAddress);
    console.log("要添加的地址数量:", addressesToAdd.length);
    
    if (addressesToAdd.length === 0) {
        console.log("❌ 没有要添加的地址");
        return;
    }
    
    try {
        // 获取 Creation 合约实例
        const creation = await ethers.getContractAt("ICreation", creationAddress);
        
        // 检查合约是否已部署
        const code = await ethers.provider.getCode(creationAddress);
        if (code === "0x") {
            console.log("❌ Creation 合约地址无效或未部署");
            return;
        }
        
        console.log("✅ Creation 合约连接成功");
        console.log("📋 合约代码长度:", code.length);
        
        // 尝试获取合约的基本信息
        try {
            const [signer] = await ethers.getSigners();
            console.log("🔑 当前签名者:", signer.address);
            
            // 尝试调用一个简单的 view 函数来测试连接
            const factories = await creation.getFactories();
            console.log("🏭 工厂合约地址:", factories);
        } catch (error) {
            console.log("⚠️  合约连接测试失败:", error.message);
        }
        
        // 获取当前签名者
        const [signer] = await ethers.getSigners();
        console.log("当前签名者:", signer.address);
        
        // 验证地址格式
        const validAddresses = [];
        const invalidAddresses = [];
        
        for (const address of addressesToAdd) {
            if (ethers.isAddress(address)) {
                validAddresses.push(address);
            } else {
                invalidAddresses.push(address);
            }
        }
        
        if (invalidAddresses.length > 0) {
            console.log(`⚠️  发现 ${invalidAddresses.length} 个无效地址:`);
            invalidAddresses.forEach(addr => console.log(`  ${addr}`));
        }
        
        if (validAddresses.length === 0) {
            console.log("❌ 没有有效的地址可以添加");
            return;
        }
        
        console.log(`\n📋 准备添加 ${validAddresses.length} 个有效地址到白名单`);
        
        // 批量添加地址
        let successCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < validAddresses.length; i++) {
            const address = validAddresses[i];
            console.log(`\n[${i + 1}/${validAddresses.length}] 处理地址: ${address}`);
            
            try {
                // 检查是否已经在白名单中
                let isWhitelisted = false;
                try {
                    console.log(`🔍 正在检查地址 ${address} 的白名单状态...`);
                    isWhitelisted = await creation.whitelist(address);
                    console.log(`✅ 白名单状态查询成功: ${isWhitelisted}`);
                } catch (error) {
                    console.log(`❌ 白名单状态查询失败: ${error.message}`);
                    console.log("⚠️  无法检查白名单状态，继续添加...");
                }
                
                if (isWhitelisted) {
                    console.log("⚠️  地址已在白名单中，跳过");
                    continue;
                }
                
                // 添加到白名单
                const tx = await creation.addToWhitelist(address);
                console.log("⏳ 交易已提交，等待确认...");
                console.log("交易哈希:", tx.hash);
                
                // 等待交易确认
                const receipt = await tx.wait();
                console.log("✅ 交易已确认，区块号:", receipt.blockNumber);
                console.log("✅ 地址已成功添加到白名单");
                
                successCount++;
                
                // 添加延迟，避免过快发送交易
                if (i < validAddresses.length - 1) {
                    console.log("⏸️  等待 2 秒后继续...");
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
            } catch (error) {
                console.error(`❌ 添加地址 ${address} 失败:`, error.message);
                failCount++;
                
                // 如果是权限错误，停止执行
                if (error.message.includes("Ownable") || error.message.includes("onlyOwner")) {
                    console.log("❌ 权限不足，停止执行");
                    break;
                }
            }
        }
        
        // 显示结果摘要
        console.log("\n" + "=".repeat(50));
        console.log("📊 批量操作结果摘要");
        console.log("=".repeat(50));
        console.log(`总地址数: ${addressesToAdd.length}`);
        console.log(`有效地址数: ${validAddresses.length}`);
        console.log(`成功添加: ${successCount}`);
        console.log(`失败数量: ${failCount}`);
        console.log(`无效地址: ${invalidAddresses.length}`);
        
        if (successCount > 0) {
            console.log("🎉 批量添加白名单完成!");
        }
        
        if (failCount > 0) {
            console.log("⚠️  部分地址添加失败，请检查错误信息");
        }
        
    } catch (error) {
        console.error("❌ 脚本执行失败:", error.message);
        console.error("错误详情:", error);
    }
}

// 运行脚本
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ 脚本执行失败:", error);
        process.exit(1);
    });
