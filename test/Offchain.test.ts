import hre, { ethers } from "hardhat";
import { expect } from "chai";
import path from "path";
import { deployFactories } from '../utils/deployFactories';
import { factoryAuth } from '../utils/factoryAuth';
import { execSync } from "child_process";
import exp from "constants";
describe("RWA:", function () {
  this.timeout(600000);
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
 
  let whitelists: any;
  let EscrowFactory: any;
  let PriceFeedFactory: any;
  let RBFFactory: any;
  let RBFRouter: any;
  let usdt: any;
  let rbfRouter: any;

  before(async () => {
    try {
      const projectRoot = path.resolve(__dirname, '..');
      execSync(`bash ${projectRoot}/shell/ready.sh`, {
          stdio: 'inherit',
          cwd: projectRoot
      });
    } catch (error) {
      console.error('Failed to execute ready.sh:', error);
      throw error;
    } 
    await deployFactories();
    await factoryAuth();
    const {deployer,investor1,investor2,investor3,investor4,investor5} = await getNamedAccounts();
    whitelists = [investor1, investor2, investor3, investor4, investor5];
    EscrowFactory = await deployments.get("EscrowFactory");
    PriceFeedFactory = await deployments.get("PriceFeedFactory");
    RBFFactory = await deployments.get("RBFFactory");
    RBFRouter = await deployments.get("RBFRouter");
    usdt = await deploy("MockUSDT", {
      from: deployer,
      args: ["USDC", "UDSC"],
    });
    rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address); 
  });

//线上线下混合认购及派息
it("tc-92", async function () {
  const {execute} = deployments;
  const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common,drds} = await getNamedAccounts();
  const RBFRouter = await deployments.get("RBFRouter");
  // 获取 RBFRouter 合约实例
  const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
  const rbfId = await rbfRouter.rbfNonce();
  const abiCoder = new ethers.AbiCoder();
  const deployData = abiCoder.encode(
    ["(uint64,string,string,address,address,address,address,address)"],
    [
      [rbfId,
      "RBF-92", "RBF-92",
      usdt.address,
      depositTreasury,
      deployer,
      manager,
      guardian,]
    ]
  );
  const deployDataHash = ethers.keccak256(deployData);
  const signer = await ethers.getSigner(rbfSigner);
  const signature = await signer.signMessage(ethers.getBytes(deployDataHash));
  const signer2 = await ethers.getSigner(rbfSigner2);
  const signature2 = await signer2.signMessage(ethers.getBytes(deployDataHash));
  const signatures = [signature,signature2];
  
  var res = await rbfRouter.deployRBF(deployData, signatures);
  var receipt = await res.wait();
  if (!receipt) throw new Error("Transaction failed");
  expect(receipt.status).to.equal(1);

  const whitelists = [investor1, investor2, investor3, investor4];
  const rbfData = await rbfRouter.getRBFInfo(rbfId);
  const rbf = rbfData.rbf;
  
  const VaultRouter = await deployments.get("VaultRouter");
  const vaultRouter = await hre.ethers.getContractAt(
          "VaultRouter",
          VaultRouter.address
        );
  const vaultId = await vaultRouter.vaultNonce();
  const subStartTime = Math.floor(Date.now() / 1000) 
  const subEndTime = subStartTime + 60;
  const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc90",
      symbol: "RbfVaultForTc90",
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "3000",
      minDepositAmount: "10000000",
      manageFee: "50",
      manager: manager,
      feeReceiver: feeReceiver,
      dividendEscrow: manager, // 添加这一行
      whitelists: [investor5],
      guardian: guardian,
      maxSupply: "10000000000",
      financePrice: "100000000",
  };
  var res = await vaultRouter.deployVault(vaultDeployData);
  var receipt = await res.wait();
  if (!receipt) throw new Error("Transaction failed");
  expect(receipt.status).to.equal(1);
  const vaultData = await vaultRouter.getVaultInfo(vaultId);
  const vault = vaultData.vault;

  const VAULT = await ethers.getContractAt("Vault", vault);
  const maxSupply = await VAULT.maxSupply();
  const financePrice = await VAULT.financePrice();
  const minDepositAmount = await VAULT.minDepositAmount();
  const totalSupply = Number(maxSupply / BigInt(1e6));
  const minAmount = Number(minDepositAmount / BigInt(1e6));

  const distribution = distributeMoneyWithMinimum(
    totalSupply,
    whitelists.length,
    minAmount
  );
  var vaultInvest: any;
  var USDT: any;
  const managerSigner = await ethers.getSigner(manager);
  const vaultManager = await hre.ethers.getContractAt(
    "Vault",
    vault,
    managerSigner
  );
  const rbfManager = await hre.ethers.getContractAt(
    "RBF",
    rbf,
    managerSigner
  );
  let investArr = new Array();
  let incomeArr = new Array();
  const priceFeed = rbfData.priceFeed;
  const priceFeedManager = await hre.ethers.getContractAt(
    "PriceFeed",
    priceFeed,
    managerSigner
  );

  expect(
    await priceFeedManager.grantRole(
      ethers.keccak256(ethers.toUtf8Bytes("FEEDER_ROLE")),
      drds
    )
  ).not.to.be.reverted;
  var onChainInvest=BigInt(0);
  const commonSigner = await ethers.getSigner(common);
  var expectedErrorMessage = `AccessControl: account ${common.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
  await expect(VAULT.connect(commonSigner).addToOffChainWL(whitelists[0])).to.be.revertedWith(expectedErrorMessage);
  await expect(VAULT.connect(commonSigner).addToOnChainWL(whitelists[1])).to.be.revertedWith(expectedErrorMessage);

  for (let i = 0; i < whitelists.length; i++) {
    const investSigner = await ethers.getSigner(whitelists[i]);
    vaultInvest = await hre.ethers.getContractAt(
      "Vault",
      vault,
      investSigner
    );
    const investAmount = BigInt(Math.floor(distribution[i] * 1e6));
    if (i % 2 == 0) {
      const manageFee = await vaultInvest.manageFee();
      const feeAmount = (investAmount * BigInt(manageFee)) / BigInt(10000);
      const totalInvestAmount = investAmount + feeAmount;
      investArr.push(totalInvestAmount);
      console.log(
        "investAmount:",
        investAmount.toString(),
        "feeAmount:",
        feeAmount.toString(),
        "totalInvestAmount:",
        totalInvestAmount.toString()
      );
      USDT = await ethers.getContractAt(
        "MockUSDT",
        usdt.address,
        investSigner
      );
      await expect(vaultManager.addToOnChainWL(whitelists[i])).not.to.be.reverted;
      await expect(vaultManager.addToOffChainWL(whitelists[i])).to.be.revertedWith("Vault: Address is already onChainWL");
      await expect(USDT.mint(whitelists[i], totalInvestAmount)).not.to.be.reverted;
      await expect(USDT.approve(vault, totalInvestAmount)).not.to.be.reverted;
      onChainInvest+=investAmount;
      await expect(VAULT.connect(commonSigner).deposit(investAmount)).to.be.revertedWith("Vault: you are not in onChainWL");
      await expect(vaultInvest.deposit(investAmount)).not.to.be.reverted;
    } else {
      investArr.push(investAmount);
      await expect(vaultManager.addToOffChainWL(whitelists[i])).not.to.be.reverted;
      await expect(vaultManager.addToOffChainWL(whitelists[i])).to.be.revertedWith("Vault: Address is already offChainWL");
      await expect(vaultManager.removeFromOffChainWL(common)).to.be.revertedWith("Vault: Address is not in the offChain whitelist");
      await expect(vaultManager.addToOffChainWL(common)).not.to.be.reverted;
      await expect(vaultManager.removeFromOffChainWL(common)).not.to.be.reverted;
      await expect(vaultManager.addToOnChainWL(whitelists[i])).to.be.revertedWith("Vault: Address is already offChainWL");
      await expect(VAULT.connect(commonSigner).offChainDepositMint(whitelists[i],investAmount)).to.be.revertedWith(expectedErrorMessage);
      await expect(vaultManager.offChainDepositMint(whitelists[0],investAmount)).to.be.revertedWith("Vault:OffChain receiver are not in offChainWL");
      await expect(vaultManager.offChainDepositMint(whitelists[i],investAmount)).not.to.be.reverted;
      if(i==1){
        const inverstorSigners = await ethers.getSigner(whitelists[0]);
        const balance = await vaultInvest.balanceOf(whitelists[0]);
        await expect(VAULT.connect(inverstorSigners).transfer(whitelists[1],balance)).to.be.revertedWith("Vault: Invalid endTime");
      }
    }
    const balance = await vaultInvest.balanceOf(whitelists[i]);
    expect(balance).to.equal(investAmount);
  }
  expectedErrorMessage = `AccessControl: account ${common.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
  await expect(VAULT.connect(commonSigner).removeFromOffChainWL(whitelists[0])).to.be.revertedWith(expectedErrorMessage);
  await expect(VAULT.connect(commonSigner).removeFromOnChainWL(whitelists[1])).to.be.revertedWith(expectedErrorMessage);


  expect(await VAULT.assetBalance()).to.equal(onChainInvest);
  console.log("total deposit balance", await VAULT.assetBalance());
  console.log("total manageFee Balance", await VAULT.manageFeeBalance());
  console.log("total Balance", await USDT.balanceOf(vault));
  expectedErrorMessage = `AccessControl: account ${deployer.toLowerCase()} is missing role ${ethers.keccak256(
    ethers.toUtf8Bytes("MANAGER_ROLE")
  )}`;

  //线下赎回

  const offlineInvestorSigners = await ethers.getSigner(whitelists[1]);
  await expect(VAULT.connect(offlineInvestorSigners).offChainRedeem()).to.be.revertedWith("Vault: Invalid time");
  // await VAULT.connect(offlineInvestorSigners).approve(vault, totalInvestAmount);
  // await expect(VAULT.connect(offlineInvestorSigners).offChainRedeem()).not.to.be.reverted;
  

  //从线下白名单中删除已经认购资产的账户，删除失败
  await expect(vaultManager.removeFromOffChainWL(investor2)).to.be.revertedWith("Vault: Address has balance");

  // Create a promise-based delay function
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  console.log("开始等待...");
  await delay(60000);
  console.log("等待结束");

  await expect(vaultManager.addToOffChainWL(common)).to.be.revertedWith("Vault: Invalid time");
  await expect(vaultManager.removeFromOffChainWL(investor1)).to.be.revertedWith("Vault: Invalid time");

  const inverstorSigners = await ethers.getSigner(whitelists[0]);
  const balance = await vaultInvest.balanceOf(whitelists[0]);
  await expect(VAULT.connect(inverstorSigners).transfer(whitelists[1],balance)).to.be.revertedWith("Vault: Invalid endTime");


  await expect(VAULT.execStrategy()).to.be.revertedWith(expectedErrorMessage);
  await expect(vaultManager.execStrategy()).to.be.revertedWith(
    "RBF: you are not vault"
  );

  await expect(rbfManager.setVault(vault)).not.to.be.reverted;
  await expect(rbfManager.setVault(vault)).to.be.revertedWith(
    "RBF: vaultAddr already set"
  );
  await expect(vaultManager.execStrategy()).not.to.be.reverted;
  await expect(VAULT.connect(inverstorSigners).transfer(whitelists[1],balance)).not.to.be.reverted;

  expect(await USDT.balanceOf(depositTreasury)).to.be.equal(onChainInvest);
  expect(await rbfManager.depositAmount()).to.be.equal(onChainInvest);

  expectedErrorMessage = `AccessControl: account ${manager.toLowerCase()} is missing role ${ethers.keccak256(
    ethers.toUtf8Bytes("MINT_AMOUNT_SETTER_ROLE")
  )}`;
  await expect(rbfManager.setMintAmount(maxSupply)).to.be.revertedWith(
    expectedErrorMessage
  );

  const rbfDeployer = await hre.ethers.getContractAt("RBF", rbf);
  expectedErrorMessage = `AccessControl: account ${deployer.toLowerCase()} is missing role ${ethers.keccak256(
    ethers.toUtf8Bytes("MANAGER_ROLE")
  )}`;
  await expect(
    rbfDeployer.grantRole(
      ethers.keccak256(ethers.toUtf8Bytes("MINT_AMOUNT_SETTER_ROLE")),
      manager
    )
  ).to.be.revertedWith(expectedErrorMessage);
  await expect(
    rbfManager.grantRole(
      ethers.keccak256(ethers.toUtf8Bytes("MINT_AMOUNT_SETTER_ROLE")),
      drds
    )
  ).not.to.be.reverted;

  const drdsSigner = await ethers.getSigner(drds);
  const rbfDrds = await hre.ethers.getContractAt("RBF", rbf, drdsSigner);
  const priceFeedDrds = await hre.ethers.getContractAt(
    "PriceFeed",
    priceFeed,
    drdsSigner
  );

  await expect(rbfDrds.setMintAmount(maxSupply)).not.to.be.reverted;
  await expect(
    priceFeedDrds.addPrice(financePrice, Math.floor(Date.now() / 1000))
  ).not.to.be.reverted;
  expect(await rbfDrds.depositMintAmount()).to.be.equal(maxSupply);

  expect(await rbfManager.balanceOf(vault)).to.be.equal(0);
  expectedErrorMessage = `AccessControl: account ${drds.toLowerCase()} is missing role ${ethers.keccak256(
    ethers.toUtf8Bytes("MANAGER_ROLE")
  )}`;
  await expect(rbfDrds.claimDeposit()).to.be.revertedWith(
    expectedErrorMessage
  );
  await expect(rbfManager.claimDeposit()).not.to.be.reverted;
  expect(await rbfManager.balanceOf(vault)).to.be.equal(maxSupply);
  console.log("rbf总净值:", await rbfManager.getAssetsNav());
  console.log("vault价值:", await vaultManager.price());
  expect(await rbfManager.getAssetsNav()).to.be.equal(
    (BigInt(maxSupply) * BigInt(financePrice)) / BigInt(1e6)
  );
  expect(await vaultManager.price()).to.be.equal(financePrice);

  await expect(rbfDrds.claimDeposit()).to.be.revertedWith(
    expectedErrorMessage
  );
  await expect(rbfDrds.dividend()).to.be.revertedWith(expectedErrorMessage);

  await expect(rbfManager.dividend()).to.be.revertedWith(
    "RBF: totalDividend must be greater than 0"
  );
  const randomMultiplier = 1.1 + Math.random() * 0.4;
  console.log("派息系数:", randomMultiplier);
  const principalInterest = Math.floor(totalSupply * randomMultiplier);
  const waitMint = BigInt(Math.floor(principalInterest - totalSupply) * 1e6);
  await expect(USDT.mint(depositTreasury, maxSupply-onChainInvest+waitMint)).not.to.be.reverted;
  const dividendCount = 4;
  const dividendCountArr = distributeMoneyWithMinimum(
    principalInterest,
    dividendCount,
    1
  );
  const totalNav = await USDT.balanceOf(depositTreasury);
  console.log("总派息资产:", totalNav.toString());

  const depositTreasurySigner = await ethers.getSigner(depositTreasury);
  const USDTdepositTreasury = await ethers.getContractAt(
    "MockUSDT",
    usdt.address,
    depositTreasurySigner
  );
  const rbfDividendTreasury = await rbfManager.dividendTreasury();
  const vaultDividendTreasury = await vaultManager.dividendTreasury();
  for (let i = 0; i < dividendCountArr.length; i++) {
    const dividendAmount = BigInt(Math.floor(dividendCountArr[i] * 1e6));
    console.log("第" + (i + 1) + "次派息:", dividendAmount);
    await expect(
      USDTdepositTreasury.transfer(rbfDividendTreasury, dividendAmount)
    ).not.to.be.reverted;
    await expect(rbfManager.dividend()).not.to.be.reverted;
    await expect(vaultManager.dividend()).not.to.be.reverted;
  }
  await expect(priceFeedDrds.addPrice(0, Math.floor(Date.now() / 1000))).not
    .to.be.reverted;
  console.log("rbf总净值:", await rbfManager.getAssetsNav());
  console.log("vault价值:", await vaultManager.price());
  expect(await rbfManager.getAssetsNav()).to.be.equal(0);
  expect(await vaultManager.price()).to.be.equal(0);
  var totalDividend = await USDT.balanceOf(vaultDividendTreasury);
  console.log("金库剩余派息金额:", totalDividend.toString());
  var investorBalance = await USDT.balanceOf(vaultDividendTreasury);
  for (let i = 0; i < whitelists.length; i++) {
    investorBalance = await USDT.balanceOf(whitelists[i]);
    incomeArr.push(investorBalance);
    totalDividend = totalDividend + investorBalance;
  }
  console.log("总派息额", totalDividend);
  console.log(investArr);
  console.log(incomeArr);
  expect(totalDividend).to.equal(totalNav);
  expect(incomeArr[0]).to.equal(BigInt(0));
  await expect(VAULT.connect(offlineInvestorSigners).offChainRedeem()).to.be.revertedWith("Vault: not allowed withdraw");
 
});

//线上线下各100个账户认购及派息
it("tc-94", async function () {
  const {execute} = deployments;
  const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common,drds} = await getNamedAccounts();
  const RBFRouter = await deployments.get("RBFRouter");
  // 获取 RBFRouter 合约实例
  const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
  const rbfId = await rbfRouter.rbfNonce();
  const abiCoder = new ethers.AbiCoder();
  const deployData = abiCoder.encode(
    ["(uint64,string,string,address,address,address,address,address)"],
    [
      [rbfId,
      "RBF-94", "RBF-94",
      usdt.address,
      depositTreasury,
      deployer,
      manager,
      guardian,]
    ]
  );
  const deployDataHash = ethers.keccak256(deployData);
  const signer = await ethers.getSigner(rbfSigner);
  const signature = await signer.signMessage(ethers.getBytes(deployDataHash));
  const signer2 = await ethers.getSigner(rbfSigner2);
  const signature2 = await signer2.signMessage(ethers.getBytes(deployDataHash));
  const signatures = [signature,signature2];
  
  var res = await rbfRouter.deployRBF(deployData, signatures);
  var receipt = await res.wait();
  if (!receipt) throw new Error("Transaction failed");
  expect(receipt.status).to.equal(1);
  // 获取测试账户
  const [...signers] = await ethers.getSigners();

  // 生成100个有效的测试地址
  const investors = signers.slice(0, 100);  
  const whitelists = investors.map(investor => investor.address);

  // const whitelists = [investor1, investor2, investor3, investor4];
  const rbfData = await rbfRouter.getRBFInfo(rbfId);
  const rbf = rbfData.rbf;
  
  const VaultRouter = await deployments.get("VaultRouter");
  const vaultRouter = await hre.ethers.getContractAt(
          "VaultRouter",
          VaultRouter.address
        );
  const vaultId = await vaultRouter.vaultNonce();
  const subStartTime = Math.floor(Date.now() / 1000) 
  const subEndTime = subStartTime + 720;
  const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc94",
      symbol: "RbfVaultForTc94",
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "3000",
      minDepositAmount: "10000000",
      manageFee: "50",
      manager: manager,
      feeReceiver: feeReceiver,
      dividendEscrow: manager, // 添加这一行
      whitelists: whitelists,
      guardian: guardian,
      maxSupply: "10000000000",
      financePrice: "100000000",
  };
  var res = await vaultRouter.deployVault(vaultDeployData);
  var receipt = await res.wait();
  if (!receipt) throw new Error("Transaction failed");
  expect(receipt.status).to.equal(1);
  const vaultData = await vaultRouter.getVaultInfo(vaultId);
  const vault = vaultData.vault;

  const VAULT = await ethers.getContractAt("Vault", vault);
  const maxSupply = await VAULT.maxSupply();
  const financePrice = await VAULT.financePrice();
  const minDepositAmount = await VAULT.minDepositAmount();
  const totalSupply = Number(maxSupply / BigInt(1e6));
  const minAmount = Number(minDepositAmount / BigInt(1e6));
 
  var vaultInvest: any;
  var USDT: any;
  const managerSigner = await ethers.getSigner(manager);
  const vaultManager = await hre.ethers.getContractAt(
    "Vault",
    vault,
    managerSigner
  );
  const rbfManager = await hre.ethers.getContractAt(
    "RBF",
    rbf,
    managerSigner
  );

  // 生成100个有效的测试地址
  const offChainInvestors = signers.slice(100, 200);
  const offchain_whitelists = offChainInvestors.map(off_investor => off_investor.address);
  const offchain_whitelistLength = offchain_whitelists.length;
  console.log("offchain_whitelistLength:",offchain_whitelistLength);
  for (let i = 0; i < offchain_whitelistLength; i++) {
    await expect(vaultManager.addToOffChainWL(offchain_whitelists[i])).not.to.be.reverted;
  }
  const accounts = await ethers.getSigners(); 
  const account201 = accounts[200]; 
  const address_201 = account201.address;
  await expect(vaultManager.addToOffChainWL(address_201)).to.be.revertedWith("Vault: Whitelist is full");


  let investArr = new Array();
  let incomeArr = new Array();
  const priceFeed = rbfData.priceFeed;
  const priceFeedManager = await hre.ethers.getContractAt(
    "PriceFeed",
    priceFeed,
    managerSigner
  );

  expect(
    await priceFeedManager.grantRole(
      ethers.keccak256(ethers.toUtf8Bytes("FEEDER_ROLE")),
      drds
    )
  ).not.to.be.reverted;
  var onChainInvest=BigInt(0);
  const distribution = distributeMoneyWithMinimum(
    totalSupply,
    whitelists.length + offchain_whitelistLength,
    minAmount
  );
  for (let i = 0; i < whitelists.length; i++) {
    const investSigner = await ethers.getSigner(whitelists[i]);
    vaultInvest = await hre.ethers.getContractAt(
      "Vault",
      vault,
      investSigner
    );
    const investAmount = BigInt(Math.floor(distribution[i] * 1e6));
    const manageFee = await vaultInvest.manageFee();
    const feeAmount = (investAmount * BigInt(manageFee)) / BigInt(10000);
    const totalInvestAmount = investAmount + feeAmount;
    investArr.push(totalInvestAmount);
    console.log(
      "investAmount:",
      investAmount.toString(),
      "feeAmount:",
      feeAmount.toString(),
      "totalInvestAmount:",
      totalInvestAmount.toString()
    );
    USDT = await ethers.getContractAt(
      "MockUSDT",
      usdt.address,
      investSigner
    );
    await expect(USDT.mint(whitelists[i], totalInvestAmount)).not.to.be.reverted;
    await expect(USDT.approve(vault, totalInvestAmount)).not.to.be.reverted;
    onChainInvest+=investAmount;
    await expect(vaultInvest.deposit(investAmount)).not.to.be.reverted;  
  }
  for (let i = 0; i < offchain_whitelistLength; i++) {
    const investSigner = await ethers.getSigner(offchain_whitelists[i]);
    vaultInvest = await hre.ethers.getContractAt(
      "Vault",
      vault,
      investSigner
    );
    const investAmount = BigInt(Math.floor(distribution[i+100] * 1e6));
    investArr.push(investAmount);
    await expect(vaultManager.offChainDepositMint(offchain_whitelists[i],investAmount)).not.to.be.reverted;
    const balance = await vaultInvest.balanceOf(offchain_whitelists[i]);
    expect(balance).to.equal(investAmount);
  }
  

  expect(await VAULT.assetBalance()).to.equal(onChainInvest);
  console.log("total deposit balance", await VAULT.assetBalance());
  console.log("total manageFee Balance", await VAULT.manageFeeBalance());
  console.log("total Balance", await USDT.balanceOf(vault));
  var expectedErrorMessage = `AccessControl: account ${deployer.toLowerCase()} is missing role ${ethers.keccak256(
    ethers.toUtf8Bytes("MANAGER_ROLE")
  )}`;
  
  await expect(rbfManager.setVault(vault)).not.to.be.reverted;
 
  await expect(vaultManager.execStrategy()).not.to.be.reverted;
  expect(await USDT.balanceOf(depositTreasury)).to.be.equal(onChainInvest);
  expect(await rbfManager.depositAmount()).to.be.equal(onChainInvest);
  
  await expect(
    rbfManager.grantRole(
      ethers.keccak256(ethers.toUtf8Bytes("MINT_AMOUNT_SETTER_ROLE")),
      drds
    )
  ).not.to.be.reverted;

  const drdsSigner = await ethers.getSigner(drds);
  const rbfDrds = await hre.ethers.getContractAt("RBF", rbf, drdsSigner);
  const priceFeedDrds = await hre.ethers.getContractAt(
    "PriceFeed",
    priceFeed,
    drdsSigner
  );

  await expect(rbfDrds.setMintAmount(maxSupply)).not.to.be.reverted;
  await expect(
    priceFeedDrds.addPrice(financePrice, Math.floor(Date.now() / 1000))
  ).not.to.be.reverted;
  expect(await rbfDrds.depositMintAmount()).to.be.equal(maxSupply);

  expect(await rbfManager.balanceOf(vault)).to.be.equal(0);
  await expect(rbfManager.claimDeposit()).not.to.be.reverted;
  expect(await rbfManager.balanceOf(vault)).to.be.equal(maxSupply);
  console.log("rbf总净值:", await rbfManager.getAssetsNav());
  console.log("vault价值:", await vaultManager.price());
  expect(await rbfManager.getAssetsNav()).to.be.equal(
    (BigInt(maxSupply) * BigInt(financePrice)) / BigInt(1e6)
  );
  expect(await vaultManager.price()).to.be.equal(financePrice);
  const randomMultiplier = 1.1 + Math.random() * 0.4;
  console.log("派息系数:", randomMultiplier);
  const principalInterest = Math.floor(totalSupply * randomMultiplier);
  const waitMint = BigInt(Math.floor(principalInterest - totalSupply) * 1e6);
  await expect(USDT.mint(depositTreasury, maxSupply-onChainInvest+waitMint)).not.to.be.reverted;
  const dividendCount = 4;
  const dividendCountArr = distributeMoneyWithMinimum(
    principalInterest,
    dividendCount,
    1
  );
  const totalNav = await USDT.balanceOf(depositTreasury);
  console.log("总派息资产:", totalNav.toString());

  const depositTreasurySigner = await ethers.getSigner(depositTreasury);
  const USDTdepositTreasury = await ethers.getContractAt(
    "MockUSDT",
    usdt.address,
    depositTreasurySigner
  );
  const rbfDividendTreasury = await rbfManager.dividendTreasury();
  const vaultDividendTreasury = await vaultManager.dividendTreasury();
  for (let i = 0; i < dividendCountArr.length; i++) {
    const dividendAmount = BigInt(Math.floor(dividendCountArr[i] * 1e6));
    console.log("第" + (i + 1) + "次派息:", dividendAmount);
    await expect(
      USDTdepositTreasury.transfer(rbfDividendTreasury, dividendAmount)
    ).not.to.be.reverted;
    await expect(rbfManager.dividend()).not.to.be.reverted;
    await expect(vaultManager.dividend()).not.to.be.reverted;
  }
  await expect(priceFeedDrds.addPrice(0, Math.floor(Date.now() / 1000))).not
    .to.be.reverted;
  console.log("rbf总净值:", await rbfManager.getAssetsNav());
  console.log("vault价值:", await vaultManager.price());
  expect(await rbfManager.getAssetsNav()).to.be.equal(0);
  expect(await vaultManager.price()).to.be.equal(0);
  var totalDividend = await USDT.balanceOf(vaultDividendTreasury);
  console.log("金库剩余派息金额:", totalDividend.toString());
  var investorBalance = await USDT.balanceOf(vaultDividendTreasury);
  for (let i = 0; i < whitelists.length; i++) {
    investorBalance = await USDT.balanceOf(whitelists[i]);
    incomeArr.push(investorBalance);
    totalDividend = totalDividend + investorBalance;
  }
  for (let i = 0; i < offchain_whitelistLength; i++) {
    investorBalance = await USDT.balanceOf(offchain_whitelists[i]);
    incomeArr.push(investorBalance);
    totalDividend = totalDividend + investorBalance;
  }
  console.log("总派息额", totalDividend);
  console.log(investArr);
  console.log(incomeArr);
  expect(totalDividend).to.equal(totalNav);
});


it("tc-95", async function () {
  var USDT: any;
  const {execute} = deployments;
  const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common,drds} = await getNamedAccounts();
  const RBFRouter = await deployments.get("RBFRouter");
  // 获取 RBFRouter 合约实例
  const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
  const rbfId = await rbfRouter.rbfNonce();
  const abiCoder = new ethers.AbiCoder();
  const deployData = abiCoder.encode(
    ["(uint64,string,string,address,address,address,address,address)"],
    [
      [rbfId,
      "RBF-95", "RBF-95",
      usdt.address,
      depositTreasury,
      deployer,
      manager,
      guardian,]
    ]
  );
  const deployDataHash = ethers.keccak256(deployData);
  const signer = await ethers.getSigner(rbfSigner);
  const signature = await signer.signMessage(ethers.getBytes(deployDataHash));
  const signer2 = await ethers.getSigner(rbfSigner2);
  const signature2 = await signer2.signMessage(ethers.getBytes(deployDataHash));
  const signatures = [signature,signature2];
  
  var res = await rbfRouter.deployRBF(deployData, signatures);
  var receipt = await res.wait();
  if (!receipt) throw new Error("Transaction failed");
  expect(receipt.status).to.equal(1);

  const whitelists = [investor1,investor2];
  const rbfData = await rbfRouter.getRBFInfo(rbfId);
  const rbf = rbfData.rbf;
  
  const VaultRouter = await deployments.get("VaultRouter");
  const vaultRouter = await hre.ethers.getContractAt(
          "VaultRouter",
          VaultRouter.address
        );
  const vaultId = await vaultRouter.vaultNonce();
  const subStartTime = Math.floor(Date.now() / 1000) 
  const subEndTime = subStartTime + 60;
  const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc95",
      symbol: "RbfVaultForTc95",
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "3000",
      minDepositAmount: "10000000",
      manageFee: "50",
      manager: manager,
      feeReceiver: feeReceiver,
      dividendEscrow: manager, // 添加这一行
      whitelists: [investor5],
      guardian: guardian,
      maxSupply: "10000000000",
      financePrice: "100000000",
  };
  var res = await vaultRouter.deployVault(vaultDeployData);
  var receipt = await res.wait();
  if (!receipt) throw new Error("Transaction failed");
  expect(receipt.status).to.equal(1);
  const vaultData = await vaultRouter.getVaultInfo(vaultId);
  const vault = vaultData.vault;

  const VAULT = await ethers.getContractAt("Vault", vault);
  const maxSupply = await VAULT.maxSupply();
  // const financePrice = await VAULT.financePrice();
  const minDepositAmount = await VAULT.minDepositAmount();
  const totalSupply = Number(maxSupply / BigInt(1e6));
  const minAmount = Number(minDepositAmount / BigInt(1e6));

  const managerSigner = await ethers.getSigner(manager);

  const vaultManager = await hre.ethers.getContractAt(
    "Vault",
    vault,
    managerSigner
  );
  await expect(vaultManager.addToOffChainWL(whitelists[0])).not.to.be.reverted;
  await expect(vaultManager.offChainDepositMint(whitelists[0],minDepositAmount - BigInt(1))).to.be.revertedWith("Vault: OffChain deposit less than min");

  await expect(vaultManager.addToOnChainWL(whitelists[1])).not.to.be.reverted;
  const investSigner = await ethers.getSigner(whitelists[1]);
  const vaultInvest = await hre.ethers.getContractAt(
    "Vault", // 替换为你的合约名称
    vault,
    investSigner
  );
  USDT = await ethers.getContractAt(
    "MockUSDT",
    usdt.address,
    investSigner
  );

  const distribution = distributeMoneyWithMinimum(
    totalSupply,
    2,
    minAmount
  );
  const investAmount = BigInt(Math.floor(distribution[0] * 1e6));
  const manageFee = await vaultInvest.manageFee();
  const feeAmount = (investAmount * BigInt(manageFee)) / BigInt(10000);
  const totalInvestAmount = investAmount + feeAmount;
  // investArr.push(totalInvestAmount);
  console.log(
    "investAmount:",
    investAmount.toString(),
    "feeAmount:",
    feeAmount.toString(),
    "totalInvestAmount:",
    totalInvestAmount.toString()
  );
    
  await expect(USDT.mint(whitelists[1], totalInvestAmount)).not.to.be.reverted;
  await expect(USDT.approve(vault, totalInvestAmount)).not.to.be.reverted;
  await expect(vaultInvest.deposit(investAmount)).not.to.be.reverted; 


  const off_investAmount = BigInt(Math.floor(distribution[1] * 1e6));
    // investArr.push(investAmount);
  await expect(vaultManager.offChainDepositMint(whitelists[0],off_investAmount + BigInt(100))).to.be.revertedWith("Vault: maxSupply exceeded");

  // Create a promise-based delay function
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  console.log("开始等待...");
  await delay(60000);
  await expect(vaultManager.offChainDepositMint(whitelists[0],maxSupply)).to.be.revertedWith("Vault: Invalid time");
  
});

it("tc-96", async function () {
  var USDT: any;
  const {execute} = deployments;
  const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common,drds} = await getNamedAccounts();
  const RBFRouter = await deployments.get("RBFRouter");
  // 获取 RBFRouter 合约实例
  const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
  const rbfId = await rbfRouter.rbfNonce();
  const abiCoder = new ethers.AbiCoder();
  const deployData = abiCoder.encode(
    ["(uint64,string,string,address,address,address,address,address)"],
    [
      [rbfId,
      "RBF-96", "RBF-96",
      usdt.address,
      depositTreasury,
      deployer,
      manager,
      guardian,]
    ]
  );
  const deployDataHash = ethers.keccak256(deployData);
  const signer = await ethers.getSigner(rbfSigner);
  const signature = await signer.signMessage(ethers.getBytes(deployDataHash));
  const signer2 = await ethers.getSigner(rbfSigner2);
  const signature2 = await signer2.signMessage(ethers.getBytes(deployDataHash));
  const signatures = [signature,signature2];
  
  var res = await rbfRouter.deployRBF(deployData, signatures);
  var receipt = await res.wait();
  if (!receipt) throw new Error("Transaction failed");
  expect(receipt.status).to.equal(1);

  const whitelists = [investor1,investor2];
  const rbfData = await rbfRouter.getRBFInfo(rbfId);
  const rbf = rbfData.rbf;
  
  const VaultRouter = await deployments.get("VaultRouter");
  const vaultRouter = await hre.ethers.getContractAt(
          "VaultRouter",
          VaultRouter.address
        );
  const vaultId = await vaultRouter.vaultNonce();
  const subStartTime = Math.floor(Date.now() / 1000) 
  const subEndTime = subStartTime + 60;
  const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc96",
      symbol: "RbfVaultForTc96",
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "3000",
      minDepositAmount: "10000000",
      manageFee: "50",
      manager: manager,
      feeReceiver: feeReceiver,
      dividendEscrow: manager, // 添加这一行
      whitelists: [investor5],
      guardian: guardian,
      maxSupply: "10000000000",
      financePrice: "100000000",
  };
  var res = await vaultRouter.deployVault(vaultDeployData);
  var receipt = await res.wait();
  if (!receipt) throw new Error("Transaction failed");
  expect(receipt.status).to.equal(1);
  const vaultData = await vaultRouter.getVaultInfo(vaultId);
  const vault = vaultData.vault;

  const VAULT = await ethers.getContractAt("Vault", vault);
  const maxSupply = await VAULT.maxSupply();
  const fundThreshold = await VAULT.fundThreshold();
  const target = maxSupply * fundThreshold / BigInt(10000);
  // const financePrice = await VAULT.financePrice();
  const minDepositAmount = await VAULT.minDepositAmount();
  const totalSupply = Number(target / BigInt(1e6));
  const minAmount = Number(minDepositAmount / BigInt(1e6));

  const managerSigner = await ethers.getSigner(manager);

  const vaultManager = await hre.ethers.getContractAt(
    "Vault",
    vault,
    managerSigner
  );
  await expect(vaultManager.addToOffChainWL(whitelists[0])).not.to.be.reverted;
  await expect(vaultManager.offChainDepositMint(whitelists[0],minDepositAmount - BigInt(1))).to.be.revertedWith("Vault: OffChain deposit less than min");

  await expect(vaultManager.addToOnChainWL(whitelists[1])).not.to.be.reverted;
  const investSigner = await ethers.getSigner(whitelists[1]);
  const vaultInvest = await hre.ethers.getContractAt(
    "Vault", // 替换为你的合约名称
    vault,
    investSigner
  );
  USDT = await ethers.getContractAt(
    "MockUSDT",
    usdt.address,
    investSigner
  );

  const distribution = distributeMoneyWithMinimum(
    totalSupply - 100,
    2,
    minAmount
  );
  const investAmount = BigInt(Math.floor(distribution[0] * 1e6));
  const manageFee = await vaultInvest.manageFee();
  const feeAmount = (investAmount * BigInt(manageFee)) / BigInt(10000);
  const totalInvestAmount = investAmount + feeAmount;
  // investArr.push(totalInvestAmount);
  console.log(
    "investAmount:",
    investAmount.toString(),
    "feeAmount:",
    feeAmount.toString(),
    "totalInvestAmount:",
    totalInvestAmount.toString()
  );
    
  await expect(USDT.mint(whitelists[1], totalInvestAmount)).not.to.be.reverted;
  await expect(USDT.approve(vault, totalInvestAmount)).not.to.be.reverted;
  await expect(vaultInvest.deposit(investAmount)).not.to.be.reverted; 


  const off_investAmount = BigInt(Math.floor(distribution[1] * 1e6));
  console.log("off_investAmount:",off_investAmount.toString());
    // investArr.push(investAmount);
  await expect(vaultManager.offChainDepositMint(whitelists[0],off_investAmount)).not.to.be.reverted;

  const offlineInvestorSigners = await ethers.getSigner(whitelists[0]);
  await expect(VAULT.connect(offlineInvestorSigners).offChainRedeem()).to.be.revertedWith("Vault: Invalid time");
  await expect(VAULT.connect(investSigner).offChainRedeem()).to.be.revertedWith("Vault: you are not in offChainWL");



  // Create a promise-based delay function
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  console.log("开始等待...");
  await delay(60000);

  //线上线下白名单账户转账
  const inverstorSigners = await ethers.getSigner(whitelists[0]);
  const balance = await vaultInvest.balanceOf(whitelists[0]);
  await expect(VAULT.connect(inverstorSigners).transfer(whitelists[1],balance)).to.be.revertedWith("Vault: Invalid endTime");


  await expect(VAULT.connect(offlineInvestorSigners).offChainRedeem()).to.be.revertedWith("ERC20: insufficient allowance");
  await VAULT.connect(offlineInvestorSigners).approve(vault, off_investAmount);
  await expect(VAULT.connect(investSigner).offChainRedeem()).to.be.revertedWith("Vault: you are not in offChainWL");
  await expect(VAULT.connect(offlineInvestorSigners).offChainRedeem()).not.to.be.reverted;

  await VAULT.connect(investSigner).approve(vault, totalInvestAmount);
  await expect(VAULT.connect(investSigner).redeem()).not.to.be.reverted;

  const redeemBalance_0 = await USDT.balanceOf(whitelists[1]);
  console.log(whitelists[0]+":redeem",redeemBalance_0.toString());
  expect(redeemBalance_0).to.equal(totalInvestAmount);
 
});

//线上线下混合认购及派息
it.only("tc-97", async function () {
  const {execute} = deployments;
  const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common,drds} = await getNamedAccounts();
  const RBFRouter = await deployments.get("RBFRouter");
  // 获取 RBFRouter 合约实例
  const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
  const rbfId = await rbfRouter.rbfNonce();
  const abiCoder = new ethers.AbiCoder();
  const deployData = abiCoder.encode(
    ["(uint64,string,string,address,address,address,address,address)"],
    [
      [rbfId,
      "RBF-97", "RBF-97",
      usdt.address,
      depositTreasury,
      deployer,
      manager,
      guardian,]
    ]
  );
  const deployDataHash = ethers.keccak256(deployData);
  const signer = await ethers.getSigner(rbfSigner);
  const signature = await signer.signMessage(ethers.getBytes(deployDataHash));
  const signer2 = await ethers.getSigner(rbfSigner2);
  const signature2 = await signer2.signMessage(ethers.getBytes(deployDataHash));
  const signatures = [signature,signature2];
  
  var res = await rbfRouter.deployRBF(deployData, signatures);
  var receipt = await res.wait();
  if (!receipt) throw new Error("Transaction failed");
  expect(receipt.status).to.equal(1);

  const whitelists = [investor1, investor2, investor3, investor4];
  const rbfData = await rbfRouter.getRBFInfo(rbfId);
  const rbf = rbfData.rbf;
  
  const VaultRouter = await deployments.get("VaultRouter");
  const vaultRouter = await hre.ethers.getContractAt(
          "VaultRouter",
          VaultRouter.address
        );
  const vaultId = await vaultRouter.vaultNonce();
  const subStartTime = Math.floor(Date.now() / 1000) 
  const subEndTime = subStartTime + 60;
  const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc90",
      symbol: "RbfVaultForTc90",
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "3000",
      minDepositAmount: "10000000",
      manageFee: "50",
      manager: manager,
      feeReceiver: feeReceiver,
      dividendEscrow: manager, // 添加这一行
      whitelists: [investor5],
      guardian: guardian,
      maxSupply: "10000000000",
      financePrice: "100000000",
  };
  var res = await vaultRouter.deployVault(vaultDeployData);
  var receipt = await res.wait();
  if (!receipt) throw new Error("Transaction failed");
  expect(receipt.status).to.equal(1);
  const vaultData = await vaultRouter.getVaultInfo(vaultId);
  const vault = vaultData.vault;

  const VAULT = await ethers.getContractAt("Vault", vault);
  const maxSupply = await VAULT.maxSupply();
  const financePrice = await VAULT.financePrice();
  const minDepositAmount = await VAULT.minDepositAmount();
  const totalSupply = Number(maxSupply / BigInt(1e6));
  const minAmount = Number(minDepositAmount / BigInt(1e6));

  const distribution = distributeMoneyWithMinimum(
    totalSupply,
    whitelists.length,
    minAmount
  );
  var vaultInvest: any;
  var USDT: any;

 
  const managerSigner = await ethers.getSigner(manager);
  const vaultManager = await hre.ethers.getContractAt(
    "Vault",
    vault,
    managerSigner
  );
  const rbfManager = await hre.ethers.getContractAt(
    "RBF",
    rbf,
    managerSigner
  );
  let investArr = new Array();
  let incomeArr = new Array();
  const priceFeed = rbfData.priceFeed;
  const priceFeedManager = await hre.ethers.getContractAt(
    "PriceFeed",
    priceFeed,
    managerSigner
  );
  const deployerSigner = await ethers.getSigner(deployer);
  USDT = await ethers.getContractAt(
    "MockUSDT",
    usdt.address,
    deployerSigner
  );

  expect(
    await priceFeedManager.grantRole(
      ethers.keccak256(ethers.toUtf8Bytes("FEEDER_ROLE")),
      drds
    )
  ).not.to.be.reverted;
  const commonSigner = await ethers.getSigner(common);
  var expectedErrorMessage = `AccessControl: account ${common.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
  await expect(VAULT.connect(commonSigner).addToOffChainWL(whitelists[0])).to.be.revertedWith(expectedErrorMessage);
  await expect(VAULT.connect(commonSigner).addToOnChainWL(whitelists[1])).to.be.revertedWith(expectedErrorMessage);

  for (let i = 0; i < whitelists.length; i++) {
    const investSigner = await ethers.getSigner(whitelists[i]);
    vaultInvest = await hre.ethers.getContractAt(
      "Vault",
      vault,
      investSigner
    );
    const investAmount = BigInt(Math.floor(distribution[i] * 1e6));
    investArr.push(investAmount);
    await expect(vaultManager.addToOffChainWL(whitelists[i])).not.to.be.reverted;
    await expect(vaultManager.offChainDepositMint(whitelists[i],investAmount)).not.to.be.reverted;
    const balance = await vaultInvest.balanceOf(whitelists[i]);
    expect(balance).to.equal(investAmount);
  }
  // expect(await VAULT.assetBalance()).to.equal(onChainInvest);
  console.log("total deposit balance", await VAULT.assetBalance());
  console.log("total manageFee Balance", await VAULT.manageFeeBalance());
  // console.log("total Balance", await USDT.balanceOf(vault));

  // Create a promise-based delay function
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  console.log("开始等待...");
  await delay(60000);
  console.log("等待结束");

  const inverstorSigners = await ethers.getSigner(whitelists[0]);
  const balance = await vaultInvest.balanceOf(whitelists[0]);
  await expect(rbfManager.setVault(vault)).not.to.be.reverted;
  await expect(vaultManager.execStrategy()).not.to.be.reverted;
  await expect(VAULT.connect(inverstorSigners).transfer(whitelists[1],balance)).not.to.be.reverted;

  // expect(await USDT.balanceOf(depositTreasury)).to.be.equal(onChainInvest);
  // expect(await rbfManager.depositAmount()).to.be.equal(onChainInvest);
  await expect(
    rbfManager.grantRole(
      ethers.keccak256(ethers.toUtf8Bytes("MINT_AMOUNT_SETTER_ROLE")),
      drds
    )
  ).not.to.be.reverted;

  const drdsSigner = await ethers.getSigner(drds);
  const rbfDrds = await hre.ethers.getContractAt("RBF", rbf, drdsSigner);
  const priceFeedDrds = await hre.ethers.getContractAt(
    "PriceFeed",
    priceFeed,
    drdsSigner
  );

  await expect(rbfDrds.setMintAmount(maxSupply)).not.to.be.reverted;
  await expect(
    priceFeedDrds.addPrice(financePrice, Math.floor(Date.now() / 1000))
  ).not.to.be.reverted;
  expect(await rbfDrds.depositMintAmount()).to.be.equal(maxSupply);

  expect(await rbfManager.balanceOf(vault)).to.be.equal(0);
  await expect(rbfManager.claimDeposit()).not.to.be.reverted;
  expect(await rbfManager.balanceOf(vault)).to.be.equal(maxSupply);
  console.log("rbf总净值:", await rbfManager.getAssetsNav());
  console.log("vault价值:", await vaultManager.price());
  expect(await rbfManager.getAssetsNav()).to.be.equal(
    (BigInt(maxSupply) * BigInt(financePrice)) / BigInt(1e6)
  );
  expect(await vaultManager.price()).to.be.equal(financePrice);

  const randomMultiplier = 1.1 + Math.random() * 0.4;
  console.log("派息系数:", randomMultiplier);
  const principalInterest = Math.floor(totalSupply * randomMultiplier);
  const waitMint = BigInt(Math.floor(principalInterest - totalSupply) * 1e6);
  await expect(USDT.mint(depositTreasury, maxSupply+waitMint)).not.to.be.reverted;
  const dividendCount = 4;
  const dividendCountArr = distributeMoneyWithMinimum(
    principalInterest,
    dividendCount,
    1
  );
  const totalNav = await USDT.balanceOf(depositTreasury);
  console.log("总派息资产:", totalNav.toString());

  const depositTreasurySigner = await ethers.getSigner(depositTreasury);
  const USDTdepositTreasury = await ethers.getContractAt(
    "MockUSDT",
    usdt.address,
    depositTreasurySigner
  );
  const rbfDividendTreasury = await rbfManager.dividendTreasury();
  const vaultDividendTreasury = await vaultManager.dividendTreasury();
  for (let i = 0; i < dividendCountArr.length; i++) {
    const dividendAmount = BigInt(Math.floor(dividendCountArr[i] * 1e6));
    console.log("第" + (i + 1) + "次派息:", dividendAmount);
    await expect(
      USDTdepositTreasury.transfer(rbfDividendTreasury, dividendAmount)
    ).not.to.be.reverted;
    await expect(rbfManager.dividend()).not.to.be.reverted;
    await expect(vaultManager.dividend()).not.to.be.reverted;
  }
  await expect(priceFeedDrds.addPrice(0, Math.floor(Date.now() / 1000))).not
    .to.be.reverted;
  console.log("rbf总净值:", await rbfManager.getAssetsNav());
  console.log("vault价值:", await vaultManager.price());
  expect(await rbfManager.getAssetsNav()).to.be.equal(0);
  expect(await vaultManager.price()).to.be.equal(0);
  var totalDividend = await USDT.balanceOf(vaultDividendTreasury);
  console.log("金库剩余派息金额:", totalDividend.toString());
  var investorBalance = await USDT.balanceOf(vaultDividendTreasury);
  for (let i = 0; i < whitelists.length; i++) {
    investorBalance = await USDT.balanceOf(whitelists[i]);
    incomeArr.push(investorBalance);
    totalDividend = totalDividend + investorBalance;
  }
  console.log("总派息额", totalDividend);
  console.log(investArr);
  console.log(incomeArr);
  expect(totalDividend).to.equal(totalNav);
  expect(incomeArr[0]).to.equal(BigInt(0)); 
});



  function distributeMoneyWithMinimum(
    total: number,
    people: number,
    minAmount: number
  ): number[] {
    if (total < people * minAmount) {
      throw new Error("can not reach minimum amount");
    }

    const result: number[] = new Array(people).fill(minAmount);
    let remaining = total - people * minAmount;

    for (let i = 0; i < people - 1; i++) {
      const max = remaining - (people - i - 1);
      const amount = Math.floor(Math.random() * (max + 1));
      result[i] += amount;
      remaining -= amount;
    }

    result[people - 1] += remaining;
    return result;
  }
  function generateWallets(count: number) {
    const wallets = [];
    for (let i = 0; i < count; i++) {
      const wallet = ethers.Wallet.createRandom();
      wallets.push(wallet);
    }
    return wallets;
  }
});

