import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { expect } from "chai";
import { parseUSDT, formatUSDT } from "../../test/utils/usdt";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { get } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("🚀 开始启动投资流程...");

  // 获取已部署的合约
  const creationDeployment = await get("Creation");
  const creation = await ethers.getContractAt("contracts/v2/creation/Creation.sol:Creation", creationDeployment.address);
  
  // 动态选择 USDT 地址
  const network = hre.network.name;
  const MAINNET_USDT_ADDRESS = process.env.MAINNET_USDT_ADDRESS || "";

  let usdtAddress: string;
  let usdtContract: any;

  if (network === "bsc" || network === "mainnet" || network === "bscmainnet") {
    if (!MAINNET_USDT_ADDRESS) {
      throw new Error("请在.env中配置MAINNET_USDT_ADDRESS");
    }
    usdtAddress = MAINNET_USDT_ADDRESS;
    usdtContract = await ethers.getContractAt("IERC20", usdtAddress);
    console.log("使用主网 USDT 地址:", usdtAddress);
  } else {
    const mockUSDTDeployment = await get("MockUSDT");
    usdtAddress = mockUSDTDeployment.address;
    usdtContract = await ethers.getContractAt("contracts/v2/mocks/MockUSDT.sol:MockUSDT", usdtAddress);
    console.log("使用 MockUSDT 地址:", usdtAddress);
  }

  // 获取项目信息
  const projectName = "Project_hardhat";
  const projectDetails = await creation.getProjectByName(projectName);

  if (!projectDetails.vault || projectDetails.vault === ethers.ZeroAddress) {
    throw new Error(`项目 ${projectName} 不存在或未部署`);
  }

  console.log("📊 项目信息:");
  console.log("🏦 Vault地址:", projectDetails.vault);
  console.log("🪙 Token地址:", projectDetails.token);
  console.log("💰 Fund地址:", projectDetails.fund);
  console.log("📈 AccumulatedYield地址:", projectDetails.accumulatedYield);

  // 获取合约实例
  const vault = await ethers.getContractAt("BasicVault", projectDetails.vault);
  const token = await ethers.getContractAt("VaultToken", projectDetails.token);
  const fund = await ethers.getContractAt("Crowdsale", projectDetails.fund);
  const accumulatedYield = await ethers.getContractAt("AccumulatedYield", projectDetails.accumulatedYield);

  // 使用部署者账户进行测试
  const testAccounts = [deployer];

  console.log("🪙 为测试账户铸造USDT...");
  const account = testAccounts[0]; // 只为一个账户铸造
  try {
    const mintAmount = parseUSDT("100000"); // 铸造100000 USDT
    await (await usdtContract.mint(account, mintAmount)).wait();
    console.log(`✅ 已为 ${account} 铸造 ${formatUSDT(mintAmount)} USDT`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (error: any) {
    console.log(`⚠️  为 ${account} 铸造USDT失败: ${error.message}`);
    // 如果是nonce错误，等待更长时间
    if (error.message.includes("nonce")) {
      console.log("🔄 检测到nonce错误，等待5秒...");
      await new Promise(resolve => setTimeout(resolve, 5000));
      // 重试一次
      try {
        const mintAmount = parseUSDT("100000");
        await (await usdtContract.mint(account, mintAmount)).wait();
        console.log(`✅ 重试成功：已为 ${account} 铸造 ${formatUSDT(mintAmount)} USDT`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (retryError: any) {
        console.log(`❌ 重试失败：${retryError.message}`);
      }
    }
  }
  
  // 等待2秒，避免nonce冲突
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 检查众筹状态
  console.log("📈 众筹信息:");
  const startTime = await fund.startTime();
  const endTime = await fund.endTime();
  const currentTime = Math.floor(Date.now() / 1000);
  
  console.log("开始时间:", new Date(Number(startTime) * 1000).toLocaleString());
  console.log("结束时间:", new Date(Number(endTime) * 1000).toLocaleString());
  console.log("当前时间:", new Date(currentTime * 1000).toLocaleString());
  console.log("软顶:", formatUSDT(await fund.softCap()));
  console.log("硬顶:", formatUSDT(await fund.maxSupply()));
  console.log("份额价格:", formatUSDT(await fund.sharePrice()));
  
  // 检查众筹是否在有效期内
  const isFundingActive = await fund.isFundingPeriodActive();
  console.log("众筹是否活跃:", isFundingActive);
  
  // 详细的时间检查
  const timeDiff = Number(startTime) - currentTime;
  if (timeDiff > 0) {
    console.log(`⏰ 众筹还未开始，还需要等待 ${Math.floor(timeDiff / 60)} 分钟`);
  } else if (timeDiff < 0) {
    console.log(`✅ 众筹已经开始 ${Math.floor(Math.abs(timeDiff) / 60)} 分钟`);
  }
  
  if (!isFundingActive) {
    console.log("⚠️  众筹不在活跃期，跳过投资流程");
    console.log("💡 提示：众筹可能还未开始或已结束");
    console.log("🔧 建议：重新部署项目，确保开始时间比当前时间早");
    return;
  }

  // 模拟投资流程
  console.log("💰 开始模拟投资流程...");
  
  // 同一个账户投资两次
  const investor = testAccounts[0];
  
  // 第一次投资
  console.log("\n👤 第一次投资开始...");
  await performInvestment(investor, parseUSDT("5000"), 1);
  
  // 等待3秒
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 第二次投资
  console.log("\n👤 第二次投资开始...");
  await performInvestment(investor, parseUSDT("6000"), 2);
  
  // 投资函数
  async function performInvestment(investor: string, investmentAmount: bigint, round: number) {
    console.log(`\n👤 投资者 ${round} (${investor}) 开始投资...`);
    
    // 检查USDT余额
    const balance = await usdtContract.balanceOf(investor);
    console.log(`💰 USDT余额: ${formatUSDT(balance)}`);
    
    if (balance < investmentAmount) {
      console.log(`❌ 余额不足，跳过投资`);
      return;
    }

    // 授权USDT给众筹合约
    console.log("🔐 授权USDT...");
    
    try {
      const signer = await ethers.getSigner(investor);
      const usdtWithSigner = usdtContract.connect(signer);
      await (await usdtWithSigner.approve(fund.target, investmentAmount)).wait();
      console.log("✅ USDT授权成功");
    } catch (error: any) {
      console.log(`⚠️  USDT授权失败: ${error.message}`);
      if (error.message.includes("nonce")) {
        console.log("🔄 检测到nonce错误，等待5秒...");
        await new Promise(resolve => setTimeout(resolve, 5000));
        // 重试一次
        try {
          const signer = await ethers.getSigner(investor);
          const usdtWithSigner = usdtContract.connect(signer);
          await (await usdtWithSigner.approve(fund.target, investmentAmount)).wait();
          console.log("✅ 重试授权成功");
        } catch (retryError: any) {
          console.log(`❌ 重试授权失败: ${retryError.message}`);
          return;
        }
      } else {
        return;
      }
    }
    
    // 等待2秒，避免nonce冲突
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 执行投资 (使用deposit方法，需要manager签名)
    console.log(`💸 投资 ${formatUSDT(investmentAmount)} USDT...`);
    
    // 构造manager签名
    const managerSigner = await ethers.getSigner(deployer);
    const managerAddress = await managerSigner.getAddress();
    
    // 获取当前nonce
    const managerNonce = await fund.getManagerNonce();
    
    // 构造签名数据 - 使用当前nonce，因为合约会先递增nonce再验证
    const sigData = {
      operation: "deposit",
      amount: investmentAmount,
      receiver: investor,
      nonce: managerNonce,
      chainId: await hre.ethers.provider.getNetwork().then(net => net.chainId),
      contractAddress: fund.target
    };
    
    // 构造消息哈希 - 使用 abi.encodePacked 来匹配合约逻辑
    const messageHash = ethers.keccak256(ethers.solidityPacked(
      ["string", "uint256", "address", "uint256", "uint256", "address"],
      [sigData.operation, sigData.amount, sigData.receiver, sigData.nonce, sigData.chainId, sigData.contractAddress]
    ));
    
    // 签名
    const signature = await managerSigner.signMessage(ethers.getBytes(messageHash));
    
    console.log("🔐 构造manager签名完成");
    console.log("Manager地址:", managerAddress);
    console.log("Nonce:", managerNonce.toString());
    console.log("签名:", signature);
    
    // 执行deposit
    try {
      // 添加调试信息
      const minDepositAmount = await fund.minDepositAmount();
      const maxSupply = await fund.maxSupply();
      const currentSupply = await token.totalSupply();
      const remainingSupply = maxSupply - currentSupply;
      
      console.log("🔍 调试信息:");
      console.log("最小投资金额:", formatUSDT(minDepositAmount));
      console.log("最大供应量:", formatUSDT(maxSupply));
      console.log("当前供应量:", formatUSDT(currentSupply));
      console.log("剩余供应量:", formatUSDT(remainingSupply));
      console.log("投资金额:", formatUSDT(investmentAmount));
      
      const investorSigner = await ethers.getSigner(investor);
      const fundWithSigner = fund.connect(investorSigner);
      const tx = await fundWithSigner.deposit(investmentAmount, investor, signature);
      const receipt = await tx.wait();
      
      if (receipt && receipt.status === 1) {
        console.log("✅ 投资成功!");
        
        // 获取投资后的信息
        const totalRaised = await fund.getTotalRaised();
        console.log(`💰 总募集金额: ${formatUSDT(totalRaised)} USDT`);
        
        // 检查Token余额
        const tokenBalance = await token.balanceOf(investor);
        console.log(`🪙 获得Token: ${formatUSDT(tokenBalance)}`);
      } else {
        console.log("❌ 投资失败");
      }
    } catch (error: any) {
      console.log("❌ 投资失败:", error.message);
      
      // 如果是nonce错误，等待更长时间
      if (error.message.includes("nonce")) {
        console.log("🔄 检测到nonce错误，等待5秒后重试...");
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        try {
          const investorSigner = await ethers.getSigner(investor);
          const fundWithSigner = fund.connect(investorSigner);
          const tx = await fundWithSigner.deposit(investmentAmount, investor, signature);
          const receipt = await tx.wait();
          
          if (receipt && receipt.status === 1) {
            console.log("✅ 重试投资成功!");
            
            const totalRaised = await fund.getTotalRaised();
            console.log(`💰 总募集金额: ${formatUSDT(totalRaised)} USDT`);
            
            const tokenBalance = await token.balanceOf(investor);
            console.log(`🪙 获得Token: ${formatUSDT(tokenBalance)}`);
          } else {
            console.log("❌ 重试投资失败");
          }
        } catch (retryError: any) {
          console.log("❌ 重试投资失败:", retryError.message);
        }
      }
    }

    // 等待2秒再继续下一个投资
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // 显示众筹统计信息
  console.log("\n📊 众筹统计:");
  const totalRaised = await fund.getTotalRaised();
  const remainingSupply = await fund.getRemainingSupply();
  const maxSupply = await fund.maxSupply();
  const totalShares = maxSupply - remainingSupply;
  
  console.log(`💰 总募集金额: ${formatUSDT(totalRaised)} USDT`);
  console.log(`📈 总发行份额: ${formatUSDT(totalShares)}`);
  console.log(`📊 剩余份额: ${formatUSDT(remainingSupply)}`);
  
  // 检查是否达到软顶
  const softCap = await fund.softCap();
  if (totalRaised >= softCap) {
    console.log("🎉 恭喜! 众筹已达到软顶!");
    
    // 解锁代币
    console.log("\n🔓 解锁代币...");
    try {
      const deployerSigner = await ethers.getSigner(deployer);
      const fundWithDeployer = fund.connect(deployerSigner);
      const tx = await fundWithDeployer.unpauseTokenOnFundingSuccess();
      const receipt = await tx.wait();
      
      if (receipt && receipt.status === 1) {
        console.log("✅ 代币解锁成功!");
        
        // 检查代币状态
        const isPaused = await token.paused();
        console.log(`🪙 代币暂停状态: ${isPaused ? "已暂停" : "已解锁"}`);
        
        if (!isPaused) {
          console.log("🎉 代币现在可以自由交易了!");
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log("❌ 代币解锁失败");
      }
    } catch (error: any) {
      console.log(`❌ 代币解锁失败: ${error.message}`);
    }
  } else {
    console.log("⏳ 众筹尚未达到软顶，继续加油!");
  }

  console.log("🎯 投资流程启动完成!");
};

export default func;
func.tags = ["v2-invest"];
