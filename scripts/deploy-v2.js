const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 部署状态文件
const getStatusFile = (network) => path.join(__dirname, '../deploy/v2', `deployment-status-${network}.json`);

// 检查基础设施是否已部署
function isInfrastructureDeployed(network) {
  const statusFile = getStatusFile(network);
  if (fs.existsSync(statusFile)) {
    const status = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
    return status.infrastructureDeployed;
  }
  return false;
}

// 保存部署状态
function saveDeploymentStatus(network, status) {
  const statusFile = getStatusFile(network);
  fs.writeFileSync(statusFile, JSON.stringify(status, null, 2));
}

// 主部署函数
async function deployV2(network = 'baseSepolia') {
  console.log('🚀 开始 V2 部署流程...');
  console.log('网络:', network);
  
  const infrastructureDeployed = isInfrastructureDeployed(network);
  
  if (!infrastructureDeployed) {
    console.log('🏗️  部署基础框架 (01, 02, 03)...');
    
    try {
      // 部署基础框架
      execSync(`npx hardhat deploy --tags v2-infrastructure --network ${network}`, {
        stdio: 'inherit'
      });
      
      // 保存部署状态
      saveDeploymentStatus(network, {
        infrastructureDeployed: true,
        lastProjectDeployed: null,
        projects: [],
        deployedAt: new Date().toISOString()
      });
      
      console.log('✅ 基础框架部署完成');
    } catch (error) {
      console.error('❌ 基础框架部署失败:', error.message);
      process.exit(1);
    }
  } else {
    console.log('✅ 基础框架已部署，跳过');
  }
  
  console.log('🎯 基础框架部署管理完成!');
  console.log('💡 现在可以运行项目部署脚本:');
  console.log(`   npx hardhat run deploy/v2/04_Deploy_Example_Project.ts --network ${network}`);
  console.log(`   npx hardhat run deploy/v2/05_Start_Invest.ts --network ${network}`);
}

// 部署项目
async function deployProject(network = 'baseSepolia') {
  console.log('📦 部署项目...');
  
  try {
    execSync(`npx hardhat run deploy/v2/04_Deploy_Example_Project.ts --network ${network}`, {
      stdio: 'inherit'
    });
    console.log('✅ 项目部署完成');
  } catch (error) {
    console.error('❌ 项目部署失败:', error.message);
    process.exit(1);
  }
}

// 启动投资
async function startInvest(network = 'baseSepolia') {
  console.log('💰 启动投资流程...');
  
  try {
    execSync(`npx hardhat run deploy/v2/05_Start_Invest.ts --network ${network}`, {
      stdio: 'inherit'
    });
    console.log('✅ 投资流程启动完成');
  } catch (error) {
    console.error('❌ 投资流程启动失败:', error.message);
    process.exit(1);
  }
}

// 重置部署
async function resetDeployment(network = 'baseSepolia') {
  console.log('🔄 重置部署状态...');
  
  const statusFile = getStatusFile(network);
  if (fs.existsSync(statusFile)) {
    fs.unlinkSync(statusFile);
    console.log('✅ 部署状态已清除');
  }
  
  try {
    execSync(`npx hardhat clean`, { stdio: 'inherit' });
    console.log('✅ 部署缓存已清除');
  } catch (error) {
    console.error('❌ 清除部署缓存失败:', error.message);
  }
}

// 命令行参数处理
const args = process.argv.slice(2);
const command = args[0];
const network = args[1] || 'baseSepolia';

switch (command) {
  case 'infrastructure':
    deployV2(network);
    break;
  case 'project':
    deployProject(network);
    break;
  case 'invest':
    startInvest(network);
    break;
  case 'all':
    deployV2(network).then(() => deployProject(network));
    break;
  case 'reset':
    resetDeployment(network);
    break;
  default:
    console.log('使用方法:');
    console.log('  node scripts/deploy-v2.js infrastructure [network]  - 部署基础框架');
    console.log('  node scripts/deploy-v2.js project [network]         - 部署项目');
    console.log('  node scripts/deploy-v2.js invest [network]          - 启动投资');
    console.log('  node scripts/deploy-v2.js all [network]             - 部署所有');
    console.log('  node scripts/deploy-v2.js reset [network]           - 重置部署');
    console.log('');
    console.log('示例:');
    console.log('  node scripts/deploy-v2.js infrastructure baseSepolia');
    console.log('  node scripts/deploy-v2.js project baseSepolia');
    console.log('  node scripts/deploy-v2.js invest baseSepolia');
}
