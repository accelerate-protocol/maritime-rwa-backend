import hre, { ethers } from "hardhat";
import { expect } from "chai";
import path from "path";
import { deployFactories } from '../utils/deployFactories';
import { factoryAuth } from '../utils/factoryAuth';
import { execSync } from "child_process";
describe("RWA:", function () {
  this.timeout(400000);
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

   //不是MANAGER_ROLE角色的账户执行策略;是MANAGER_ROLE角色的账户但不是vault执行策略;不是MANAGER_ROLE角色的账户执行setVault;是MANAGER_ROLE角色的账户执行setVault
  it("tc-66", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common,drds} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-66", "RBF-66",
        usdt.address,
        depositTreasury,
        "0",
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
    const vaultDeployData = {
        vaultId: vaultId,
        name: "RbfVaultForTc66",
        symbol: "RbfVaultForTc66",
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
    const minDepositAmount = await VAULT.minDepositAmount();
    const totalSupply = Number(maxSupply / BigInt(1e6));
    const minAmount = Number(minDepositAmount / BigInt(1e6));
    
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
    expect(await VAULT.assetBalance()).to.equal(maxSupply)
    console.log("total deposit balance",await VAULT.assetBalance())
    console.log("total manageFee Balance",await VAULT.manageFeeBalance())
    console.log("total Balance",await USDT.balanceOf(vault))
    var expectedErrorMessage = `AccessControl: account ${deployer.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
    console.log("expectedErrorMessage",expectedErrorMessage)

    //执行赎回
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
    ).to.be.revertedWith("RBF: you are not vault"); //不是Vaul执行requestDeposit
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
    expectedErrorMessage = `AccessControl: account ${manager.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("PRICE_MINT_AMOUNT_SETTER_ROLE"))}`;
    await expect(rbfManager.setDepositPriceAndMintAmount(financePrice,maxSupply)).to.be.revertedWith(expectedErrorMessage);

    const rbfDeployer = await hre.ethers.getContractAt(
      "RBF", // 替换为你的合约名称
      rbf
    )
    //不是MANAGER_ROLE角色的账户执行grantRole，执行失败
    expectedErrorMessage = `AccessControl: account ${deployer.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
    await expect(rbfDeployer.grantRole(ethers.keccak256(ethers.toUtf8Bytes("PRICE_MINT_AMOUNT_SETTER_ROLE")),manager)).to.be.revertedWith(expectedErrorMessage);
    //是MANAGER_ROLE角色的账户执行grantRole，执行成功
    await expect(rbfManager.grantRole(ethers.keccak256(ethers.toUtf8Bytes("PRICE_MINT_AMOUNT_SETTER_ROLE")),drds)).not.to.be.reverted;

    //是PRICE_MINT_AMOUNT_SETTER_ROLE角色的账户执行setDepositPirceAndMintAmount，执行成功
    const drdsSigner = await ethers.getSigner(drds);
    const rbfDrds =await hre.ethers.getContractAt(
      "RBF", 
      rbf,
      drdsSigner
    )

    //depositPirce为0，执行claimDeposit，执行失败
    await expect(rbfManager.claimDeposit()).to.be.revertedWith("RBF: depositPirce must be greater than 0");
    //depositMintAmount为0，执行claimDeposit，执行失败
    await expect(rbfDrds.setDepositPriceAndMintAmount(financePrice,BigInt(0))).not.to.be.reverted;
    await expect(rbfManager.claimDeposit()).to.be.revertedWith("RBF: depositMintAmount must be greater than 0");
    
    //depositMintAmount和depositPrice不为0，执行claimDeposit，执行成功
    await expect(rbfDrds.setDepositPriceAndMintAmount(financePrice,maxSupply)).not.to.be.reverted;
    expect(await rbfDrds.depositPrice()).to.be.equal(financePrice);
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
    const waitMint = BigInt(Math.floor(principalInterest - totalSupply) * 1e6);
    await expect(USDT.mint(depositTreasury, waitMint)).not.to.be.reverted;
    const dividendCountArr = distributeMoneyWithMinimum(
          principalInterest,
          2,
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

    //提前融资完成，在设置的结束认购时间前提取手续费，提取失败
    await expect(vaultManager.withdrawManageFee()).to.be.revertedWith("Vault: Invalid time");
  });


 


  it("tc-78", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common,drds} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-78", "RBF-78",
        usdt.address,
        depositTreasury,
        "0",
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
    const subEndTime = subStartTime + 30;
    const vaultDeployData = {
        vaultId: vaultId,
        name: "RbfVaultForTc78",
        symbol: "RbfVaultForTc78",
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
    const fundThreshold = await VAULT.fundThreshold();
    // const target = maxSupply * fundThreshold / BigInt(10000);
    const financePrice=await VAULT.financePrice();
    const minDepositAmount = await VAULT.minDepositAmount();
    const totalSupply = Number(maxSupply / BigInt(1e6));
    const minAmount = Number(minDepositAmount / BigInt(1e6));

    
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
    expect(await VAULT.assetBalance()).to.equal(maxSupply)
    console.log("total deposit balance",await VAULT.assetBalance())
    console.log("total manageFee Balance",await VAULT.manageFeeBalance())
    console.log("total Balance",await USDT.balanceOf(vault))
    var expectedErrorMessage = `AccessControl: account ${deployer.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
    console.log("expectedErrorMessage",expectedErrorMessage)

    // Create a promise-based delay function
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    console.log("开始等待...");
    await delay(20000);

    //执行赎回
    const investSigner = await ethers.getSigner(whitelists[0]);
    const vaultInvest = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      investSigner
    )
    await expect(vaultInvest.redeem()).to.be.revertedWith("Vault: not allowed withdraw");

    //不是MANAGER_ROLE角色的账户执行策略
    await expect(
      VAULT.execStrategy()
    ).to.be.revertedWith(expectedErrorMessage);
    //是MANAGER_ROLE角色的账户但不是vault的ownner执行策略
    await expect(
      vaultManager.execStrategy()
    ).to.be.revertedWith("RBF: you are not vault"); //不是Vaul执行requestDeposit
    //不是MANAGER_ROLE角色的账户执行setVault
    expectedErrorMessage = `AccessControl: account ${common.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
    console.log("commonAccount",common.toLowerCase())
    console.log("expectedErrorMessage",expectedErrorMessage)
    await expect(commonAccount.setVault(vault)).to.be.revertedWith(expectedErrorMessage);
    //是MANAGER_ROLE角色的账户执行setVault
    await expect(rbfManager.setVault(vault)).not.to.be.reverted;
    //setVault之后执行策略，既是MANAGER_ROLE又是vault，然后执行策略
    await expect(vaultManager.execStrategy()).not.to.be.reverted;

    //不是PRICE_MINT_AMOUNT_SETTER_ROLE角色的账户执行setDepositPirceAndMintAmount，执行失败
    expectedErrorMessage = `AccessControl: account ${manager.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("PRICE_MINT_AMOUNT_SETTER_ROLE"))}`;
    await expect(rbfManager.setDepositPriceAndMintAmount(financePrice,maxSupply)).to.be.revertedWith(expectedErrorMessage);

    const rbfDeployer = await hre.ethers.getContractAt(
      "RBF", // 替换为你的合约名称
      rbf
    )
    //不是MANAGER_ROLE角色的账户执行grantRole，执行失败
    expectedErrorMessage = `AccessControl: account ${deployer.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
    await expect(rbfDeployer.grantRole(ethers.keccak256(ethers.toUtf8Bytes("PRICE_MINT_AMOUNT_SETTER_ROLE")),manager)).to.be.revertedWith(expectedErrorMessage);
    //是MANAGER_ROLE角色的账户执行grantRole，执行成功
    await expect(rbfManager.grantRole(ethers.keccak256(ethers.toUtf8Bytes("PRICE_MINT_AMOUNT_SETTER_ROLE")),drds)).not.to.be.reverted;

    //是PRICE_MINT_AMOUNT_SETTER_ROLE角色的账户执行setDepositPirceAndMintAmount，执行成功
    const drdsSigner = await ethers.getSigner(drds);
    const rbfDrds =await hre.ethers.getContractAt(
      "RBF", 
      rbf,
      drdsSigner
    )

    //depositPirce为0，执行claimDeposit，执行失败
    await expect(rbfManager.claimDeposit()).to.be.revertedWith("RBF: depositPirce must be greater than 0");
    //depositMintAmount为0，执行claimDeposit，执行失败
    await expect(rbfDrds.setDepositPriceAndMintAmount(financePrice,BigInt(0))).not.to.be.reverted;
    await expect(rbfManager.claimDeposit()).to.be.revertedWith("RBF: depositMintAmount must be greater than 0");
    
    //depositMintAmount和depositPrice不为0，执行claimDeposit，执行成功
    await expect(rbfDrds.setDepositPriceAndMintAmount(financePrice,maxSupply)).not.to.be.reverted;
    expect(await rbfDrds.depositPrice()).to.be.equal(financePrice);
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
    const manageBalance_befor = await USDT.balanceOf(feeReceiver)
    //提前融资完成，提取管理费
    //非管理员，提取管理费失败
    expectedErrorMessage = `AccessControl: account ${investor1.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
    await expect(vaultInvest.withdrawManageFee()).to.be.revertedWith(expectedErrorMessage);
    //管理员，提取管理费成功
    await expect(vaultManager.withdrawManageFee()).not.to.be.reverted;

    const manageBalance_after =await USDT.balanceOf(feeReceiver)
    const manageFee = await VAULT.manageFee();
    expect(manageBalance_after).to.be.equal(manageBalance_befor + maxSupply * manageFee / BigInt(10000));

  });

  //极限测试：100个人认购，并给100个人派息
  it("tc-67:investor length is equal to 100", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,rbfSigner2,drds} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-67", "RBF-67",
        usdt.address,
        depositTreasury,
        "0",
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

    const vaultDeployData = {
        vaultId: vaultId,
        name: "RbfVaultForTc67",
        symbol: "RbfVaultForTc67",
        assetToken: usdt.address,
        rbf: rbfData.rbf,
        subStartTime: subStartTime,
        subEndTime: subEndTime,
        duration: "2592000",
        fundThreshold: "3000",
        minDepositAmount: "10000000",
        manageFee: "3000",
        manager: manager,
        feeReceiver: feeReceiver,
        dividendEscrow: manager, // 添加这一行
        whitelists: whitelists,
        guardian: guardian,
        maxSupply: "10000000000",
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
    
    
    const maxSupply = await VAULT.maxSupply();
    // const fundThreshold = await VAULT.fundThreshold();
    // const target = maxSupply * fundThreshold / BigInt(10000);
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
    const accounts = await ethers.getSigners(); 
    const account100 = accounts[99]; 
    const address_100 = account100.address;
    await expect(vaultManager.addToWhitelist(address_100)).not.to.be.reverted;
    expect(await VAULT.whiteListMap(address_100)).to.be.equals(true);
    const account101 = accounts[100]; 
    //添加白名单账户超过100个，添加失败
    const address = account101.address;
    await expect(vaultManager.addToWhitelist(address)).to.be.revertedWith("Vault: Whitelist is full");
    expect(await VAULT.whiteListMap(address)).to.be.equals(false);

    const rbfManager = await hre.ethers.getContractAt(
      "RBF", // 替换为你的合约名称
      rbf,
      managerSigner
    )


    let investArr= new Array();
    let incomeArr = new Array();

    const whitelistLength = await VAULT.getWhiteListsLen();
    console.log("whitelistLength:",whitelistLength)
    const distribution = distributeMoneyWithMinimum(
      totalSupply,
      Number(whitelistLength),
      minAmount
    );
    console.log("distribution:",distribution)

    
    const vaultWhiteLists = await VAULT.whiteLists;
    
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
      await expect(USDT.mint(await vaultWhiteLists(i), totalInvestAmount)).not.to.be.reverted;
      await expect(USDT.approve(vault, totalInvestAmount)).not.to.be.reverted;
      await expect(vaultInvest.deposit(investAmount)).not.to.be.reverted;
      expect(await vaultInvest.balanceOf(await vaultWhiteLists(i))).to.equal(investAmount);
    }
    expect(await VAULT.assetBalance()).to.equal(maxSupply)
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
    await expect(rbfManager.grantRole(ethers.keccak256(ethers.toUtf8Bytes("PRICE_MINT_AMOUNT_SETTER_ROLE")),drds)).not.to.be.reverted;

    //是PRICE_MINT_AMOUNT_SETTER_ROLE角色的账户执行setDepositPirceAndMintAmount，执行成功
    const drdsSigner = await ethers.getSigner(drds);
    const rbfDrds =await hre.ethers.getContractAt(
      "RBF", 
      rbf,
      drdsSigner
    )

    await expect(rbfDrds.setDepositPriceAndMintAmount(financePrice,maxSupply)).not.to.be.reverted;
    expect(await rbfDrds.depositPrice()).to.be.equal(financePrice);
    expect(await rbfDrds.depositMintAmount()).to.be.equal(maxSupply);

    //是MANAGER_ROLE角色的账户执行claimDeposit，执行成功
    await expect(rbfManager.claimDeposit()).not.to.be.reverted;
    expect(await rbfManager.balanceOf(vault)).to.be.equal(maxSupply);

    //派息成功
    const randomMultiplier = 1.1 + Math.random() * 0.4;
    console.log("派息系数:",randomMultiplier)
    const principalInterest = Math.floor(totalSupply * randomMultiplier);
    const waitMint = BigInt(Math.floor(principalInterest - totalSupply) * 1e6);
    await expect(USDT.mint(depositTreasury, waitMint)).not.to.be.reverted;
    const dividendCount = 4;
    const dividendCountArr = distributeMoneyWithMinimum(
          principalInterest,
          dividendCount,
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
    var vaultDividendBalance:any;
    for (let i = 0; i < dividendCountArr.length; i++) {
      const dividendAmount = BigInt(Math.floor(dividendCountArr[i] * 1e6));
      console.log("第" + (i + 1) + "次派息:", dividendAmount);
      await expect(USDTdepositTreasury.transfer(rbfDividendTreasury, dividendAmount)).not.to.be.reverted;
      await expect(rbfManager.dividend()).not.to.be.reverted;

      var tx = await vaultManager.dividend();
      var receipt = await tx.wait();
      console.log(receipt);
      // var receipt = await res.wait();
      if (!receipt) throw new Error("Transaction failed");
      expect(receipt.status).to.equal(1);
      // expect(receipt.status).to.equal(1);
      
      // await expect(vaultManager.dividend()).not.to.be.reverted;
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
    console.log("总派息额",totalDividend)
    console.log(investArr)
    console.log(incomeArr)
    expect(totalDividend).to.equal(totalNav);
  });
it("tc-68:execStrategy - assetBalance is zero", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common,drds} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-68", "RBF-68",
        usdt.address,
        depositTreasury,
        "0",
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
    const vaultDeployData = {
        vaultId: vaultId,
        name: "RbfVaultForTc68",
        symbol: "RbfVaultForTc68",
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
    const fundThreshold = await VAULT.fundThreshold();
    const target = maxSupply * fundThreshold / BigInt(10000);
    const financePrice=await VAULT.financePrice();
    const minDepositAmount = await VAULT.minDepositAmount();
    const totalSupply = Number(maxSupply / BigInt(1e6));
    const minAmount = Number(minDepositAmount / BigInt(1e6));

    const distribution = distributeMoneyWithMinimum(
      totalSupply,
      whitelists.length,
      minAmount
    );
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
    
    //是MANAGER_ROLE角色的账户执行setVault
    await expect(rbfManager.setVault(vault)).not.to.be.reverted;
    //setVault之后执行策略，既是MANAGER_ROLE又是vault，然后执行策略
    //assetBalance为0，执行策略失败
    await expect(vaultManager.execStrategy()).to.be.revertedWith("Vault: assetBalance is zero");  
  });

  //融资结束时间到，但是没有达到投资阈值,执行赎回操作
  it("tc-69:execStrategy - fundraising fail", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common,drds} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-69", "RBF-69",
        usdt.address,
        depositTreasury,
        "0",
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
        name: "RbfVaultForTc69",
        symbol: "RbfVaultForTc69",
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

    //未到赎回时间执行赎回
    await expect(vaultInvest.redeem()).to.be.revertedWith("Vault: Invalid time")
    

    const redeemBalance = await USDT.balanceOf(whitelists[0]);
    console.log(whitelists[0]+":redeem",redeemBalance.toString());
    expect(redeemBalance).to.equal(0);
    // const balance =await vaultInvest.balanceOf(whitelists[0]);
    // expect(balance).to.equal(investAmount);

    const managerSigner = await ethers.getSigner(manager);
    const vaultManager=await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      managerSigner
    )
    //未到截止时间，提取管理费
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

    console.log("开始等待...");
    await delay(20000);
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

      //认购的白名单账户执行赎回操作
      await expect(vaultInvest.redeem()).not.to.be.reverted;
      const redeemBalance_0 = await USDT.balanceOf(whitelists[0]);
      console.log(whitelists[0]+":redeem",redeemBalance_0.toString());
      expect(redeemBalance_0).to.equal(totalInvestAmount);


      //不在白名单中的账户执行赎回
      const commonSigner1 = await ethers.getSigner(common);
      const vaultcommon = await hre.ethers.getContractAt(
          "Vault", // 替换为你的合约名称
          vault,
          commonSigner1
        )
      await expect(vaultcommon.redeem()).to.be.revertedWith("Vault: you are not int whitelist");

      //到截止时间后，提取管理费
      await expect(vaultManager.withdrawManageFee()).to.be.revertedWith("Vault: Invalid endTime");

  });

  it("tc-79:withDrawManageFee - fundraising fail", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common,drds} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-69", "RBF-69",
        usdt.address,
        depositTreasury,
        "0",
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
        name: "RbfVaultForTc69",
        symbol: "RbfVaultForTc69",
        assetToken: usdt.address,
        rbf: rbfData.rbf,
        subStartTime: subStartTime,
        subEndTime: subEndTime,
        duration: "20",
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

    const managerSigner = await ethers.getSigner(manager);
    const vaultManager=await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      managerSigner
    )
  
    console.log("subStartTime",subStartTime)
    console.log("subEndTime",subEndTime)
    //未到截止时间，提取管理费
    await expect(vaultManager.withdrawManageFee()).to.be.revertedWith("Vault: Invalid endTime");
    const rbfManager = await hre.ethers.getContractAt(
      "RBF", // 替换为你的合约名称
      rbf,
      managerSigner
    )
    
    //是MANAGER_ROLE角色的账户执行setVault
    await expect(rbfManager.setVault(vault)).not.to.be.reverted;
    console.log("current time",Math.floor(Date.now() / 1000))
    //setVault之后执行策略，既是MANAGER_ROLE又是vault，然后执行策略 

    // Create a promise-based delay function
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    console.log("开始等待...");
    await delay(20000);
    //认购结束但是未达到融资阈值，执行策略失败
    await expect(vaultManager.execStrategy()).to.be.revertedWith("Vault: fundraising fail"); 

      console.log("开始等待...");
      await delay(20000);

      //到截止时间后，提取管理费
      // await expect(vaultManager.withdrawManageFee()).to.be.revertedWith("Vault: not allowed withdraw");
      await expect(vaultManager.withdrawManageFee()).to.be.revertedWith("Vault: Invalid endTime");

  });


  //depositAmount为0，执行claimDeposit，执行失败;No dividend to pay
  it("tc-70", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,rbfSigner2,} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-70", "RBF-70",
        usdt.address,
        depositTreasury,
        "0",
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
    const subEndTime = subStartTime + 5;
    const vaultDeployData = {
        vaultId: vaultId,
        name: "RbfVaultForTc70",
        symbol: "RbfVaultForTc70",
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
    console.log("开始等待...");
    await delay(5000); 
    expect(await VAULT.assetBalance()).to.equal(BigInt(0));
    
    //是MANAGER_ROLE角色的账户执行claimDeposit，depositAmount为0，执行claimDeposit，执行失败
    await expect(rbfManager.claimDeposit()).to.be.revertedWith("RBF: depositAmount must be greater than 0");
    //No dividend to pay
    await expect(vaultManager.dividend()).to.be.revertedWith("Vault: No dividend to pay");
    
  });

  //融资时间结束且达到融资阈值，派息
  it("tc-71", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common,drds} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-71", "RBF-71",
        usdt.address,
        depositTreasury,
        "0",
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
    const subEndTime = subStartTime + 30;
    const vaultDeployData = {
        vaultId: vaultId,
        name: "RbfVaultForTc71",
        symbol: "RbfVaultForTc71",
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
    const commonSigner = await ethers.getSigner(common);
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
    // Create a promise-based delay function
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    console.log("开始等待...");
    await delay(30000); 
   
    //是MANAGER_ROLE角色的账户执行setVault
    await expect(rbfManager.setVault(vault)).not.to.be.reverted;
    //setVault之后执行策略，既是MANAGER_ROLE又是vault，然后执行策略
    await expect(vaultManager.execStrategy()).not.to.be.reverted;
    //是MANAGER_ROLE角色的账户执行grantRole，执行成功
    await expect(rbfManager.grantRole(ethers.keccak256(ethers.toUtf8Bytes("PRICE_MINT_AMOUNT_SETTER_ROLE")),drds)).not.to.be.reverted;

    //是PRICE_MINT_AMOUNT_SETTER_ROLE角色的账户执行setDepositPirceAndMintAmount，执行成功
    const drdsSigner = await ethers.getSigner(drds);
    const rbfDrds =await hre.ethers.getContractAt(
      "RBF", 
      rbf,
      drdsSigner
    )
    
    //depositMintAmount和depositPrice不为0，执行claimDeposit，执行成功
    await expect(rbfDrds.setDepositPriceAndMintAmount(financePrice,maxSupply)).not.to.be.reverted;
    expect(await rbfDrds.depositPrice()).to.be.equal(financePrice);
    expect(await rbfDrds.depositMintAmount()).to.be.equal(maxSupply);

    //此时查询RBF的金额为0
    expect(await rbfManager.balanceOf(vault)).to.be.equal(0);
    //depositMintAmount不在范围内，执行claimDeposit，执行失败
    await expect(rbfManager.claimDeposit()).to.be.revertedWith("RBF: depositMintAmount is not in the range");
    //此时查询RBF的金额为0
    expect(await rbfManager.balanceOf(vault)).to.be.equal(0);


    //depositMintAmount不在范围内，执行claimDeposit，执行失败
    await expect(rbfDrds.setDepositPriceAndMintAmount(financePrice,target-BigInt(2000000))).not.to.be.reverted;
    expect(await rbfDrds.depositPrice()).to.be.equal(financePrice);
    expect(await rbfDrds.depositMintAmount()).to.be.equal(target-BigInt(2000000));

    //depositMintAmount不在范围内，执行claimDeposit，执行失败
    await expect(rbfManager.claimDeposit()).to.be.revertedWith("RBF: depositMintAmount is not in the range");
    //此时查询RBF的金额为0
    expect(await rbfManager.balanceOf(vault)).to.be.equal(0);

    await expect(rbfDrds.setDepositPriceAndMintAmount(financePrice,target)).not.to.be.reverted;
    expect(await rbfDrds.depositPrice()).to.be.equal(financePrice);
    expect(await rbfDrds.depositMintAmount()).to.be.equal(target);

    await expect(rbfManager.claimDeposit()).not.to.be.reverted;
    expect(await rbfManager.balanceOf(vault)).to.be.equal(target);

    //派息
    const randomMultiplier = 1.1 + Math.random() * 0.4;
    console.log("派息系数:",randomMultiplier)
    const principalInterest = Math.floor(totalSupply * randomMultiplier);
    const waitMint = BigInt(Math.floor(principalInterest - totalSupply) * 1e6);
    await expect(USDT.mint(depositTreasury, waitMint)).not.to.be.reverted;
    const dividentCount = 2;
    const dividendCountArr = distributeMoneyWithMinimum(
          principalInterest,
          dividentCount,
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

  //融资时间结束且达到融资阈值，派息
  it("tc-72", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common,drds} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-72", "RBF-72",
        usdt.address,
        depositTreasury,
        "0",
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
    const subEndTime = subStartTime + 30;
    const vaultDeployData = {
        vaultId: vaultId,
        name: "RbfVaultForTc72",
        symbol: "RbfVaultForTc72",
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
    
    //白名单中的账户相互转账,可以成功
    const investSigner = await ethers.getSigner(whitelists[0]);
    const vaultInvest = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      investSigner
    )
    await expect(vaultInvest.transfer(whitelists[1],10)).not.to.be.reverted;

    
    const investSigner1 = await ethers.getSigner(whitelists[1]);
    const vaultInvest1 = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      investSigner1
    )

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

    //授权第三方不是白名单中的账户
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
    await expect(vaultWhitelist.transfer(common,100000)).to.be.revertedWith("Vault: transfer from and to must in whitelist");
    await expect(vaultInvest.transferFrom(whitelists[1],common,1000)).to.be.revertedWith("Vault: transfer from and to must in whitelist");
    //不是白名单中的账户向白名单中的账户转账，执行失败
    await expect(vaultInvest.transferFrom(common,whitelists[1],1000)).to.be.revertedWith("Vault: transfer from and to must in whitelist");

    // Create a promise-based delay function
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    console.log("开始等待...");
    await delay(30000); 
   
    //是MANAGER_ROLE角色的账户执行setVault
    await expect(rbfManager.setVault(vault)).not.to.be.reverted;
    //setVault之后执行策略，既是MANAGER_ROLE又是vault，然后执行策略
    await expect(vaultManager.execStrategy()).not.to.be.reverted;
    //是MANAGER_ROLE角色的账户执行grantRole，执行成功
    await expect(rbfManager.grantRole(ethers.keccak256(ethers.toUtf8Bytes("PRICE_MINT_AMOUNT_SETTER_ROLE")),drds)).not.to.be.reverted;

    //是PRICE_MINT_AMOUNT_SETTER_ROLE角色的账户执行setDepositPirceAndMintAmount，执行成功
    const drdsSigner = await ethers.getSigner(drds);
    const rbfDrds =await hre.ethers.getContractAt(
      "RBF", 
      rbf,
      drdsSigner
    )
    
    //depositMintAmount和depositPrice不为0，执行claimDeposit，执行成功
    await expect(rbfDrds.setDepositPriceAndMintAmount(financePrice,maxSupply)).not.to.be.reverted;
    expect(await rbfDrds.depositPrice()).to.be.equal(financePrice);
    expect(await rbfDrds.depositMintAmount()).to.be.equal(maxSupply);

    //执行赎回，赎回失败
    await expect(vaultInvest.redeem()).to.be.revertedWith("Vault: not allowed withdraw");

    //提前管理费
    await expect(vaultManager.withdrawManageFee()).not.to.be.reverted;

    //此时查询RBF的金额为0
    expect(await rbfManager.balanceOf(vault)).to.be.equal(0);
    //depositMintAmount不在范围内，执行claimDeposit，执行失败
    await expect(rbfManager.claimDeposit()).to.be.revertedWith("RBF: depositMintAmount is not in the range");
    //此时查询RBF的金额为0
    expect(await rbfManager.balanceOf(vault)).to.be.equal(0);


    //depositMintAmount不在范围内，执行claimDeposit，执行失败
    await expect(rbfDrds.setDepositPriceAndMintAmount(financePrice,target-BigInt(2000000))).not.to.be.reverted;
    expect(await rbfDrds.depositPrice()).to.be.equal(financePrice);
    expect(await rbfDrds.depositMintAmount()).to.be.equal(target-BigInt(2000000));

    //depositMintAmount不在范围内，执行claimDeposit，执行失败
    await expect(rbfManager.claimDeposit()).to.be.revertedWith("RBF: depositMintAmount is not in the range");
    //此时查询RBF的金额为0
    expect(await rbfManager.balanceOf(vault)).to.be.equal(0);

    await expect(rbfDrds.setDepositPriceAndMintAmount(financePrice,target)).not.to.be.reverted;
    expect(await rbfDrds.depositPrice()).to.be.equal(financePrice);
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

  //各个时期添加删除白名单及白名单账户间转账后派息是否正确执行
  it("tc-77", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common,drds} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-77", "RBF-77",
        usdt.address,
        depositTreasury,
        "0",
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
      name: "RbfVaultForTc77",
      symbol: "RbfVaultForTc77",
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
    //认购期且未完成认购时，白名单修改

    //删除白名单
    // console.log("1-whitelists.lenght",await VAULT.getWhiteListsLen());
    expect(await VAULT.getWhiteListsLen()).to.equal(whitelists.length);
    //要删除的账户不在白名单中，删除失败
    await expect(vaultManager.removeFromWhitelist(common)).to.be.revertedWith("Vault: Address is not in the whitelist");
    expect(await VAULT.getWhiteListsLen()).to.equal(whitelists.length);
    //要删除的账户在白名单中，删除成功
    await expect(vaultManager.removeFromWhitelist(investor1)).not.to.be.reverted; //[investor1, investor2, investor3, investor4] --> [investor2, investor3, investor4]
    expect(await VAULT.getWhiteListsLen()).to.equal(BigInt(whitelists.length - 1));
    console.log(await VAULT.whiteListMap(investor1));
    expect(await VAULT.whiteListMap(investor1)).to.be.equals(false);
    

    //添加白名单
    //要添加的账户已经在白名单，添加失败
    await expect(vaultManager.addToWhitelist(investor2)).to.be.revertedWith("Vault: Address is already whitelisted");
    //添加不在白名单列表中的账户，添加成功
    await expect(vaultManager.addToWhitelist(investor1)).not.to.be.reverted;//[ investor2, investor3, investor4] --> [investor1,investor2, investor3, investor4]
    expect(await VAULT.whiteListMap(investor1)).to.be.equals(true);
  
    const rbfManager = await hre.ethers.getContractAt(
      "RBF", // 替换为你的合约名称
      rbf,
      managerSigner
    );

    //此时查询vault的assetBalance为0
    expect(await VAULT.assetBalance()).to.equal(BigInt(0));
    let incomeArr_1= new Array();
    let incomeArr_2 = new Array();

    const whitelistLength = await VAULT.getWhiteListsLen();
    const result: number[] = [];
    for (let i = 0; i < whitelistLength; i++) {
      result[i] = Number(maxSupply / BigInt(whitelistLength));
    }
  
    const vaultWhiteLists = VAULT.whiteLists;
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
      await expect(vaultManager.removeFromWhitelist(whitelistAddr)).to.be.revertedWith("Vault: Address has balance");
      expect(await VAULT.whiteListMap(whitelistAddr)).to.be.equals(true);
    }
    expect(await VAULT.assetBalance()).to.equal(maxSupply)
    console.log("total deposit balance",await VAULT.assetBalance())
    console.log("total manageFee Balance",await VAULT.manageFeeBalance())
    console.log("total Balance",await USDT.balanceOf(vault))

    //融资提前完成后
    //账户有投资金额，则无法删除成功
    await expect(vaultManager.removeFromWhitelist(investor1)).to.be.revertedWith("Vault: Address has balance");
    expect(await VAULT.whiteListMap(investor1)).to.be.equals(true);

    const investSigner = await ethers.getSigner(investor1);
    const vaultInvest = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      investSigner
    )
    //添加账户到白名单
    await expect(vaultManager.addToWhitelist(investor5)).not.to.be.reverted;//[investor1,investor2, investor3, investor4] --> [investor1,investor2, investor3, investor4,investor5]
    expect(await VAULT.whiteListMap(investor5)).to.be.equals(true);
    const balance = await vaultInvest.balanceOf(investor1);

    //将账户投资的钱转给其他成员，则账户没有投资金额，则删除成功
    await expect(vaultInvest.transfer(investor5,balance)).not.to.be.reverted;//[investor1:2500,investor2:2500, investor3:2500, investor4:2500,investor5:0] --> [investor1:0,investor2:2500, investor3:2500, investor4:2500,investor5:2500]
    expect(await vaultInvest.balanceOf(investor1)).to.equal(0);
    expect(await vaultInvest.balanceOf(investor5)).to.equal(balance);
    await expect(vaultManager.removeFromWhitelist(investor1)).not.to.be.reverted;//[investor1,investor2, investor3, investor4,investor5] --> [investor2, investor3, investor4,investor5]
    expect(await VAULT.whiteListMap(investor1)).to.be.equals(false);

    //等待60s
    // Create a promise-based delay function
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    console.log("开始等待...");
    await delay(60000);
    console.log("等待结束");


    //是MANAGER_ROLE角色的账户执行setVault
    await expect(rbfManager.setVault(vault)).not.to.be.reverted;
    //setVault之后执行策略，既是MANAGER_ROLE又是vault，然后执行策略
    await expect(vaultManager.execStrategy()).not.to.be.reverted;

    //是MANAGER_ROLE角色的账户执行grantRole，执行成功
    await expect(rbfManager.grantRole(ethers.keccak256(ethers.toUtf8Bytes("PRICE_MINT_AMOUNT_SETTER_ROLE")),drds)).not.to.be.reverted;

    //是PRICE_MINT_AMOUNT_SETTER_ROLE角色的账户执行setDepositPirceAndMintAmount，执行成功
    const drdsSigner = await ethers.getSigner(drds);
    const rbfDrds =await hre.ethers.getContractAt(
      "RBF", 
      rbf,
      drdsSigner
    )

    //depositMintAmount和depositPrice不为0，执行claimDeposit，执行成功
    await expect(rbfDrds.setDepositPriceAndMintAmount(financePrice,maxSupply)).not.to.be.reverted;
    expect(await rbfDrds.depositPrice()).to.be.equal(financePrice);
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
    const currentWhitelistLength = await VAULT.getWhiteListsLen();
    const currentVaultWhiteLists = await VAULT.whiteLists;
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
      expect(investorBalance).to.be.equal(dividendAmount1 / currentWhitelistLength);
      incomeArr_1.push(investorBalance);
    }
    //认购期结束
    //添加白名单
    await expect(vaultManager.addToWhitelist(investor1)).to.be.revertedWith("Vault: Invalid time");
    expect(await VAULT.whiteListMap(investor1)).to.be.equals(false);
    //删除白名单
    await expect(vaultManager.removeFromWhitelist(investor5)).to.be.revertedWith("Vault: Invalid time");
    expect(await VAULT.whiteListMap(investor5)).to.be.equals(true);

    const investSigner5 = await ethers.getSigner(investor5);
    const vaultInvest5 = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      investSigner5
    )

    const balance5 = await vaultInvest.balanceOf(investor5);
    //将账户投资的钱转给其他成员，则账户没有投资金额，删除失败
    await expect(vaultInvest5.transfer(investor2,balance5)).not.to.be.reverted;
    expect(await vaultInvest5.balanceOf(investor5)).to.equal(0);
    await expect(vaultManager.removeFromWhitelist(investor5)).to.be.revertedWith("Vault: Invalid time");
    expect(await VAULT.whiteListMap(investor5)).to.be.equals(true);
    const dividendAmount2 = totalNav - dividendAmount1;
    console.log("第2次派息:", dividendAmount2);
    const finalWhitelistLength = await VAULT.getWhiteListsLen();
    const finalVaultWhiteLists = await VAULT.whiteLists;
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
    expect(incomeArr_2[0] - incomeArr_2[3] + incomeArr_2[0]).to.equal(incomeArr_2[1]); 
    expect(incomeArr_2[0]).to.equal(incomeArr_2[2]);
  });


  it("tc-81", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common,drds} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-81", "RBF-81",
        usdt.address,
        depositTreasury,
        "0",
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
    const vaultDeployData = {
        vaultId: vaultId,
        name: "RbfVaultForTc80",
        symbol: "RbfVaultForTc80",
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
    console.log("total deposit balance",await VAULT.assetBalance())
    console.log("total manageFee Balance",await VAULT.manageFeeBalance())
    console.log("total Balance",await USDT.balanceOf(vault))
    var expectedErrorMessage = `AccessControl: account ${deployer.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
    console.log("expectedErrorMessage",expectedErrorMessage)
      
    //是MANAGER_ROLE角色的账户执行setVault
    await expect(rbfManager.setVault(vault)).not.to.be.reverted;
    //是MANAGER_ROLE角色的账户执行grantRole，执行成功
    await expect(rbfManager.grantRole(ethers.keccak256(ethers.toUtf8Bytes("PRICE_MINT_AMOUNT_SETTER_ROLE")),drds)).not.to.be.reverted;


    //此时查询RBF的金额为0
    expect(await rbfManager.balanceOf(vault)).to.be.equal(0);

    //派息
    const randomMultiplier = 1.1 + Math.random() * 0.4;
    console.log("派息系数:",randomMultiplier)
    const principalInterest = Math.floor(Number(maxSupply) * randomMultiplier);
    const waitMint = BigInt(Math.floor(principalInterest - totalSupply) * 1e6);
    await expect(USDT.mint(depositTreasury, waitMint)).not.to.be.reverted;
   
    const totalNav= await USDT.balanceOf(depositTreasury);
    console.log("总派息资产:",totalNav.toString())

    const depositTreasurySigner = await ethers.getSigner(depositTreasury);
    const USDTdepositTreasury = await ethers.getContractAt(
      "MockUSDT",
      usdt.address,
      depositTreasurySigner
    );

    const rbfDividendTreasury = await rbfManager.dividendTreasury();
    const dividendAmount = BigInt(Math.floor(1000 * 1e6));
    await expect(USDTdepositTreasury.transfer(rbfDividendTreasury, dividendAmount)).not.to.be.reverted;
    await expect(rbfManager.dividend()).to.be.revertedWith("RBF: totalSupply must be greater than 0"); 
    await expect(vaultManager.dividend()).to.be.revertedWith("Vault: No dividend to pay");
  });

  //Vault白名单地址为零地址
  it("tc-80", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common,drds} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-80", "RBF-80",
        usdt.address,
        depositTreasury,
        "0",
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
    const subEndTime = subStartTime + 3600;
    const vaultDeployData = {
        vaultId: vaultId,
        name: "RbfVaultForTc80",
        symbol: "RbfVaultForTc80",
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
    await expect(rbfManager.grantRole(ethers.keccak256(ethers.toUtf8Bytes("PRICE_MINT_AMOUNT_SETTER_ROLE")),drds)).not.to.be.reverted;

    //是PRICE_MINT_AMOUNT_SETTER_ROLE角色的账户执行setDepositPirceAndMintAmount，执行成功
    const drdsSigner = await ethers.getSigner(drds);
    const rbfDrds =await hre.ethers.getContractAt(
      "RBF", 
      rbf,
      drdsSigner
    )
    
    //depositMintAmount和depositPrice不为0，执行claimDeposit，执行成功
    await expect(rbfDrds.setDepositPriceAndMintAmount(financePrice,maxSupply)).not.to.be.reverted;
    expect(await rbfDrds.depositPrice()).to.be.equal(financePrice);
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
    //派息前给白名单列表中的零地址转一部分钱
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

  it("tc-90", async function () {

    // const priceFeed = await deployments.get("PriceFeed");
    // const priceFeedContract = await ethers.getContractAt("PriceFeed", priceFeed.address);
    const {execute} = deployments;
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common,drds} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-90", "RBF-90",
        usdt.address,
        depositTreasury,
        "0",
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
    // const priceFeedAddress = await rbf.priceFeed();
    // const priceFeed = await ethers.getContractAt("PriceFeed", priceFeedAddress);
    // await priceFeed.addPrice(BigInt("1200000000"),Math.floor(Date.now() / 1000));
    
    const VaultRouter = await deployments.get("VaultRouter");
    const vaultRouter = await hre.ethers.getContractAt(
            "VaultRouter",
            VaultRouter.address
          );
    const vaultId = await vaultRouter.vaultNonce();
    const subStartTime = Math.floor(Date.now() / 1000) 
    const subEndTime = subStartTime + 3600;
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
    const deployerSigner = await ethers.getSigner(deployer);
    const managerSigner = await ethers.getSigner(manager);
    const vaultManager=await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      managerSigner
    )
    
    // const deployerAccount = await hre.ethers.getContractAt(
    //   "RBF", // 替换为你的合约名称
    //   rbf,
    //   deployerSigner
    // )
    const rbfManager = await hre.ethers.getContractAt(
      "RBF", // 替换为你的合约名称
      rbf,
      managerSigner
    )

  let investArr= new Array();
  // let incomeArr = new Array();

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
  expect(await VAULT.assetBalance()).to.equal(maxSupply)
  console.log("total deposit balance",await VAULT.assetBalance())
  console.log("total manageFee Balance",await VAULT.manageFeeBalance())
  console.log("total Balance",await USDT.balanceOf(vault))
  var expectedErrorMessage = `AccessControl: account ${deployer.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
  console.log("expectedErrorMessage",expectedErrorMessage)

   //是MANAGER_ROLE角色的账户执行setVault
   await expect(rbfManager.setVault(vault)).not.to.be.reverted;
   //setVault之后执行策略，既是MANAGER_ROLE又是vault，然后执行策略
   await expect(vaultManager.execStrategy()).not.to.be.reverted;
 
   const rbfDeployer = await hre.ethers.getContractAt(
     "RBF", // 替换为你的合约名称
     rbf
   )
   //是MANAGER_ROLE角色的账户执行grantRole，执行成功
   await expect(rbfManager.grantRole(ethers.keccak256(ethers.toUtf8Bytes("PRICE_MINT_AMOUNT_SETTER_ROLE")),drds)).not.to.be.reverted;
 
   //是PRICE_MINT_AMOUNT_SETTER_ROLE角色的账户执行setDepositPirceAndMintAmount，执行成功
   const drdsSigner = await ethers.getSigner(drds);
   const rbfDrds =await hre.ethers.getContractAt(
     "RBF", 
     rbf,
     drdsSigner
   )
 
 //depositMintAmount为0，执行claimDeposit，执行失败
   await expect(rbfDrds.setDepositPriceAndMintAmount(financePrice,BigInt(0))).not.to.be.reverted;
   
   //depositMintAmount和depositPrice不为0，执行claimDeposit，执行成功
   await expect(rbfDrds.setDepositPriceAndMintAmount(financePrice,maxSupply)).not.to.be.reverted;
   expect(await rbfDrds.depositPrice()).to.be.equal(financePrice);
   expect(await rbfDrds.depositMintAmount()).to.be.equal(maxSupply);
 
   //此时查询RBF的金额为0
   expect(await rbfManager.balanceOf(vault)).to.be.equal(0)
   //是MANAGER_ROLE角色的账户执行claimDeposit，执行成功
   await expect(rbfManager.claimDeposit()).not.to.be.reverted;
   expect(await rbfManager.balanceOf(vault)).to.be.equal(maxSupply);
 
   //此时查询vault的assetBalance为0
   expect(await VAULT.assetBalance()).to.equal(BigInt(0));

  //获取RBF的最新价格
  const RBF = await ethers.getContractAt("RBF", rbf);
  console.log("RBF",RBF)
  const priceFeedAddress = await RBF.priceFeed();
  const priceFeed = await ethers.getContractAt("PriceFeed", priceFeedAddress);

  var expectedErrorMessage = `AccessControl: account ${manager.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("FEEDER_ROLE"))}`;
    // console.log("expectedErrorMessage",expectedErrorMessage)

  const manager_Signer = await ethers.getSigner(manager);
  //不是FEEDER_ROLE角色的账户执行addPrice，执行失败
  await expect(priceFeed.connect(manager_Signer).addPrice(BigInt("1200000000"), Math.floor(Date.now() / 1000))).to.be.revertedWith(expectedErrorMessage);

  //是FEEDER_ROLE角色的账户执行grantRole，执行成功
  await expect(priceFeed.connect(manager_Signer).grantRole(ethers.keccak256(ethers.toUtf8Bytes("FEEDER_ROLE")),deployer)).not.to.be.reverted;
  
  const FeedSigner = await ethers.getSigner(deployer);

  let err:any;
  try {
    await RBF.getLatestPrice();
  } catch (error) {
    err = error;
    console.log("err",err);
  }finally{
    expect(err.message).to.be.include("Transaction reverted");
  }
  await priceFeed.connect(FeedSigner).addPrice(BigInt("1200000000"), Math.floor(Date.now() / 1000))
  const lastPrice = await RBF.getLatestPrice();
  console.log("lastPrice",lastPrice);
  const nav = await rbfManager.getAssetsNav();
  console.log("nav",nav);
  const price = await VAULT.price();
  console.log("price",price);
  const Supply = await VAULT.totalSupply();
  console.log("Supply",Supply);
  expect(price).to.equal(nav * BigInt(10**6) / Supply); 

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
    //  incomeArr.push(investorBalance);
     totalDividend=totalDividend+investorBalance;
   }
   console.log("总派息额",totalDividend)

   console.log("feedprice 小于0")
   await priceFeed.connect(FeedSigner).addPrice(BigInt("-1"), Math.floor(Date.now() / 1000));
   await expect(RBF.getLatestPrice()).to.be.revertedWith("Invalid price data");

   console.log("feedprice 为浮点数-1位小数")
   await priceFeed.connect(FeedSigner).addPrice(BigInt("10000000"), Math.floor(Date.now() / 1000));
   const lastPrice_float = await RBF.getLatestPrice();
   console.log("lastPrice_float",lastPrice_float);
   expect(lastPrice_float).to.be.equal(BigInt(10000000));

   console.log("feedprice 为浮点数-8位小数")
   await priceFeed.connect(FeedSigner).addPrice(BigInt("1"), Math.floor(Date.now() / 1000));
   const lastPrice_float_1 = await RBF.getLatestPrice();
   console.log("lastPrice_float",lastPrice_float_1);
   expect(lastPrice_float_1).to.be.equal(BigInt(1));

   await priceFeed.connect(FeedSigner).addPrice(BigInt("0"), Math.floor(Date.now() / 1000));
   expect(totalDividend).to.equal(totalNav);
   const lastPrice_final = await RBF.getLatestPrice();
   console.log("lastPrice",lastPrice_final);
   const nav_final = await rbfManager.getAssetsNav();
   console.log("nav",nav_final);
   const price_final = await VAULT.price();
   console.log("price",price_final);
   const Supply_final = await VAULT.totalSupply();
   console.log("Supply",Supply_final);
   expect(price_final).to.equal(nav_final * BigInt(10**6) / Supply_final); 
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

