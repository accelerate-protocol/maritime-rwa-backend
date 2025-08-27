const { ethers } = require("hardhat");
const { parseUSDT } = require("../test/utils/usdt");

async function main() {
  const { deployments, getNamedAccounts } = require("hardhat");
  const { get } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("🚀 开始部署具体的项目...");

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
  
  // 从环境变量读取配置
  const ENV_USDT_ADDRESS = process.env.USDT_ADDRESS || "";
  const ENV_DRDS_ADDRESS = process.env.DRDS_ADDRESS || "";
  const ENV_PROJECT_NAME = process.env.PROJECT_NAME || "";
  
  // 动态选择 USDT 地址
  const network = require("hardhat").network.name;
  // 从.env读取主网USDT地址
  const MAINNET_USDT_ADDRESS = process.env.MAINNET_USDT_ADDRESS || "";

  let usdtAddress;
  let usdtContract;

  // 根据网络类型选择USDT地址
  if (network === "hardhat" || network === "localhost") {
    // 本地网络使用MockUSDT
    const mockUSDTDeployment = await get("MockUSDT");
    usdtAddress = mockUSDTDeployment.address;
    usdtContract = await ethers.getContractAt("contracts/v2/mocks/MockUSDT.sol:MockUSDT", usdtAddress);
    console.log("使用 MockUSDT 地址:", usdtAddress);
  } else if (network === "bsc" || network === "mainnet" || network === "bscmainnet") {
    // 主网使用真实USDT地址
    if (!MAINNET_USDT_ADDRESS) {
      throw new Error("请在.env中配置MAINNET_USDT_ADDRESS");
    }
    usdtAddress = MAINNET_USDT_ADDRESS;
    usdtContract = await ethers.getContractAt("IERC20", usdtAddress);
    console.log("使用主网 USDT 地址:", usdtAddress);
  } else {
    // 测试网优先使用环境变量配置，否则使用MockUSDT
    if (ENV_USDT_ADDRESS) {
      usdtAddress = ENV_USDT_ADDRESS;
      usdtContract = await ethers.getContractAt("IERC20", usdtAddress);
      console.log("使用环境变量配置的 USDT 地址:", usdtAddress);
    } else {
      const mockUSDTDeployment = await get("MockUSDT");
      usdtAddress = mockUSDTDeployment.address;
      usdtContract = await ethers.getContractAt("contracts/v2/mocks/MockUSDT.sol:MockUSDT", usdtAddress);
      console.log("使用 MockUSDT 地址:", usdtAddress);
    }
  }

  // 设置 DRDS 地址
  let drdsAddress;
  if (network === "hardhat" || network === "localhost") {
    // 本地网络默认使用deployer作为DRDS
    drdsAddress = deployer;
    console.log("使用默认的 DRDS 地址 (deployer):", drdsAddress);
  } else {
    // 其他网络使用环境变量配置或默认deployer
    drdsAddress = ENV_DRDS_ADDRESS || deployer;
    if (ENV_DRDS_ADDRESS) {
      console.log("使用环境变量配置的 DRDS 地址:", drdsAddress);
    } else {
      console.log("使用默认的 DRDS 地址 (deployer):", drdsAddress);
    }
  }

  console.log("📦 已获取工厂合约和USDT配置");

  // 检查deployer是否在白名单中
  try {
    const isWhitelisted = await creation.whitelist(deployer);
    if (!isWhitelisted) {
      console.log("🔐 添加deployer到白名单...");
      const creationWithOwner = creation.connect(await ethers.getSigner(deployer));
      await (await creationWithOwner.addToWhitelist(deployer)).wait();
      console.log("✅ 已添加到白名单");
    }
  } catch (error) {
    console.log("⚠️  白名单检查失败，继续部署:", error.message);
  }

  // 设置项目名称
  let projectName;
  if (network === "hardhat" || network === "localhost") {
    // 本地网络使用随机生成的项目名称
    projectName = `Project_${Date.now()}`;
    console.log("使用随机生成的项目名称:", projectName);
  } else {
    // 其他网络使用环境变量配置或随机生成
    projectName = ENV_PROJECT_NAME || `Project_${Date.now()}`;
    if (ENV_PROJECT_NAME) {
      console.log("使用环境变量配置的项目名称:", projectName);
    } else {
      console.log("使用随机生成的项目名称:", projectName);
    }
  }

  // 1. Vault初始化数据
  const vaultInitData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "bool", "address[]"],
    [deployer, drdsAddress, true, [deployer]] // manager, validator, whitelistEnabled, initialWhitelist
  );

  // 2. Token初始化数据
  const tokenInitData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["string", "string", "uint8"],
    ["Example Token", "EXT", 6]
  );

  // 3. Fund初始化数据
  const currentTime = Math.floor(Date.now() / 1000);
  const fundInitData = ethers.AbiCoder.defaultAbiCoder().encode(
    [
      "uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address"
    ],
    [
      currentTime,                      // startTime: 立即开始
      currentTime + 86400 * 30,         // endTime: 30天后结束
      usdtContract.target,                  // assetToken: 使用MockUSDT作为融资代币
      parseUSDT("10000"),  // maxSupply: 最大供应量1万 (6位小数)
      parseUSDT("9000"),   // softCap: 软顶9000 (6位小数)
      ethers.parseUnits("1", 8),     // sharePrice: 份额价格 1
      parseUSDT("100"),    // minDepositAmount: 最小投资100 USDT (6位小数)
      200,                              // manageFeeBps: 管理费2%
      deployer,                         // fundingReceiver: 融资接收地址
      deployer,                         // manageFeeReceiver: 管理费接收地址
      deployer                          // manager
    ]
  );

  // 4. AccumulatedYield初始化数据
  const accumulatedYieldInitData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "address"],
    [usdtContract.target, deployer, deployer]  // rewardToken, rewardManager, dividendTreasury
  );

  console.log("📝 初始化数据准备完成");

  // 部署项目
  console.log("🔨 开始部署项目...");
  
  try {
    const tx = await creation.deployAll(
      projectName, // projectName - 使用环境变量或随机生成
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
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    let projectCreatedLog = null;
    let deployedProjectName = projectName;
    
    if (receipt && receipt.hash) {
      console.log("✅ 交易成功:", receipt.hash);
      
      // 查找ProjectCreated事件
      const creationInterface = new ethers.Interface([
        "event ProjectCreated(string projectName, address vault, address token, address fund, address accumulatedYield, address deployer)"
      ]);
      
      projectCreatedLog = receipt.logs
        .map(log => {
          try {
            return creationInterface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find(log => log && log.name === "ProjectCreated");

      if (projectCreatedLog) {
        const args = projectCreatedLog.args;
        deployedProjectName = args.projectName;
        console.log("🎉 项目部署成功!");
        console.log("📊 项目名称:", args.projectName);
        console.log("🏦 Vault地址:", args.vault);
        console.log("🪙 Token地址:", args.token);
        console.log("💰 Fund地址:", args.fund);
        console.log("📈 AccumulatedYield地址:", args.accumulatedYield);

        // 初始化vault
        await new Promise(resolve => setTimeout(resolve, 2000));
        const vault = await ethers.getContractAt("BasicVault", args.vault);
        const vaultWithManager = vault.connect(await ethers.getSigner(deployer));
        await (await vaultWithManager.configureModules(args.token, args.fund, args.accumulatedYield)).wait();
        console.log("✅ Vault模块配置完成");
      }
    }

    console.log("🎯 示例项目部署完成!");
    
    if (projectCreatedLog) {
      console.log("📝 项目信息:");
      console.log("  名称:", deployedProjectName);
      console.log("  Vault:", projectCreatedLog.args.vault);
      console.log("  Token:", projectCreatedLog.args.token);
      console.log("  Fund:", projectCreatedLog.args.fund);
      console.log("  Yield:", projectCreatedLog.args.accumulatedYield);
    } else {
      console.log("⚠️  未找到项目创建事件，部署可能失败");
    }
  } catch (error) {
    console.error("❌ 部署失败:", error.message);
    throw error;
  }
}

// 执行脚本
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
