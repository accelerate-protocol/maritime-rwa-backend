const { ethers } = require("hardhat");

async function main() {
    // Get contract address from command line arguments, use default address if not provided
    // Usage: npx hardhat run scripts/yield-status.js --address 0xContractAddress
    let yieldAddress;
    
    // Parse command line arguments
    const addressArg = process.argv.find(arg => arg.startsWith("--address="));
    if (addressArg) {
        yieldAddress = addressArg.split("=")[1];
    } else {
        // Default yield contract address - please modify according to actual situation
        yieldAddress = "0x6599D8915721950358E0781567C74f38333538C7"; // Replace with actual yield contract address
        console.log("No contract address provided, using default address.");
        console.log("Usage: npx hardhat run scripts/yield-status.js --address=0xContractAddress");
        console.log("Note: Please ensure the provided address is a deployed AccumulatedYield contract address.");
    }
    
    console.log("🔍 Yield Pool Quick Status Query");
    console.log("=".repeat(50));
    
    try {
        // Check if the contract address is valid
        if (!ethers.isAddress(yieldAddress)) {
            throw new Error("Invalid contract address");
        }
        
        console.log(`Contract address: ${yieldAddress}`);
        
        // Check if the contract is deployed
        const code = await ethers.provider.getCode(yieldAddress);
        if (code === "0x") {
            throw new Error("Contract not deployed or incorrect address");
        }
        
        // Get contract instance
        const accumulatedYield = await ethers.getContractAt("AccumulatedYield", yieldAddress);
        
        // Get global pool information
        let globalPoolInfo;
        try {
            globalPoolInfo = await accumulatedYield.getGlobalPoolInfo();
        } catch (error) {
            throw new Error(`Failed to get global pool information: ${error.message}`);
        }
        
        console.log(`Yield pool status: ${globalPoolInfo.isActive ? '🟢 Active' : '🔴 Inactive'}`);
        
        // Get token address
        const shareTokenAddress = globalPoolInfo.shareToken;
        const rewardTokenAddress = globalPoolInfo.rewardToken;
        
        if (!shareTokenAddress || !rewardTokenAddress) {
            throw new Error("Unable to get token address information");
        }
        
        console.log(`\n💼 Token Information:`);
        console.log(`Share token: ${shareTokenAddress}`);
        console.log(`Reward token: ${rewardTokenAddress}`);
        
        // Get instances of share token and reward token to get symbols and decimals
        let shareToken, rewardToken;
        try {
            shareToken = await ethers.getContractAt("ERC20", shareTokenAddress);
            rewardToken = await ethers.getContractAt("ERC20", rewardTokenAddress);
        } catch (error) {
            throw new Error(`Failed to get token contract instances: ${error.message}`);
        }
        
        let shareSymbol = "SHARE";
        let rewardSymbol = "REWARD";
        let shareDecimals = 18;
        let rewardDecimals = 18;
        
        try {
            shareSymbol = await shareToken.symbol();
            rewardSymbol = await rewardToken.symbol();
            shareDecimals = await shareToken.decimals();
            rewardDecimals = await rewardToken.decimals();
        } catch (error) {
            console.log("Unable to get token symbols or decimals, using default values");
        }
        
        // Key data
        const totalAccumulatedShares = globalPoolInfo.totalAccumulatedShares;
        const totalDividend = globalPoolInfo.totalDividend;
        const lastDividendTime = globalPoolInfo.lastDividendTime;
        
        console.log(`\n💰 Yield Pool Status:`);
        console.log(`Total accumulated shares: ${totalAccumulatedShares}`);
        console.log(`Total dividend: ${ethers.formatUnits(totalDividend, rewardDecimals)} ${rewardSymbol}`);
        console.log(`Last dividend time: ${new Date(Number(lastDividendTime) * 1000).toLocaleString()}`);
        
        // Get current user address
        // const [signer] = await ethers.getSigners();
        // const userAddress = await signer.getAddress();
        const userAddress = "0xa1FE4Ed4D662eCa52DEA7b934E429b98AAFF7533"
        
        // Get user information
        let userInfo, pendingReward;
        try {
            userInfo = await accumulatedYield.getUserInfo(userAddress);
            pendingReward = await accumulatedYield.pendingReward(userAddress);
        } catch (error) {
            console.error(`Failed to get user information: ${error.message}`);
            console.log("Continuing with other queries...");
        }
        
        if (userInfo) {
            console.log(`\n👤 User Information (${userAddress}):`);
            console.log(`Accumulated shares: ${ethers.formatUnits(userInfo.accumulatedShares, shareDecimals)} ${shareSymbol}`);
            console.log(`Last claim time: ${userInfo.lastClaimTime > 0 ? new Date(Number(userInfo.lastClaimTime) * 1000).toLocaleString() : 'Never claimed'}`);
            console.log(`Last claimed dividend: ${ethers.formatUnits(userInfo.lastClaimDividend, rewardDecimals)} ${rewardSymbol}`);
            console.log(`Total claimed rewards: ${ethers.formatUnits(userInfo.totalClaimed, rewardDecimals)} ${rewardSymbol}`);
            
            if (pendingReward !== undefined) {
                console.log(`Pending rewards: ${ethers.formatUnits(pendingReward, rewardDecimals)} ${rewardSymbol}`);
            }
        }
        
        // Get user share token balance
        try {
            const userShareBalance = await shareToken.balanceOf(userAddress);
            console.log(`Share token balance: ${ethers.formatUnits(userShareBalance, shareDecimals)} ${shareSymbol}`);
        } catch (error) {
            console.error(`Failed to get user share token balance: ${error.message}`);
        }
        
        // Get management information
        let dividendTreasury, manager, dividendNonce;
        try {
            dividendTreasury = await accumulatedYield.getDividendTreasury();
            manager = await accumulatedYield.getManager();
            dividendNonce = await accumulatedYield.getDividendNonce();
            
            console.log(`\n🏛️ Management Information:`);
            console.log(`Dividend treasury: ${dividendTreasury}`);
            console.log(`Manager: ${manager}`);
            console.log(`Dividend nonce: ${dividendNonce}`);
        } catch (error) {
            console.error(`Failed to get management information: ${error.message}`);
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