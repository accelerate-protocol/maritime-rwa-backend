const { ethers } = require("hardhat");

async function main() {
    // Crowdfunding contract address - please modify according to actual situation
    const fundAddress = "0xbA75BD6E851DEE41aFCfD7376a29aE459299dcF8"; // Replace with actual crowdfunding contract address
    
    try {
        const fund = await ethers.getContractAt("Crowdsale", fundAddress);
        
        // Quick status query
        console.log("🔍 Crowdfunding Quick Status Query");
        console.log("=".repeat(50));
        
        // Basic status
        const isFundingPeriodActive = await fund.isFundingPeriodActive();
        const isFundingSuccessful = await fund.isFundingSuccessful();
        
        console.log(`Crowdfunding period: ${isFundingPeriodActive ? '🟢 Active' : '🔴 Inactive'}`);
        console.log(`Crowdfunding result: ${isFundingSuccessful ? '🎉 Successful' : '⏳ In progress/Failed'}`);
        
        // Key data
        const manager = await fund.manager();
        const totalRaised = await fund.getTotalRaised();
        const softCap = await fund.softCap();
        const maxSupply = await fund.maxSupply();
        const remainingSupply = await fund.getRemainingSupply();
        const manageFee = await fund.manageFee();
        const manageFeeBps = await fund.manageFeeBps();
        const fundingAssets = await fund.fundingAssets();
        const sharePrice = await fund.sharePrice();

        console.log(`\n💰 Funding Status:`);
        console.log(`Manager: ${manager}`);
        console.log(`Total raised: ${ethers.formatUnits(totalRaised, 6)} asset`);
        console.log(`Soft cap: ${ethers.formatUnits(softCap, 6)} asset`);
        console.log(`Maximum supply: ${ethers.formatUnits(maxSupply, 6)} asset`);
        console.log(`Remaining supply: ${ethers.formatUnits(remainingSupply, 6)} asset`);
        console.log(`Management fee: ${ethers.formatUnits(manageFee, 6)} asset`);
        console.log(`Management fee percentage: ${manageFeeBps}%`);
        console.log(`Funding assets: ${ethers.formatUnits(fundingAssets, 6)} asset`);
        console.log(`Share token price: ${ethers.formatUnits(sharePrice, 8)} asset`);
        
        // Progress bar
        const softCapProgress = (Number(totalRaised) / Number(softCap)) * 100;
        const maxProgress = (Number(totalRaised) / Number(maxSupply)) * 100;
        
        console.log(`\n📊 Progress:`);
        console.log(`Soft cap achievement: ${softCapProgress.toFixed(1)}% ${'█'.repeat(Math.floor(softCapProgress/5))}${'░'.repeat(20-Math.floor(softCapProgress/5))}`);
        console.log(`Maximum supply: ${maxProgress.toFixed(1)}% ${'█'.repeat(Math.floor(maxProgress/5))}${'░'.repeat(20-Math.floor(maxProgress/5))}`);
        
        // Time information
        const startTime = await fund.startTime();
        const endTime = await fund.endTime();
        const currentTime = Math.floor(Date.now() / 1000);
        const timeRemaining = Number(endTime) - currentTime;
        
        console.log(`\n⏰ Time:`);
        if (timeRemaining > 0) {
            const days = Math.floor(timeRemaining / 86400);
            const hours = Math.floor((timeRemaining % 86400) / 3600);
            console.log(`Remaining: ${days} days ${hours} hours`);
        } else {
            console.log(`Ended`);
        }
        
        console.log("=".repeat(50));
        
    } catch (error) {
        console.error("❌ Query failed:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Script execution failed:", error);
        process.exit(1);
    });
