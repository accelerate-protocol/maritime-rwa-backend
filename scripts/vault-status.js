const { ethers } = require("hardhat");

async function main() {
    // CoreVault contract address - please modify according to actual situation
    const vaultAddress = "0x86337dDaF2661A069D0DcB5D160585acC2d15E9a"; // Replace with actual CoreVault contract address
    
    try {
        const vault = await ethers.getContractAt("CoreVault", vaultAddress);
        
        // Quick status query
        console.log("🔍 CoreVault Quick Status Query");
        console.log("=".repeat(50));
        
        // Query other key information
        const shareToken = await vault.vaultToken();
        const funding = await vault.funding();
        const yield = await vault.yield();
        const validatorRegistry = await vault.validatorRegistry();
        const validator = await vault.getValidator();
        
        console.log(`\n💰 Vault Status:`);
        console.log(`Token address: ${shareToken}`);
        console.log(`Funding contract address: ${funding}`);
        console.log(`Yield contract address: ${yield}`);
        console.log(`Validator registry contract address: ${validatorRegistry}`);
        console.log(`DRDS validator address: ${validator}`);

        
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