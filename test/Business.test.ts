import hre, { ethers } from "hardhat";
import { expect } from "chai";
import path from "path";
import { deployFactories } from '../utils/deployFactoriesAndRouter';
import { factoryAuth } from '../utils/factoryAuth';
import { execSync } from "child_process";
import { getAccount } from "../utils/account";
import { isPromise } from "util/types";
describe("RWA:", function () {
  this.timeout(600000);
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  // 在describe块顶部声明所有共享变量
  let whitelists: any;
  let EscrowFactory: any;
  let PriceFeedFactory: any;
  let RBFFactory: any;
  let RBFRouter: any;
  let usdt: any;
  let rbfRouter: any;
  let vaultRouter: any;
  var VaultDecimals = 18;
  var rbfDecimals = VaultDecimals;
  var decimalUsdt: any;
  // let investArr: any[] = [];
  // let incomeArr: any[] = [];

  // 创建一个共享的延迟函数
  const delay = async (ms: number, message?: string) => {
    if (message) console.log(`开始等待${message}...`);
    await new Promise(resolve => setTimeout(resolve, ms));
    if (message) console.log(`等待${message}结束`);
  };

  // // 确保测试用例串行执行
  // this.beforeEach(function() {
  //   return new Promise(resolve => setTimeout(resolve, 1000));
  // });

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
    decimalUsdt = await getDecimalUSDT(usdt.address);
    rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    
    // 初始化其他共享变量
    const VaultRouter = await deployments.get("VaultRouter");
    vaultRouter = await hre.ethers.getContractAt("VaultRouter", VaultRouter.address);
  });

  // 创建一个辅助函数来获取decimalUSDT
  async function getDecimalUSDT(usdt: any) {
    const USDT = await ethers.getContractAt("MockUSDT", usdt);
  return 10n ** BigInt(await USDT.decimals());
  }

  //depositAmount为0，执行claimDeposit，执行失败;No dividend to pay
  it("tc-45", async function () {
  const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,rbfSigner2,drds} = await getNamedAccounts();
  const RBFRouter = await deployments.get("RBFRouter");
  // 获取 RBFRouter 合约实例
  const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
  const rbfId = await rbfRouter.rbfNonce();
  const abiCoder = new ethers.AbiCoder();
  const deployData = abiCoder.encode(
    ["(uint64,string,string,uint8,address,address,address,address,address)"],
    [
      [rbfId,
      "RBF-45", "RBF-45",
      rbfDecimals,
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

  const whitelists = [investor1];
  const rbfData = await rbfRouter.getRBFInfo(rbfId);
  const rbf = rbfData.rbf;
  
  const VaultRouter = await deployments.get("VaultRouter");
  const vaultRouter = await hre.ethers.getContractAt(
    "VaultRouter",
    VaultRouter.address
  );
  const vaultId = await vaultRouter.vaultNonce();
  const subStartTime = Math.floor(Date.now() / 1000) 
  const subEndTime = subStartTime + 3600;
  const minDepositAmount = 10n * decimalUsdt;
  const maxSupply =  10000n * (10n ** BigInt(VaultDecimals));
  const vaultDeployData = {
    vaultId: vaultId,
    name: "RbfVaultForTc45",
    symbol: "RbfVaultForTc45",
    decimals:VaultDecimals,
    assetToken: usdt.address,
    rbf: rbfData.rbf,
    subStartTime: subStartTime,
    subEndTime: subEndTime,
    duration: "2592000",
    fundThreshold: "3000",
    minDepositAmount: minDepositAmount,
    manageFee: "50",
    manager: manager,
    feeReceiver: feeReceiver,
    dividendEscrow: manager, // 添加这一行
    whitelists: whitelists,
    isOpen: false,
    guardian: guardian,
    maxSupply: maxSupply,
    financePrice: "100000000",
  };
  var res = await vaultRouter.deployVault(vaultDeployData);
  var receipt = await res.wait();
  if (!receipt) throw new Error("Transaction failed");
  expect(receipt.status).to.equal(1);
  const vaultData = await vaultRouter.getVaultInfo(vaultId);
  const vault = vaultData.vault;
  const VAULT = await ethers.getContractAt("Vault", vault);
  const managerSigner = await ethers.getSigner(manager);
  const vaultManager=await hre.ethers.getContractAt(
    "Vault", // 替换为你的合约名称
    vault,
    managerSigner
  )
  const rbfManager = await hre.ethers.getContractAt(
    "RBF", // 替换为你的合约名称
    rbf,
    managerSigner
  )
  
  await expect(rbfManager.dividend()).to.be.revertedWith("RBF: totalDividend must be greater than 0");
  //此时查询vault的assetBalance为0
  expect(await VAULT.assetBalance()).to.equal(BigInt(0));
  // Create a promise-based delay function
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  expect(await VAULT.assetBalance()).to.equal(BigInt(0));
  
  //是MANAGER_ROLE角色的账户执行claimDeposit，depositAmount为0，执行claimDeposit，执行失败
  await expect(rbfManager.claimDeposit()).to.be.revertedWith("RBF: depositAmount must be greater than 0");
  
  //No dividend to pay
  await expect(vaultManager.dividend()).to.be.revertedWith("Vault: No dividend to pay");  

  const drdsSigner = await ethers.getSigner(drds);
  const rbfDrds =await hre.ethers.getContractAt(
    "RBF", 
    rbf,
    drdsSigner
  )

  await expect(rbfManager.grantRole(ethers.keccak256(ethers.toUtf8Bytes("MINT_AMOUNT_SETTER_ROLE")),drds)).not.to.be.reverted;
  
  //depositAmount为0的情况下，执行setMintAmount，执行失败
  await expect(rbfDrds.setMintAmount(0)).to.be.revertedWith("RBF: depositAmount must be greater than 0");
  });

   // 创建一个辅助函数来获取decimalFactor
   async function getDecimalFactor(vaultContract: any) {
    const decimals = await vaultContract.decimals();
    return BigInt(10) ** BigInt(decimals);
  }

  it("tc-46", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common,drds} = await getNamedAccounts();

    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-46", "RBF-46",
        rbfDecimals,
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
    
    // 使用deployerAccount的地址作为signer来调用合约
    var res = await rbfRouter.deployRBF(deployData, signatures);
    var receipt = await res.wait();
    if (!receipt) throw new Error("Transaction failed");
    expect(receipt.status).to.equal(1);

    const whitelists = [investor1, investor2, investor3, investor4, investor5];
    const rbfData = await rbfRouter.getRBFInfo(rbfId);
    const rbf = rbfData.rbf;
    
    const VaultRouter = await deployments.get("VaultRouter");
    const vaultRouter = await hre.ethers.getContractAt(
      "VaultRouter",
      VaultRouter.address
    );
    const vaultId = await vaultRouter.vaultNonce();
    const subStartTime = Math.floor(Date.now() / 1000) 
    const subEndTime = subStartTime + 3600;
    const minDepositAmountInput = 10n * decimalUsdt;
    const maxSupplyInput =  10000n * (10n ** BigInt(VaultDecimals));
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc46",
      symbol: "RbfVaultForTc46",
      decimals:VaultDecimals,
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "3000",
      minDepositAmount: minDepositAmountInput,
      manageFee: "50",
      manager: manager,
      feeReceiver: feeReceiver,
      dividendEscrow: manager, // 添加这一行
      whitelists: whitelists,
      isOpen: false,
      guardian: guardian,
      maxSupply: maxSupplyInput,
      financePrice: "100000000",
    };
    var res = await vaultRouter.deployVault(vaultDeployData);
    var receipt = await res.wait();
    if (!receipt) throw new Error("Transaction failed");
    expect(receipt.status).to.equal(1);
    const vaultData = await vaultRouter.getVaultInfo(vaultId);
    const vault = vaultData.vault;
    const VAULT = await ethers.getContractAt("Vault", vault);
    const decimalFactor = await getDecimalFactor(VAULT); 
    
    const maxSupply = await VAULT.maxSupply();
    const financePrice=await VAULT.financePrice();
    const minDepositAmount = await VAULT.minDepositAmount();
    const totalSupply = Number(maxSupply / decimalFactor);
    const minAmount = Number(minDepositAmount / decimalUsdt);
    
    var USDT:any;
    const commonSigner = await ethers.getSigner(common);
    const managerSigner = await ethers.getSigner(manager);
    const vaultManager=await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      managerSigner
    )
    
    const commonAccount = await hre.ethers.getContractAt(
      "RBF", // 替换为你的合约名称
      rbf,
      commonSigner
    )
    const rbfManager = await hre.ethers.getContractAt(
      "RBF", // 替换为你的合约名称
      rbf,
      managerSigner
    )

    //此时查询vault的assetBalance为0
    expect(await VAULT.assetBalance()).to.equal(BigInt(0));
    let investArr= new Array();
    let incomeArr = new Array();

    const whitelistLength = await whitelists.length;
    const distribution = distributeMoneyWithMinimum(
      totalSupply,
      whitelistLength,
      minAmount
    );

    console.log("distribution.length",distribution.length)
    expect(distribution.length).to.equal(whitelistLength);
    USDT = await ethers.getContractAt(
      "MockUSDT",
      usdt.address
    );
    var investorBalance_before_all= BigInt(0);
    for (let i = 0; i < whitelists.length; i++) {
      const investSigner = await ethers.getSigner(whitelists[i]);
      var investorBalance_before=await USDT.connect(investSigner).balanceOf(whitelists[i]);
      investorBalance_before_all = investorBalance_before_all + investorBalance_before;
    }
    const depositTreasuryBalance = await USDT.balanceOf(depositTreasury);

    //提前认购maxSupply 100%
    for (let i = 0; i < whitelistLength; i++) {
      const investSigner = await ethers.getSigner(whitelists[i]);
      const vaultInvest = await hre.ethers.getContractAt(
        "Vault", // 替换为你的合约名称
        vault,
        investSigner
      )
      const manageFee=await vaultInvest.manageFee();
      const investAmount = BigInt(Math.floor(distribution[i])) * decimalUsdt;
      const feeAmount = investAmount * BigInt(manageFee) / BigInt(10000);
      const totalInvestAmount = investAmount + feeAmount;
      investArr.push(totalInvestAmount)
      console.log("investAmount:",investAmount.toString(),"feeAmount:",feeAmount.toString(),"totalInvestAmount:",totalInvestAmount.toString())
      await expect(USDT.connect(investSigner).mint(whitelists[i], totalInvestAmount)).not.to.be.reverted;
      await expect(USDT.connect(investSigner).approve(vault, totalInvestAmount)).not.to.be.reverted;
      await expect(vaultInvest.deposit(investAmount)).not.to.be.reverted;
      expect((await vaultInvest.balanceOf(whitelists[i])) / decimalFactor).to.equal(investAmount / decimalUsdt);
    }
    expect((await VAULT.assetBalance()) / decimalUsdt).to.equal(maxSupply / decimalFactor) 
    console.log("total deposit balance",await VAULT.assetBalance())
    console.log("total manageFee Balance",await VAULT.manageFeeBalance())
    console.log("total Balance",await USDT.balanceOf(vault))
    var expectedErrorMessage = `AccessControl: account ${deployer.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
    console.log("expectedErrorMessage",expectedErrorMessage)

    //执行赎回:已经提前完成融资，在认购截止时间前白名单账户执行赎回，赎回失败
    const investSigner = await ethers.getSigner(whitelists[0]);
    const vaultInvest = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      investSigner
    )
    await expect(vaultInvest.redeem()).to.be.revertedWith("Vault: Invalid time");

    //不是MANAGER_ROLE角色的账户执行策略
    await expect(
      VAULT.execStrategy()
    ).to.be.revertedWith(expectedErrorMessage);
    //是MANAGER_ROLE角色的账户但不是vault的ownner执行策略
    await expect(
      vaultManager.execStrategy()
    ).to.be.revertedWith("RBF: you are not vault"); //不是Vault执行requestDeposit
    //不是MANAGER_ROLE角色的账户执行setVault
    expectedErrorMessage = `AccessControl: account ${common.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
    console.log("commonAccount",common.toLowerCase())
    console.log("expectedErrorMessage",expectedErrorMessage)
    await expect(commonAccount.setVault(vault)).to.be.revertedWith(expectedErrorMessage);
    //setVault时，Vault地址为零地址
    await expect(rbfManager.setVault(ethers.ZeroAddress)).to.be.revertedWith("RBF: vaultAddr cannot be zero address");
    //是MANAGER_ROLE角色的账户执行setVault
    await expect(rbfManager.setVault(vault)).not.to.be.reverted;

    //对已经setVault的地址继续执行setVault
    await expect(rbfManager.setVault(vault)).to.be.revertedWith("RBF: vaultAddr already set");
    //setVault之后执行策略，既是MANAGER_ROLE又是vault，然后执行策略
    await expect(vaultManager.execStrategy()).not.to.be.reverted;

    //再次执行策略，执行失败
    await expect(vaultManager.execStrategy()).to.be.revertedWith("Vault: assetBalance is zero");

    //不是PRICE_MINT_AMOUNT_SETTER_ROLE角色的账户执行setDepositPirceAndMintAmount，执行失败
    expectedErrorMessage = `AccessControl: account ${manager.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MINT_AMOUNT_SETTER_ROLE"))}`;
    await expect(rbfManager.setMintAmount(maxSupply)).to.be.revertedWith(expectedErrorMessage);

    const rbfDeployer = await hre.ethers.getContractAt(
      "RBF", // 替换为你的合约名称
      rbf
    )
    //不是MANAGER_ROLE角色的账户执行grantRole，执行失败
    expectedErrorMessage = `AccessControl: account ${deployer.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
    await expect(rbfDeployer.grantRole(ethers.keccak256(ethers.toUtf8Bytes("MINT_AMOUNT_SETTER_ROLE")),manager)).to.be.revertedWith(expectedErrorMessage);
    //是MANAGER_ROLE角色的账户执行grantRole，执行成功
    await expect(rbfManager.grantRole(ethers.keccak256(ethers.toUtf8Bytes("MINT_AMOUNT_SETTER_ROLE")),drds)).not.to.be.reverted;

    //是PRICE_MINT_AMOUNT_SETTER_ROLE角色的账户执行setMintAmount，执行成功
    const drdsSigner = await ethers.getSigner(drds);
    const rbfDrds =await hre.ethers.getContractAt(
      "RBF", 
      rbf,
      drdsSigner
    )

    const vaultDrds=await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      drdsSigner
    )

    //depositMintAmount为0，执行claimDeposit，执行失败
    await expect(rbfDrds.setMintAmount(BigInt(0))).not.to.be.reverted;
    await expect(rbfManager.claimDeposit()).to.be.revertedWith("RBF: depositMintAmount must be greater than 0");
    
    //depositMintAmount和depositPrice不为0，执行claimDeposit，执行成功
    await expect(rbfDrds.setMintAmount(maxSupply)).not.to.be.reverted;

    const priceFeed = rbfData.priceFeed;
    const manager_Signer = await ethers.getSigner(manager);

    const PriceFeed = await hre.ethers.getContractAt(
      "PriceFeed",
      priceFeed,
    );

    await expect(PriceFeed.connect(manager_Signer).grantRole(ethers.keccak256(ethers.toUtf8Bytes("FEEDER_ROLE")),drds)).not.to.be.reverted;

    await expect(
      PriceFeed.connect(drdsSigner).addPrice(financePrice, Math.floor(Date.now() / 1000))
    ).not.to.be.reverted;

    expect(await rbfDrds.depositMintAmount()).to.be.equal(maxSupply);

    //此时查询RBF的金额为0
    expect(await rbfManager.balanceOf(vault)).to.be.equal(0);
    expectedErrorMessage = `AccessControl: account ${drds.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
    //不是MANAGER_ROLE角色的账户执行claimDeposit，执行失败
    await expect(rbfDrds.claimDeposit()).to.be.revertedWith(expectedErrorMessage);
    //是MANAGER_ROLE角色的账户执行claimDeposit，执行成功
    await expect(rbfManager.claimDeposit()).not.to.be.reverted;
    expect(await rbfManager.balanceOf(vault)).to.be.equal(maxSupply);
    //不是MANAGER_ROLE角色的账户执行dividend，执行失败
    await expect(rbfDrds.dividend()).to.be.revertedWith(expectedErrorMessage);
    //totalDividend为0，执行dividend，执行失败
    await expect(
      rbfManager.dividend()
    ).to.be.revertedWith("RBF: totalDividend must be greater than 0");

    //派息
    const randomMultiplier = 1.1 + Math.random() * 0.4;
    console.log("派息系数:",randomMultiplier)
    const principalInterest = Math.floor(totalSupply * randomMultiplier);
    const waitMint = BigInt(Math.floor(principalInterest - totalSupply)) * decimalUsdt;
    await expect(USDT.mint(depositTreasury, waitMint)).not.to.be.reverted;
    const dividendCountArr = distributeMoneyWithMinimum(
      principalInterest,
      2,
      1
    );
    console.log("depositTreasuryBalance",depositTreasuryBalance);
    console.log("await USDT.balanceOf(depositTreasury)",await USDT.balanceOf(depositTreasury));
    const totalNav= await USDT.balanceOf(depositTreasury) - depositTreasuryBalance;
    console.log("总派息资产:",totalNav.toString())

    const depositTreasurySigner = await ethers.getSigner(depositTreasury);
    const USDTdepositTreasury = await ethers.getContractAt(
      "MockUSDT",
      usdt.address,
      depositTreasurySigner
    );
    const rbfDividendTreasury = await rbfManager.dividendTreasury();
    const vaultDividendTreasury = await vaultManager.dividendTreasury();
    for (let i = 0; i < dividendCountArr.length; i++) {
      const dividendAmount = BigInt(Math.floor(dividendCountArr[i])) * decimalUsdt;
      console.log("第" + (i + 1) + "次派息:", dividendAmount);
      await expect(USDTdepositTreasury.transfer(rbfDividendTreasury, dividendAmount)).not.to.be.reverted;
      await expect(rbfManager.dividend()).not.to.be.reverted;

      //不是MANAGER_ROLE角色的账户执行dividend，执行失败
      await expect(vaultDrds.dividend()).to.be.revertedWith(expectedErrorMessage);
      
      //是MANAGER_ROLE角色的账户执行dividend，执行成功
      await expect(vaultManager.dividend()).not.to.be.reverted;
    }

    var totalDividend =await USDT.balanceOf(
      vaultDividendTreasury
    );;
    console.log("金库剩余派息金额:",totalDividend.toString());
    var investorBalance= 0;
    for (let i = 0; i < whitelists.length; i++) {
      investorBalance=await USDT.balanceOf(whitelists[i]);
      incomeArr.push(investorBalance);
      totalDividend=totalDividend + investorBalance;
    }
    console.log("总派息额",totalDividend - investorBalance_before_all)
    console.log(investArr)
    console.log(incomeArr)
    console.log("totalDividend - investorBalance_before_all",totalDividend - investorBalance_before_all)
    expect(totalDividend - investorBalance_before_all).to.equal(totalNav);

    //提前融资完成，在设置的结束认购时间前提取手续费，提取失败
    await expect(vaultManager.withdrawManageFee()).to.be.revertedWith("Vault: Invalid time");
  });

  //极限测试：100个线上认购，并给100个人派息
  it("tc-47", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,rbfSigner2,drds} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-47", "RBF-47",
        rbfDecimals,
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

    
    const rbfData = await rbfRouter.getRBFInfo(rbfId);
    const rbf = rbfData.rbf;
    const VaultRouter = await deployments.get("VaultRouter");
    const vaultRouter = await hre.ethers.getContractAt(
      "VaultRouter",
      VaultRouter.address
    );
    const vaultId = await vaultRouter.vaultNonce();
    const subStartTime = Math.floor(Date.now() / 1000) 
    const subEndTime = subStartTime + 3600;
   
    // 获取测试账户
    const [...signers] = await ethers.getSigners();

    // 生成100个有效的测试地址
    const investors = signers.slice(0, 99);  
    const whitelists = investors.map(investor => investor.address);

    const minDepositAmountInput = 10n * decimalUsdt;
    const maxSupplyInput =  10000n * (10n ** BigInt(VaultDecimals));
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc47",
      symbol: "RbfVaultForTc47",
      decimals: VaultDecimals,
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "3000",
      minDepositAmount: minDepositAmountInput,
      manageFee: "3000",
      manager: manager,
      feeReceiver: feeReceiver,
      dividendEscrow: manager, // 添加这一行
      whitelists: whitelists,
      isOpen: false,
      guardian: guardian,
      maxSupply: maxSupplyInput,
      financePrice: "100000000",
    };
    console.log("whitelists length:",whitelists.length);
    var res = await vaultRouter.deployVault(vaultDeployData);
    var receipt = await res.wait();
    if (!receipt) throw new Error("Transaction failed");
    expect(receipt.status).to.equal(1);

    

    const vaultData = await vaultRouter.getVaultInfo(vaultId);
    const vault = vaultData.vault;
    const VAULT = await ethers.getContractAt("Vault", vault);
    const decimalFactor = await getDecimalFactor(VAULT);
      
    const maxSupply = await VAULT.maxSupply();
    const financePrice=await VAULT.financePrice();
    const minDepositAmount = await VAULT.minDepositAmount();
    const totalSupply = Number(maxSupply / decimalFactor);
    const minAmount = Number(minDepositAmount / decimalUsdt);

    var USDT:any;
    USDT = await ethers.getContractAt(
      "MockUSDT",
      usdt.address
    );
    const managerSigner = await ethers.getSigner(manager);
    const vaultManager=await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      managerSigner
    )
    const accounts = await ethers.getSigners(); 
    const account100 = accounts[99]; 
    const address_100 = account100.address;
    await expect(vaultManager.addToOnChainWL(address_100)).not.to.be.reverted;
    expect(await VAULT.onChainWLMap(address_100)).to.be.equals(true);
    const account101 = accounts[100]; 

    //添加白名单账户超过100个，添加失败
    const address = account101.address;
    await expect(vaultManager.addToOnChainWL(address)).to.be.revertedWith("Vault: Whitelist is full");
    expect(await VAULT.onChainWLMap(address)).to.be.equals(false);

    const rbfManager = await hre.ethers.getContractAt(
      "RBF", // 替换为你的合约名称
      rbf,
      managerSigner
    )
    let investArr= new Array();
    let incomeArr = new Array();

    const whitelistLength = await VAULT.getOnChainWLLen();
    console.log("whitelistLength:",whitelistLength)
    const distribution = distributeMoneyWithMinimum(
      totalSupply,
      Number(whitelistLength),
      minAmount
    );
    console.log("distribution:",distribution)
    const vaultWhiteLists = await VAULT.onChainWL;

    const depositTreasuryBalance = await USDT.balanceOf(depositTreasury);

    var investorBalance_before_all= BigInt(0);
    for (let i = 0; i < whitelistLength; i++) {
      const whitelistAddr = await vaultWhiteLists(i);
      const investSigner = await ethers.getSigner(whitelistAddr);
      var investorBalance_before=await USDT.connect(investSigner).balanceOf(whitelistAddr);
      investorBalance_before_all = investorBalance_before_all + investorBalance_before;
    }
    
    for (let i = 0; i < whitelistLength; i++) {
      console.log(i)
      const whitelistAddr = await vaultWhiteLists(i);
      const investSigner = await ethers.getSigner(whitelistAddr);
      const vaultInvest = await hre.ethers.getContractAt(
        "Vault", // 替换为你的合约名称
        vault,
        investSigner
      )
      const manageFee=await vaultInvest.manageFee();
      const investAmount = BigInt(Math.floor(distribution[i])) * decimalUsdt;
      const feeAmount = investAmount * BigInt(manageFee) / BigInt(10000);
      const totalInvestAmount = investAmount + feeAmount;
      investArr.push(totalInvestAmount)
      console.log("investAmount:",investAmount.toString(),"feeAmount:",feeAmount.toString(),"totalInvestAmount:",totalInvestAmount.toString())

      
      await expect(USDT.connect(investSigner).mint(await vaultWhiteLists(i), totalInvestAmount)).not.to.be.reverted;
      await expect(USDT.connect(investSigner).approve(vault, totalInvestAmount)).not.to.be.reverted;
      await expect(vaultInvest.deposit(investAmount)).not.to.be.reverted;
      expect((await vaultInvest.balanceOf(await vaultWhiteLists(i)))/decimalFactor).to.equal(investAmount / decimalUsdt);
    }
    expect((await VAULT.assetBalance())/ decimalUsdt).to.equal(maxSupply / decimalFactor)
    console.log("total deposit balance",await VAULT.assetBalance())
    console.log("total manageFee Balance",await VAULT.manageFeeBalance())
    console.log("total Balance",await USDT.balanceOf(vault))
    var expectedErrorMessage = `AccessControl: account ${deployer.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
    console.log("expectedErrorMessage",expectedErrorMessage)
    //是MANAGER_ROLE角色的账户执行setVault
    await expect(rbfManager.setVault(vault)).not.to.be.reverted;
    //setVault之后执行策略，既是MANAGER_ROLE又是vault，然后执行策略
    await expect(vaultManager.execStrategy()).not.to.be.reverted;
    //是MANAGER_ROLE角色的账户执行grantRole，执行成功
    await expect(rbfManager.grantRole(ethers.keccak256(ethers.toUtf8Bytes("MINT_AMOUNT_SETTER_ROLE")),drds)).not.to.be.reverted;

    //是PRICE_MINT_AMOUNT_SETTER_ROLE角色的账户执行setDepositPirceAndMintAmount，执行成功
    const drdsSigner = await ethers.getSigner(drds);
    const rbfDrds =await hre.ethers.getContractAt(
      "RBF", 
      rbf,
      drdsSigner
    )

    await expect(rbfDrds.setMintAmount(maxSupply)).not.to.be.reverted;

    const priceFeed = rbfData.priceFeed;
    const manager_Signer = await ethers.getSigner(manager);

    const PriceFeed = await hre.ethers.getContractAt(
      "PriceFeed",
      priceFeed,
    );

    await expect(PriceFeed.connect(manager_Signer).grantRole(ethers.keccak256(ethers.toUtf8Bytes("FEEDER_ROLE")),drds)).not.to.be.reverted;

    await expect(
      PriceFeed.connect(drdsSigner).addPrice(financePrice, Math.floor(Date.now() / 1000))
    ).not.to.be.reverted;

    // expect(await rbfDrds.depositPrice()).to.be.equal(financePrice);
    expect(await rbfDrds.depositMintAmount()).to.be.equal(maxSupply);

    //是MANAGER_ROLE角色的账户执行claimDeposit，执行成功
    await expect(rbfManager.claimDeposit()).not.to.be.reverted;
    expect(await rbfManager.balanceOf(vault)).to.be.equal(maxSupply);

    //派息成功
    const randomMultiplier = 1.1 + Math.random() * 0.4;
    console.log("派息系数:",randomMultiplier)
    const principalInterest = Math.floor(totalSupply * randomMultiplier);
    const waitMint = BigInt(Math.floor(principalInterest - totalSupply)) * decimalUsdt;
    await expect(USDT.mint(depositTreasury, waitMint)).not.to.be.reverted;
    const dividendCount = 4;
    const dividendCountArr = distributeMoneyWithMinimum(
          principalInterest,
          dividendCount,
          1
    );
    const totalNav= await USDT.balanceOf(depositTreasury) - depositTreasuryBalance;
    console.log("总派息资产:",totalNav.toString())

    const depositTreasurySigner = await ethers.getSigner(depositTreasury);
    const USDTdepositTreasury = await ethers.getContractAt(
      "MockUSDT",
      usdt.address,
      depositTreasurySigner
    );
    const rbfDividendTreasury = await rbfManager.dividendTreasury();
    const vaultDividendTreasury = await vaultManager.dividendTreasury();
    // var vaultDividendBalance:any;
    for (let i = 0; i < dividendCountArr.length; i++) {
      const dividendAmount = BigInt(Math.floor(dividendCountArr[i])) * decimalUsdt;
      console.log("第" + (i + 1) + "次派息:", dividendAmount);
      await expect(USDTdepositTreasury.transfer(rbfDividendTreasury, dividendAmount)).not.to.be.reverted;
      await expect(rbfManager.dividend()).not.to.be.reverted;

      var tx = await vaultManager.dividend();
      var receipt = await tx.wait();
      console.log(receipt);
      if (!receipt) throw new Error("Transaction failed");
      expect(receipt.status).to.equal(1);
    }

    var totalDividend=await USDT.balanceOf(
      vaultDividendTreasury
    );;
    console.log("金库剩余派息金额:",totalDividend.toString());
    var investorBalance=await USDT.balanceOf(vaultDividendTreasury);
    for (let i = 0; i < whitelistLength; i++) {
      const whitelistAddr = await vaultWhiteLists(i);
      investorBalance=await USDT.balanceOf(whitelistAddr);
      incomeArr.push(investorBalance);
      totalDividend=totalDividend+investorBalance;
    }
    console.log("总派息额",totalDividend - investorBalance_before_all)
    console.log(investArr)
    console.log(incomeArr)
    expect(totalDividend - investorBalance_before_all).to.equal(totalNav);
  });

  it("tc-48", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common,drds} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-48", "RBF-48",
        rbfDecimals,
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

    const whitelists = [investor1, investor2, investor3, investor4, investor5];
    const rbfData = await rbfRouter.getRBFInfo(rbfId);
    const rbf = rbfData.rbf;
    
    const VaultRouter = await deployments.get("VaultRouter");
    const vaultRouter = await hre.ethers.getContractAt(
      "VaultRouter",
      VaultRouter.address
    );
    const vaultId = await vaultRouter.vaultNonce();
    const subStartTime = Math.floor(Date.now() / 1000) 
    const subEndTime = subStartTime + 3600;
    const minDepositAmountInput = 10n * decimalUsdt;
    const maxSupplyInput =  10000n * (10n ** BigInt(VaultDecimals));
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc48",
      symbol: "RbfVaultForTc48",
      decimals: VaultDecimals,
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "3000",
      minDepositAmount: minDepositAmountInput,
      manageFee: "50",
      manager: manager,
      feeReceiver: feeReceiver,
      dividendEscrow: manager, // 添加这一行
      whitelists: whitelists,
      isOpen: false,
      guardian: guardian,
      maxSupply: maxSupplyInput,
      financePrice: "100000000",
    };
    var res = await vaultRouter.deployVault(vaultDeployData);
    var receipt = await res.wait();
    if (!receipt) throw new Error("Transaction failed");
    expect(receipt.status).to.equal(1);
    const vaultData = await vaultRouter.getVaultInfo(vaultId);
    const vault = vaultData.vault;
    const VAULT = await ethers.getContractAt("Vault", vault);
    
    const managerSigner = await ethers.getSigner(manager);
    const vaultManager=await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      managerSigner
    )
    
    const rbfManager = await hre.ethers.getContractAt(
      "RBF", // 替换为你的合约名称
      rbf,
      managerSigner
    )

    //此时查询vault的assetBalance为0
    expect(await VAULT.assetBalance()).to.equal(BigInt(0));
    
    //是MANAGER_ROLE角色的账户执行setVault
    await expect(rbfManager.setVault(vault)).not.to.be.reverted;
    //setVault之后执行策略，既是MANAGER_ROLE又是vault，然后执行策略
    //assetBalance为0，执行策略失败
    await expect(vaultManager.execStrategy()).to.be.revertedWith("Vault: assetBalance is zero");  
  });

  //融资金额为0，派息
  it("tc-49", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common,drds} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-49", "RBF-49",
        rbfDecimals,
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

    const whitelists = [investor1];
    const rbfData = await rbfRouter.getRBFInfo(rbfId);
    const rbf = rbfData.rbf;
    
    const VaultRouter = await deployments.get("VaultRouter");
    const vaultRouter = await hre.ethers.getContractAt(
            "VaultRouter",
            VaultRouter.address
          );
    const vaultId = await vaultRouter.vaultNonce();
    const subStartTime = Math.floor(Date.now() / 1000) 
    const subEndTime = subStartTime + 3600;
    const minDepositAmountInput = 10n * decimalUsdt;
    const maxSupplyInput =  10000n * (10n ** BigInt(VaultDecimals));
    const vaultDeployData = {
        vaultId: vaultId,
        name: "RbfVaultForTc49",
        symbol: "RbfVaultForTc49",
        decimals: VaultDecimals,
        assetToken: usdt.address,
        rbf: rbfData.rbf,
        subStartTime: subStartTime,
        subEndTime: subEndTime,
        duration: "2592000",
        fundThreshold: "3000",
        minDepositAmount: minDepositAmountInput,
        manageFee: "50",
        manager: manager,
        feeReceiver: feeReceiver,
        dividendEscrow: manager, // 添加这一行
        whitelists: whitelists,
        isOpen: false,
        guardian: guardian,
        maxSupply: maxSupplyInput,
        financePrice: "100000000",
    };
    var res = await vaultRouter.deployVault(vaultDeployData);
    var receipt = await res.wait();
    if (!receipt) throw new Error("Transaction failed");
    expect(receipt.status).to.equal(1);

    const vaultData = await vaultRouter.getVaultInfo(vaultId);
    const vault = vaultData.vault;
    const VAULT = await ethers.getContractAt("Vault", vault);
    const decimalsFactor = await getDecimalFactor(VAULT);
    
    const maxSupply = await VAULT.maxSupply();
    const totalSupply = 0;
    
    var USDT:any;
    const managerSigner = await ethers.getSigner(manager);
    const vaultManager=await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      managerSigner
    )
    const rbfManager = await hre.ethers.getContractAt(
      "RBF", // 替换为你的合约名称
      rbf,
      managerSigner
    )

    //此时查询vault的assetBalance为0
    expect(await VAULT.assetBalance()).to.equal(BigInt(0));
    let investArr= new Array();

    const investSigner_0 = await ethers.getSigner(whitelists[0]);
    const vaultInvest_0 = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      investSigner_0
    )
    const manageFee=await vaultInvest_0.manageFee();
    const investAmount = BigInt(Math.floor(totalSupply)) * decimalUsdt;
    const feeAmount = investAmount * BigInt(manageFee) / BigInt(10000);
    const totalInvestAmount = investAmount + feeAmount;
    investArr.push(totalInvestAmount)
    console.log("investAmount:",investAmount.toString(),"feeAmount:",feeAmount.toString(),"totalInvestAmount:",totalInvestAmount.toString())

    USDT = await ethers.getContractAt(
      "MockUSDT",
      usdt.address,
      investSigner_0
    );
    await expect(USDT.mint(whitelists[0], totalInvestAmount)).not.to.be.reverted;
    await expect(USDT.approve(vault, totalInvestAmount)).not.to.be.reverted;
    console.log("total deposit balance",await VAULT.assetBalance())
    console.log("total manageFee Balance",await VAULT.manageFeeBalance())
    console.log("total Balance",await USDT.balanceOf(vault))
      
    //是MANAGER_ROLE角色的账户执行setVault
    await expect(rbfManager.setVault(vault)).not.to.be.reverted;
    //是MANAGER_ROLE角色的账户执行grantRole，执行成功
    await expect(rbfManager.grantRole(ethers.keccak256(ethers.toUtf8Bytes("MINT_AMOUNT_SETTER_ROLE")),drds)).not.to.be.reverted;
    //此时查询RBF的金额为0
    expect(await rbfManager.balanceOf(vault)).to.be.equal(0);


    //派息
    const randomMultiplier = 1.1 + Math.random() * 0.4;
    console.log("派息系数:",randomMultiplier)
    const principalInterest = Math.floor(Number(maxSupply) * randomMultiplier);
    const waitMint = BigInt(Math.floor(principalInterest - totalSupply)) * decimalUsdt;
    await expect(USDT.mint(depositTreasury, waitMint)).not.to.be.reverted;
   
    // const totalNav= await USDT.balanceOf(depositTreasury) ;
    // console.log("总派息资产:",totalNav.toString())

    const depositTreasurySigner = await ethers.getSigner(depositTreasury);
    const USDTdepositTreasury = await ethers.getContractAt(
      "MockUSDT",
      usdt.address,
      depositTreasurySigner
    );

    const rbfDividendTreasury = await rbfManager.dividendTreasury();
    const dividendAmount = BigInt(Math.floor(1000)) * decimalsFactor;
    await expect(USDTdepositTreasury.transfer(rbfDividendTreasury, dividendAmount)).not.to.be.reverted;

    //融资金额为0，rbf执行派息
    await expect(rbfManager.dividend()).to.be.revertedWith("RBF: totalSupply must be greater than 0"); 
    
    //vaultDiveidend address金额为0，vault执行派息
    await expect(vaultManager.dividend()).to.be.revertedWith("Vault: No dividend to pay");
  });

  it("tc-50", async function () {
    const {execute} = deployments;
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common,drds} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-50", "RBF-50",
        rbfDecimals,
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

    const whitelists = [investor1, investor2, investor3, investor4, investor5];
    const rbfData = await rbfRouter.getRBFInfo(rbfId);
    const rbf = rbfData.rbf;
    
    const VaultRouter = await deployments.get("VaultRouter");
    const vaultRouter = await hre.ethers.getContractAt(
            "VaultRouter",
            VaultRouter.address
          );
    const vaultId = await vaultRouter.vaultNonce();
    const subStartTime = Math.floor(Date.now() / 1000) 
    const subEndTime = subStartTime + 3600;
    const minDepositAmountInput = 10n * decimalUsdt;
    const maxSupplyInput =  10000n * (10n ** BigInt(VaultDecimals));
    const vaultDeployData = {
        vaultId: vaultId,
        name: "RbfVaultForTc50",
        symbol: "RbfVaultForTc50",
        decimals: VaultDecimals,
        assetToken: usdt.address,
        rbf: rbfData.rbf,
        subStartTime: subStartTime,
        subEndTime: subEndTime,
        duration: "2592000",
        fundThreshold: "3000",
        minDepositAmount: minDepositAmountInput,
        manageFee: "50",
        manager: manager,
        feeReceiver: feeReceiver,
        dividendEscrow: manager, // 添加这一行
        whitelists: whitelists,
        isOpen: false,
        guardian: guardian,
        maxSupply: maxSupplyInput,
        financePrice: "100000000",
    };
    var res = await vaultRouter.deployVault(vaultDeployData);
    var receipt = await res.wait();
    if (!receipt) throw new Error("Transaction failed");
    expect(receipt.status).to.equal(1);
    const vaultData = await vaultRouter.getVaultInfo(vaultId);
    const vault = vaultData.vault;
    const VAULT = await ethers.getContractAt("Vault", vault);
    const decimalFactor = await getDecimalFactor(VAULT);
    
    const maxSupply = await VAULT.maxSupply();
    // const financePrice=await VAULT.financePrice();
    const minDepositAmount = await VAULT.minDepositAmount();
    const totalSupply = Number(maxSupply / decimalFactor);
    const minAmount = Number(minDepositAmount / decimalUsdt);
    
    var USDT:any;
    USDT = await ethers.getContractAt(
      "MockUSDT",
      usdt.address
    );
    const managerSigner = await ethers.getSigner(manager);
    const vaultManager=await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      managerSigner
    )
    const rbfManager = await hre.ethers.getContractAt(
      "RBF", // 替换为你的合约名称
      rbf,
      managerSigner
    )

  let investArr= new Array();
  // let incomeArr = new Array();

  const whitelistLength = await whitelists.length;

  var investorBalance_before_all= BigInt(0);
  for (let i = 0; i < whitelistLength; i++) {
    const investSigner = await ethers.getSigner(whitelists[i]);
    var investorBalance_before=await USDT.connect(investSigner).balanceOf(whitelists[i]);
    investorBalance_before_all = investorBalance_before_all + investorBalance_before;
  }
  console.log("investorBalance_before_all",investorBalance_before_all.toString())

  const distribution = distributeMoneyWithMinimum(
    totalSupply,
    whitelistLength,
    minAmount
  );

  console.log("distribution.length",distribution.length)
  expect(distribution.length).to.equal(whitelistLength);

  const depositTreasuryBalance= await USDT.balanceOf(depositTreasury);

  for (let i = 0; i < whitelistLength; i++) {
    const investSigner = await ethers.getSigner(whitelists[i]);
    const vaultInvest = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      investSigner
    )
    const manageFee=await vaultInvest.manageFee();
    const investAmount = BigInt(Math.floor(distribution[i])) * decimalUsdt;
    const feeAmount = investAmount * BigInt(manageFee) / BigInt(10000);
    const totalInvestAmount = investAmount + feeAmount;
    investArr.push(totalInvestAmount)
    console.log("investAmount:",investAmount.toString(),"feeAmount:",feeAmount.toString(),"totalInvestAmount:",totalInvestAmount.toString())

    
    await expect(USDT.connect(investSigner).mint(whitelists[i], totalInvestAmount)).not.to.be.reverted;
    await expect(USDT.connect(investSigner).approve(vault, totalInvestAmount)).not.to.be.reverted;
    await expect(vaultInvest.deposit(investAmount)).not.to.be.reverted;
    expect((await vaultInvest.balanceOf(whitelists[i])) / decimalFactor).to.equal(investAmount /decimalUsdt);
  }
  expect((await VAULT.assetBalance()) / decimalUsdt).to.equal(maxSupply / decimalFactor)
  console.log("total deposit balance",await VAULT.assetBalance())
  console.log("total manageFee Balance",await VAULT.manageFeeBalance())
  console.log("total Balance",await USDT.balanceOf(vault))
  var expectedErrorMessage = `AccessControl: account ${deployer.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
  console.log("expectedErrorMessage",expectedErrorMessage)

  //喂价前获取RBF的最新价格
  const RBF = await ethers.getContractAt("RBF", rbf);
  console.log("RBF",RBF)
  let err:any;

  //是MANAGER_ROLE角色的账户执行setVault
  await expect(rbfManager.setVault(vault)).not.to.be.reverted;
  //setVault之后执行策略，既是MANAGER_ROLE又是vault，然后执行策略
  await expect(vaultManager.execStrategy()).not.to.be.reverted;

  // const rbfDeployer = await hre.ethers.getContractAt(
  //   "RBF", // 替换为你的合约名称
  //   rbf
  // )
  //是MANAGER_ROLE角色的账户执行grantRole，执行成功
  await expect(rbfManager.grantRole(ethers.keccak256(ethers.toUtf8Bytes("MINT_AMOUNT_SETTER_ROLE")),drds)).not.to.be.reverted;

  //是PRICE_MINT_AMOUNT_SETTER_ROLE角色的账户执行setDepositPirceAndMintAmount，执行成功
  const drdsSigner = await ethers.getSigner(drds);
  const rbfDrds =await hre.ethers.getContractAt(
    "RBF", 
    rbf,
    drdsSigner
  )
 
  //depositMintAmount为0，执行claimDeposit，执行失败
  await expect(rbfDrds.setMintAmount(BigInt(0))).not.to.be.reverted;
   
  //depositMintAmount和depositPrice不为0，执行claimDeposit，执行成功
  await expect(rbfDrds.setMintAmount(maxSupply)).not.to.be.reverted;
   
  //  expect(await rbfDrds.depositPrice()).to.be.equal(financePrice);
  expect(await rbfDrds.depositMintAmount()).to.be.equal(maxSupply);
 
  //此时查询RBF的金额为0
  expect(await rbfManager.balanceOf(vault)).to.be.equal(0)
  //是MANAGER_ROLE角色的账户执行claimDeposit，执行成功
  await expect(rbfManager.claimDeposit()).not.to.be.reverted;
  expect(await rbfManager.balanceOf(vault)).to.be.equal(maxSupply);

  //此时查询vault的assetBalance为0
  expect(await VAULT.assetBalance()).to.equal(BigInt(0));

  
  const priceFeedAddress = await RBF.priceFeed();
  const priceFeed = await ethers.getContractAt("PriceFeed", priceFeedAddress);

  var expectedErrorMessage = `AccessControl: account ${manager.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("FEEDER_ROLE"))}`;

  const manager_Signer = await ethers.getSigner(manager);
  //不是FEEDER_ROLE角色的账户执行addPrice，执行失败
  await expect(priceFeed.connect(manager_Signer).addPrice(BigInt("1200000000"), Math.floor(Date.now() / 1000))).to.be.revertedWith(expectedErrorMessage);

  //是FEEDER_ROLE角色的账户执行grantRole，执行成功
  await expect(priceFeed.connect(manager_Signer).grantRole(ethers.keccak256(ethers.toUtf8Bytes("FEEDER_ROLE")),deployer)).not.to.be.reverted;
  
  const FeedSigner = await ethers.getSigner(deployer);

  // let err:any;
  // try {
  //   await RBF.getLatestPrice();
  // } catch (error) {
  //   err = error;
  //   console.log("err",err);
  // }finally{
  //   expect(err.message).to.be.include("Transaction reverted");
  // }
  await priceFeed.connect(FeedSigner).addPrice(BigInt("1200000000"), Math.floor(Date.now() / 1000))
  
  //查询RBF最新价格
  const lastPrice = await RBF.getLatestPrice();
  console.log("lastPrice",lastPrice);

  //查询RBF净值
  const nav = await rbfManager.getAssetsNav();
  console.log("nav",nav);

  //查询vault的price
  const price = await VAULT.price();
  console.log("price",price);
  const Supply = await VAULT.totalSupply();
  console.log("Supply",Supply);
  expect(price).to.equal(nav * decimalFactor / Supply); 

  //派息
   const randomMultiplier = 1.1 + Math.random() * 0.4;
   console.log("派息系数:",randomMultiplier)
   const principalInterest = Math.floor(totalSupply * randomMultiplier);
   const waitMint = BigInt(Math.floor(principalInterest - totalSupply)) * decimalUsdt;
   await expect(USDT.mint(depositTreasury, waitMint)).not.to.be.reverted;
   const dividendCountArr = distributeMoneyWithMinimum(
         principalInterest,
         1,
         1
   );
   const totalNav= await USDT.balanceOf(depositTreasury) - depositTreasuryBalance;
   console.log("总派息资产:",totalNav.toString())

   const depositTreasurySigner = await ethers.getSigner(depositTreasury);
   const USDTdepositTreasury = await ethers.getContractAt(
     "MockUSDT",
     usdt.address,
     depositTreasurySigner
   );
   const rbfDividendTreasury = await rbfManager.dividendTreasury();
   const vaultDividendTreasury = await vaultManager.dividendTreasury();
   for (let i = 0; i < dividendCountArr.length; i++) {
     const dividendAmount = BigInt(Math.floor(dividendCountArr[i])) * decimalUsdt;
     console.log("第" + (i + 1) + "次派息:", dividendAmount);
     await expect(USDTdepositTreasury.transfer(rbfDividendTreasury, dividendAmount)).not.to.be.reverted;
     await expect(rbfManager.dividend()).not.to.be.reverted;
     await expect(vaultManager.dividend()).not.to.be.reverted;
   }

   var totalDividend=await USDT.balanceOf(
     vaultDividendTreasury
   );;
   console.log("金库剩余派息金额:",totalDividend.toString());
   var investorBalance=await USDT.balanceOf(vaultDividendTreasury);
   for (let i = 0; i < whitelists.length; i++) {
     investorBalance=await USDT.balanceOf(whitelists[i]);
    //  incomeArr.push(investorBalance);
     totalDividend=totalDividend+investorBalance;
   }
   console.log("总派息额",totalDividend - investorBalance_before_all)
   expect(totalDividend - investorBalance_before_all).to.equal(totalNav);

   //喂价小于0
   console.log("feedprice 小于0")
   await priceFeed.connect(FeedSigner).addPrice(BigInt("-1"), Math.floor(Date.now() / 1000));
   
   //喂价小于0后，查询RBF最新价格，执行失败
   await expect(RBF.getLatestPrice()).to.be.revertedWith("Invalid price data");

   //喂价：浮点数一位小数
   console.log("feedprice 为浮点数-1位小数")
   await priceFeed.connect(FeedSigner).addPrice(BigInt("10000000"), Math.floor(Date.now() / 1000));
   const lastPrice_float = await RBF.getLatestPrice();
   console.log("lastPrice_float",lastPrice_float);
   expect(lastPrice_float).to.be.equal(BigInt(10000000));

   //喂价：浮点数8位小数
   console.log("feedprice 为浮点数-8位小数")
   await priceFeed.connect(FeedSigner).addPrice(BigInt("1"), Math.floor(Date.now() / 1000));
   const lastPrice_float_1 = await RBF.getLatestPrice();
   console.log("lastPrice_float",lastPrice_float_1);
   expect(lastPrice_float_1).to.be.equal(BigInt(1));

   //喂价为0
   await priceFeed.connect(FeedSigner).addPrice(BigInt("0"), Math.floor(Date.now() / 1000));
   const lastPrice_final = await RBF.getLatestPrice();
   console.log("lastPrice",lastPrice_final);
   const nav_final = await rbfManager.getAssetsNav();
   console.log("nav",nav_final);
   const price_final = await VAULT.price();
   console.log("price",price_final);
   const Supply_final = await VAULT.totalSupply();
   console.log("Supply",Supply_final);
   expect(price_final).to.equal(nav_final * decimalFactor / Supply_final); 
  });

  //极限测试：线上白名单为100个发行
  it("tc-51", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,rbfSigner2,drds} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-51", "RBF-51",
        rbfDecimals,
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

    
    const rbfData = await rbfRouter.getRBFInfo(rbfId);
    const rbf = rbfData.rbf;
    const VaultRouter = await deployments.get("VaultRouter");
    const vaultRouter = await hre.ethers.getContractAt(
      "VaultRouter",
      VaultRouter.address
    );
    const vaultId = await vaultRouter.vaultNonce();
    const subStartTime = Math.floor(Date.now() / 1000) 
    const subEndTime = subStartTime + 3600;
  
    // 获取测试账户
    const [...signers] = await ethers.getSigners();

    // 生成100个有效的测试地址
    const investors = signers.slice(0, 100);  
    const whitelists = investors.map(investor => investor.address);
    const minDepositAmountInput = 10n * decimalUsdt;
    const maxSupplyInput =  10000n * (10n ** BigInt(VaultDecimals));

    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc51",
      symbol: "RbfVaultForTc51",
      decimals: VaultDecimals,
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "3000",
      minDepositAmount: minDepositAmountInput,
      manageFee: "3000",
      manager: manager,
      feeReceiver: feeReceiver,
      dividendEscrow: manager, // 添加这一行
      whitelists: whitelists,
      isOpen: false,
      guardian: guardian,
      maxSupply: maxSupplyInput,
      financePrice: "100000000",
    };
    console.log("whitelists length:",whitelists.length);
    var res = await vaultRouter.deployVault(vaultDeployData);
    var receipt = await res.wait();
    if (!receipt) throw new Error("Transaction failed");
    expect(receipt.status).to.equal(1);
    const vaultData = await vaultRouter.getVaultInfo(vaultId);
    const vault = vaultData.vault;
    const VAULT = await ethers.getContractAt("Vault", vault);
    const decimalFactor = await getDecimalFactor(VAULT);
    
    
    const maxSupply = await VAULT.maxSupply();
    // const fundThreshold = await VAULT.fundThreshold();
    // const target = maxSupply * fundThreshold / BigInt(10000);
    const financePrice=await VAULT.financePrice();
    const minDepositAmount = await VAULT.minDepositAmount();
    const totalSupply = Number(maxSupply / decimalFactor);
    const minAmount = Number(minDepositAmount / decimalUsdt);

    var USDT:any;
    USDT = await ethers.getContractAt(
      "MockUSDT",
      usdt.address
    );

    const depositTreasuryBalance = await USDT.balanceOf(depositTreasury);
    const managerSigner = await ethers.getSigner(manager);
    const vaultManager=await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      managerSigner
    )

    const rbfManager = await hre.ethers.getContractAt(
      "RBF", // 替换为你的合约名称
      rbf,
      managerSigner
    )


    let investArr= new Array();
    let incomeArr = new Array();

    const whitelistLength = await VAULT.getOnChainWLLen();
    console.log("whitelistLength:",whitelistLength)
    const distribution = distributeMoneyWithMinimum(
      totalSupply,
      Number(whitelistLength),
      minAmount
    );
    console.log("distribution:",distribution)

    
    const vaultWhiteLists = await VAULT.onChainWL;

    var investorBalance_before_all= BigInt(0);
    for (let i = 0; i < whitelistLength; i++) {
      const whitelistAddr = await vaultWhiteLists(i);
      const investSigner = await ethers.getSigner(whitelistAddr);
      var investorBalance_before=await USDT.connect(investSigner).balanceOf(whitelistAddr);
      investorBalance_before_all = investorBalance_before_all + investorBalance_before;
    }
    
    for (let i = 0; i < whitelistLength; i++) {
      console.log(i)
      const whitelistAddr = await vaultWhiteLists(i);
      const investSigner = await ethers.getSigner(whitelistAddr);
      const vaultInvest = await hre.ethers.getContractAt(
        "Vault", // 替换为你的合约名称
        vault,
        investSigner
      )
      const manageFee=await vaultInvest.manageFee();
      const investAmount = BigInt(Math.floor(distribution[i])) * decimalUsdt;
      const feeAmount = investAmount * BigInt(manageFee) / BigInt(10000);
      const totalInvestAmount = investAmount + feeAmount;
      investArr.push(totalInvestAmount)
      console.log("investAmount:",investAmount.toString(),"feeAmount:",feeAmount.toString(),"totalInvestAmount:",totalInvestAmount.toString())

      
      await expect(USDT.connect(investSigner).mint(await vaultWhiteLists(i), totalInvestAmount)).not.to.be.reverted;
      await expect(USDT.connect(investSigner).approve(vault, totalInvestAmount)).not.to.be.reverted;
      await expect(vaultInvest.deposit(investAmount)).not.to.be.reverted;
      expect((await vaultInvest.balanceOf(await vaultWhiteLists(i))) / decimalFactor).to.equal(investAmount / decimalUsdt);
    }
    expect((await VAULT.assetBalance()) / decimalUsdt).to.equal(maxSupply / decimalFactor)
    console.log("total deposit balance",await VAULT.assetBalance())
    console.log("total manageFee Balance",await VAULT.manageFeeBalance())
    console.log("total Balance",await USDT.balanceOf(vault))
    var expectedErrorMessage = `AccessControl: account ${deployer.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
    console.log("expectedErrorMessage",expectedErrorMessage)
    //是MANAGER_ROLE角色的账户执行setVault
    await expect(rbfManager.setVault(vault)).not.to.be.reverted;
    //setVault之后执行策略，既是MANAGER_ROLE又是vault，然后执行策略
    await expect(vaultManager.execStrategy()).not.to.be.reverted;
    //是MANAGER_ROLE角色的账户执行grantRole，执行成功
    await expect(rbfManager.grantRole(ethers.keccak256(ethers.toUtf8Bytes("MINT_AMOUNT_SETTER_ROLE")),drds)).not.to.be.reverted;

    //是PRICE_MINT_AMOUNT_SETTER_ROLE角色的账户执行setDepositPirceAndMintAmount，执行成功
    const drdsSigner = await ethers.getSigner(drds);
    const rbfDrds =await hre.ethers.getContractAt(
      "RBF", 
      rbf,
      drdsSigner
    )

    await expect(rbfDrds.setMintAmount(maxSupply)).not.to.be.reverted;

    const priceFeed = rbfData.priceFeed;
    const manager_Signer = await ethers.getSigner(manager);

    const PriceFeed = await hre.ethers.getContractAt(
      "PriceFeed",
      priceFeed,
    );

    await expect(PriceFeed.connect(manager_Signer).grantRole(ethers.keccak256(ethers.toUtf8Bytes("FEEDER_ROLE")),drds)).not.to.be.reverted;

    await expect(
      PriceFeed.connect(drdsSigner).addPrice(financePrice, Math.floor(Date.now() / 1000))
    ).not.to.be.reverted;

    // expect(await rbfDrds.depositPrice()).to.be.equal(financePrice);
    expect(await rbfDrds.depositMintAmount()).to.be.equal(maxSupply);

    //是MANAGER_ROLE角色的账户执行claimDeposit，执行成功
    await expect(rbfManager.claimDeposit()).not.to.be.reverted;
    expect(await rbfManager.balanceOf(vault)).to.be.equal(maxSupply);

    //派息成功
    const randomMultiplier = 1.1 + Math.random() * 0.4;
    console.log("派息系数:",randomMultiplier)
    const principalInterest = Math.floor(totalSupply * randomMultiplier);
    const waitMint = BigInt(Math.floor(principalInterest - totalSupply)) * decimalUsdt;
    await expect(USDT.mint(depositTreasury, waitMint)).not.to.be.reverted;
    const dividendCount = 4;
    const dividendCountArr = distributeMoneyWithMinimum(
          principalInterest,
          dividendCount,
          1
    );
    const totalNav= await USDT.balanceOf(depositTreasury) - depositTreasuryBalance;
    console.log("总派息资产:",totalNav.toString())

    const depositTreasurySigner = await ethers.getSigner(depositTreasury);
    const USDTdepositTreasury = await ethers.getContractAt(
      "MockUSDT",
      usdt.address,
      depositTreasurySigner
    );
    const rbfDividendTreasury = await rbfManager.dividendTreasury();
    const vaultDividendTreasury = await vaultManager.dividendTreasury();
    var vaultDividendBalance:any;
    for (let i = 0; i < dividendCountArr.length; i++) {
      const dividendAmount = BigInt(Math.floor(dividendCountArr[i])) * decimalUsdt;
      console.log("第" + (i + 1) + "次派息:", dividendAmount);
      await expect(USDTdepositTreasury.transfer(rbfDividendTreasury, dividendAmount)).not.to.be.reverted;
      await expect(rbfManager.dividend()).not.to.be.reverted;

      var tx = await vaultManager.dividend();
      var receipt = await tx.wait();
      console.log(receipt);
      // var receipt = await res.wait();
      if (!receipt) throw new Error("Transaction failed");
      expect(receipt.status).to.equal(1);
    }

    var totalDividend=await USDT.balanceOf(
      vaultDividendTreasury
    );;
    console.log("金库剩余派息金额:",totalDividend.toString());
    var investorBalance=await USDT.balanceOf(vaultDividendTreasury);
    for (let i = 0; i < whitelistLength; i++) {
      const whitelistAddr = await vaultWhiteLists(i);
      investorBalance=await USDT.balanceOf(whitelistAddr);
      incomeArr.push(investorBalance);
      totalDividend=totalDividend+investorBalance;
    }
    console.log("总派息额",totalDividend -investorBalance_before_all)
    console.log(investArr)
    console.log(incomeArr)
    expect(totalDividend - investorBalance_before_all).to.equal(totalNav);
  });

  //线上线下各100个账户认购及派息
  it("tc-53", async function () {
    const {execute} = deployments;
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common,drds} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-94", "RBF-94",
        rbfDecimals,
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
    const subEndTime = subStartTime + 3600;
    const minDepositAmountInput = 10n * decimalUsdt;
    const maxSupplyInput =  10000n * (10n ** BigInt(VaultDecimals));
    const vaultDeployData = {
        vaultId: vaultId,
        name: "RbfVaultForTc53",
        symbol: "RbfVaultForTc53",
        decimals: VaultDecimals,
        assetToken: usdt.address,
        rbf: rbfData.rbf,
        subStartTime: subStartTime,
        subEndTime: subEndTime,
        duration: "2592000",
        fundThreshold: "3000",
        minDepositAmount: minDepositAmountInput,
        manageFee: "50",
        manager: manager,
        feeReceiver: feeReceiver,
        dividendEscrow: manager, // 添加这一行
        whitelists: whitelists,
        isOpen: false,
        guardian: guardian,
        maxSupply: maxSupplyInput,
        financePrice: "100000000",
    };
    var res = await vaultRouter.deployVault(vaultDeployData);
    var receipt = await res.wait();
    if (!receipt) throw new Error("Transaction failed");
    expect(receipt.status).to.equal(1);
    const vaultData = await vaultRouter.getVaultInfo(vaultId);
    const vault = vaultData.vault;

    const VAULT = await ethers.getContractAt("Vault", vault);
    const decimalFactor = await getDecimalFactor(VAULT);
    const maxSupply = await VAULT.maxSupply();
    const financePrice = await VAULT.financePrice();
    const minDepositAmount = await VAULT.minDepositAmount();
    const totalSupply = Number(maxSupply / decimalFactor);
    const minAmount = Number(minDepositAmount / decimalUsdt);
  
    var vaultInvest: any;
    var USDT: any;
    USDT = await ethers.getContractAt(
      "MockUSDT",
      usdt.address
    );
    const depositTreasuryBalance = await USDT.balanceOf(depositTreasury);
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

    //线下白名单账户数量等于100，继续添加，应该失败
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
    var investorBalance_before_all= BigInt(0);
    for (let i = 0; i < whitelists.length; i++) {
      const investSigner = await ethers.getSigner(whitelists[i]);
      var investorBalance_before=await USDT.connect(investSigner).balanceOf(whitelists[i]);
      investorBalance_before_all = investorBalance_before_all + investorBalance_before;
    }
    for (let i = 0; i < offchain_whitelistLength; i++) {
      const investSigner = await ethers.getSigner(offchain_whitelists[i]);
      var investorBalance_before=await USDT.connect(investSigner).balanceOf(offchain_whitelists[i]);
      investorBalance_before_all = investorBalance_before_all + investorBalance_before;
    }

    for (let i = 0; i < whitelists.length; i++) {
      const investSigner = await ethers.getSigner(whitelists[i]);
      vaultInvest = await hre.ethers.getContractAt(
        "Vault",
        vault,
        investSigner
      );
      const investAmount = BigInt(Math.floor(distribution[i])) * decimalUsdt;
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
      
      await expect(USDT.connect(investSigner).mint(whitelists[i], totalInvestAmount)).not.to.be.reverted;
      await expect(USDT.connect(investSigner).approve(vault, totalInvestAmount)).not.to.be.reverted;
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
      const investAmount = BigInt(Math.floor(distribution[i+100])) * decimalFactor;
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
    expect(await USDT.balanceOf(depositTreasury) - depositTreasuryBalance).to.be.equal(onChainInvest);
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
      (BigInt(maxSupply) * BigInt(financePrice)) / decimalFactor
    );
    expect(await vaultManager.price()).to.be.equal(financePrice);
    const randomMultiplier = 1.1 + Math.random() * 0.4;
    console.log("派息系数:", randomMultiplier);
    const principalInterest = Math.floor(totalSupply * randomMultiplier);
    const waitMint = BigInt(Math.floor(principalInterest - totalSupply)) * decimalFactor;
    await expect(USDT.mint(depositTreasury, maxSupply-onChainInvest+waitMint)).not.to.be.reverted;
    const dividendCount = 4;
    const dividendCountArr = distributeMoneyWithMinimum(
      principalInterest,
      dividendCount,
      1
    );
    const totalNav = await USDT.balanceOf(depositTreasury) - depositTreasuryBalance;
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
      const dividendAmount = BigInt(Math.floor(dividendCountArr[i])) * decimalFactor;
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
    console.log("总派息额", totalDividend - investorBalance_before_all);
    console.log(investArr);
    console.log(incomeArr);
    expect(totalDividend - investorBalance_before_all).to.equal(totalNav);
  });

 //isOpen = true，线上线下各100个账户认购及派息
 it("tc-69", async function () {
  const {execute} = deployments;
  const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common,drds} = await getNamedAccounts();
  const RBFRouter = await deployments.get("RBFRouter");
  // 获取 RBFRouter 合约实例
  const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
  const rbfId = await rbfRouter.rbfNonce();
  const abiCoder = new ethers.AbiCoder();
  const deployData = abiCoder.encode(
    ["(uint64,string,string,uint8,address,address,address,address,address)"],
    [
      [rbfId,
      "RBF-69", "RBF-69",
      rbfDecimals,
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
  const subEndTime = subStartTime + 3600;
  const minDepositAmountInput = 10n * decimalUsdt;
    const maxSupplyInput =  10000n * (10n ** BigInt(VaultDecimals));
  const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc69",
      symbol: "RbfVaultForTc69",
      decimals: VaultDecimals,
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "3000",
      minDepositAmount: minDepositAmountInput,
      manageFee: "50",
      manager: manager,
      feeReceiver: feeReceiver,
      dividendEscrow: manager, // 添加这一行
      whitelists: [investor1],
      isOpen: true,
      guardian: guardian,
      maxSupply: maxSupplyInput,
      financePrice: "100000000",
  };
  var res = await vaultRouter.deployVault(vaultDeployData);
  var receipt = await res.wait();
  if (!receipt) throw new Error("Transaction failed");
  expect(receipt.status).to.equal(1);
  const vaultData = await vaultRouter.getVaultInfo(vaultId);
  const vault = vaultData.vault;

  const VAULT = await ethers.getContractAt("Vault", vault);
  const decimalFactor = await getDecimalFactor(VAULT);
  const maxSupply = await VAULT.maxSupply();
  const financePrice = await VAULT.financePrice();
  const minDepositAmount = await VAULT.minDepositAmount();
  const totalSupply = Number(maxSupply / decimalFactor);
  const minAmount = Number(minDepositAmount / decimalUsdt);

  var vaultInvest: any;
  var USDT: any;
  USDT = await ethers.getContractAt(
    "MockUSDT",
    usdt.address
  );
  const depositTreasuryBalance = await USDT.balanceOf(depositTreasury);
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

  //线下白名单账户数量等于100，继续添加，应该失败
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
  var investorBalance_before_all= BigInt(0);
  for (let i = 0; i < whitelists.length; i++) {
    const investSigner = await ethers.getSigner(whitelists[i]);
    var investorBalance_before=await USDT.connect(investSigner).balanceOf(whitelists[i]);
    investorBalance_before_all = investorBalance_before_all + investorBalance_before;
  }
  for (let i = 0; i < offchain_whitelistLength; i++) {
    const investSigner = await ethers.getSigner(offchain_whitelists[i]);
    var investorBalance_before=await USDT.connect(investSigner).balanceOf(offchain_whitelists[i]);
    investorBalance_before_all = investorBalance_before_all + investorBalance_before;
  }

  let moreThan = BigInt(0);
  for (let i = 0; i < whitelists.length; i++) {
    const investSigner = await ethers.getSigner(whitelists[i]);
    vaultInvest = await hre.ethers.getContractAt(
      "Vault",
      vault,
      investSigner
    );
    const investAmount = BigInt(Math.floor(distribution[i])) * decimalUsdt;
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
    
    await expect(USDT.connect(investSigner).mint(whitelists[i], totalInvestAmount)).not.to.be.reverted;
    await expect(USDT.connect(investSigner).approve(vault, totalInvestAmount)).not.to.be.reverted;
    onChainInvest+=investAmount;

    await expect(vaultInvest.deposit(investAmount)).not.to.be.reverted;  
    // if (i == 100){
    //   moreThan = investAmount;
    //   await expect(vaultInvest.deposit(investAmount)).to.be.revertedWith("Vault: Whitelist is full");  
    // }else{
    //   await expect(vaultInvest.deposit(investAmount)).not.to.be.reverted;  
    // }
  }
  for (let i = 0; i < offchain_whitelistLength; i++) {
    const investSigner = await ethers.getSigner(offchain_whitelists[i]);
    vaultInvest = await hre.ethers.getContractAt(
      "Vault",
      vault,
      investSigner
    );
    const investAmount = BigInt(Math.floor(distribution[i+100])) * decimalFactor;
    investArr.push(investAmount);
    await expect(vaultManager.offChainDepositMint(offchain_whitelists[i],investAmount)).not.to.be.reverted;
    const balance = await vaultInvest.balanceOf(offchain_whitelists[i]);
    expect(balance).to.equal(investAmount);
  }

  expect(await VAULT.assetBalance()).to.equal(onChainInvest - moreThan);
  console.log("total deposit balance", await VAULT.assetBalance());
  console.log("total manageFee Balance", await VAULT.manageFeeBalance());
  console.log("total Balance", await USDT.balanceOf(vault));

  var expectedErrorMessage = `AccessControl: account ${deployer.toLowerCase()} is missing role ${ethers.keccak256(
    ethers.toUtf8Bytes("MANAGER_ROLE")
  )}`;

  
  await expect(rbfManager.setVault(vault)).not.to.be.reverted;

  await expect(vaultManager.execStrategy()).not.to.be.reverted;
  expect(await USDT.balanceOf(depositTreasury) - depositTreasuryBalance).to.be.equal(onChainInvest);
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
    (BigInt(maxSupply) * BigInt(financePrice)) / decimalFactor
  );
  expect(await vaultManager.price()).to.be.equal(financePrice);
  const randomMultiplier = 1.1 + Math.random() * 0.4;
  console.log("派息系数:", randomMultiplier);
  const principalInterest = Math.floor(totalSupply * randomMultiplier);
  const waitMint = BigInt(Math.floor(principalInterest - totalSupply)) * decimalUsdt;
  await expect(USDT.mint(depositTreasury, maxSupply-onChainInvest+waitMint)).not.to.be.reverted;
  const dividendCount = 4;
  const dividendCountArr = distributeMoneyWithMinimum(
    principalInterest,
    dividendCount,
    1
  );
  const totalNav = await USDT.balanceOf(depositTreasury) - depositTreasuryBalance;
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
    const dividendAmount = BigInt(Math.floor(dividendCountArr[i])) * decimalUsdt;
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
  console.log("总派息额", totalDividend - investorBalance_before_all);
  console.log(investArr);
  console.log(incomeArr);
  expect(totalDividend - investorBalance_before_all).to.equal(totalNav);
});


  //isOpen = true，线上线下各101个账户认购失败
  it("tc-70", async function () {
    const {execute} = deployments;
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common,drds} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-70", "RBF-70",
        rbfDecimals,
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
    const investors = signers.slice(0, 101);  
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
    const subEndTime = subStartTime + 3600;
    const minDepositAmountInput = 10n * decimalUsdt;
    const maxSupplyInput =  10000n * (10n ** BigInt(VaultDecimals));
    const vaultDeployData = {
        vaultId: vaultId,
        name: "RbfVaultForTc70",
        symbol: "RbfVaultForTc70",
        decimals: VaultDecimals,
        assetToken: usdt.address,
        rbf: rbfData.rbf,
        subStartTime: subStartTime,
        subEndTime: subEndTime,
        duration: "2592000",
        fundThreshold: "3000",
        minDepositAmount: minDepositAmountInput,
        manageFee: "50",
        manager: manager,
        feeReceiver: feeReceiver,
        dividendEscrow: manager, // 添加这一行
        whitelists: [investor1],
        isOpen: true,
        guardian: guardian,
        maxSupply: maxSupplyInput,
        financePrice: "100000000",
    };
    var res = await vaultRouter.deployVault(vaultDeployData);
    var receipt = await res.wait();
    if (!receipt) throw new Error("Transaction failed");
    expect(receipt.status).to.equal(1);
    const vaultData = await vaultRouter.getVaultInfo(vaultId);
    const vault = vaultData.vault;

    const VAULT = await ethers.getContractAt("Vault", vault);
    const decimalFactor = await getDecimalFactor(VAULT);
    const maxSupply = await VAULT.maxSupply();
    const financePrice = await VAULT.financePrice();
    const minDepositAmount = await VAULT.minDepositAmount();
    const totalSupply = Number(maxSupply / decimalFactor);
    const minAmount = Number(minDepositAmount / decimalUsdt);
  
    var vaultInvest: any;
    var USDT: any;
    USDT = await ethers.getContractAt(
      "MockUSDT",
      usdt.address
    );
    const depositTreasuryBalance = await USDT.balanceOf(depositTreasury);
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
    const offChainInvestors = signers.slice(101, 201);
    const offchain_whitelists = offChainInvestors.map(off_investor => off_investor.address);
    const offchain_whitelistLength = offchain_whitelists.length;
    console.log("offchain_whitelistLength:",offchain_whitelistLength);
    for (let i = 0; i < offchain_whitelistLength; i++) {
      await expect(vaultManager.addToOffChainWL(offchain_whitelists[i])).not.to.be.reverted;
    }
    const accounts = await ethers.getSigners(); 
    const account201 = accounts[201]; 
    const address_201 = account201.address;

    //线下白名单账户数量等于100，继续添加，应该失败
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
    var investorBalance_before_all= BigInt(0);
    for (let i = 0; i < whitelists.length; i++) {
      const investSigner = await ethers.getSigner(whitelists[i]);
      var investorBalance_before=await USDT.connect(investSigner).balanceOf(whitelists[i]);
      investorBalance_before_all = investorBalance_before_all + investorBalance_before;
    }
    for (let i = 0; i < offchain_whitelistLength; i++) {
      const investSigner = await ethers.getSigner(offchain_whitelists[i]);
      var investorBalance_before=await USDT.connect(investSigner).balanceOf(offchain_whitelists[i]);
      investorBalance_before_all = investorBalance_before_all + investorBalance_before;
    }

    let moreThan = BigInt(0);
    for (let i = 0; i < whitelists.length; i++) {
      const investSigner = await ethers.getSigner(whitelists[i]);
      vaultInvest = await hre.ethers.getContractAt(
        "Vault",
        vault,
        investSigner
      );
      const investAmount = BigInt(Math.floor(distribution[i])) * decimalUsdt;
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
      
      await expect(USDT.connect(investSigner).mint(whitelists[i], totalInvestAmount)).not.to.be.reverted;
      await expect(USDT.connect(investSigner).approve(vault, totalInvestAmount)).not.to.be.reverted;
      onChainInvest+=investAmount;
      if (i == 100){
        moreThan = investAmount;
        await expect(vaultInvest.deposit(investAmount)).to.be.revertedWith("Vault: Whitelist is full");  
      }else{
        await expect(vaultInvest.deposit(investAmount)).not.to.be.reverted;  
      }
    }
    // for (let i = 0; i < offchain_whitelistLength; i++) {
    //   const investSigner = await ethers.getSigner(offchain_whitelists[i]);
    //   vaultInvest = await hre.ethers.getContractAt(
    //     "Vault",
    //     vault,
    //     investSigner
    //   );
    //   const investAmount = BigInt(Math.floor(distribution[i+100] * 1e6));
    //   investArr.push(investAmount);
    //   await expect(vaultManager.offChainDepositMint(offchain_whitelists[i],investAmount)).not.to.be.reverted;
    //   const balance = await vaultInvest.balanceOf(offchain_whitelists[i]);
    //   expect(balance).to.equal(investAmount);
    // }

    // expect(await VAULT.assetBalance()).to.equal(onChainInvest - moreThan);
    // console.log("total deposit balance", await VAULT.assetBalance());
    // console.log("total manageFee Balance", await VAULT.manageFeeBalance());
    // console.log("total Balance", await USDT.balanceOf(vault));

    //  //等待认购期结束
    // // Create a promise-based delay function
    // const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    // console.log("开始等待...");
    // await delay(200000);
    // console.log("等待结束");
    // var expectedErrorMessage = `AccessControl: account ${deployer.toLowerCase()} is missing role ${ethers.keccak256(
    //   ethers.toUtf8Bytes("MANAGER_ROLE")
    // )}`;

    
    // await expect(rbfManager.setVault(vault)).not.to.be.reverted;
  
    // await expect(vaultManager.execStrategy()).not.to.be.reverted;
    // expect(await USDT.balanceOf(depositTreasury) - depositTreasuryBalance).to.be.equal(onChainInvest);
    // expect(await rbfManager.depositAmount()).to.be.equal(onChainInvest);
    
    // await expect(
    //   rbfManager.grantRole(
    //     ethers.keccak256(ethers.toUtf8Bytes("MINT_AMOUNT_SETTER_ROLE")),
    //     drds
    //   )
    // ).not.to.be.reverted;

    // const drdsSigner = await ethers.getSigner(drds);
    // const rbfDrds = await hre.ethers.getContractAt("RBF", rbf, drdsSigner);
    // const priceFeedDrds = await hre.ethers.getContractAt(
    //   "PriceFeed",
    //   priceFeed,
    //   drdsSigner
    // );

    // await expect(rbfDrds.setMintAmount(maxSupply)).not.to.be.reverted;
    // await expect(
    //   priceFeedDrds.addPrice(financePrice, Math.floor(Date.now() / 1000))
    // ).not.to.be.reverted;
    // expect(await rbfDrds.depositMintAmount()).to.be.equal(maxSupply);

    // expect(await rbfManager.balanceOf(vault)).to.be.equal(0);
    // await expect(rbfManager.claimDeposit()).not.to.be.reverted;
    // expect(await rbfManager.balanceOf(vault)).to.be.equal(maxSupply);
    // console.log("rbf总净值:", await rbfManager.getAssetsNav());
    // console.log("vault价值:", await vaultManager.price());
    // expect(await rbfManager.getAssetsNav()).to.be.equal(
    //   (BigInt(maxSupply) * BigInt(financePrice)) / BigInt(1e6)
    // );
    // expect(await vaultManager.price()).to.be.equal(financePrice);
    // const randomMultiplier = 1.1 + Math.random() * 0.4;
    // console.log("派息系数:", randomMultiplier);
    // const principalInterest = Math.floor(totalSupply * randomMultiplier);
    // const waitMint = BigInt(Math.floor(principalInterest - totalSupply) * 1e6);
    // await expect(USDT.mint(depositTreasury, maxSupply-onChainInvest+waitMint)).not.to.be.reverted;
    // const dividendCount = 4;
    // const dividendCountArr = distributeMoneyWithMinimum(
    //   principalInterest,
    //   dividendCount,
    //   1
    // );
    // const totalNav = await USDT.balanceOf(depositTreasury) - depositTreasuryBalance;
    // console.log("总派息资产:", totalNav.toString());

    // const depositTreasurySigner = await ethers.getSigner(depositTreasury);
    // const USDTdepositTreasury = await ethers.getContractAt(
    //   "MockUSDT",
    //   usdt.address,
    //   depositTreasurySigner
    // );
    // const rbfDividendTreasury = await rbfManager.dividendTreasury();
    // const vaultDividendTreasury = await vaultManager.dividendTreasury();
    // for (let i = 0; i < dividendCountArr.length; i++) {
    //   const dividendAmount = BigInt(Math.floor(dividendCountArr[i] * 1e6));
    //   console.log("第" + (i + 1) + "次派息:", dividendAmount);
    //   await expect(
    //     USDTdepositTreasury.transfer(rbfDividendTreasury, dividendAmount)
    //   ).not.to.be.reverted;
    //   await expect(rbfManager.dividend()).not.to.be.reverted;
    //   await expect(vaultManager.dividend()).not.to.be.reverted;
    // }
    // await expect(priceFeedDrds.addPrice(0, Math.floor(Date.now() / 1000))).not
    //   .to.be.reverted;
    // console.log("rbf总净值:", await rbfManager.getAssetsNav());
    // console.log("vault价值:", await vaultManager.price());
    // expect(await rbfManager.getAssetsNav()).to.be.equal(0);
    // expect(await vaultManager.price()).to.be.equal(0);
    // var totalDividend = await USDT.balanceOf(vaultDividendTreasury);
    // console.log("金库剩余派息金额:", totalDividend.toString());
    // var investorBalance = await USDT.balanceOf(vaultDividendTreasury);
    // for (let i = 0; i < whitelists.length; i++) {
    //   investorBalance = await USDT.balanceOf(whitelists[i]);
    //   incomeArr.push(investorBalance);
    //   totalDividend = totalDividend + investorBalance;
    // }
    // for (let i = 0; i < offchain_whitelistLength; i++) {
    //   investorBalance = await USDT.balanceOf(offchain_whitelists[i]);
    //   incomeArr.push(investorBalance);
    //   totalDividend = totalDividend + investorBalance;
    // }
    // console.log("总派息额", totalDividend - investorBalance_before_all);
    // console.log(investArr);
    // console.log(incomeArr);
    // expect(totalDividend - investorBalance_before_all).to.equal(totalNav);
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
});





