const { execSync } = require('child_process');
const path = require('path');

async function main() {
  const network = process.argv[2] || 'localhost';
  
  console.log("🚀 开始执行完整的部署和投资流程...");
  console.log("📡 目标网络:", network);
  
  try {
    // 1. 部署基础合约
    console.log("\n📦 步骤 1: 部署基础合约...");
    execSync(`npx hardhat run scripts/deploy-v2.js --network ${network}`, { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    // 等待5秒
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 2. 部署示例项目
    console.log("\n🏗️  步骤 2: 部署示例项目...");
    execSync(`npx hardhat run scripts/deploy-example-project.js --network ${network}`, { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    // 等待5秒
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 3. 启动投资流程
    console.log("\n💰 步骤 3: 启动投资流程...");
    execSync(`npx hardhat run scripts/start-invest.js --network ${network}`, { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    console.log("\n🎉 完整流程执行完成!");
    
  } catch (error) {
    console.error("❌ 执行过程中出现错误:", error.message);
    process.exit(1);
  }
}

// 执行脚本
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
