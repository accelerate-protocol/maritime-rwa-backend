import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("=== 部署 V2 Mock 模板 ===");

  // 1. 部署 MockBasicVault 模板
  console.log("部署 MockBasicVault 模板...");
  const mockBasicVault = await deploy("MockBasicVault", {
    contract: "contracts/mocks/MockBasicVault.sol:MockBasicVault",
    from: deployer,
    args: [],
    log: true,
  });
  console.log("MockBasicVault 模板地址:", mockBasicVault.address);

  // 2. 部署 MockERC20 模板
  console.log("部署 MockERC20 模板...");
  const mockERC20 = await deploy("MockERC20", {
    contract: "contracts/mocks/MockERC20.sol:MockERC20",
    from: deployer,
    args: [],
    log: true,
  });
  console.log("MockERC20 模板地址:", mockERC20.address);

  // 3. 部署 MockCrowdsale 模板
  console.log("部署 MockCrowdsale 模板...");
  const mockCrowdsale = await deploy("MockCrowdsale", {
    contract: "contracts/mocks/MockCrowdsale.sol:MockCrowdsale",
    from: deployer,
    args: [],
    log: true,
  });
  console.log("MockCrowdsale 模板地址:", mockCrowdsale.address);

  // 4. 部署 MockAccumulatedYield 模板
  console.log("部署 MockAccumulatedYield 模板...");
  const mockAccumulatedYield = await deploy("MockAccumulatedYield", {
    contract: "contracts/mocks/MockAccumulatedYield.sol:MockAccumulatedYield",
    from: deployer,
    args: [],
    log: true,
  });
  console.log("MockAccumulatedYield 模板地址:", mockAccumulatedYield.address);

  // 5. 部署 MockUSDT
  console.log("部署 MockUSDT...");
  const mockUSDT = await deploy("MockUSDT", {
    contract: "contracts/v2/mocks/MockUSDT.sol:MockUSDT",
    from: deployer,
    args: ["Mock USDT", "USDT"],
    log: true,
  });
  console.log("MockUSDT 地址:", mockUSDT.address);

  console.log("=== V2 Mock 模板部署完成 ===");
};

export default func;
func.tags = ["v2-templates"]; 