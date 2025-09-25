import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  console.log("=== Accelerate Protocol V2 Architecture Description ===");
  console.log("V2 architecture adopts a modular design, mainly including the following components:");
  
  console.log("1. Template Contracts (Templates):");
console.log("   - CoreVault: CoreVault.sol template contract");
  console.log("   - FundVault: FunVault.sol template contract");
  console.log("   - ShareToken: Token template contract");
console.log("   - Crowdsale: Crowdfunding template contract");
console.log("   - AccumulatedYield: AccumulatedYield template contract");
console.log("   - FundYield: FundYield template contract");

console.log("2. Template Factories (TemplateFactories):");
console.log("   - CoreVaultTemplateFactory: CoreVault template factory, responsible for creating vault instances");
console.log("   - FundVaultTemplateFactory: FundVault template factory, responsible for creating vault instances");
console.log("   - ShareTokenTemplateFactory: Token template factory, responsible for creating token instances");
console.log("   - CrowdsaleTemplateFactory: Crowdfunding template factory, responsible for creating crowdfunding instances");
console.log("   - AccumulatedYieldTemplateFactory: Yield template factory, responsible for creating yield instances");
console.log("   - FundYieldTemplateFactory: FundYield template factory, responsible for creating yield instances");

  console.log("3. Template Registries (TemplateRegistry):");
  console.log("   - VaultTemplateRegistry: CoreVault.sol template registry, manages vault templates");
  console.log("   - TokenTemplateRegistry: Token template registry, manages token templates");
  console.log("   - FundTemplateRegistry: Crowdfunding template registry, manages crowdfunding templates");
  console.log("   - YieldTemplateRegistry: Yield template registry, manages yield templates");
  
  console.log("4. Creation Contract (Creation):");
  console.log("   - Creation: One-click deployment contract, integrates all template registries, enables one-click deployment of complete projects");
  
  console.log("Deployment Process:");
console.log("1. Deploy template contracts (Templates)");
console.log("2. Deploy template factories (TemplateFactories)");
console.log("3. Deploy template registries (TemplateRegistry)");
console.log("4. Add template factories to corresponding template registries");
console.log("5. Deploy Creation contract, passing in addresses of each template registry");
  
  console.log("=== Architecture Description Complete ===");
};


export default func;
func.tags = ["v2-deploy-all"];
func.dependencies = ["v2-creation","ValidatorRegistry"];