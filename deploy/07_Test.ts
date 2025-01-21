import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  console.log("===============流程测试=======================)");
  const { deployments, getNamedAccounts, ethers } = hre;
  const { execute } = deployments;
  // const { deployer } = await getNamedAccounts();
  const [deployer, vaultInvestor1, vaultInvestor2] = await ethers.getSigners();
  // 通过部署信息获取合约实例
  const rbuRouterDeployment = await deployments.get("RBURouter"); // 替换为你的合约名称
  const rbuRouter = await hre.ethers.getContractAt(
    "RBURouter", // 替换为你的合约名称
    rbuRouterDeployment.address
  );

  console.log("===============查询合约地址=======================)");
  console.log("RBURouter deployed at:", rbuRouterDeployment.address);
  // 调用查询方法
  const rbuId = await rbuRouter.getRbuNonce(); // 替换为具体方法名
  // console.log("rbuId:", rbuId);

  const rbuInfo = await rbuRouter.getRBUInfo(rbuId - 1n);
  console.log("rbuManager:", rbuInfo.rbuManager);
  console.log("rbuEscrow:", rbuInfo.rbuEscrow);
  console.log("dividendTreasury:", rbuInfo.dividendTreasury);
  console.log("rbuToken:", rbuInfo.rbuToken);
  console.log("rbuPrice:", rbuInfo.rbuPrice);

  const rbuManager = await hre.ethers.getContractAt(
    "RBUManager", // 替换为你的合约名称
    rbuInfo.rbuManager
  );

  const rbuToken = await hre.ethers.getContractAt(
    "RBUToken", // 替换为你的合约名称
    rbuInfo.rbuToken
  );
  // 通过部署信息获取合约实例
  const vaultDeployment = await deployments.get("VaultRouter"); // 替换为你的合约名称
  const vaultRouter = await hre.ethers.getContractAt(
    "VaultRouter", // 替换为你的合约名称
    vaultDeployment.address
  );

  const vaultInfo = await vaultRouter.getVaultInfo(0);
  console.log("vault:", vaultInfo.vault);
  console.log("feeEscrow:", vaultInfo.feeEscrow);
  console.log("dividendEscrow:", vaultInfo.dividendEscrow);

  const vault = await hre.ethers.getContractAt(
    "Vault", // 替换为你的合约名称
    vaultInfo.vault
  );

  const rbuPrice = await hre.ethers.getContractAt(
    "Pricer", // 替换为你的合约名称
    rbuInfo.rbuPrice
  );

  console.log("===============添加白名单======================)");
  await rbuPrice.addWhiteListAddr(deployer);

  const rbuWhiteList = await rbuManager.getAllWhitelistedAddresses();
  console.log("rbuWhiteList:", rbuWhiteList);

  const vaultWhiteList = await vault.getAllWhitelistedAddresses();
  console.log("vaultWhiteList:", vaultWhiteList);

  console.log("添加rbu代币白名单");
  await rbuManager.addToWhitelist(vaultInfo.vault, {
    from: deployer.address, // 指定交易发送者
    gasLimit: 1000000, // 设置交易的 gas 限制
  });

  const rbuWhiteList2 = await rbuManager.getAllWhitelistedAddresses();
  console.log("rbuWhiteList2:", rbuWhiteList2);

  console.log("添加vault白名单");
  await vault.addToWhitelist(vaultInvestor1.address, {
    from: deployer.address,
    gasLimit: 1000000,
  });
  await vault.addToWhitelist(vaultInvestor2.address, {
    from: deployer.address,
    gasLimit: 1000000,
  });
  const vaultWhiteList2 = await vault.getAllWhitelistedAddresses();
  console.log("vaultWhiteList2:", vaultWhiteList2);

  const usdtDeployment = await deployments.get("MockUSDT"); // 替换为你的合约名称
  const usdt = await hre.ethers.getContractAt(
    "MockUSDT", // 替换为你的合约名称
    usdtDeployment.address
  );

  console.log("===============投资者金库投资=======================)")
  const vault1 = await hre.ethers.getContractAt(
    "Vault", // 替换为你的合约名称
    vaultInfo.vault,
    vaultInvestor1
  );
  console.log ("投资者1:",vaultInvestor1.address);
  console.log ("铸币:");
  await execute(
    'MockUSDT',
    { from: deployer.address, log: true,  gasLimit: 10000000  },
    'mint',
    vaultInvestor1.address,
    "500000000000000000000"
  );
  const balance = await usdt.balanceOf(vaultInvestor1.address);
  await execute(
    'MockUSDT',
    { from: vaultInvestor1.address, log: true,  gasLimit: 10000000  },
    'approve',
    vaultInfo.vault,
    balance
  );
  console.log ("金库投资:");
  await vault1.deposit(balance.toString(),vaultInvestor1.address, {
    from: vaultInvestor1.address,
    gasLimit: 1000000,
  });
  const  vaultToken1 = await vault.balanceOf(vaultInvestor1.address);
  console.log("投资者1金库代币份额:",vaultToken1.toString());

  console.log ("投资者2:",vaultInvestor2.address);
  const vault2 = await hre.ethers.getContractAt(
    "Vault", // 替换为你的合约名称
    vaultInfo.vault,
    vaultInvestor2
  );
  console.log ("铸币:");
  await execute(
    'MockUSDT',
    { from: vaultInvestor2.address, log: true,  gasLimit: 10000000  },
    'mint',
    vaultInvestor2.address,
    "500000000000000000000"
  );
  const balance2 = await usdt.balanceOf(vaultInvestor2.address);
  console.log ("金库投资:");
  await execute(
    'MockUSDT',
    { from: vaultInvestor2.address, log: true,  gasLimit: 10000000  },
    'approve',
    vaultInfo.vault,
    balance2
  );
  await vault2.deposit(balance2,vaultInvestor2.address, {
    from: vaultInvestor2,
    gasLimit: 1000000,
  });
  const  vaultToken2 = await vault.balanceOf(vaultInvestor2.address);
  console.log("投资者2金库代币份额:",vaultToken2.toString());

  const vaultbalance = await usdt.balanceOf(vaultInfo.vault);
  console.log("金库融资稳定币余额:",vaultbalance.toString());

  const totalDeposit= await vault.totalDeposit()
  console.log("金库融资进度:",totalDeposit.toString());

  // console.log(
  //   "===============投资者金库投资(部署者代投资)=======================)"
  // );
  // await vault.addToWhitelist(deployer.address, {
  //   from: deployer.address,
  //   gasLimit: 1000000,
  // });

  // const vault1 = await hre.ethers.getContractAt(
  //   "Vault", // 替换为你的合约名称
  //   vaultInfo.vault,
  //   vaultInvestor1
  // );
  // console.log("投资者1:", vaultInvestor1.address);
  // console.log("铸币:");
  // await execute(
  //   "MockUSDT",
  //   { from: deployer.address, log: true, gasLimit: 10000000 },
  //   "mint",
  //   deployer.address,
  //   "500000000000000000000"
  // );
  // const balance = await usdt.balanceOf(deployer.address);
  // await execute(
  //   "MockUSDT",
  //   { from: deployer.address, log: true, gasLimit: 10000000 },
  //   "approve",
  //   vaultInfo.vault,
  //   balance
  // );
  // console.log("金库投资:");
  // await vault.deposit(balance.toString(), vaultInvestor1.address, {
  //   from: deployer.address,
  //   gasLimit: 1000000,
  // });
  // const vaultToken1 = await vault.balanceOf(vaultInvestor1.address);
  // console.log("投资者1金库代币份额:", vaultToken1.toString());

  // console.log("投资者2:", vaultInvestor2.address);
  // const vault2 = await hre.ethers.getContractAt(
  //   "Vault", // 替换为你的合约名称
  //   vaultInfo.vault,
  //   vaultInvestor2
  // );
  // console.log("铸币:");
  // await execute(
  //   "MockUSDT",
  //   { from: deployer.address, log: true, gasLimit: 10000000 },
  //   "mint",
  //   deployer.address,
  //   "500000000000000000000"
  // );
  // const balance2 = await usdt.balanceOf(deployer.address);
  // console.log("金库投资:");
  // await execute(
  //   "MockUSDT",
  //   { from: deployer.address, log: true, gasLimit: 10000000 },
  //   "approve",
  //   vaultInfo.vault,
  //   balance2
  // );
  // await vault.deposit(balance2, vaultInvestor2.address, {
  //   from: deployer,
  //   gasLimit: 1000000,
  // });
  // const vaultToken2 = await vault.balanceOf(vaultInvestor2.address);
  // console.log("投资者2金库代币份额:", vaultToken2.toString());

  // const vaultbalance = await usdt.balanceOf(vaultInfo.vault);
  // console.log("金库融资稳定币余额:", vaultbalance.toString());

  // const totalDeposit = await vault.totalDeposit();
  // console.log("金库总存款:", totalDeposit.toString());

  console.log("===============执行策略（投资rbu）=======================)");
  const withDrawTime1 = await vault.withdrawTime();
  console.log("金库可取时间:", withDrawTime1.toString());

  await vault.execStrategy({
    from: deployer.address,
    gasLimit: 1000000,
  });

  const withDrawTime2 = await vault.withdrawTime();
  console.log("金库可取时间:", withDrawTime2.toString());
  const vaultbalance2 = await usdt.balanceOf(vaultInfo.vault);
  console.log("金库融资稳定币余额:", vaultbalance2.toString());

  const vaultRbuTokenBalance = await rbuToken.balanceOf(vaultInfo.vault);
  console.log("金库rbuToken余额:", vaultRbuTokenBalance.toString());

  const rbubalance = await usdt.balanceOf(deployer.address);
  console.log("rbu提款账户余额:", rbubalance.toString());

  console.log("===============额外铸造利息=======================)");
  await execute(
    "MockUSDT",
    { from: deployer.address, log: true, gasLimit: 10000000 },
    "mint",
    deployer.address,
    "500000000000000000000"
  );

  const backBalance = await usdt.balanceOf(deployer.address);
  console.log("总归还金额:", backBalance.toString());

  var dividendbalance;
  var vaultDividendbalance;
  var investor1Usdt;
  var investor2Usdt;
  var vaultPrice;
  var timestampInSeconds;
  console.log("===============1500u分3次派息=======================)");

  console.log("====第1次派息400u====)");
  await usdt.transfer(rbuInfo.dividendTreasury, "400000000000000000000");
  dividendbalance = await usdt.balanceOf(rbuInfo.dividendTreasury);
  console.log("派息前rbu派息金库余额:", dividendbalance.toString());
  console.log("====rbu派息====)");
  await rbuManager.dividend();
  dividendbalance = await usdt.balanceOf(rbuInfo.dividendTreasury);
  console.log("派息后rbu派息金库余额:", dividendbalance.toString());

  await sleep(1000);
  timestampInSeconds = Math.floor(Date.now() / 1000);
  await rbuPrice.addPrice("600000000000000000", timestampInSeconds);

  vaultPrice = await vault.price();
  console.log("金库币价:", vaultPrice.toString());

  vaultDividendbalance = await usdt.balanceOf(vaultInfo.dividendEscrow);
  console.log("派息前vault派息金库余额:", vaultDividendbalance.toString());
  console.log("====vault派息====)");

  await vault.dividend();
  vaultDividendbalance = await usdt.balanceOf(vaultInfo.dividendEscrow);
  console.log("派息后vault派息金库余额:", vaultDividendbalance.toString());

  investor1Usdt = await usdt.balanceOf(vaultInvestor1.address);
  console.log("派息后投资用户1-USDT余额:", investor1Usdt.toString());
  investor2Usdt = await usdt.balanceOf(vaultInvestor2.address);
  console.log("派息后投资用户2-USDT余额:", investor2Usdt.toString());

  console.log("===============第2次派息500u=======================)");
  await usdt.transfer(rbuInfo.dividendTreasury, "500000000000000000000");
  dividendbalance = await usdt.balanceOf(rbuInfo.dividendTreasury);
  console.log("派息前rbu派息金库余额:", dividendbalance.toString());
  console.log("====rbu派息====)");

  await rbuManager.dividend();
  dividendbalance = await usdt.balanceOf(rbuInfo.dividendTreasury);
  console.log("派息后rbu派息金库余额:", dividendbalance.toString());

  await sleep(1000);
  timestampInSeconds = Math.floor(Date.now() / 1000);
  await rbuPrice.addPrice("100000000000000000", timestampInSeconds);

  vaultPrice = await vault.price();
  console.log("金库币价:", vaultPrice.toString());

  vaultDividendbalance = await usdt.balanceOf(vaultInfo.dividendEscrow);
  console.log("派息前vault派息金库余额:", vaultDividendbalance.toString());
  console.log("====vault派息====)");

  await vault.dividend();
  vaultDividendbalance = await usdt.balanceOf(vaultInfo.dividendEscrow);
  console.log("派息后vault派息金库余额:", vaultDividendbalance.toString());

  investor1Usdt = await usdt.balanceOf(vaultInvestor1.address);
  console.log("派息后投资用户1-USDT余额:", investor1Usdt.toString());
  investor2Usdt = await usdt.balanceOf(vaultInvestor2.address);
  console.log("派息后投资用户2-USDT余额:", investor2Usdt.toString());

  console.log("===============第3次派息600u=======================)");
  await usdt.transfer(rbuInfo.dividendTreasury, "600000000000000000000");
  dividendbalance = await usdt.balanceOf(rbuInfo.dividendTreasury);
  console.log("派息前rbu派息金库余额:", dividendbalance.toString());
  console.log("====rbu派息====)");

  await rbuManager.dividend();
  dividendbalance = await usdt.balanceOf(rbuInfo.dividendTreasury);
  console.log("派息后rbu派息金库余额:", dividendbalance.toString());

  await sleep(1000);
  timestampInSeconds = Math.floor(Date.now() / 1000);
  await rbuPrice.addPrice("100000000000000000", timestampInSeconds);

  vaultPrice = await vault.price();
  console.log("金库币价:", vaultPrice.toString());
  vaultDividendbalance = await usdt.balanceOf(vaultInfo.dividendEscrow);
  console.log("派息前vault派息金库余额:", vaultDividendbalance.toString());
  console.log("====vault派息====)");
  await vault.dividend();
  vaultDividendbalance = await usdt.balanceOf(vaultInfo.dividendEscrow);
  console.log("派息后vault派息金库余额:", vaultDividendbalance.toString());
  investor1Usdt = await usdt.balanceOf(vaultInvestor1.address);
  console.log("派息后投资用户1-USDT余额:", investor1Usdt.toString());
  investor2Usdt = await usdt.balanceOf(vaultInvestor2.address);
  console.log("派息后投资用户2-USDT余额:", investor2Usdt.toString());

  await execute(
    "MockUSDT",
    { from: deployer.address, log: true, gasLimit: 10000000 },
    "mint",
    deployer.address,
    "100000000000000000000"
  );
  await usdt.transfer(rbuInfo.rbuEscrow, "100000000000000000000");

  console.log("===============等待rbu到期=======================)");
  await sleep(80000);
  await execute(
    "MockUSDT",
    { from: deployer.address, log: true, gasLimit: 10000000 },
    "mint",
    deployer.address,
    "10000000000000000000000"
  );

  console.log("===============金库清算rbu=======================)");
  console.log("清算前vault-rbu代币余额",await rbuToken.balanceOf(vaultInfo.vault));
  console.log("清算前rbu取款金库余额",await usdt.balanceOf(rbuInfo.rbuEscrow));
  console.log("rbuPrice",await rbuPrice.getLatestPrice());
  await vault.harvest()
  console.log("清算后vault-rbu代币余额",await rbuToken.balanceOf(vaultInfo.vault));
  console.log("清算后rbu取款金库余额",await usdt.balanceOf(rbuInfo.rbuEscrow));
  console.log("vault合约锁仓余额",await usdt.balanceOf(vaultInfo.vault));
  vaultPrice = await vault.price();
  console.log("金库币价:", vaultPrice.toString());
  console.log("===============投资者清算vault=======================)");
  console.log("金库清算时间:",await vault.withdrawTime());
  console.log("当前时间:",Math.floor(Date.now() / 1000));
  
  console.log("===============等待vault到期=======================)");
  await sleep(80000);
  await execute(
    "MockUSDT",
    { from: deployer.address, log: true, gasLimit: 10000000 },
    "mint",
    deployer.address,
    "10000000000000000000000"
  );

  await vault1.redeem(vaultToken1.toString(),vaultInvestor1.address,vaultInvestor1.address); 
  await vault2.redeem(vaultToken2.toString(),vaultInvestor2.address,vaultInvestor2.address);


  investor1Usdt = await usdt.balanceOf(vaultInvestor1.address);
  console.log("清算后投资用户1-USDT余额:", investor1Usdt.toString());
  investor2Usdt = await usdt.balanceOf(vaultInvestor2.address);
  console.log("清算后投资用户2-USDT余额:", investor2Usdt.toString());

  console.log("rbu代币供应量:",await rbuToken.totalSupply());
  console.log("vault代币供应量:",await vault.totalSupply());

  

};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default func;
func.tags = ["07_Test"];
