const { ethers } = require("hardhat");
const { parseUSDT, formatUSDT } = require("../test/utils/usdt");

async function main() {

  const { deployments, getNamedAccounts } = require("hardhat");
  const { get,deploy } = deployments;
  const { deployer,investor1} = await getNamedAccounts();
  const network = require("hardhat").network.name;

  const stage = process.env.VAULT_LIFECYCLE_STAGE || "deploy"; // Default to deployment stage
  console.log(`🚀 Starting vault lifecycle at stage: ${stage}`);

  // Read environment variable configuration
  const ENV_USDT_ADDRESS = process.env.USDT_ADDRESS || "";
  const ENV_VALIDATOR_ADDRESS = process.env.VALIDATOR_ADDRESS || "";
  const MAINNET_USDT_ADDRESS = process.env.MAINNET_USDT_ADDRESS || "";
  const ENV_PROJECT_NAME = process.env.PROJECT_NAME || "";

  // Dynamically select USDT address
  let usdtAddress;
  let usdtContract;

  // Select USDT address based on network type
  if (network === "hardhat" || network === "localhost") {
    // Local network uses MockUSDT
    const mockUSDTDeployment = await deploy("MockUSDT", {
        contract: "contracts/v2/mocks/MockUSDT.sol:MockUSDT",
        from: deployer,
        args: ["USDT", "UDST"],
    });


    usdtAddress = mockUSDTDeployment.address;
    
    usdtContract = await ethers.getContractAt("contracts/v2/mocks/MockUSDT.sol:MockUSDT", usdtAddress);
    console.log("Using MockUSDT address:", usdtAddress);
  } else if (network === "bsc" || network === "mainnet" || network === "bscmainnet") {
    // Mainnet uses real USDT address
    if (!MAINNET_USDT_ADDRESS) {
      throw new Error("Please configure MAINNET_USDT_ADDRESS in .env");
    }
    usdtAddress = MAINNET_USDT_ADDRESS;
    usdtContract = await ethers.getContractAt("IERC20", usdtAddress);
    console.log("Using mainnet USDT address:", usdtAddress);
  } else {
    // Testnet prioritizes environment variable configuration, otherwise uses MockUSDT
    if (ENV_USDT_ADDRESS) {
      usdtAddress = ENV_USDT_ADDRESS;
      usdtContract = await ethers.getContractAt("IERC20", usdtAddress);
      console.log("Using USDT address from environment variable:", usdtAddress);
    } else {
      const mockUSDTDeployment = await get("MockUSDT");
      usdtAddress = mockUSDTDeployment.address;
      usdtContract = await ethers.getContractAt("contracts/v2/mocks/MockUSDT.sol:MockUSDT", usdtAddress);
      console.log("Using MockUSDT address:", usdtAddress);
    }
  }

  // Set DRDS address
  const drdsDeployment = await get("ValidatorRegistry");
  const drdsAddress = drdsDeployment.address;

  console.log("📦 Factory contracts and USDT configuration obtained");

   // Get deployed Creation contract
    const creationDeployment = await get("Creation");
    const creation = await ethers.getContractAt("contracts/v2/creation/Creation.sol:Creation", creationDeployment.address);
  
    // Project deployment stage
    if (stage === "deploy" || stage === "all") {
      const projectName = process.env.PROJECT_NAME || "DefaultProject";
      await deployProject(creation, usdtContract, drdsAddress, deployer, projectName);
    }
  
    // Get project information - redeploy each time
    let projectDetails;
    // If in deployment stage, projectDetails will be set after deployment
  // If in other stages, directly execute deployment
  if (stage !== "deploy") {
    console.log("🔄 Redeploying project each time...");
    
    // Execute deployment stage
    const projectName = process.env.PROJECT_NAME || "DefaultProject";
    projectDetails = await deployProject(creation, usdtContract, drdsAddress, deployer, projectName);
    
    // Check if project details were successfully obtained
    if (!projectDetails) {
      console.error("❌ Failed to get project details after deployment.");
      throw new Error("Failed to deploy project");
    }
  }

  // Investment stage
  if ((stage === "invest") && projectDetails) {
    console.log("💰 Starting investment process...")
    console.log("🔍 Project Details:", projectDetails);
    await investProject(projectDetails, usdtContract, deployer);
  }

  // Dividend stage
  if ((stage === "dividend"|| stage === "all") && projectDetails) {
    console.log("💰 Starting investment process...")
    console.log("🔍 Project Details:", projectDetails);
    await investProject(projectDetails, usdtContract, deployer);
    await getYieldProject(projectDetails, usdtContract, deployer,investor1);
  }

}

// Project deployment function
async function deployProject(creation, usdtContract, drdsAddress, deployer, projectName) {
  console.log("🚀 Starting project deployment...");

  // Check if deployer is in whitelist
  try {
    console.log("🔍 Checking deployer whitelist status...");
    console.log("Creation Address:", await creation.getAddress())
    const isWhitelisted = await creation.whitelist(deployer);
    if (!isWhitelisted) {
      console.log("🔐 Adding deployer to whitelist...");
      const creationWithOwner = creation.connect(await ethers.getSigner(deployer));
      await (await creationWithOwner.addToWhitelist(deployer)).wait();
      console.log("✅ Added to whitelist");
    }
  } catch (error) {
    console.log("⚠️  Whitelist check failed, continuing deployment:", error.message);
  }

  // Check if deployer has VAULT_LAUNCH_ROLE permission
  try {
    const VAULT_LAUNCH_ROLE = await creation.VAULT_LAUNCH_ROLE();
    const hasRole = await creation.hasRole(VAULT_LAUNCH_ROLE, deployer);
    if (!hasRole) {
      console.log("🔐 Granting VAULT_LAUNCH_ROLE to deployer...");
      const creationWithOwner = creation.connect(await ethers.getSigner(deployer));
      // First check if has MANAGER_ROLE, as it is the admin role for VAULT_LAUNCH_ROLE
      const MANAGER_ROLE = await creation.MANAGER_ROLE();
      const hasManagerRole = await creation.hasRole(MANAGER_ROLE, deployer);
      if (!hasManagerRole) {
        // If doesn't have MANAGER_ROLE, grant it first (requires DEFAULT_ADMIN_ROLE permission)
        const DEFAULT_ADMIN_ROLE = await creation.DEFAULT_ADMIN_ROLE();
        const hasAdminRole = await creation.hasRole(DEFAULT_ADMIN_ROLE, deployer);
        if (hasAdminRole) {
          await (await creationWithOwner.grantRole(MANAGER_ROLE, deployer)).wait();
          console.log("✅ Granted MANAGER_ROLE to deployer");
        } else {
          console.log("⚠️ Deployer does not have DEFAULT_ADMIN_ROLE, cannot grant MANAGER_ROLE");
        }
      }
      // Grant VAULT_LAUNCH_ROLE
      if (await creation.hasRole(MANAGER_ROLE, deployer)) {
        await (await creationWithOwner.grantRole(VAULT_LAUNCH_ROLE, deployer)).wait();
        console.log("✅ Granted VAULT_LAUNCH_ROLE to deployer");
      } else {
        console.log("⚠️ Deployer does not have MANAGER_ROLE, cannot grant VAULT_LAUNCH_ROLE");
      }
    }
  } catch (error) {
    console.log("⚠️  Role check failed, continuing deployment:", error.message);
  }

  // 1. Vault initialization data
  const vaultInitData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "bool", "address[]"],
    [deployer, drdsAddress, false, [deployer]] // manager, validator, whitelistEnabled, initialWhitelist
  );

  // 2. Token initialization data
  const tokenInitData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["string", "string", "uint8"],
    ["Example Token", "EXT", 6]
  );

  // 3. Fund initialization data
  const currentTime = Math.floor(Date.now() / 1000);
  const fundInitData = ethers.AbiCoder.defaultAbiCoder().encode(
    [
      "uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"
    ],
    [
      currentTime,                      // startTime: Start immediately
    currentTime + 86400 * 30,         // endTime: End after 30 days
    usdtContract.target,              // assetToken: Use MockUSDT as the funding token
    parseUSDT("10000"),  // maxSupply: Maximum supply 10,000 (6 decimals)
    parseUSDT("9000"),   // softCap: Soft cap 9,000 (6 decimals)
    ethers.parseUnits("1", 8),     // sharePrice: Share price 1
    parseUSDT("10"),    // minDepositAmount: Minimum investment 100 USDT (6 decimals)
    200,                              // manageFeeBps: Management fee 2%
    deployer,                         // fundingReceiver: Funding receiver address
    deployer,                         // manageFeeReceiver: Management fee receiver address
      deployer,                          // manager
      deployer                           // offchainManager
    ]
  );

  // 4. FundYield initialization data
  const fundYieldInitData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "address","uint256","uint256"],
    [usdtContract.target, deployer, deployer,0,0]  // rewardToken, rewardManager, settleCaller,minRedemptionAmount,startTime
  );



  console.log("📝 Initialization data preparation completed");

  // Deploy project
  console.log("🔨 Starting project deployment...");
  
  try {
    // Create DeployParams structure
    const deployParams = {
      vaultTemplateId: 2,
      vaultInitData: vaultInitData,
      tokenTemplateId: 1,
      tokenInitData: tokenInitData,
      fundTemplateId: 1,
      fundInitData: fundInitData,
      yieldTemplateId: 2,
      yieldInitData: fundYieldInitData,
      guardian: deployer
    };
    
    const tx = await creation.deployAll(deployParams);

    console.log("⏳ Waiting for transaction confirmation...");
    const receipt = await tx.wait();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    let projectCreatedLog = null;
    
    if (receipt && receipt.hash) {
      console.log("✅ Transaction successful:", receipt.hash);
      
      // Find ProjectCreated event
      const creationInterface = new ethers.Interface([
        "event ProjectCreated((uint8 templateId, address template, address proxyAdmin) vault, (uint8 templateId, address template, address proxyAdmin) token, (uint8 templateId, address template, address proxyAdmin) fund, (uint8 templateId, address template, address proxyAdmin) yield, address deployer)"
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
        console.log("🎉 Project deployment successful!");
      }
    }

    console.log("🎯 Project deployment completed!");
    
    if (projectCreatedLog) {
      console.log("📝 Project information:");
      console.log("  Vault:", projectCreatedLog.args.vault.template);
      console.log("  Token:", projectCreatedLog.args.token.template);
      console.log("  Fund:", projectCreatedLog.args.fund.template);
      console.log("  Yield:", projectCreatedLog.args.yield.template);
      
      // Set projectDetails for subsequent stages
      projectDetails = {
        vault: { template: projectCreatedLog.args.vault.template },
        token: { template: projectCreatedLog.args.token.template },
        fund: { template: projectCreatedLog.args.fund.template },
        yield: { template: projectCreatedLog.args.yield.template }
      };
      
      // Return projectDetails object
      return projectDetails;
    } else {
      console.log("⚠️  Project creation event not found, deployment may have failed");
    }
  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    throw error;
  }
}

// Project investment function
async function investProject(projectDetails, usdtContract, deployer) {
  console.log("🚀 Starting investment process...");

  let token, fund, vault;
  try {
    token = await ethers.getContractAt("ShareToken", projectDetails.token.template);
    fund = await ethers.getContractAt("Crowdsale", projectDetails.fund.template);
    vault = await ethers.getContractAt("CoreVault", projectDetails.vault.template);
  } catch (error) {
    console.log("Error getting contract instance:", error.message);
    return;
  }
  
  // Use deployer account for testing
  const testAccounts = [deployer];

  // Add whitelist permission for investors
  console.log("🔑 Adding investors to whitelist...");
  try {
    // Get TOKEN_TRANSFER_ROLE
    const TOKEN_TRANSFER_ROLE = await vault.TOKEN_TRANSFER_ROLE();
    console.log(`TOKEN_TRANSFER_ROLE: ${TOKEN_TRANSFER_ROLE}`);
    
    // Add TOKEN_TRANSFER_ROLE permission for all test accounts
    const vaultWithDeployer = vault.connect(await ethers.getSigner(deployer));
    
    // Grant TOKEN_TRANSFER_ROLE permission to each test account
    for (const account of testAccounts) {
      console.log(`Processing account: ${account}`);
      const hasRole = await vault.hasRole(TOKEN_TRANSFER_ROLE, account);
      if (!hasRole) {
        await (await vaultWithDeployer.grantRole(TOKEN_TRANSFER_ROLE, account)).wait();
        console.log(`✅ Granted TOKEN_TRANSFER_ROLE to ${account}`);
      } else {
        console.log(`ℹ️ ${account} already has TOKEN_TRANSFER_ROLE`);
      }
    }
  } catch (error) {
    console.error(`❌ Failed to add investors to whitelist: ${error.message}`);
  }

  const network = require("hardhat").network.name;
  if (network === "hardhat" || network === "localhost") {
    console.log("🪙 Minting USDT for test accounts...");
    const account = testAccounts[0]; // Mint only for one account
    try {
      const mintAmount = parseUSDT("100000"); // Mint 100000 USDT
      await (await usdtContract.mint(account, mintAmount)).wait();
      console.log(`✅ Minted ${formatUSDT(mintAmount)} USDT for ${account}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.log(`⚠️  Failed to mint USDT for ${account}: ${error.message}`);
      // If it's a nonce error, wait longer
      if (error.message.includes("nonce")) {
        console.log("🔄 Nonce error detected, waiting 5 seconds...");
        await new Promise(resolve => setTimeout(resolve, 5000));
        // 重试一次
        try {
          const mintAmount = parseUSDT("100000");
          await (await usdtContract.mint(account, mintAmount)).wait();
          console.log(`✅ Retry successful: Minted ${formatUSDT(mintAmount)} USDT for ${account}`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (retryError) {
          console.log(`❌ Retry failed: ${retryError.message}`);
        }
      }
    }

    // 等待2秒以避免nonce冲突
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Check crowdfunding status
  console.log("📈 Crowdfunding Information:");
  let startTime, endTime;
  try {
    // 尝试获取众筹时间信息
    // 注意：这里我们尝试使用不同的方式获取状态变量
    startTime = await fund.startTime ? await fund.startTime() : await fund.startTime_();
    console.log("成功获取startTime:", startTime);
  } catch (error) {
    console.log("获取startTime失败:", error.message);
    // 设置默认值
    startTime = Math.floor(Date.now() / 1000) - 3600; // 默认为1小时前
  }
  
  try {
    endTime = await fund.endTime ? await fund.endTime() : await fund.endTime_();
    console.log("成功获取endTime:", endTime);
  } catch (error) {
    console.log("获取endTime失败:", error.message);
    // 设置默认值
    endTime = Math.floor(Date.now() / 1000) + 3600; // 默认为1小时后
  }
  
  const currentTime = Math.floor(Date.now() / 1000);
  
  console.log("Start time:", new Date(Number(startTime) * 1000).toLocaleString());
  console.log("End time:", new Date(Number(endTime) * 1000).toLocaleString());
  console.log("Current time:", new Date(currentTime * 1000).toLocaleString());
  
  try {
    const softCap = await fund.softCap ? await fund.softCap() : await fund.softCap_();
    console.log("Soft cap:", formatUSDT(softCap));
  } catch (error) {
    console.log("获取softCap失败:", error.message);
  }
  
  try {
    const maxSupply = await fund.maxSupply ? await fund.maxSupply() : await fund.maxSupply_();
    console.log("Hard cap:", formatUSDT(maxSupply));
  } catch (error) {
    console.log("获取maxSupply失败:", error.message);
  }
  
  try {
    const sharePrice = await fund.sharePrice ? await fund.sharePrice() : await fund.sharePrice_();
    console.log("Share price:", formatUSDT(sharePrice));
  } catch (error) {
    console.log("获取sharePrice失败:", error.message);
  }
  
  // Check if crowdfunding is within valid period
  let isFundingActive = false;
  try {
    isFundingActive = await fund.isFundingPeriodActive ? await fund.isFundingPeriodActive() : await fund.isFundingPeriodActive_();
    console.log("Is crowdfunding active:", isFundingActive);
  } catch (error) {
    console.log("获取众筹状态失败:", error.message);
    // 手动计算众筹是否活跃
    isFundingActive = currentTime >= startTime && currentTime <= endTime;
    console.log("手动计算众筹状态:", isFundingActive);
  }
  
  // 详细时间检查
  const timeDiff = Number(startTime) - currentTime;
  if (timeDiff > 0) {
    console.log(`⏰ Crowdfunding has not started yet, need to wait ${Math.floor(timeDiff / 60)} minutes`);
  } else if (timeDiff < 0) {
    console.log(`✅ Crowdfunding has been active for ${Math.floor(Math.abs(timeDiff) / 60)} minutes`);
  }
  
  if (!isFundingActive) {
    console.log("⚠️  Crowdfunding is not active, skipping investment process");
    console.log("💡 Hint: Crowdfunding may not have started yet or has already ended");
    console.log("🔧 Suggestion: Redeploy the project, ensuring the start time is earlier than the current time");
    return;
  }
  
  // 模拟投资过程
  console.log("💰 Starting investment simulation...");
  
  // 同一账户投资两次
  const investor = testAccounts[0];
  
  // 第一次投资
  console.log("\n👤 First investment starting...");
  await performInvestment(investor, parseUSDT("5000"), 1);
  
  // 等待3秒
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 第二次投资
  console.log("\n👤 Second investment starting...");
  await performInvestment(investor, parseUSDT("6000"), 2);
  
  // 投资函数
  async function performInvestment(investor, investmentAmount, round) {
    console.log(`\n👤 Investor ${round} (${investor}) starting investment...`);
    
    // 检查USDT余额
    const balance = await usdtContract.balanceOf(investor);
    console.log(`💰 USDT balance: ${formatUSDT(balance)}`);
    
    if (balance < investmentAmount) {
      console.log(`❌ Insufficient balance, skipping investment`);
      return;
    }

    // 授权USDT给众筹合约
    console.log("🔐 Authorizing USDT...");
    
    try {
      const signer = await ethers.getSigner(investor);
      const usdtWithSigner = usdtContract.connect(signer);
      await (await usdtWithSigner.approve(fund.target, investmentAmount)).wait();
      console.log("✅ USDT authorization successful");
    } catch (error) {
      console.log(`⚠️  USDT authorization failed: ${error.message}`);
      if (error.message.includes("nonce")) {
        console.log("🔄 Nonce error detected, waiting 5 seconds...");
        await new Promise(resolve => setTimeout(resolve, 5000));
        // 重试一次
        try {
          const signer = await ethers.getSigner(investor);
          const usdtWithSigner = usdtContract.connect(signer);
          await (await usdtWithSigner.approve(fund.target, investmentAmount)).wait();
          console.log("✅ Retry authorization successful");
        } catch (retryError) {
          console.log(`❌ Retry authorization failed: ${retryError.message}`);
          return;
        }
      } else {
        return;
      }
    }
    
    // 等待2秒以避免nonce冲突
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 确保投资者账户有TOKEN_TRANSFER_ROLE权限
  try {
    const TOKEN_TRANSFER_ROLE = await vault.TOKEN_TRANSFER_ROLE();
    const vaultWithDeployer = vault.connect(await ethers.getSigner(deployer));
    const hasRole = await vault.hasRole(TOKEN_TRANSFER_ROLE, investor);

    if (!hasRole) {
      console.log(`🔑 Adding investor ${investor} to whitelist...`);
      await (await vaultWithDeployer.grantRole(TOKEN_TRANSFER_ROLE, investor)).wait();
      console.log(`✅ Granted TOKEN_TRANSFER_ROLE to ${investor}`);
    } else {
      console.log(`ℹ️ Investor ${investor} already has TOKEN_TRANSFER_ROLE`);
    }
  } catch (error) {
    console.error(`❌ Failed to add investor to whitelist: ${error.message}`);
    return;
  }

  // 执行投资（使用deposit方法，需要管理员签名）
  console.log(`💸 Investing ${formatUSDT(investmentAmount)} USDT...`);
    
    // 构造管理员签名
    const managerSigner = await ethers.getSigner(deployer);
    const managerAddress = await managerSigner.getAddress();
    
    // 获取当前nonce
    const managerNonce = await fund.getCallerNonce(deployer);
    
    // 构造签名数据 - 使用当前nonce，因为合约会在验证前增加nonce
    const sigData = {
      operation: "deposit",
      amount: investmentAmount,
      receiver: investor,
      nonce: managerNonce,
      chainId: await require("hardhat").ethers.provider.getNetwork().then(net => net.chainId),
      contractAddress: fund.target
    };
    
    // 构造消息哈希 - 使用abi.encodePacked匹配合约逻辑
    const messageHash = ethers.keccak256(ethers.solidityPacked(
      ["string", "uint256", "address", "uint256", "uint256", "address"],
      [sigData.operation, sigData.amount, sigData.receiver, sigData.nonce, sigData.chainId, sigData.contractAddress]
    ));
    
    // 签名
    const signature = await managerSigner.signMessage(ethers.getBytes(messageHash));
    
    console.log("🔐 Manager signature construction completed");
    console.log("Manager address:", managerAddress);
    console.log("Nonce:", managerNonce.toString());
    console.log("Signature:", signature);
    
    // 执行存款
    try {
      // 添加调试信息
      const minDepositAmount = await fund.minDepositAmount();
      const maxSupply = await fund.maxSupply();
      const currentSupply = await token.totalSupply();
      const remainingSupply = maxSupply - currentSupply;
      
      console.log("🔍 Debug information:");
      console.log("Minimum investment amount:", formatUSDT(minDepositAmount));
      console.log("Maximum supply:", formatUSDT(maxSupply));
      console.log("Current supply:", formatUSDT(currentSupply));
      console.log("Remaining supply:", formatUSDT(remainingSupply));
      console.log("Investment amount:", formatUSDT(investmentAmount));
      
      const investorSigner = await ethers.getSigner(investor);
      const fundWithSigner = fund.connect(investorSigner);
      const tx = await fundWithSigner.deposit(investmentAmount, investor, signature);
      const receipt = await tx.wait();
      
      if (receipt && receipt.status === 1) {
        console.log("✅ Investment successful!");
        
        // 获取投资后信息
        const totalRaised = await fund.getTotalRaised();
        console.log(`💰 Total raised: ${formatUSDT(totalRaised)} USDT`);
        
        // 检查Token余额
        const tokenBalance = await token.balanceOf(investor);
        console.log(`🪙 Tokens received: ${formatUSDT(tokenBalance)}`);
      } else {
        console.log("❌ Investment failed");
      }
    } catch (error) {
      console.log("❌ Investment failed:", error.message);
      
      // 如果是nonce错误，等待更长时间
      if (error.message.includes("nonce")) {
        console.log("🔄 Nonce error detected, waiting 5 seconds before retrying...");
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        try {
          const investorSigner = await ethers.getSigner(investor);
          const fundWithSigner = fund.connect(investorSigner);
          const tx = await fundWithSigner.deposit(investmentAmount, investor, signature);
          const receipt = await tx.wait();
          
          if (receipt && receipt.status === 1) {
            console.log("✅ Retry investment successful!");
            
            const totalRaised = await fund.getTotalRaised();
            console.log(`💰 Total raised: ${formatUSDT(totalRaised)} USDT`);
            
            const tokenBalance = await token.balanceOf(investor);
            console.log(`🪙 Tokens received: ${formatUSDT(tokenBalance)}`);
          } else {
            console.log("❌ Retry investment failed");
          }
        } catch (retryError) {
          console.log("❌ Retry investment failed:", retryError.message);
        }
      }
    }

    // 等待2秒再继续下一次投资
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // 显示众筹统计信息
  console.log("\n📊 Crowdfunding statistics:");
  const totalRaised = await fund.getTotalRaised();
  const remainingSupply = await fund.getRemainingSupply();
  const maxSupply = await fund.maxSupply(); // 使用公共方法 maxSupply() 而不是 _maxSupply()
  const totalShares = maxSupply - remainingSupply;
  
  console.log(`💰 Total raised: ${formatUSDT(totalRaised)} USDT`);
  console.log(`📈 Total shares issued: ${formatUSDT(totalShares)}`);
  console.log(`📊 Remaining shares: ${formatUSDT(remainingSupply)}`);
  
  // 检查是否达到软顶
  const softCap = await fund.softCap();
  if (totalRaised >= softCap) {
    console.log("🎉 Congratulations! Crowdfunding has reached the soft cap!");
    
    // 解锁代币
    console.log("\n🔓 Unlocking tokens...");
    try {
      const deployerSigner = await ethers.getSigner(deployer);
      const vaultWithDeployer = vault.connect(deployerSigner);
      const tx = await vaultWithDeployer.unpauseToken();
      const receipt = await tx.wait();
      
      if (receipt && receipt.status === 1) {
        console.log("✅ Token unlock successful!");
        
        // 检查代币状态
        const isPaused = await token.paused();
        console.log(`🪙 Token pause status: ${isPaused ? "Paused" : "Unlocked"}`);
        
        if (!isPaused) {
          console.log("🎉 Tokens can now be freely traded!");
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log("❌ Token unlock failed");
      }
    } catch (error) {
      console.log(`❌ Token unlock failed: ${error.message}`);
    }
  } else {
    console.log("⏳ Crowdfunding has not yet reached the soft cap, keep going!");
  }

  console.log("🎯 Investment process completed!");
}


// 分红函数
async function getYieldProject(projectDetails, usdtContract, deployer,investor) {
  const fundYield = await ethers.getContractAt("FundYield", projectDetails.yield.template);
  const vault = await ethers.getContractAt("FundVault", projectDetails.vault.template);
  const share = await ethers.getContractAt("ShareToken", projectDetails.token.template);

  const testAccounts = [deployer];
  const network = require("hardhat").network.name;
  if (network === "hardhat" || network === "localhost") {
    console.log("🪙 Minting USDT for test accounts...");
    const account = testAccounts[0]; // 只为一个账户铸造
    try {
      const mintAmount = parseUSDT("100000"); // 铸造100000 USDT
      await (await usdtContract.mint(account, mintAmount)).wait();
      console.log(`✅ Minted ${formatUSDT(mintAmount)} USDT for ${account}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.log(`⚠️ Failed to mint USDT for ${account}: ${error.message}`);
      // 如果是nonce错误，等待更长时间
      if (error.message.includes("nonce")) {
        console.log("🔄 Nonce error detected, waiting 5 seconds...");
        await new Promise(resolve => setTimeout(resolve, 5000));
        // 重试一次
        try {
          const mintAmount = parseUSDT("100000");
          await (await usdtContract.mint(account, mintAmount)).wait();
          console.log(`✅ Retry successful: Minted ${formatUSDT(mintAmount)} USDT for ${account}`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (retryError) {
          console.log(`❌ Retry failed: ${retryError.message}`);
        }
      }
    }

    // 等待2秒以避免nonce冲突
    await new Promise(resolve => setTimeout(resolve, 2000));
  }


  var lastId=await vault.latestRoundId();
  console.log("lastId:",lastId)
  console.log("last price:",await vault.lastestPrice())
  console.log("latestRoundData:",await vault.lastestRoundData());
  console.log("get RoundData:",await vault.getRoundData(lastId));

  await vault.addPrice(200000000n);

  lastId=await vault.latestRoundId();
  console.log("lastId:",lastId)
  console.log("last price:",await vault.lastestPrice())
  console.log("latestRoundData:",await vault.lastestRoundData());
  console.log("get RoundData:",await vault.getRoundData(lastId));


  
  console.log("✅ Is fund successful:", await vault.isFundSuccessful());
  console.log("fund yield vault:",await fundYield.vault());
  console.log("fund yield shareToken:",await fundYield.shareToken());
  console.log("fund yield rewardToken:",await fundYield.rewardToken());
  console.log("fund yield minRedemptionAmount:",await fundYield.minRedemptionAmount());
  console.log("fund yield startTime:",await fundYield.startTime());
  console.log("fund yield currentEpochId:",await fundYield.currentEpochId());

  console.log("first epoch redemption");

  var epochId=await fundYield.currentEpochId();

  const validator = await vault.getValidator();
  console.log("Validator address:", validator);

  const dividendAmount = parseUSDT("10000"); // 分配1000 USDT
  
  // 检查USDT余额
  const balance = await usdtContract.balanceOf(deployer);
  console.log(`💰 Dividend account USDT balance: ${formatUSDT(balance)}`);
  
  if (balance < dividendAmount) {
    console.log(`❌ Insufficient balance, skipping dividend distribution`);
    return;
  }


  const validatorSigner = await ethers.getSigner(deployer);
  const payload = ethers.solidityPackedKeccak256(
    ["address", "uint256", "uint256"],
    [vault.target, epochId, dividendAmount]
  );
  const signature = await validatorSigner.signMessage(ethers.getBytes(payload));

  const deployerSigner = await ethers.getSigner(deployer);
  const investorSigner = await ethers.getSigner(investor);
  
  const fundYieldwithSigner= fundYield.connect(deployerSigner);
  const fundYieldwithInvestor= fundYield.connect(investorSigner);

  var beforeBalance=await share.balanceOf(deployer);
  console.log("req redeem before",beforeBalance)

  await share.connect(deployerSigner).approve(fundYield.target,beforeBalance);
  await fundYieldwithSigner.requestRedemption(beforeBalance);

  console.log("req redeem after",await share.balanceOf(deployer))


  var currentEpoch=await fundYieldwithSigner.currentEpochId();
  console.log("current epoch",currentEpoch)
  var epochData= await fundYieldwithSigner.getEpochData(currentEpoch);
  console.log("epoch data",epochData)
  var userReq=await fundYieldwithSigner.getRedemptionRequest(deployer,currentEpoch);
  console.log("user req",userReq)

  await fundYieldwithSigner.cancelRedemption();
  console.log("req redeem cancel",await share.balanceOf(deployer))

  var epochData= await fundYieldwithSigner.getEpochData(currentEpoch);
  console.log("epoch data",epochData)
  var userReq=await fundYieldwithSigner.getRedemptionRequest(deployer,currentEpoch);
  console.log("user req",userReq)

  await fundYieldwithSigner.changeEpoch();
  console.log("current epoch",await fundYieldwithSigner.currentEpochId())
  var epochData= await fundYieldwithSigner.getEpochData(currentEpoch);
  console.log("epoch data",epochData);


  console.log("second epoch redemption");


  var beforeBalance=await share.balanceOf(deployer);
  

  var investorBalance = beforeBalance / 3n;
  beforeBalance = beforeBalance - investorBalance;
  
  console.log("req redeem before",beforeBalance)
  await share.connect(deployerSigner).transfer(investor,investorBalance);
  await share.connect(deployerSigner).approve(fundYield.target,beforeBalance);
  await fundYieldwithSigner.requestRedemption(beforeBalance);

  console.log("req redeem after",await share.balanceOf(deployer))

  console.log("investor req redeem before",await share.balanceOf(investor))

  await share.connect(investorSigner).approve(fundYield.target,investorBalance);
  await fundYieldwithInvestor.requestRedemption(investorBalance);
  console.log("investor req redeem after",await share.balanceOf(investor))

  var currentEpoch = await fundYield.currentEpochId();
  var epochData= await fundYieldwithSigner.getEpochData(currentEpoch);
  console.log("epoch data",epochData);
  var userReq=await fundYieldwithSigner.getRedemptionRequest(deployer,currentEpoch);
  console.log("deployer req",userReq);
  var investorReq=await fundYieldwithInvestor.getRedemptionRequest(investor,currentEpoch);
  console.log("investor req",investorReq);


  await fundYieldwithSigner.changeEpoch();
  console.log("current epoch",await fundYieldwithSigner.currentEpochId());


  console.log("before finishRedemptionEpoch usdt amount",await usdtContract.balanceOf(deployer))
  var dividendAmount2 = parseUSDT("50000");
  await usdtContract.connect(deployerSigner).approve(projectDetails.yield.template,dividendAmount2)
  var payload2 = ethers.solidityPackedKeccak256(
    ["address", "uint256", "uint256"],
    [vault.target, currentEpoch, dividendAmount2]
  );
  var signature2 = await validatorSigner.signMessage(ethers.getBytes(payload2));
  await fundYieldwithSigner.finishRedemptionEpoch(currentEpoch,dividendAmount2,signature2);

  console.log("deployer usdt amount",await usdtContract.balanceOf(deployer))
  var epochData= await fundYieldwithSigner.getEpochData(currentEpoch);
  console.log("epoch data",epochData)
  console.log("lockedShareToken:",await fundYieldwithSigner.lockedShareToken());
  console.log("deployer pendingReward:",await fundYieldwithSigner.pendingReward(deployer,currentEpoch));
  await fundYieldwithSigner.claimRedemption(currentEpoch);
  console.log("deployer pendingReward:",await fundYieldwithSigner.pendingReward(deployer,currentEpoch));

  var userReq=await fundYieldwithSigner.getRedemptionRequest(deployer,currentEpoch);
  console.log("deployer after claim user req",userReq)
  console.log("deployer usdt amount",await usdtContract.balanceOf(deployer));
  console.log("investor usdt amount",await usdtContract.balanceOf(investor));
  var epochData= await fundYieldwithInvestor.getEpochData(currentEpoch);
  console.log("epoch data",epochData)
  console.log("lockedShareToken:",await fundYieldwithSigner.lockedShareToken());
  console.log("investor pendingReward:",await fundYieldwithSigner.pendingReward(investor,currentEpoch));
  await fundYieldwithInvestor.claimRedemption(currentEpoch);
  console.log("investor pendingReward:",await fundYieldwithSigner.pendingReward(investor,currentEpoch));
  var userReq=await fundYieldwithInvestor.getRedemptionRequest(deployer,currentEpoch);
  console.log("lockedShareToken:",await fundYieldwithSigner.lockedShareToken());
  console.log("investor after claim user req",userReq)
  console.log("investor usdt amount",await usdtContract.balanceOf(investor));


  console.log("share token supply",await share.totalSupply())

  console.log("epoch data",await fundYieldwithInvestor.getEpochData(currentEpoch));










































  


  








  




  

  console.log("🎯 getYieldProject process completed!");
}

// 执行脚本
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });