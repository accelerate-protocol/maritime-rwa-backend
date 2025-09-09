const { ethers } = require("hardhat");

async function main() {
    // CoreVault contract address - please modify according to actual situation
    const vaultAddress = process.env.VAULT_ADDRESS || "0x64dd30640B1738985523841eBDc44524f90EB10F"; // Replace with actual CoreVault contract address
    
    try {
        const vault = await ethers.getContractAt("CoreVault", vaultAddress);
        
        // Quick status query
        console.log("🔍 CoreVault Quick Status Query");
        console.log("=".repeat(50));
        
        // Query manager
        const manager = await vault.manager();
        console.log(`Manager address: ${manager}`);
        
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