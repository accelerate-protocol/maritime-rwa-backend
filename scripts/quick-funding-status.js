const { ethers } = require("hardhat");

async function main() {
    // 众筹合约地址 - 请根据实际情况修改
    const fundAddress = "0x613A471042Ee37501cFE17c3F09673b633969827"; // 替换为实际的众筹合约地址
    
    try {
        const fund = await ethers.getContractAt("Crowdsale", fundAddress);
        
        // 快速状态查询
        console.log("🔍 众筹快速状态查询");
        console.log("=".repeat(50));
        
        // 基础状态
        const isInitialized = await fund.isInitialized();
        const isFundingPeriodActive = await fund.isFundingPeriodActive();
        const isFundingSuccessful = await fund.isFundingSuccessful();
        
        console.log(`状态: ${isInitialized ? '✅ 已初始化' : '❌ 未初始化'}`);
        console.log(`众筹期间: ${isFundingPeriodActive ? '🟢 活跃' : '🔴 非活跃'}`);
        console.log(`众筹结果: ${isFundingSuccessful ? '🎉 成功' : '⏳ 进行中/失败'}`);
        
        // 关键数据
        const totalRaisedUsd = await fund.getTotalRaised();
        const softCap = await fund.softCap();
        const maxSupply = await fund.maxSupply();
        const remainingSupply = await fund.getRemainingSupply();
        const manageFee = await fund.manageFee();
        const manageFeeBps = await fund.manageFeeBps();
        const fundingAssets = await fund.fundingAssets();
        const sharePrice = await fund.sharePrice();
        
        console.log(`\n💰 资金状态:`);
        console.log(`总筹集: ${ethers.formatUnits(totalRaisedUsd, 6)} asset`);
        console.log(`软顶: ${ethers.formatUnits(softCap, 6)} vlt`);
        console.log(`最大供应: ${ethers.formatUnits(maxSupply, 6)} vlt`);
        console.log(`剩余供应: ${ethers.formatUnits(remainingSupply, 6)} vlt`);
        console.log(`管理费: ${ethers.formatUnits(manageFee, 6)} asset`);
        console.log(`管理费比例: ${Number(manageFeeBps) / 100}%`);
        console.log(`资金资产: ${ethers.formatUnits(fundingAssets, 6)} asset`);
        console.log(`份额代币价格: ${ethers.formatUnits(sharePrice, 8)} funding`);
        
        // 进度条
        const totalRaised = Number(totalRaisedUsd) * 1e8 / Number(sharePrice);
        const softCapProgress = (totalRaised / Number(softCap)) * 100;
        const maxProgress = (totalRaised / Number(maxSupply)) * 100;
        
        console.log(`\n📊 进度:`);
        const softCapBars = Math.max(0, Math.min(20, Math.floor(softCapProgress/5)));
        const maxProgressBars = Math.max(0, Math.min(20, Math.floor(maxProgress/5)));
        console.log(`软顶达成: ${softCapProgress.toFixed(1)}% ${'█'.repeat(softCapBars)}${'░'.repeat(20-softCapBars)}`);
        console.log(`最大供应: ${maxProgress.toFixed(1)}% ${'█'.repeat(maxProgressBars)}${'░'.repeat(20-maxProgressBars)}`);
        
        // 时间信息
        const startTime = await fund.startTime();
        const endTime = await fund.endTime();
        const currentTime = Math.floor(Date.now() / 1000);
        const timeRemaining = Number(endTime) - currentTime;
        
        console.log(`\n⏰ 时间:`);
        if (timeRemaining > 0) {
            const days = Math.floor(timeRemaining / 86400);
            const hours = Math.floor((timeRemaining % 86400) / 3600);
            console.log(`剩余: ${days}天 ${hours}小时`);
        } else {
            console.log(`已结束`);
        }
        
        console.log("=".repeat(50));
        
    } catch (error) {
        console.error("❌ 查询失败:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ 脚本执行失败:", error);
        process.exit(1);
    });
