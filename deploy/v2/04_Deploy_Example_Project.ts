import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { get } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("🚀 开始部署示例项目 (MockBasicVault + MockERC20 + MockCrowdsale + AccumulatedYield)...");

  // 获取已部署的合约
  const creationDeployment = await get("Creation");
  const creation = await ethers.getContractAt("contracts/v2/creation/Creation.sol:Creation", creationDeployment.address);
  
  const vaultFactoryDeployment = await get("VaultFactory");
  const vaultFactory = await ethers.getContractAt("contracts/v2/factories/VaultFactory.sol:VaultFactory", vaultFactoryDeployment.address);
  
  const tokenFactoryDeployment = await get("TokenFactory");
  const tokenFactory = await ethers.getContractAt("contracts/v2/factories/TokenFactory.sol:TokenFactory", tokenFactoryDeployment.address);
  
  const fundFactoryDeployment = await get("FundFactory");
  const fundFactory = await ethers.getContractAt("contracts/v2/factories/FundFactory.sol:FundFactory", fundFactoryDeployment.address);
  
  const YieldFactoryDeployment = await get("YieldFactory");
  const YieldFactory = await ethers.getContractAt("contracts/v2/factories/YieldFactory.sol:YieldFactory", YieldFactoryDeployment.address);
  
  const mockUSDTDeployment = await get("MockUSDT");
  const mockUSDT = await ethers.getContractAt("contracts/v1/MockUSDT.sol:MockUSDT", mockUSDTDeployment.address);

  console.log("📦 已获取工厂合约和MockUSDT");

  // 1. Vault初始化数据
  const vaultInitData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "bool", "address[]"],
    [deployer, false, []]
  );

  // 2. Token初始化数据
  const tokenInitData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["string", "string", "uint8"],
    ["Example Token", "EXT", 18]
  );

  // 3. Fund初始化数据
  const currentTime = Math.floor(Date.now() / 1000);
  const fundInitData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "uint256"],
    [
      currentTime + 86400,              // startTime: 1天后开始
      currentTime + 86400 * 30,         // endTime: 30天后结束
      mockUSDT.target,                  // assetToken: 使用MockUSDT作为融资代币
      ethers.parseEther("1000000"),     // maxSupply: 最大供应量100万
      ethers.parseEther("100000"),      // softCap: 软顶10万
      ethers.parseEther("0.1"),         // sharePrice: 份额价格0.1 USDT
      ethers.parseEther("100"),         // minDepositAmount: 最小投资100 USDT
      200,                              // manageFeeBps: 管理费2%
      deployer,                         // fundingReceiver: 融资接收地址
      deployer,                         // manageFeeReceiver: 管理费接收地址
      ethers.parseEther("1")            // decimalsMultiplier: 精度倍数
    ]
  );

  // 4. AccumulatedYield初始化数据
  const accumulatedYieldInitData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address"],
    [mockUSDT.target, deployer]  // rewardToken, rewardManager
  );

  console.log("📝 初始化数据准备完成");

  // 部署项目
  console.log("🔨 开始部署项目...");
  
  const tx = await creation.deployAllWithUserParams(
    0, // Vault模板ID (MockBasicVault)
    vaultInitData,
    0, // Token模板ID (MockERC20)
    tokenInitData,
    0, // Fund模板ID (MockCrowdsale)
    fundInitData,
    0, // AccumulatedYield模板ID
    accumulatedYieldInitData
  );

  console.log("⏳ 等待交易确认...");
  const receipt = await tx.wait();
  
  if (receipt && receipt.hash) {
    console.log("✅ 交易成功:", receipt.hash);
    
    // 查找ProjectCreated事件
    const projectCreatedEvent = receipt.logs?.find(
      (log: any) => log.eventName === "ProjectCreated"
    );
    
    if (projectCreatedEvent && 'args' in projectCreatedEvent) {
      const args = projectCreatedEvent.args as any;
      console.log("🎉 项目部署成功!");
      console.log("📊 项目ID:", args.projectId.toString());
      console.log("🏦 Vault地址:", args.vault);
      console.log("🪙 Token地址:", args.token);
      console.log("💰 Fund地址:", args.fund);
      console.log("📈 AccumulatedYield地址:", args.accumulatedYield);
      
      // 获取项目详情
      const projectDetails = await creation.getProjectDetails(args.projectId);
      console.log("📅 创建时间:", new Date(Number(projectDetails.createdAt) * 1000).toLocaleString());
    }
  }

  console.log("🎯 示例项目部署完成!");
};

export default func;
func.tags = ["v2-example"];
func.dependencies = ["v2-creation"]; // 依赖Creation部署 