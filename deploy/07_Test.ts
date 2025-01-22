import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  console.log("===============流程测试=======================)");
  const { deployments, getNamedAccounts, ethers } = hre;
  const { execute } = deployments;
  // const { deployer } = await getNamedAccounts();
  const [
    deployer,
    vaultInvestor1,
    vaultInvestor2,
    vaultInvestor3,
    vaultInvestor4,
    vaultInvestor5,
    vaultInvestor6,
  ] = await ethers.getSigners();
  const vaultInvestors = [
    vaultInvestor1,
    vaultInvestor2,
    vaultInvestor3,
    vaultInvestor4,
    vaultInvestor5,
    vaultInvestor6,
  ];

  var deployerBalance=await deployer.provider.getBalance(deployer.address)
  console.log("测试前部署账户余额",deployerBalance)

  // const preAmount = ethers.parseEther("0.0001");
  // for (let i = 0; i < vaultInvestors.length; i++) {
  //   var investorAmount=await deployer.provider.getBalance(vaultInvestors[i].address)
  //   console.log("investorAmount:",investorAmount)
  //   console.log("投资者测试费用空投")
  //     const tx = await deployer.sendTransaction({
  //       to: vaultInvestors[i].address,
  //       value: preAmount,
  //     });
  //     await tx.wait()
    
  // }

  console.log("Deployer balance", await deployer.provider.getBalance(deployer.address));

  var tx;

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
  console.log("rbuEscrow:", rbuInfo.withdrawTreasury);
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
  for (let i = 0; i < vaultInvestors.length; i++) {
    await vault.addToWhitelist(vaultInvestors[i].address, {
      from: deployer.address,
      gasLimit: 1000000,
    });
  }

  const vaultWhiteList2 = await vault.getAllWhitelistedAddresses();
  console.log("vaultWhiteList2:", vaultWhiteList2);

  const usdtDeployment = await deployments.get("MockUSDT"); // 替换为你的合约名称
  const usdt = await hre.ethers.getContractAt(
    "MockUSDT", // 替换为你的合约名称
    usdtDeployment.address
  );

  console.log("===============投资者金库投资=======================)");

  var totalSupplyRaw = await vault.maxSupply();
  const totalSupply = Number(totalSupplyRaw / BigInt(1e18));
  var minDepositAmount = await vault.minDepositAmount();
  const minAmount = Number(minDepositAmount / BigInt(1e18));

  const distribution = distributeMoneyWithMinimum(
    totalSupply,
    vaultInvestors.length,
    minAmount
  );
  console.log("分配结果：", distribution);
  console.log(
    "总金额校验：",
    distribution.reduce((a, b) => a + b, 0)
  );
  for (let i = 0; i < vaultInvestors.length; i++) {
    const investAmount = BigInt(Math.floor(distribution[i] * 1e18));
    console.log("投资金额:" + investAmount);
    var vaultTmp = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vaultInfo.vault,
      vaultInvestors[i]
    );
    console.log("投资者", i, ":", vaultInvestors[i].address);
    console.log("铸币:");
    tx=await execute(
      "MockUSDT",
      { from: deployer.address, log: true, gasLimit: 10000000 },
      "mint",
      vaultInvestors[i].address,
      investAmount
    );
    console.log("铸币交易",tx.transactionHash)
    const balance = await usdt.balanceOf(vaultInvestors[i].address);
    tx=await execute(
      "MockUSDT",
      { from: vaultInvestors[i].address, log: true, gasLimit: 10000000 },
      "approve",
      vaultInfo.vault,
      balance
    );
    console.log("铸币许可",tx.transactionHash)
    console.log("金库投资:");
    await vaultTmp.deposit(balance.toString(), vaultInvestors[i].address, {
      from: vaultInvestors[i].address,
      gasLimit: 1000000,
    });
    var vaultToken = await vault.balanceOf(vaultInvestors[i].address);
    console.log("投资者" + i + "金库代币份额:", vaultToken.toString());
  }

  console.log("==============融资结束金库进度=======================)");
  const vaultbalance = await usdt.balanceOf(vaultInfo.vault);
  console.log("金库融资稳定币余额:", vaultbalance.toString());

  const totalDeposit = await vault.totalDeposit();
  console.log("金库融资进度:", totalDeposit.toString());

  console.log("===============执行策略（投资rbu）=======================)");
  const withDrawTime1 = await vault.withdrawTime();
  console.log("金库可取时间:", withDrawTime1.toString());

  tx=await vault.execStrategy({
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
  const randomMultiplier = 1.5 + Math.random() * 0.5;
  console.log("铸造系数", randomMultiplier);
  const principalInterest = Math.floor(totalSupply * randomMultiplier);
  const waitMint = BigInt(Math.floor(principalInterest - totalSupply) * 1e18);
  console.log("铸造利息金额", waitMint);

  tx=await execute(
    "MockUSDT",
    { from: deployer.address, log: true, gasLimit: 10000000 },
    "mint",
    deployer.address,
    waitMint
  );
  console.log("铸造利息交易",tx.transactionHash)

  const backBalance = await usdt.balanceOf(deployer.address);
  console.log("总归还金额:", backBalance.toString());

  const dividendCount = 4;
  const dividendCountArr = distributeMoneyWithMinimum(
    principalInterest,
    dividendCount,
    100
  );
  var dividendbalance;
  var vaultDividendbalance;
  var dividendBeforeBalance=await deployer.provider.getBalance(deployer.address)
  console.log("派息前部署账户余额",dividendBeforeBalance)

  console.log("随机派息金额", dividendCountArr);
  for (let i = 0; i < dividendCountArr.length; i++) {
    const dividendAmount = BigInt(Math.floor(dividendCountArr[i] * 1e18));
    console.log("第" + (i + 1) + "次派息:", dividendAmount);
    await usdt.transfer(rbuInfo.dividendTreasury, dividendAmount);
    dividendbalance = await usdt.balanceOf(rbuInfo.dividendTreasury);
    console.log("派息前rbu派息金库余额:", dividendbalance.toString());
    console.log("====rbu派息====)");
    await rbuManager.dividend();
    dividendbalance = await usdt.balanceOf(rbuInfo.dividendTreasury);
    console.log("派息后rbu派息金库余额:", dividendbalance.toString());

    // await sleep(1000);
    // timestampInSeconds = Math.floor(Date.now() / 1000);
    // await rbuPrice.addPrice("600000000000000000", timestampInSeconds);

    // vaultPrice = await vault.price();
    // console.log("金库币价:", vaultPrice.toString());

    vaultDividendbalance = await usdt.balanceOf(vaultInfo.dividendEscrow);
    console.log("派息前vault派息金库余额:", vaultDividendbalance.toString());
    console.log("====vault派息====)");

    await vault.dividend();
    vaultDividendbalance = await usdt.balanceOf(vaultInfo.dividendEscrow);
    console.log("派息后vault派息金库余额:", vaultDividendbalance.toString());

    for (let j = 0; j < vaultInvestors.length; j++) {
      var investorUsdt = await usdt.balanceOf(vaultInvestors[j].address);
      console.log("派息后投资用户" + j + "-USDT余额:", investorUsdt.toString());
    }
  }
  var dividendAfterBalance=await deployer.provider.getBalance(deployer.address)
  console.log("派息后部署账户余额",dividendAfterBalance)

  var timestampInSeconds = Math.floor(Date.now() / 1000);
  await rbuPrice.addPrice("0", timestampInSeconds);

  var vaultPrice = await vault.price();
  console.log("金库币价:", vaultPrice.toString());

  // console.log("===============等待rbu到期=======================)");
  // await sleep(80000);
  // // await execute(
  // //   "MockUSDT",
  // //   { from: deployer.address, log: true, gasLimit: 10000000 },
  // //   "mint",
  // //   deployer.address,
  // //   "10000000000000000000000"
  // // );

  // console.log("===============金库清算rbu=======================)");
  // console.log(
  //   "清算前vault-rbu代币余额",
  //   await rbuToken.balanceOf(vaultInfo.vault)
  // );
  // console.log("清算前rbu取款金库余额", await usdt.balanceOf(rbuInfo.rbuEscrow));
  // console.log("rbuPrice", await rbuPrice.getLatestPrice());
  // await vault.harvest();
  // console.log(
  //   "清算后vault-rbu代币余额",
  //   await rbuToken.balanceOf(vaultInfo.vault)
  // );
  // console.log("清算后rbu取款金库余额", await usdt.balanceOf(rbuInfo.rbuEscrow));
  // console.log("vault合约锁仓余额", await usdt.balanceOf(vaultInfo.vault));
  // vaultPrice = await vault.price();
  // console.log("金库币价:", vaultPrice.toString());
  // console.log("===============投资者清算vault=======================)");
  // console.log("金库清算时间:", await vault.withdrawTime());
  // console.log("当前时间:", Math.floor(Date.now() / 1000));

  // console.log("===============等待vault到期=======================)");
  // await sleep(80000);
  // // await execute(
  // //   "MockUSDT",
  // //   { from: deployer.address, log: true, gasLimit: 10000000 },
  // //   "mint",
  // //   deployer.address,
  // //   "10000000000000000000000"
  // // );

  // for (let i = 0; i < vaultInvestors.length; i++) {
  //   var vaultToken = await vault.balanceOf(vaultInvestors[i].address);
  //   var vaultTmp = await hre.ethers.getContractAt(
  //     "Vault", // 替换为你的合约名称
  //     vaultInfo.vault,
  //     vaultInvestors[i]
  //   );

  //   await vaultTmp.redeem(
  //     vaultToken.toString(),
  //     vaultInvestors[i].address,
  //     vaultInvestors[i].address
  //   );
  // }

  // for (let i = 0; i < vaultInvestors.length; i++) {
  //   var investorVault = await vault.balanceOf(vaultInvestors[i].address);
  //   console.log("赎回后投资用户" + i + "-vault余额:", investorVault.toString());
  // }

  console.log("rbu代币供应量:", await rbuToken.totalSupply());
  console.log("vault代币供应量:", await vault.totalSupply());
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function distributeMoneyWithMinimum(
  total: number,
  people: number,
  minAmount: number
): number[] {
  if (total < people * minAmount) {
    throw new Error("总金额不足以满足每人至少分到最小金额的要求！");
  }

  const result: number[] = new Array(people).fill(minAmount);
  let remaining = total - people * minAmount;

  for (let i = 0; i < people - 1; i++) {
    // 为当前人分配一个随机金额，范围是 [0, remaining - (people - i - 1)]
    const max = remaining - (people - i - 1);
    const amount = Math.floor(Math.random() * (max + 1));
    result[i] += amount;
    remaining -= amount;
  }

  // 将剩余金额分配给最后一个人
  result[people - 1] += remaining;
  return result;
}

export default func;
func.tags = ["07_Test"];
