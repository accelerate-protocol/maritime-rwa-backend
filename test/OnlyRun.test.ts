import hre, { ethers } from "hardhat";
import { expect } from "chai";
import path from "path";
import { deployFactories } from '../utils/deployFactoriesAndRouter';
import { factoryAuth } from '../utils/factoryAuth';
import { execSync } from "child_process";
import { getAccount } from "../utils/account";
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
    
    // 初始化其他共享变量
    const VaultRouter = await deployments.get("VaultRouter");
    vaultRouter = await hre.ethers.getContractAt("VaultRouter", VaultRouter.address);
  });

  //各个时期添加删除白名单及白名单账户间转账后派息是否正确执行
  it("tc-39", async function () {
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
        "RBF-39", "RBF-39",
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
      name: "RbfVaultForTc39",
      symbol: "RbfVaultForTc39",
      assetToken: usdt.address,
      rbf: rbf,
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
    
    const financePrice=await VAULT.financePrice();
    const minDepositAmount = await VAULT.minDepositAmount();
    const totalSupply = Number(maxSupply / BigInt(1e6));
    const minAmount = Number(minDepositAmount / BigInt(1e6));

    var USDT:any;

    const managerSigner = await ethers.getSigner(manager);
    const vaultManager=await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      managerSigner
    )
    expect(await VAULT.getOnChainWLLen()).to.equal(whitelists.length);

    //认购期且未完成认购时，删除白名单账户，要删除的账户不在白名单中，删除失败
    await expect(vaultManager.removeFromOnChainWL(common)).to.be.revertedWith("Vault: Address is not in the whitelist");
    expect(await VAULT.getOnChainWLLen()).to.equal(whitelists.length);
    
    //认购期且未完成认购时，删除白名单账户，要删除的账户在白名单中，删除成功
    await expect(vaultManager.removeFromOnChainWL(investor1)).not.to.be.reverted; //[investor1, investor2, investor3, investor4] --> [investor2, investor3, investor4]
    
    //删除成功后线上白名单列表长度减一
    expect(await VAULT.getOnChainWLLen()).to.equal(BigInt(whitelists.length - 1));
    console.log(await VAULT.onChainWLMap(investor1));

    //删除成功后线上白名单Map中查询已被删除的账户状态为false
    expect(await VAULT.onChainWLMap(investor1)).to.be.equals(false);
    

    //认购期且未完成认购时，添加白名单，要添加的账户已经在白名单，添加失败
    await expect(vaultManager.addToOnChainWL(investor2)).to.be.revertedWith("Vault: Address is already onChainWL");
    
    //认购期且未完成认购时，添加白名单，添加不在白名单列表中的账户，添加成功
    await expect(vaultManager.addToOnChainWL(investor1)).not.to.be.reverted;//[ investor2, investor3, investor4] --> [investor2, investor3, investor4,investor1]
    
    //添加成功后线上白名单Map中查询已被添加的账户状态为true
    expect(await VAULT.onChainWLMap(investor1)).to.be.equals(true);
  
    const rbfManager = await hre.ethers.getContractAt(
      "RBF", // 替换为你的合约名称
      rbf,
      managerSigner
    );

    //此时查询vault的assetBalance为0
    expect(await VAULT.assetBalance()).to.equal(BigInt(0));
    let incomeArr_1= new Array();
    let incomeArr_2 = new Array();

    const whitelistLength = await VAULT.getOnChainWLLen();
    const result: number[] = [];
    for (let i = 0; i < whitelistLength; i++) {
      result[i] = Number(maxSupply / BigInt(whitelistLength));
    }
  
    const vaultWhiteLists = VAULT.onChainWL;
    expect(result.length).to.equal(whitelistLength);
    for (let i = 0; i < whitelistLength; i++) {
      console.log("第" + (i + 1) + "个账户认购:");
      const whitelistAddr = await vaultWhiteLists(i);
      const investSigner = await ethers.getSigner(whitelistAddr);
      const vaultInvest = await hre.ethers.getContractAt(
        "Vault", // 替换为你的合约名称
        vault,
        investSigner
      )
      const manageFee=await vaultInvest.manageFee();
      const investAmount = BigInt(Math.floor(result[i] ));
      const feeAmount = investAmount * BigInt(manageFee) / BigInt(10000);
      const totalInvestAmount = investAmount + feeAmount;
      // investArr.push(totalInvestAmount)
      console.log(whitelistAddr);
      console.log("investAmount:",investAmount.toString(),"feeAmount:",feeAmount.toString(),"totalInvestAmount:",totalInvestAmount.toString())

      USDT = await ethers.getContractAt(
        "MockUSDT",
        usdt.address,
        investSigner
      );
      await expect(USDT.mint(whitelistAddr, totalInvestAmount)).not.to.be.reverted;
      await expect(USDT.approve(vault, totalInvestAmount)).not.to.be.reverted;
      await expect(vaultInvest.deposit(investAmount)).not.to.be.reverted;
      expect(await vaultInvest.balanceOf(whitelistAddr)).to.equal(investAmount);

      //账户认购后有余额，不能从白名单中删除该账户
      await expect(vaultManager.removeFromOnChainWL(whitelistAddr)).to.be.revertedWith("Vault: Address has balance");
      expect(await VAULT.onChainWLMap(whitelistAddr)).to.be.equals(true);
    }
    expect(await VAULT.assetBalance()).to.equal(maxSupply)
    console.log("total deposit balance",await VAULT.assetBalance())
    console.log("total manageFee Balance",await VAULT.manageFeeBalance())
    console.log("total Balance",await USDT.balanceOf(vault))
    console.log("current time",Math.floor(Date.now() / 1000));
    console.log("subEndTime",subEndTime);
    
    //融资提前完成后，但在认购期内，账户有投资金额，则无法删除成功
    await expect(vaultManager.removeFromOnChainWL(investor1)).to.be.revertedWith("Vault: Address has balance");
    expect(await VAULT.onChainWLMap(investor1)).to.be.equals(true);

    const investSigner = await ethers.getSigner(investor1);
    const vaultInvest = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      investSigner
    )

    //融资提前完成后，但在认购期内，添加账户到白名单，成功
    await expect(vaultManager.addToOnChainWL(investor5)).not.to.be.reverted;//[investor2, investor3, investor4,investor1] --> [investor2, investor3, investor4,investor1,investor5]
    expect(await VAULT.onChainWLMap(investor5)).to.be.equals(true);
    
    //融资提前完成后，但在认购期内，删除白名单中的没有认购账户，成功
    await expect(vaultManager.removeFromOnChainWL(investor5)).not.to.be.reverted;//[investor2, investor3, investor4,investor1,investor5] --> [investor2, investor3, investor4,investor1]
    expect(await VAULT.onChainWLMap(investor5)).to.be.equals(false);

    //添加账户到白名单
    await expect(vaultManager.addToOnChainWL(investor5)).not.to.be.reverted;//[investor2, investor3, investor4,investor1] --> [investor2, investor3, investor4,investor1,investor5]
    expect(await VAULT.onChainWLMap(investor5)).to.be.equals(true);

    const balance = await vaultInvest.balanceOf(investor1);

    //等待认购期结束
    // Create a promise-based delay function
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    console.log("开始等待...");
    await delay(60000);
    console.log("等待结束");
    console.log("current time",Math.floor(Date.now() / 1000));


    //是MANAGER_ROLE角色的账户执行setVault
    await expect(rbfManager.setVault(vault)).not.to.be.reverted;
    //setVault之后执行策略，既是MANAGER_ROLE又是vault，然后执行策略
    await expect(vaultManager.execStrategy()).not.to.be.reverted;

    //将账户投资的钱转给其他成员，则账户没有投资金额，但是认购期结束，则删除失败
    await expect(vaultInvest.transfer(investor5,balance)).not.to.be.reverted;//[investor2:2500, investor3:2500, investor4:2500,investor1:2500,investor5:0] --> [investor2:2500, investor3:2500, investor4:2500,investor1:0,investor5:2500]
    expect(await vaultInvest.balanceOf(investor1)).to.equal(0);
    expect(await vaultInvest.balanceOf(investor5)).to.equal(balance);
    await expect(vaultManager.removeFromOnChainWL(investor1)).to.be.revertedWith("Vault: Invalid time");
    expect(await VAULT.onChainWLMap(investor1)).to.be.equals(true);

    //是MANAGER_ROLE角色的账户执行grantRole，执行成功
    await expect(rbfManager.grantRole(ethers.keccak256(ethers.toUtf8Bytes("MINT_AMOUNT_SETTER_ROLE")),drds)).not.to.be.reverted;

    //是PRICE_MINT_AMOUNT_SETTER_ROLE角色的账户执行setDepositPirceAndMintAmount，执行成功
    const drdsSigner = await ethers.getSigner(drds);
    const rbfDrds =await hre.ethers.getContractAt(
      "RBF", 
      rbf,
      drdsSigner
    )

    //depositMintAmount和depositPrice不为0，执行claimDeposit，执行成功
    await expect(rbfDrds.setMintAmount(maxSupply)).not.to.be.reverted;
    const priceFeed = rbfData.priceFeed;
    const manager_Signer = await ethers.getSigner(manager);

    // const drdsSigner = await ethers.getSigner(drds);
    // const rbfDrds = await hre.ethers.getContractAt("RBF", rbf, drdsSigner);
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

    //派息
    const randomMultiplier = 1.1 + Math.random() * 0.4;
    console.log("派息系数:",randomMultiplier)
    const principalInterest = Math.floor(totalSupply * randomMultiplier);
    console.log("总权益:",principalInterest);
    const waitMint = BigInt(Math.floor(principalInterest - totalSupply) * 1e6);
    await expect(USDT.mint(depositTreasury, waitMint)).not.to.be.reverted;
    expect(await rbfManager.balanceOf(vault)).to.be.equal(maxSupply);
    const totalNav= await USDT.balanceOf(depositTreasury);
    console.log("总派息资产:",totalNav.toString())

    const depositTreasurySigner = await ethers.getSigner(depositTreasury);
    const USDTdepositTreasury = await ethers.getContractAt(
      "MockUSDT",
      usdt.address,
      depositTreasurySigner
    );
    const rbfDividendTreasury = await rbfManager.dividendTreasury();
    const vaultDividendTreasury = await vaultManager.dividendTreasury();
    //假设分两次派息，第一次派息金额为四分之一，第二次派息金额为剩余金额
    const dividendAmount1 = BigInt(Math.floor(principalInterest * 0.25 * 1e6));
    console.log("第1次派息:", dividendAmount1);
    const currentWhitelistLength = await VAULT.getOnChainWLLen();
    console.log("当前白名单长度:", currentWhitelistLength);
    const currentVaultWhiteLists = await VAULT.onChainWL;
    for (let i = 0; i < currentWhitelistLength; i++) {
      const whitelistAddr = await currentVaultWhiteLists(i);
      const investSigner = await ethers.getSigner(whitelistAddr);
      const vaultInvest = await hre.ethers.getContractAt(
        "Vault", // 替换为你的合约名称
        vault,
        investSigner
      )
      const balance = await vaultInvest.balanceOf(whitelistAddr);
      console.log(whitelistAddr+":balance",balance.toString())    
    }
    await expect(USDTdepositTreasury.transfer(rbfDividendTreasury, dividendAmount1)).not.to.be.reverted;
    await expect(rbfManager.dividend()).not.to.be.reverted;
    await expect(vaultManager.dividend()).not.to.be.reverted;
    
    for (let i = 0; i < currentWhitelistLength; i++) {
      const whitelistAddr = await currentVaultWhiteLists(i);
      investorBalance = await USDT.balanceOf(whitelistAddr);
      console.log(whitelistAddr+":income",investorBalance.toString());
      incomeArr_1.push(investorBalance);
    }
    
    //认购期结束,添加账户到线上白名单失败
    await expect(vaultManager.addToOnChainWL(common)).to.be.revertedWith("Vault: Invalid time");
    expect(await VAULT.onChainWLMap(common)).to.be.equals(false);
    
    //认购期结束,删除白名单账户失败
    expect(await VAULT.onChainWLMap(investor5)).to.be.equals(true);
    await expect(vaultManager.removeFromOnChainWL(investor5)).to.be.revertedWith("Vault: Invalid time");
    expect(await VAULT.onChainWLMap(investor5)).to.be.equals(true);

    const investSigner5 = await ethers.getSigner(investor5);
    const vaultInvest5 = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      investSigner5
    )

    //[investor2:2500, investor3:2500, investor4:2500,investor1:0,investor5:2500]
    const balance5 = await vaultInvest.balanceOf(investor5);
    
    //将账户投资的钱转给其他成员，则账户没有投资金额，删除失败
    await expect(vaultInvest5.transfer(investor2,balance5)).not.to.be.reverted;//[investor2:5000, investor3:2500, investor4:2500,investor1:0,investor5:0]
    expect(await vaultInvest5.balanceOf(investor5)).to.equal(0);
    const dividendAmount2 = totalNav - dividendAmount1;
    console.log("第2次派息:", dividendAmount2);
    const finalWhitelistLength = await VAULT.getOnChainWLLen();
    console.log("最终白名单长度:", finalWhitelistLength);
    const finalVaultWhiteLists = await VAULT.onChainWL;
    for (let i = 0; i < finalWhitelistLength; i++) {
      const whitelistAddr = await finalVaultWhiteLists(i);
      const investSigner = await ethers.getSigner(whitelistAddr);
      const vaultInvest = await hre.ethers.getContractAt(
        "Vault", // 替换为你的合约名称
        vault,
        investSigner
      )
      const balance = await vaultInvest.balanceOf(whitelistAddr);
      console.log(whitelistAddr+":balance",balance.toString())    
    }


    await expect(USDTdepositTreasury.transfer(rbfDividendTreasury, dividendAmount2)).not.to.be.reverted;
    await expect(rbfManager.dividend()).not.to.be.reverted;
    await expect(vaultManager.dividend()).not.to.be.reverted;

    var totalDividend=await USDT.balanceOf(
      vaultDividendTreasury
    );;
    console.log("金库剩余派息金额-2:",totalDividend.toString());
    var investorBalance=await USDT.balanceOf(vaultDividendTreasury);
    
    for (let i = 0; i < finalWhitelistLength; i++) {
      const whitelistAddr = await finalVaultWhiteLists(i);
      investorBalance = await USDT.balanceOf(whitelistAddr);
      // incomeArr.push(investorBalance);
      console.log(whitelistAddr+":income",investorBalance.toString())
      incomeArr_2.push(investorBalance);
      totalDividend = totalDividend + investorBalance;
    }
    console.log("总派息额",totalDividend)
    // console.log(incomeArr)
    expect(totalDividend).to.equal(totalNav);
    expect(incomeArr_2[3]).to.equal(incomeArr_1[3]);
    expect(incomeArr_2[0] - incomeArr_2[4] + incomeArr_2[0]).to.equal(incomeArr_2[1]); 
    expect(incomeArr_2[0]).to.equal(incomeArr_2[2]);
  });

  it("tc-40", async function () {
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
        "RBF-40", "RBF-40",
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
    const subEndTime = subStartTime + 40;
    const vaultDeployData = {
        vaultId: vaultId,
        name: "RbfVaultForTc40",
        symbol: "RbfVaultForTc40",
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
    // const fundThreshold = await VAULT.fundThreshold();
    // const target = maxSupply * fundThreshold / BigInt(10000);
    const financePrice=await VAULT.financePrice();
    const minDepositAmount = await VAULT.minDepositAmount();
    const totalSupply = Number(maxSupply / BigInt(1e6));
    const minAmount = Number(minDepositAmount / BigInt(1e6));

    
    var USDT:any;
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
    let incomeArr = new Array();

    const whitelistLength = await whitelists.length;
    const distribution = distributeMoneyWithMinimum(
      totalSupply,
      whitelistLength,
      minAmount
    );

    console.log("distribution.length",distribution.length)
    expect(distribution.length).to.equal(whitelistLength);

    for (let i = 0; i < whitelistLength; i++) {
      const investSigner = await ethers.getSigner(whitelists[i]);
      const vaultInvest = await hre.ethers.getContractAt(
        "Vault", // 替换为你的合约名称
        vault,
        investSigner
      )
      const manageFee=await vaultInvest.manageFee();
      const investAmount = BigInt(Math.floor(distribution[i] * 1e6));
      const feeAmount = investAmount * BigInt(manageFee) / BigInt(10000);
      const totalInvestAmount = investAmount + feeAmount;
      investArr.push(totalInvestAmount)
      console.log("investAmount:",investAmount.toString(),"feeAmount:",feeAmount.toString(),"totalInvestAmount:",totalInvestAmount.toString())

      
      await expect(USDT.connect(investSigner).mint(whitelists[i], totalInvestAmount)).not.to.be.reverted;
      await expect(USDT.connect(investSigner).approve(vault, totalInvestAmount)).not.to.be.reverted;
      await expect(vaultInvest.deposit(investAmount)).not.to.be.reverted;
      expect(await vaultInvest.balanceOf(whitelists[i])).to.equal(investAmount);
    }
    expect(await VAULT.assetBalance()).to.equal(maxSupply)
    console.log("total deposit balance",await VAULT.assetBalance())
    console.log("total manageFee Balance",await VAULT.manageFeeBalance())
    console.log("total Balance",await USDT.balanceOf(vault))
    var expectedErrorMessage = `AccessControl: account ${deployer.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
    console.log("expectedErrorMessage",expectedErrorMessage)

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    console.log("tc-40: 等待认购期结束...");
    await delay(40000);

    //提前认购完成MaxSupply100%，认购期结束后执行赎回，赎回失败
    const investSigner = await ethers.getSigner(whitelists[0]);
    const vaultInvest = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      investSigner
    )
    await expect(vaultInvest.redeem()).to.be.revertedWith("Vault: not allowed withdraw");

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

    // expect(await rbfDrds.depositPrice()).to.be.equal(financePrice);
    expect(await rbfDrds.depositMintAmount()).to.be.equal(maxSupply);

    //此时查询RBF的金额为0
    expect(await rbfManager.balanceOf(vault)).to.be.equal(0);
    
    //是MANAGER_ROLE角色的账户执行claimDeposit，执行成功
    await expect(rbfManager.claimDeposit()).not.to.be.reverted;
    expect(await rbfManager.balanceOf(vault)).to.be.equal(maxSupply);

    //派息
    const randomMultiplier = 1.1 + Math.random() * 0.4;
    console.log("派息系数:",randomMultiplier)
    const principalInterest = Math.floor(totalSupply * randomMultiplier);
    const waitMint = BigInt(Math.floor(principalInterest - totalSupply) * 1e6);
    await expect(USDT.mint(depositTreasury, waitMint)).not.to.be.reverted;
    const dividendCountArr = distributeMoneyWithMinimum(
          principalInterest,
          whitelists.length,
          1
    );
    const totalNav= await USDT.balanceOf(depositTreasury);
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
      const dividendAmount = BigInt(Math.floor(dividendCountArr[i] * 1e6));
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
      incomeArr.push(investorBalance);
      totalDividend=totalDividend+investorBalance;
    }
    console.log("总派息额",totalDividend - investorBalance_before_all)
    console.log(investArr)
    console.log(incomeArr)
    expect(totalDividend - investorBalance_before_all).to.equal(totalNav);
    const manageBalance_befor = await USDT.balanceOf(feeReceiver)
    //提前完成融资，认购期结束后，非管理员提取管理费失败
    expectedErrorMessage = `AccessControl: account ${investor1.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
    await expect(vaultInvest.withdrawManageFee()).to.be.revertedWith(expectedErrorMessage);
    //提前完成融资，认购期结束后，管理员提取管理费成功
    await expect(vaultManager.withdrawManageFee()).not.to.be.reverted;

    const manageBalance_after =await USDT.balanceOf(feeReceiver)
    const manageFee = await VAULT.manageFee();
    expect(manageBalance_after).to.be.equal(manageBalance_befor + maxSupply * manageFee / BigInt(10000));

  });


  //管理费等于0，提取管理费
  it("tc-61", async function () {
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
        "RBF-60", "RBF-60",
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
    const subEndTime = subStartTime + 40;
    const vaultDeployData = {
        vaultId: vaultId,
        name: "RbfVaultForTc60",
        symbol: "RbfVaultForTc60",
        assetToken: usdt.address,
        rbf: rbfData.rbf,
        subStartTime: subStartTime,
        subEndTime: subEndTime,
        duration: "2592000",
        fundThreshold: "3000",
        minDepositAmount: "10000000",
        manageFee: "0",
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
    // const fundThreshold = await VAULT.fundThreshold();
    // const target = maxSupply * fundThreshold / BigInt(10000);
    const financePrice=await VAULT.financePrice();
    const minDepositAmount = await VAULT.minDepositAmount();
    const totalSupply = Number(maxSupply / BigInt(1e6));
    const minAmount = Number(minDepositAmount / BigInt(1e6));

    
    var USDT:any;
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
    let incomeArr = new Array();

    const whitelistLength = await whitelists.length;
    const distribution = distributeMoneyWithMinimum(
      totalSupply,
      whitelistLength,
      minAmount
    );

    console.log("distribution.length",distribution.length)
    expect(distribution.length).to.equal(whitelistLength);

    for (let i = 0; i < whitelistLength; i++) {
      const investSigner = await ethers.getSigner(whitelists[i]);
      const vaultInvest = await hre.ethers.getContractAt(
        "Vault", // 替换为你的合约名称
        vault,
        investSigner
      )
      const manageFee=await vaultInvest.manageFee();
      expect(manageFee).to.equal(0);
      const investAmount = BigInt(Math.floor(distribution[i] * 1e6));
      const feeAmount = investAmount * BigInt(manageFee) / BigInt(10000);
      const totalInvestAmount = investAmount + feeAmount;
      investArr.push(totalInvestAmount)
      console.log("investAmount:",investAmount.toString(),"feeAmount:",feeAmount.toString(),"totalInvestAmount:",totalInvestAmount.toString())

      
      await expect(USDT.connect(investSigner).mint(whitelists[i], totalInvestAmount)).not.to.be.reverted;
      await expect(USDT.connect(investSigner).approve(vault, totalInvestAmount)).not.to.be.reverted;
      await expect(vaultInvest.deposit(investAmount)).not.to.be.reverted;
      expect(await vaultInvest.balanceOf(whitelists[i])).to.equal(investAmount);
    }
    expect(await VAULT.assetBalance()).to.equal(maxSupply)
    console.log("total deposit balance",await VAULT.assetBalance())
    console.log("total manageFee Balance",await VAULT.manageFeeBalance())
    console.log("total Balance",await USDT.balanceOf(vault))
    var expectedErrorMessage = `AccessControl: account ${deployer.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
    console.log("expectedErrorMessage",expectedErrorMessage)

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    console.log("tc-61: 等待认购期结束...");
    await delay(40000);

    //提前认购完成MaxSupply100%，认购期结束后执行赎回，赎回失败
    const investSigner = await ethers.getSigner(whitelists[0]);
    const vaultInvest = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      investSigner
    )
    await expect(vaultInvest.redeem()).to.be.revertedWith("Vault: not allowed withdraw");

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

    // expect(await rbfDrds.depositPrice()).to.be.equal(financePrice);
    expect(await rbfDrds.depositMintAmount()).to.be.equal(maxSupply);

    //此时查询RBF的金额为0
    expect(await rbfManager.balanceOf(vault)).to.be.equal(0);
    
    //是MANAGER_ROLE角色的账户执行claimDeposit，执行成功
    await expect(rbfManager.claimDeposit()).not.to.be.reverted;
    expect(await rbfManager.balanceOf(vault)).to.be.equal(maxSupply);

    //派息
    const randomMultiplier = 1.1 + Math.random() * 0.4;
    console.log("派息系数:",randomMultiplier)
    const principalInterest = Math.floor(totalSupply * randomMultiplier);
    const waitMint = BigInt(Math.floor(principalInterest - totalSupply) * 1e6);
    await expect(USDT.mint(depositTreasury, waitMint)).not.to.be.reverted;
    const dividendCountArr = distributeMoneyWithMinimum(
          principalInterest,
          whitelists.length,
          1
    );
    const totalNav= await USDT.balanceOf(depositTreasury);
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
      const dividendAmount = BigInt(Math.floor(dividendCountArr[i] * 1e6));
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
      incomeArr.push(investorBalance);
      totalDividend=totalDividend+investorBalance;
    }
    console.log("总派息额",totalDividend - investorBalance_before_all)
    console.log(investArr)
    console.log(incomeArr)
    expect(totalDividend - investorBalance_before_all).to.equal(totalNav);
    const manageBalance_befor = await USDT.balanceOf(feeReceiver)
    //提前完成融资，认购期结束后，非管理员提取管理费失败
    expectedErrorMessage = `AccessControl: account ${investor1.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
    await expect(vaultInvest.withdrawManageFee()).to.be.revertedWith(expectedErrorMessage);
    //提前完成融资，认购期结束后，管理员提取管理费成功
    await expect(vaultManager.withdrawManageFee()).not.to.be.reverted;

    const manageBalance_after =await USDT.balanceOf(feeReceiver)
    const manageFee = await VAULT.manageFee();
    expect(manageBalance_after).to.be.equal(manageBalance_befor + maxSupply * manageFee / BigInt(10000));

  });

  //Vault白名单地址包含零地址，是否影响正常功能
  it("tc-42", async function () {
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
        "RBF-42", "RBF-42",
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

    const whitelists = [investor1, ethers.ZeroAddress];
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
        name: "RbfVaultForTc42",
        symbol: "RbfVaultForTc42",
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
    const financePrice=await VAULT.financePrice();
    const totalSupply = Number(maxSupply / BigInt(1e6));
    
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
    let incomeArr = new Array();

    const investSigner_0 = await ethers.getSigner(whitelists[0]);
    const vaultInvest_0 = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      investSigner_0
    )
    const manageFee=await vaultInvest_0.manageFee();
    const investAmount = BigInt(Math.floor(totalSupply * 1e6));
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
    await expect(vaultInvest_0.deposit(investAmount)).not.to.be.reverted;
    expect(await vaultInvest_0.balanceOf(whitelists[0])).to.equal(investAmount);
    expect(await VAULT.assetBalance()).to.equal(maxSupply)
    console.log("total deposit balance",await VAULT.assetBalance())
    console.log("total manageFee Balance",await VAULT.manageFeeBalance())
    console.log("total Balance",await USDT.balanceOf(vault))
    var expectedErrorMessage = `AccessControl: account ${deployer.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
    console.log("expectedErrorMessage",expectedErrorMessage)

    const investSigner = await ethers.getSigner(whitelists[0]);
    const vaultInvest = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      investSigner
    )
      
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
    //是MANAGER_ROLE角色的账户执行claimDeposit，执行成功
    await expect(rbfManager.claimDeposit()).not.to.be.reverted;
    expect(await rbfManager.balanceOf(vault)).to.be.equal(maxSupply);

    //派息
    const randomMultiplier = 1.1 + Math.random() * 0.4;
    console.log("派息系数:",randomMultiplier)
    const principalInterest = Math.floor(totalSupply * randomMultiplier);
    const waitMint = BigInt(Math.floor(principalInterest - totalSupply) * 1e6);
    await expect(USDT.mint(depositTreasury, waitMint)).not.to.be.reverted;
    const dividendCountArr = distributeMoneyWithMinimum(
          principalInterest,
          1,
          1
    );
    const totalNav= await USDT.balanceOf(depositTreasury);
    console.log("总派息资产:",totalNav.toString())

    const depositTreasurySigner = await ethers.getSigner(depositTreasury);
    const USDTdepositTreasury = await ethers.getContractAt(
      "MockUSDT",
      usdt.address,
      depositTreasurySigner
    );
    
    
    // Create a promise-based delay function
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    console.log("开始等待...");
    await delay(60000);

    //派息前给白名单列表中的零地址转一部分钱，转账失败
    const investSigner1 = await ethers.getSigner(investor1);
    const vaultInvest1 = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      investSigner1
    )
    const balance1 = await vaultInvest.balanceOf(investor1);
    await expect(vaultInvest1.transfer(whitelists[1],balance1)).to.be.revertedWith("ERC20: transfer to the zero address");

    const rbfDividendTreasury = await rbfManager.dividendTreasury();
    const vaultDividendTreasury = await vaultManager.dividendTreasury();
    

    for (let i = 0; i < dividendCountArr.length; i++) {
      const dividendAmount = BigInt(Math.floor(dividendCountArr[i] * 1e6));
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
      incomeArr.push(investorBalance);
      totalDividend=totalDividend+investorBalance;
    }
    console.log("总派息额",totalDividend)
    console.log(investArr)
    console.log(incomeArr)
    expect(totalDividend).to.equal(totalNav);
  });

  //融资时间结束且达到融资阈值，派息
  it("tc-43", async function () {
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
        "RBF-43", "RBF-43",
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
    const subEndTime = subStartTime + 40;
    const vaultDeployData = {
        vaultId: vaultId,
        name: "RbfVaultForTc43",
        symbol: "RbfVaultForTc43",
        assetToken: usdt.address,
        rbf: rbfData.rbf,
        subStartTime: subStartTime,
        subEndTime: subEndTime,
        duration: "2592000",
        fundThreshold: "3000",
        minDepositAmount: "10000000", //10U
        manageFee: "50",
        manager: manager,
        feeReceiver: feeReceiver,
        dividendEscrow: manager, // 添加这一行
        whitelists: whitelists,
        guardian: guardian,
        maxSupply: "10000000000", //金额10000U
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
    const financePrice=await VAULT.financePrice();
    const minDepositAmount = await VAULT.minDepositAmount();
    const totalSupply = Number(target / BigInt(1e6));
    const minAmount = Number(minDepositAmount / BigInt(1e6));

    const distribution = distributeMoneyWithMinimum(
      totalSupply,
      whitelists.length,
      minAmount
    );
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
    let incomeArr = new Array();

    for (let i = 0; i < whitelists.length; i++) {
      const investSigner = await ethers.getSigner(whitelists[i]);
      const vaultInvest = await hre.ethers.getContractAt(
        "Vault", // 替换为你的合约名称
        vault,
        investSigner
      )
      const manageFee=await vaultInvest.manageFee();
      const investAmount = BigInt(Math.floor(distribution[i] * 1e6));
      const feeAmount = investAmount * BigInt(manageFee) / BigInt(10000);
      const totalInvestAmount = investAmount + feeAmount;
      investArr.push(totalInvestAmount)
      console.log("investAmount:",investAmount.toString(),"feeAmount:",feeAmount.toString(),"totalInvestAmount:",totalInvestAmount.toString())

      USDT = await ethers.getContractAt(
        "MockUSDT",
        usdt.address,
        investSigner
      );
      await expect(USDT.mint(whitelists[i], totalInvestAmount)).not.to.be.reverted;
      await expect(USDT.approve(vault, totalInvestAmount)).not.to.be.reverted;
      await expect(vaultInvest.deposit(investAmount)).not.to.be.reverted;
      expect(await vaultInvest.balanceOf(whitelists[i])).to.equal(investAmount);
    }
    expect(await VAULT.assetBalance()).to.equal(target)
    console.log("total deposit balance",await VAULT.assetBalance())
    console.log("total manageFee Balance",await VAULT.manageFeeBalance())
    console.log("total Balance",await USDT.balanceOf(vault))
    
    //白名单中的账户相互转账,在结束时间之前，转账失败
    const investSigner = await ethers.getSigner(whitelists[0]);
    const vaultInvest = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      investSigner
    )
    await expect(vaultInvest.transfer(whitelists[1],10)).to.be.revertedWith("Vault: Invalid endTime");

    
    const investSigner1 = await ethers.getSigner(whitelists[1]);
    const vaultInvest1 = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      investSigner1
    )

    await expect(vaultInvest1.transferFrom(whitelists[1],whitelists[2],10)).to.be.revertedWith("Vault: Invalid endTime");


    // await expect(vaultInvest1.transferFrom(whitelists[1],whitelists[2],10)).to.be.revertedWith("ERC20: insufficient allowance");

    // Create a promise-based delay function
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    console.log("开始等待...");
    await delay(40000); 

    //执行策略前白名单中的账户相互转账，转账失败
    await expect(vaultInvest.transfer(whitelists[1],10)).to.be.revertedWith("Vault: Invalid endTime");
    await expect(vaultInvest1.transferFrom(whitelists[1],whitelists[2],10)).to.be.revertedWith("Vault: Invalid endTime");

   
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
    );

    //执行策略后白名单中的账户相互转账，转账成功
    await expect(vaultInvest.transfer(whitelists[1],10)).not.to.be.reverted;
    await expect(vaultInvest1.transferFrom(whitelists[1],whitelists[2],10)).to.be.revertedWith("ERC20: insufficient allowance");

    //授权自己
    await expect(vaultInvest1.approve(whitelists[1],10)).not.to.be.reverted;

    await expect(vaultInvest1.transferFrom(whitelists[1],whitelists[2],10)).not.to.be.reverted;

    //白名单中的账户相互转账,可以成功
    const investSigner2 = await ethers.getSigner(whitelists[2]);
    const vaultInvest2 = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      investSigner2
    )
    
    await expect(vaultInvest1.transferFrom(whitelists[2],whitelists[3],10)).to.be.revertedWith("ERC20: insufficient allowance");

    //授权第三方为白名单中的账户
    await expect(vaultInvest2.approve(whitelists[1],10)).not.to.be.reverted;
    await expect(vaultInvest1.transferFrom(whitelists[2],whitelists[3],10)).not.to.be.reverted;

    const commonSigner = await ethers.getSigner(common);
    const commonAccount = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      commonSigner
    )
    await expect(commonAccount.transferFrom(whitelists[2],whitelists[3],10)).to.be.revertedWith("ERC20: insufficient allowance");
    await expect(vaultManager.transferFrom(whitelists[2],whitelists[3],10)).to.be.revertedWith("ERC20: insufficient allowance");

    // //授权第三方不是白名单中的账户
    await expect(vaultInvest2.approve(common,10)).not.to.be.reverted;
    await expect(commonAccount.transferFrom(whitelists[2],whitelists[3],10)).not.to.be.reverted;

    //授权第三方不是白名单中的账户，是vaultManager
    await expect(vaultInvest2.approve(manager,10)).not.to.be.reverted;
    await expect(vaultManager.transferFrom(whitelists[2],whitelists[3],10)).not.to.be.reverted;

    //白名单中的账户向非白名单的账户转账，执行失败
    const WhitelistSigner = await ethers.getSigner(whitelists[2]);
    const vaultWhitelist = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      WhitelistSigner
    )
    await expect(vaultWhitelist.transfer(common,100000)).to.be.revertedWith("Vault: transfer from and to must in onChainWL or offChainWL");
    await expect(vaultInvest.transferFrom(whitelists[1],common,1000)).to.be.revertedWith("Vault: transfer from and to must in onChainWL or offChainWL");
    //不是白名单中的账户向白名单中的账户转账，执行失败
    await expect(vaultInvest.transferFrom(common,whitelists[1],1000)).to.be.revertedWith("Vault: transfer from and to must in onChainWL or offChainWL");


    //执行赎回，赎回失败
    await expect(vaultInvest.redeem()).to.be.revertedWith("Vault: not allowed withdraw");

    //提前管理费
    await expect(vaultManager.withdrawManageFee()).not.to.be.reverted;

    //此时查询RBF的金额为0
    expect(await rbfManager.balanceOf(vault)).to.be.equal(0);

    await expect(rbfDrds.setMintAmount(target)).not.to.be.reverted;

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

    expect(await rbfDrds.depositMintAmount()).to.be.equal(target);

    await expect(rbfManager.claimDeposit()).not.to.be.reverted;
    expect(await rbfManager.balanceOf(vault)).to.be.equal(target);

    //派息
    const randomMultiplier = 1.1 + Math.random() * 0.4;
    console.log("派息系数:",randomMultiplier)
    const principalInterest = Math.floor(totalSupply * randomMultiplier);
    const waitMint = BigInt(Math.floor(principalInterest - totalSupply) * 1e6);
    await expect(USDT.mint(depositTreasury, waitMint)).not.to.be.reverted;
    const dividendCountArr = distributeMoneyWithMinimum(
          principalInterest,
          whitelists.length,
          1
    );
    const totalNav= await USDT.balanceOf(depositTreasury);
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
      const dividendAmount = BigInt(Math.floor(dividendCountArr[i] * 1e6));
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
      incomeArr.push(investorBalance);
      totalDividend=totalDividend+investorBalance;
    }
    console.log("总派息额",totalDividend)
    console.log(investArr)
    console.log(incomeArr)
    expect(totalDividend).to.equal(totalNav);
  });
  //融资结束时间到，但是没有达到投资阈值,执行赎回操作
  it("tc-44:fundraising fail", async function () {
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
        "RBF-44", "RBF-44",
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
    const subEndTime = subStartTime + 20;
    const vaultDeployData = {
        vaultId: vaultId,
        name: "RbfVaultForTc44",
        symbol: "RbfVaultForTc44",
        assetToken: usdt.address,
        rbf: rbfData.rbf,
        subStartTime: subStartTime,
        subEndTime: subEndTime,
        duration: "60",
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

    const investSigner = await ethers.getSigner(whitelists[0]);
    const vaultInvest = await hre.ethers.getContractAt(
        "Vault", // 替换为你的合约名称
        vault,
        investSigner
    )
    
    const manageFee=await vaultInvest.manageFee();
    const minDepositAmount = await vaultInvest.minDepositAmount();
    const investAmount = BigInt(minDepositAmount);
    const feeAmount = investAmount  * BigInt(manageFee) / BigInt(10000);
    const totalInvestAmount = investAmount + feeAmount;
    console.log("investAmount:",investAmount.toString(),"feeAmount:",feeAmount.toString(),"totalInvestAmount:",totalInvestAmount.toString())

    const USDT = await ethers.getContractAt(
      "MockUSDT",
      usdt.address,
      investSigner
    );
    await USDT.mint(whitelists[0], totalInvestAmount);


    await USDT.approve(vault, totalInvestAmount);

    await vaultInvest.deposit(investAmount);

    //认购未达到阈值，未到认购截止时间时间执行赎回
    await expect(vaultInvest.redeem()).to.be.revertedWith("Vault: Invalid time")
    

    const redeemBalance = await USDT.balanceOf(whitelists[0]);
    console.log(whitelists[0]+":redeem",redeemBalance.toString());
    expect(redeemBalance).to.equal(0);

    const managerSigner = await ethers.getSigner(manager);
    const vaultManager=await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      managerSigner
    )
    //认购未达到阈值,未到截止时间，提取管理费
    await expect(vaultManager.withdrawManageFee()).to.be.revertedWith("Vault: Invalid endTime");
    const rbfManager = await hre.ethers.getContractAt(
      "RBF", // 替换为你的合约名称
      rbf,
      managerSigner
    )
    console.log("subStartTime",subStartTime)
    console.log("subEndTime",subEndTime)
    
    //是MANAGER_ROLE角色的账户执行setVault
    await expect(rbfManager.setVault(vault)).not.to.be.reverted;
    console.log("current time",Math.floor(Date.now() / 1000))
    //setVault之后执行策略，既是MANAGER_ROLE又是vault，然后执行策略
    //在认购期间执行策略失败
    await expect(vaultManager.execStrategy()).to.be.revertedWith("Vault: fundraising fail");  

    // Create a promise-based delay function
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    console.log("tc-44: 等待认购期结束...");
    
    await delay(20000);

    //账户之间转账


    //认购结束但是未达到融资阈值，执行策略失败
    await expect(vaultManager.execStrategy()).to.be.revertedWith("Vault: fundraising fail"); 

    //没有认购的白名单账户执行赎回操作
    const investSigner1 = await ethers.getSigner(whitelists[1]);
    const vaultInvest1 = await hre.ethers.getContractAt(
        "Vault", // 替换为你的合约名称
        vault,
        investSigner1
      )
    await expect(vaultInvest1.redeem()).not.to.be.reverted;
    const redeemBalance_1= await USDT.balanceOf(whitelists[1]);
    console.log(whitelists[1]+":reddem",redeemBalance_1.toString());
    expect(redeemBalance_1).to.equal(0);

    //认购的白名单账户执行赎回操作,没有授权，提取失败
    await expect(vaultInvest.redeem()).to.be.revertedWith("ERC20: insufficient allowance");

    const VAULT = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
    )

    //授权
    // approve
    await vaultInvest.approve(vault, totalInvestAmount);

    //不在线上白名单中的账户执行赎回
    const commonSigner = await ethers.getSigner(common);
    await expect(VAULT.connect(commonSigner).redeem()).to.be.revertedWith("Vault: you are not in onChainWL");

    //在线上白名单中的账户执行赎回，赎回成功
    await expect(vaultInvest.redeem()).not.to.be.reverted;
      

    const redeemBalance_0 = await USDT.balanceOf(whitelists[0]);
    console.log(whitelists[0]+":redeem",redeemBalance_0.toString());
    expect(redeemBalance_0).to.equal(totalInvestAmount);

    //融资未达到阈值，认购期结束后（计息期间），提取管理费
    await expect(vaultManager.withdrawManageFee()).to.be.revertedWith("Vault: Invalid endTime");

    console.log("开始等待计息...");
    await delay(60000);

    //融资未达到阈值，锁定期结束后，提取管理费
    await expect(vaultManager.withdrawManageFee()).to.be.revertedWith("Vault: Invalid endTime");

  });

  //线上线下混合认购及派息:认购MaxSupply
  it("tc-54", async function () {
    const {execute} = deployments;
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common,drds,investor6} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-54", "RBF-54",
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
        name: "RbfVaultForTc54",
        symbol: "RbfVaultForTc54",
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
    
    //不是MANAGER_ROLE角色的账户执行添加到线下白名单，执行失败
    await expect(VAULT.connect(commonSigner).addToOffChainWL(whitelists[0])).to.be.revertedWith(expectedErrorMessage);
    
    //不是MANAGER_ROLE角色的账户执行添加到线上白名单，执行失败
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
        
        //在认购期内，是MANAGER_ROLE角色的账户执行添加到线上白名单，且被添加的账户不在线上白名单，执行成功
        await expect(vaultManager.addToOnChainWL(whitelists[i])).not.to.be.reverted;
        
        //在认购期内，添加已经在线上白名单的账户到线下白名单，执行失败
        await expect(vaultManager.addToOffChainWL(whitelists[i])).to.be.revertedWith("Vault: Address is already onChainWL");
        await expect(USDT.mint(whitelists[i], totalInvestAmount)).not.to.be.reverted;
        await expect(USDT.approve(vault, totalInvestAmount)).not.to.be.reverted;
        onChainInvest+=investAmount;
        await expect(VAULT.connect(commonSigner).deposit(investAmount)).to.be.revertedWith("Vault: you are not in onChainWL");
        await expect(vaultInvest.deposit(investAmount)).not.to.be.reverted;
      } else {
        investArr.push(investAmount);

        //是MANAGER_ROLE角色的账户执行添加到线下白名单，且被添加的账户不在线下白名单，执行成功
        await expect(vaultManager.addToOffChainWL(whitelists[i])).not.to.be.reverted;

        //添加已经在线下白名单的账户到线下白名单，执行失败
        await expect(vaultManager.addToOffChainWL(whitelists[i])).to.be.revertedWith("Vault: Address is already offChainWL");
        
        //从线下白名单中删除不在线下白名单的账户，执行失败
        await expect(vaultManager.removeFromOffChainWL(common)).to.be.revertedWith("Vault: Address is not in the offChain whitelist");
        
        await expect(vaultManager.addToOffChainWL(common)).not.to.be.reverted;
       
        //在认购期内从线下白名单中删除在线下白名单中的账户，并且当前账户没有认购，删除成功
        await expect(vaultManager.removeFromOffChainWL(common)).not.to.be.reverted;

        //添加已经在线下白名单的账户到线上白名单，执行失败
        await expect(vaultManager.addToOnChainWL(whitelists[i])).to.be.revertedWith("Vault: Address is already offChainWL");
        
        //在认购期内，线下白名单账户认购符合要求的金额，执行者不是MANAGER_ROLE，执行失败
        await expect(VAULT.connect(commonSigner).offChainDepositMint(whitelists[i],investAmount)).to.be.revertedWith(expectedErrorMessage);
        
        //线上白名单中的账户执行线下认购，执行失败
        await expect(vaultManager.offChainDepositMint(whitelists[0],investAmount)).to.be.revertedWith("Vault:OffChain receiver are not in offChainWL");
        
        //在认购期内，线下白名单账户认购符合要求的金额，并且执行者是MANAGER_ROLE，执行成功
        await expect(vaultManager.offChainDepositMint(whitelists[i],investAmount)).not.to.be.reverted;
        if(i==1){
          const inverstorSigners = await ethers.getSigner(whitelists[0]);
          const inverstorSigners_1 = await ethers.getSigner(whitelists[1]);
          const balance = await vaultInvest.balanceOf(whitelists[0]);
          const balance_1 = await vaultInvest.balanceOf(whitelists[1]);
          
          //认购期内线上白名单账户给线下白名单账户转账，执行失败
          await expect(VAULT.connect(inverstorSigners).transfer(whitelists[1],balance)).to.be.revertedWith("Vault: Invalid endTime");

          //认购期内线上白名单账户给线上白名单账户转账，执行失败
          await expect(VAULT.connect(inverstorSigners).transfer(whitelists[2],balance)).to.be.revertedWith("Vault: Invalid endTime");

          //认购期内线下白名单账户给线上白名单账户转账，执行失败
          await expect(VAULT.connect(inverstorSigners_1).transfer(whitelists[0],balance_1)).to.be.revertedWith("Vault: Invalid endTime");

          //认购期内线下白名单账户给线下白名单账户转账，执行失败
          await expect(VAULT.connect(inverstorSigners_1).transfer(whitelists[3],balance_1)).to.be.revertedWith("Vault: Invalid endTime");
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

    //认购期内，线下赎回失败
    const offlineInvestorSigners = await ethers.getSigner(whitelists[1]);
    await expect(VAULT.connect(offlineInvestorSigners).offChainRedeem()).to.be.revertedWith("Vault: Invalid time");
    // await VAULT.connect(offlineInvestorSigners).approve(vault, totalInvestAmount);
    // await expect(VAULT.connect(offlineInvestorSigners).offChainRedeem()).not.to.be.reverted;
    

    //认购期内，从线下白名单中删除已经认购资产的账户，删除失败
    await expect(vaultManager.removeFromOffChainWL(investor2)).to.be.revertedWith("Vault: Address has balance");

    // Create a promise-based delay function
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    console.log("开始等待...");
    await delay(60000);
    console.log("等待结束");

    //认购期结束后，添加账户到线下白名单，添加失败
    await expect(vaultManager.addToOffChainWL(common)).to.be.revertedWith("Vault: Invalid time");
    
    //认购期结束后，从线下白名单中删除已经认购资产的账户，删除失败
    await expect(vaultManager.removeFromOffChainWL(investor1)).to.be.revertedWith("Vault: Invalid time");

    const inverstorSigners = await ethers.getSigner(whitelists[0]);
    const balance = await vaultInvest.balanceOf(whitelists[0]);

    //认购期结束后，执行策略之前线上白名单账户给线下白名单账户转账，执行失败
    await expect(VAULT.connect(inverstorSigners).transfer(whitelists[1],balance)).to.be.revertedWith("Vault: Invalid endTime");

    //认购期结束后，执行策略之前线上白名单账户给线上白名单账户转账，执行失败
    await expect(VAULT.connect(inverstorSigners).transfer(whitelists[2],balance)).to.be.revertedWith("Vault: Invalid endTime");

    const inverstorSigners_1 = await ethers.getSigner(whitelists[1]);
    const balance_1 = await vaultInvest.balanceOf(whitelists[1]);

    //认购期结束后，执行策略之前线下白名单账户给线下白名单账户转账，执行失败
    await expect(VAULT.connect(inverstorSigners_1).transfer(whitelists[3],balance_1)).to.be.revertedWith("Vault: Invalid endTime");

    //认购期结束后，执行策略之前线下白名单账户给线上白名单账户转账，执行失败
    await expect(VAULT.connect(inverstorSigners_1).transfer(whitelists[0],balance_1)).to.be.revertedWith("Vault: Invalid endTime");

    await expect(VAULT.execStrategy()).to.be.revertedWith(expectedErrorMessage);
    await expect(vaultManager.execStrategy()).to.be.revertedWith(
      "RBF: you are not vault"
    );

    await expect(rbfManager.setVault(vault)).not.to.be.reverted;
    await expect(rbfManager.setVault(vault)).to.be.revertedWith(
      "RBF: vaultAddr already set"
    );
    await expect(vaultManager.execStrategy()).not.to.be.reverted;

    //认购期结束且执行策略后线上白名单给线下白名单账户转账，执行成功
    await expect(VAULT.connect(inverstorSigners).transfer(whitelists[1],balance)).not.to.be.reverted;

    //认购期结束且执行策略后线下白名单给线上白名单账户转账，执行成功
    await expect(VAULT.connect(inverstorSigners_1).transfer(whitelists[0],BigInt(1))).not.to.be.reverted;

    //认购期结束且执行策略后线下白名单给线下白名单账户转账，执行成功
    await expect(VAULT.connect(inverstorSigners_1).transfer(whitelists[3],BigInt(1))).not.to.be.reverted;

    //认购期结束且执行策略后线下白名单给线下白名单账户转账，执行成功
    await expect(VAULT.connect(inverstorSigners).transfer(whitelists[2],BigInt(1))).not.to.be.reverted;

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

    //融资生效后线下赎回，执行失败
    await expect(VAULT.connect(offlineInvestorSigners).offChainRedeem()).to.be.revertedWith("Vault: not allowed withdraw");
  
  });


  it("tc-55", async function () {
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
        "RBF-55", "RBF-55",
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
        name: "RbfVaultForTc55",
        symbol: "RbfVaultForTc55",
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
    
    //线下认购金额小于最小认购金额，认购失败
    await expect(vaultManager.offChainDepositMint(whitelists[0],minDepositAmount - BigInt(1))).to.be.revertedWith("Vault: OffChain deposit less than min");

    //线下认购金额大于maxsupply，认购失败
    await expect(vaultManager.offChainDepositMint(whitelists[0],maxSupply + BigInt(1))).to.be.revertedWith("Vault: maxSupply exceeded");

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

    //线上认购小于最小认购金额，认购失败
    await expect(vaultInvest.deposit(minDepositAmount - BigInt(1))).to.be.revertedWith("Vault: deposit less than min");

    await expect(vaultInvest.deposit(investAmount)).not.to.be.reverted; 

    const off_investAmount = BigInt(Math.floor(distribution[1] * 1e6));

    //线上认购大于maxsupply-已认购金额，认购失败

    const investAmount_2 = off_investAmount + BigInt(100)
    const feeAmount_2 = (investAmount_2 * BigInt(manageFee)) / BigInt(10000);
    const totalInvestAmount_2 = investAmount_2 + feeAmount_2;
    await expect(USDT.mint(whitelists[1], totalInvestAmount_2)).not.to.be.reverted;
    await expect(USDT.approve(vault, totalInvestAmount_2)).not.to.be.reverted;
    await expect(vaultInvest.deposit(investAmount_2)).to.be.revertedWith("Vault: maxSupply exceeded");
    
    //线下认购大于maxsupply-已认购金额，认购失败
    await expect(vaultManager.offChainDepositMint(whitelists[0],off_investAmount + BigInt(100))).to.be.revertedWith("Vault: maxSupply exceeded");

    // Create a promise-based delay function
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    console.log("开始等待...");
    await delay(60000);

    //认购期结束后，线下认购，执行失败
    await expect(vaultManager.offChainDepositMint(whitelists[0],maxSupply)).to.be.revertedWith("Vault: Invalid time");
    
  });


  //融资未生效
  it("tc-56", async function () {
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
        "RBF-56", "RBF-56",
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
        name: "RbfVaultForTc56",
        symbol: "RbfVaultForTc56",
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

    //whitelists[0]加入线下认购白名单
    await expect(vaultManager.addToOffChainWL(whitelists[0])).not.to.be.reverted;
    
    //whitelists[0]线下认购金额小于最小认购金额，认购失败
    await expect(vaultManager.offChainDepositMint(whitelists[0],minDepositAmount - BigInt(1))).to.be.revertedWith("Vault: OffChain deposit less than min");

    const rbfManager = await hre.ethers.getContractAt(
      "RBF",
      rbf,
      managerSigner
    );

    //whitelists[1]加入线上认购白名单
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

    //whitelists[1]线上认购 
    await expect(USDT.mint(whitelists[1], totalInvestAmount)).not.to.be.reverted;
    await expect(USDT.approve(vault, totalInvestAmount)).not.to.be.reverted;
    await expect(vaultInvest.deposit(investAmount)).not.to.be.reverted; 

    //whitelists[0]线下认购 
    const off_investAmount = BigInt(Math.floor(distribution[1] * 1e6));
    console.log("off_investAmount:",off_investAmount.toString());
    await expect(vaultManager.offChainDepositMint(whitelists[0],off_investAmount)).not.to.be.reverted;

    const offlineInvestorSigners = await ethers.getSigner(whitelists[0]);

    //线下认购者在认购期内执行线下赎回，执行失败
    await expect(VAULT.connect(offlineInvestorSigners).offChainRedeem()).to.be.revertedWith("Vault: Invalid time");

    //不在线下白名单的账户执行线下赎回，执行失败
    await expect(VAULT.connect(investSigner).offChainRedeem()).to.be.revertedWith("Vault: you are not in offChainWL");

    //认购期内执行策略，执行失败
    await expect(rbfManager.setVault(vault)).not.to.be.reverted;
    await expect(vaultManager.execStrategy()).to.be.revertedWith("Vault: fundraising fail");


    // Create a promise-based delay function
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    console.log("开始等待...");
    await delay(60000);

    //线上线下白名单账户转账，未执行策略转账失败
    const inverstorSigners = await ethers.getSigner(whitelists[0]);
    const balance = await vaultInvest.balanceOf(whitelists[0]);
    await expect(VAULT.connect(inverstorSigners).transfer(whitelists[1],balance)).to.be.revertedWith("Vault: Invalid endTime");

    //融资未生效情况下setVault、执行策略
    // await expect(rbfManager.setVault(vault)).not.to.be.reverted;
    await expect(vaultManager.execStrategy()).to.be.revertedWith("Vault: fundraising fail");

    //融资未生效情况下，执行派息
    const randomMultiplier = 1.1 + Math.random() * 0.4;
    console.log("派息系数:",randomMultiplier)
    const principalInterest = Math.floor(Number(maxSupply) * randomMultiplier);
    const waitMint = BigInt(Math.floor(principalInterest - totalSupply) * 1e6);
    await expect(USDT.mint(depositTreasury, waitMint)).not.to.be.reverted;

    const dividendCountArr = distributeMoneyWithMinimum(
      principalInterest,
      1,
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
    // const vaultDividendTreasury = await vaultManager.dividendTreasury();
    for (let i = 0; i < dividendCountArr.length; i++) {
      const dividendAmount = BigInt(Math.floor(dividendCountArr[i] * 1e6));
      console.log("第" + (i + 1) + "次派息:", dividendAmount);
      await expect(
        USDTdepositTreasury.transfer(rbfDividendTreasury, BigInt(100))
      ).not.to.be.reverted;
      await expect(rbfManager.dividend()).to.be.revertedWith("RBF: totalSupply must be greater than 0");
      await expect(vaultManager.dividend()).to.be.revertedWith("Vault: No dividend to pay");
    }

    //认购期结束后，融资未生效，线下认购者在approve前线下赎回，赎回失败
    await expect(VAULT.connect(offlineInvestorSigners).offChainRedeem()).to.be.revertedWith("ERC20: insufficient allowance");
    await VAULT.connect(offlineInvestorSigners).approve(vault, off_investAmount);
    await expect(VAULT.connect(investSigner).offChainRedeem()).to.be.revertedWith("Vault: you are not in offChainWL");
    
    //认购期结束后，融资未生效，线下认购者在approve后线下赎回，赎回成功
    await expect(VAULT.connect(offlineInvestorSigners).offChainRedeem()).not.to.be.reverted;


    //认购期结束后，融资未生效，线上认购者在approve前线上赎回，赎回失败
    await expect(VAULT.connect(investSigner).redeem()).to.be.revertedWith("ERC20: insufficient allowance");
    await VAULT.connect(investSigner).approve(vault, totalInvestAmount);
    
    //认购期结束后，融资未生效，线上认购者在approve后线上赎回，赎回成功
    await expect(VAULT.connect(investSigner).redeem()).not.to.be.reverted;

    const redeemBalance_0 = await USDT.balanceOf(whitelists[1]);
    console.log(whitelists[0]+":redeem",redeemBalance_0.toString());
    expect(redeemBalance_0).to.equal(totalInvestAmount);
  
  });

  //全线下认购
  it("tc-57", async function () {
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
        "RBF-57", "RBF-57",
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
        name: "RbfVaultForTc57",
        symbol: "RbfVaultForTc57",
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

    // const inverstorSigners = await ethers.getSigner(whitelists[0]);
    // const balance = await vaultInvest.balanceOf(whitelists[0]);
    await expect(rbfManager.setVault(vault)).not.to.be.reverted;
    // const vaultSigner = await ethers.getSigner(vault);
    // await expect(rbfManager.connect(vaultSigner).requestDeposit(maxSupply)).not.to.be.reverted;
    await expect(vaultManager.execStrategy()).to.be.revertedWith("Vault: assetBalance is zero");
    //
    // await expect(VAULT.connect(inverstorSigners).transfer(whitelists[1],balance)).not.to.be.reverted;

    // // expect(await USDT.balanceOf(depositTreasury)).to.be.equal(onChainInvest);
    // // expect(await rbfManager.depositAmount()).to.be.equal(onChainInvest);
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
    // await expect(USDT.mint(depositTreasury, maxSupply+waitMint)).not.to.be.reverted;
    // const dividendCount = 4;
    // const dividendCountArr = distributeMoneyWithMinimum(
    //   principalInterest,
    //   dividendCount,
    //   1
    // );
    // const totalNav = await USDT.balanceOf(depositTreasury);
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
    // console.log("总派息额", totalDividend);
    // console.log(investArr);
    // console.log(incomeArr);
    // expect(totalDividend).to.equal(totalNav);
    // expect(incomeArr[0]).to.equal(BigInt(0)); 
  });

  //线上线下混合认购及派息:认购达到阈值
  it("tc-58", async function () {
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
        "RBF-58", "RBF-58",
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
        name: "RbfVaultForTc58",
        symbol: "RbfVaultForTc58",
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
    const financePrice = await VAULT.financePrice();
    const minDepositAmount = await VAULT.minDepositAmount();
    const totalSupply = Number(target / BigInt(1e6));
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
    
    //不是MANAGER_ROLE角色的账户执行添加到线下白名单，执行失败
    await expect(VAULT.connect(commonSigner).addToOffChainWL(whitelists[0])).to.be.revertedWith(expectedErrorMessage);
    
    //不是MANAGER_ROLE角色的账户执行添加到线上白名单，执行失败
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
        
        //在认购期内，是MANAGER_ROLE角色的账户执行添加到线上白名单，且被添加的账户不在线上白名单，执行成功
        await expect(vaultManager.addToOnChainWL(whitelists[i])).not.to.be.reverted;
        
        //在认购期内，添加已经在线上白名单的账户到线下白名单，执行失败
        await expect(vaultManager.addToOffChainWL(whitelists[i])).to.be.revertedWith("Vault: Address is already onChainWL");
        await expect(USDT.mint(whitelists[i], totalInvestAmount)).not.to.be.reverted;
        await expect(USDT.approve(vault, totalInvestAmount)).not.to.be.reverted;
        onChainInvest+=investAmount;
        await expect(VAULT.connect(commonSigner).deposit(investAmount)).to.be.revertedWith("Vault: you are not in onChainWL");
        await expect(vaultInvest.deposit(investAmount)).not.to.be.reverted;
      } else {
        investArr.push(investAmount);

        //是MANAGER_ROLE角色的账户执行添加到线下白名单，且被添加的账户不在线下白名单，执行成功
        await expect(vaultManager.addToOffChainWL(whitelists[i])).not.to.be.reverted;

        //添加已经在线下白名单的账户到线下白名单，执行失败
        await expect(vaultManager.addToOffChainWL(whitelists[i])).to.be.revertedWith("Vault: Address is already offChainWL");
        
        //从线下白名单中删除不在线下白名单的账户，执行失败
        await expect(vaultManager.removeFromOffChainWL(common)).to.be.revertedWith("Vault: Address is not in the offChain whitelist");
        
        await expect(vaultManager.addToOffChainWL(common)).not.to.be.reverted;
       
        //在认购期内从线下白名单中删除在线下白名单中的账户，并且当前账户没有认购，删除成功
        await expect(vaultManager.removeFromOffChainWL(common)).not.to.be.reverted;

        //添加已经在线下白名单的账户到线上白名单，执行失败
        await expect(vaultManager.addToOnChainWL(whitelists[i])).to.be.revertedWith("Vault: Address is already offChainWL");
        
        //在认购期内，线下白名单账户认购符合要求的金额，执行者不是MANAGER_ROLE，执行失败
        await expect(VAULT.connect(commonSigner).offChainDepositMint(whitelists[i],investAmount)).to.be.revertedWith(expectedErrorMessage);
        
        //线上白名单中的账户执行线下认购，执行失败
        await expect(vaultManager.offChainDepositMint(whitelists[0],investAmount)).to.be.revertedWith("Vault:OffChain receiver are not in offChainWL");
        
        //在认购期内，线下白名单账户认购符合要求的金额，并且执行者是MANAGER_ROLE，执行成功
        await expect(vaultManager.offChainDepositMint(whitelists[i],investAmount)).not.to.be.reverted;
        if(i==1){
          const inverstorSigners = await ethers.getSigner(whitelists[0]);
          const inverstorSigners_1 = await ethers.getSigner(whitelists[1]);
          const balance = await vaultInvest.balanceOf(whitelists[0]);
          const balance_1 = await vaultInvest.balanceOf(whitelists[1]);
          
          //认购期内线上白名单账户给线下白名单账户转账，执行失败
          await expect(VAULT.connect(inverstorSigners).transfer(whitelists[1],balance)).to.be.revertedWith("Vault: Invalid endTime");

          //认购期内线上白名单账户给线上白名单账户转账，执行失败
          await expect(VAULT.connect(inverstorSigners).transfer(whitelists[2],balance)).to.be.revertedWith("Vault: Invalid endTime");

          //认购期内线下白名单账户给线上白名单账户转账，执行失败
          await expect(VAULT.connect(inverstorSigners_1).transfer(whitelists[0],balance_1)).to.be.revertedWith("Vault: Invalid endTime");

          //认购期内线下白名单账户给线下白名单账户转账，执行失败
          await expect(VAULT.connect(inverstorSigners_1).transfer(whitelists[3],balance_1)).to.be.revertedWith("Vault: Invalid endTime");
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

    //认购期内，线下赎回失败
    const offlineInvestorSigners = await ethers.getSigner(whitelists[1]);
    await expect(VAULT.connect(offlineInvestorSigners).offChainRedeem()).to.be.revertedWith("Vault: Invalid time");
    // await VAULT.connect(offlineInvestorSigners).approve(vault, totalInvestAmount);
    // await expect(VAULT.connect(offlineInvestorSigners).offChainRedeem()).not.to.be.reverted;
    

    //认购期内，从线下白名单中删除已经认购资产的账户，删除失败
    await expect(vaultManager.removeFromOffChainWL(investor2)).to.be.revertedWith("Vault: Address has balance");

    // Create a promise-based delay function
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    console.log("开始等待...");
    await delay(60000);
    console.log("等待结束");

    //认购期结束后，从线下白名单中删除未认购资产的账户，删除失败
    await expect(vaultManager.addToOffChainWL(common)).to.be.revertedWith("Vault: Invalid time");
    
    //认购期结束后，从线下白名单中删除已经认购资产的账户，删除失败
    await expect(vaultManager.removeFromOffChainWL(investor1)).to.be.revertedWith("Vault: Invalid time");

    const inverstorSigners = await ethers.getSigner(whitelists[0]);
    const balance = await vaultInvest.balanceOf(whitelists[0]);

    //认购期结束后，执行策略之前线上白名单账户给线下白名单账户转账，执行失败
    await expect(VAULT.connect(inverstorSigners).transfer(whitelists[1],balance)).to.be.revertedWith("Vault: Invalid endTime");

    //认购期结束后，执行策略之前线上白名单账户给线上白名单账户转账，执行失败
    await expect(VAULT.connect(inverstorSigners).transfer(whitelists[2],balance)).to.be.revertedWith("Vault: Invalid endTime");

    const inverstorSigners_1 = await ethers.getSigner(whitelists[1]);
    const balance_1 = await vaultInvest.balanceOf(whitelists[1]);

    //认购期结束后，执行策略之前线下白名单账户给线下白名单账户转账，执行失败
    await expect(VAULT.connect(inverstorSigners_1).transfer(whitelists[3],balance_1)).to.be.revertedWith("Vault: Invalid endTime");

    //认购期结束后，执行策略之前线下白名单账户给线上白名单账户转账，执行失败
    await expect(VAULT.connect(inverstorSigners_1).transfer(whitelists[0],balance_1)).to.be.revertedWith("Vault: Invalid endTime");

    await expect(VAULT.execStrategy()).to.be.revertedWith(expectedErrorMessage);
    await expect(vaultManager.execStrategy()).to.be.revertedWith(
      "RBF: you are not vault"
    );

    await expect(rbfManager.setVault(vault)).not.to.be.reverted;
    await expect(rbfManager.setVault(vault)).to.be.revertedWith(
      "RBF: vaultAddr already set"
    );
    await expect(vaultManager.execStrategy()).not.to.be.reverted;

    //认购期结束且执行策略后线上白名单给线下白名单账户转账，执行成功
    await expect(VAULT.connect(inverstorSigners).transfer(whitelists[1],balance)).not.to.be.reverted;

    //认购期结束且执行策略后线下白名单给线上白名单账户转账，执行成功
    await expect(VAULT.connect(inverstorSigners_1).transfer(whitelists[0],BigInt(1))).not.to.be.reverted;

    //认购期结束且执行策略后线下白名单给线下白名单账户转账，执行成功
    await expect(VAULT.connect(inverstorSigners_1).transfer(whitelists[3],BigInt(1))).not.to.be.reverted;

    //认购期结束且执行策略后线下白名单给线下白名单账户转账，执行成功
    await expect(VAULT.connect(inverstorSigners).transfer(whitelists[2],BigInt(1))).not.to.be.reverted;

    expect(await USDT.balanceOf(depositTreasury)).to.be.equal(onChainInvest);
    expect(await rbfManager.depositAmount()).to.be.equal(onChainInvest);

    expectedErrorMessage = `AccessControl: account ${manager.toLowerCase()} is missing role ${ethers.keccak256(
      ethers.toUtf8Bytes("MINT_AMOUNT_SETTER_ROLE")
    )}`;
    await expect(rbfManager.setMintAmount(target)).to.be.revertedWith(
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

    await expect(rbfDrds.setMintAmount(target)).not.to.be.reverted;
    await expect(
      priceFeedDrds.addPrice(financePrice, Math.floor(Date.now() / 1000))
    ).not.to.be.reverted;
    expect(await rbfDrds.depositMintAmount()).to.be.equal(target);

    expect(await rbfManager.balanceOf(vault)).to.be.equal(0);
    expectedErrorMessage = `AccessControl: account ${drds.toLowerCase()} is missing role ${ethers.keccak256(
      ethers.toUtf8Bytes("MANAGER_ROLE")
    )}`;
    await expect(rbfDrds.claimDeposit()).to.be.revertedWith(
      expectedErrorMessage
    );
    await expect(rbfManager.claimDeposit()).not.to.be.reverted;
    expect(await rbfManager.balanceOf(vault)).to.be.equal(target);
    console.log("rbf总净值:", await rbfManager.getAssetsNav());
    console.log("vault价值:", await vaultManager.price());
    console.log("financePrice:", financePrice);
    console.log("target:", target);
    expect(await rbfManager.getAssetsNav()).to.be.equal(
      (BigInt(target) * BigInt(financePrice)) / BigInt(1e6)
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
    await expect(USDT.mint(depositTreasury, target-onChainInvest+waitMint)).not.to.be.reverted;
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

    //融资生效后线下赎回，执行失败
    await expect(VAULT.connect(offlineInvestorSigners).offChainRedeem()).to.be.revertedWith("Vault: not allowed withdraw");
  
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
  // function generateWallets(count: number) {
  //   const wallets = [];
  //   for (let i = 0; i < count; i++) {
  //     const wallet = ethers.Wallet.createRandom();
  //     wallets.push(wallet);
  //   }
  //   return wallets;
  // }
});