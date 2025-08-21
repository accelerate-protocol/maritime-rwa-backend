const { execSync } = require('child_process');

console.log('🔄 重新部署项目...');

try {
  // 重新部署项目
  console.log('📦 部署新项目...');
  execSync('npx hardhat run deploy/v2/04_Deploy_Example_Project.ts --network baseSepolia', {
    stdio: 'inherit'
  });
  
  console.log('✅ 项目重新部署完成!');
  console.log('💡 现在可以运行投资脚本:');
  console.log('   npx hardhat run deploy/v2/05_Start_Invest.ts --network baseSepolia');
  
} catch (error) {
  console.error('❌ 重新部署失败:', error.message);
  process.exit(1);
}
