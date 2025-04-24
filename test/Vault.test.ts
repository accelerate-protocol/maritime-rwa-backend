import hre from "hardhat";
import { expect } from "chai";
import { execSync } from "child_process";
import path from "path";
import { deployFactories } from '../utils/deployFactoriesAndRouter';
import { factoryAuth } from '../utils/factoryAuth';

describe("Vault:", function () {
  this.timeout(200000); // 增加到 100 秒
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy, execute } = deployments;
 
  var whitelists: any;
  var EscrowFactory: any;
  var PriceFeedFactory: any;
  var RBFFactory: any;
  var RBFRouter: any;
  var usdt: any; 

  var rbfRouter: any;
  this.beforeAll(async () => {
    try {
      // 获取项目根目录
      const projectRoot = path.resolve(__dirname, '..');
      // 执行 shell/ready.sh
      execSync(`bash ${projectRoot}/shell/ready.sh`, {
          stdio: 'inherit',  // 这样可以看到脚本的输出
          cwd: projectRoot   // 设置工作目录为项目根目录
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
    // usdt = await hre.ethers.getContractAt("MockUSDT", usdtDeployment.address);
    rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address); 
  });
  
  it("tc-22:assetToken is zero address, deploy failed", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-28", "RBF-28",
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
    
    const VaultRouter = await deployments.get("VaultRouter");
    const vaultRouter = await hre.ethers.getContractAt(
      "VaultRouter",
      VaultRouter.address
    );
    const vaultId = await vaultRouter.vaultNonce();
    const subStartTime = Math.floor(Date.now() / 1000);
    const subEndTime = subStartTime + 3600;

    //assetToken为零地址，部署失败
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForVault_assetTokenIsZeroAddress",
      symbol: "RbfVaultForVault_assetTokenIsZeroAddress",
      assetToken: ethers.ZeroAddress,
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
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
      "Vault: Invalid assetToken address"
    );

    //manager为零地址，部署失败
    const vaultDeployData_1 = {
      vaultId: vaultId,
      name: "RbfVaultForVault_managerIsZeroAddress",
      symbol: "RbfVaultForVault_managerIsZeroAddress",
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "3000",
      minDepositAmount: "10000000",
      manageFee: "50",
      manager: ethers.ZeroAddress,
      feeReceiver: feeReceiver,
      dividendEscrow: manager, // 添加这一行
      whitelists: whitelists,
      guardian: guardian,
      maxSupply: "10000000000",
      financePrice: "100000000",
    };
    await expect(vaultRouter.deployVault(vaultDeployData_1)).to.be.revertedWith(
      "Vault: Invalid manager"
    );

    //feeReceiver为零地址，部署失败
    const vaultDeployData_2 = {
      vaultId: vaultId,
      name: "RbfVaultForTc30",
      symbol: "RbfVaultForTc30",
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "3000",
      minDepositAmount: "10000000",
      manageFee: "50",
      manager: manager,
      feeReceiver: ethers.ZeroAddress,
      dividendEscrow: manager, // 添加这一行
      whitelists: whitelists,
      guardian: guardian,
      maxSupply: "10000000000",
      financePrice: "100000000",
    };
    await expect(vaultRouter.deployVault(vaultDeployData_2)).to.be.revertedWith(
      "Vault: Invalid feeReceiver address"
    );
    
  });

  //RBF不存在，部署失败
  it("tc-23:RBF does not exist, deploy failed", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const whitelists = [investor1, investor2, investor3, investor4, investor5];
    const rbfData = await rbfRouter.getRBFInfo(rbfId);
    
    const VaultRouter = await deployments.get("VaultRouter");
    const vaultRouter = await hre.ethers.getContractAt(
            "VaultRouter",
            VaultRouter.address
          );
    const vaultId = await vaultRouter.vaultNonce();
    const subStartTime = Math.floor(Date.now() / 1000);
    const subEndTime = subStartTime + 3600;
    const vaultDeployData = {
        vaultId: vaultId,
        name: "RbfVaultForVault_assetTokenIsZeroAddress",
        symbol: "RbfVaultForVault_assetTokenIsZeroAddress",
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
    let err:any;
    try {
      await vaultRouter.deployVault(vaultDeployData);
    } catch (error) {
      console.log("error",error)
      err=error;
    }finally{
      expect(err.message).to.include("Transaction reverted without a reason string");
    }
  });

  //认购开始时间必须大于当前时间
  it.skip("tc-41:Subscription start time must be greater than the current time", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-41", "RBF-41",
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
    
    const VaultRouter = await deployments.get("VaultRouter");
    const vaultRouter = await hre.ethers.getContractAt(
            "VaultRouter",
            VaultRouter.address
          );
    const vaultId = await vaultRouter.vaultNonce();
    const subStartTime = Math.floor(Date.now() / 1000) - 24 * 3600;
    const subEndTime = subStartTime + 3600;
    const vaultDeployData = {
        vaultId: vaultId,
        name: "RbfVaultForTc41",
        symbol: "RbfVaultForTc41",
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
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
      "Vault: Invalid manager"
    );
  });
  
  it("tc-24:Subscription end time is earlier than the start time", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-24", "RBF-24",
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
    
    const VaultRouter = await deployments.get("VaultRouter");
    const vaultRouter = await hre.ethers.getContractAt(
      "VaultRouter",
      VaultRouter.address
    );
    const vaultId = await vaultRouter.vaultNonce();

    //认购结束时间早于开始时间
    const subStartTime = Math.floor(Date.now() / 1000) 
    const subEndTime = subStartTime - 24 * 3600;
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
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
      "Vault: Invalid subTime"
    );

    //认购结束时间等于开始时间
    const subStartTime_1 = Math.floor(Date.now() / 1000) 
    const subEndTime_1 = subStartTime;
    const vaultDeployData_1 = {
      vaultId: vaultId,
      name: "RbfVaultForTc42",
      symbol: "RbfVaultForTc42",
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime_1,
      subEndTime: subEndTime_1,
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
    await expect(vaultRouter.deployVault(vaultDeployData_1)).to.be.revertedWith(
      "Vault: Invalid subTime"
    );
  });

  
  it("tc-25:Non-whitelist accounts subscribe, subscribe failed", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common} = await getNamedAccounts();
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
        name: "RbfVaultForTc43",
        symbol: "RbfVaultForTc43",
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

    //不在白名单中的账户认购，认购失败
    const commonSigner = await ethers.getSigner(common);
    const vaultInvest = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      commonSigner
    )
    const manageFee=await vaultInvest.manageFee();
    const minDepositAmount = await vaultInvest.minDepositAmount();
    const feeAmount = minDepositAmount * BigInt(manageFee) / BigInt(10000);
    const totalInvestAmount = minDepositAmount + feeAmount;
    console.log("investAmount:",minDepositAmount.toString(),"feeAmount:",feeAmount.toString(),"totalInvestAmount:",totalInvestAmount.toString())

    const USDT = await ethers.getContractAt(
      "MockUSDT",
      usdt.address,
      commonSigner
    );
    await USDT.mint(common, totalInvestAmount);


    await USDT.approve(vault, totalInvestAmount);
    await expect(vaultInvest.deposit(minDepositAmount)).to.be.revertedWith(
      "Vault: you are not in onChainWL"
    );
  });

  //白名单中的账户认购，在认购期内，以最小认购金额认
  it("tc-26:Whitelist accounts subscribe", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-26", "RBF-26",
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
        name: "RbfVaultForTc26",
        symbol: "RbfVaultForTc26",
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
    const balance =await vaultInvest.balanceOf(whitelists[0]);
    expect(balance).to.equal(investAmount);
  });

  //在认购开始之前认购
  it("tc-27:Subscribe before the subscription starts", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-27", "RBF-27",
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
    
    const VaultRouter = await deployments.get("VaultRouter");
    const vaultRouter = await hre.ethers.getContractAt(
            "VaultRouter",
            VaultRouter.address
          );
    const vaultId = await vaultRouter.vaultNonce();
    const subStartTime = Math.floor(Date.now() / 1000) + 24 * 3600;
    const subEndTime = subStartTime + 24 * 3600 * 2;
    const vaultDeployData = {
        vaultId: vaultId,
        name: "RbfVaultForTc27",
        symbol: "RbfVaultForTc27",
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
      const manageFee = await vaultInvest.manageFee();
      const minDepositAmount = await vaultInvest.minDepositAmount();
      const investAmount = minDepositAmount;
      const feeAmount = investAmount * BigInt(manageFee) / BigInt(10000);
      const totalInvestAmount = investAmount + feeAmount;
      // investArr.push(totalInvestAmount)
      console.log("investAmount:",investAmount.toString(),"feeAmount:",feeAmount.toString(),"totalInvestAmount:",totalInvestAmount.toString())

      const USDT = await ethers.getContractAt(
        "MockUSDT",
        usdt.address,
        investSigner
      );
      await USDT.mint(whitelists[0], totalInvestAmount);
      await USDT.approve(vault, totalInvestAmount);
      await expect(vaultInvest.deposit(investAmount)).to.be.revertedWith(
        "Vault: Invalid time"
      );
  });

  //认购金额小于最小投资金额
  it("tc-28:Subscribe amount less than the minimum investment amount", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-28", "RBF-28",
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
        name: "RbfVaultForTc28",
        symbol: "RbfVaultForTc28",
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
    const manageFee = await vaultInvest.manageFee();
    const minDepositAmount = await vaultInvest.minDepositAmount();
    const investAmount = minDepositAmount - BigInt(1);
    // const investAmount = BigInt(Math.floor(distribution[i] * 1e6));
    const feeAmount = investAmount * BigInt(manageFee) / BigInt(10000);
    const totalInvestAmount = investAmount + feeAmount;
    // investArr.push(totalInvestAmount)
    console.log("investAmount:",investAmount.toString(),"feeAmount:",feeAmount.toString(),"totalInvestAmount:",totalInvestAmount.toString())

    const USDT = await ethers.getContractAt(
      "MockUSDT",
      usdt.address,
      investSigner
    );
    await USDT.mint(whitelists[0], totalInvestAmount);
    await USDT.approve(vault, totalInvestAmount);
    await expect(vaultInvest.deposit(investAmount)).to.be.revertedWith(
      "Vault: deposit less than min"
    );
  });

  //认购金额大于最大供应量
  it("tc-29:Subscribe amount more than the max supply", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF", "RBF",
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
        name: "RbfVaultForTc29",
        symbol: "RbfVaultForTc29",
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
      const manageFee = await vaultInvest.manageFee();
      const maxSupply = await vaultInvest.maxSupply();
      const investAmount = maxSupply + BigInt(10000000000);
      // const investAmount = BigInt(Math.floor(distribution[i] * 1e6));
      const feeAmount = investAmount * BigInt(manageFee) / BigInt(10000);
      const totalInvestAmount = investAmount + feeAmount;
      // investArr.push(totalInvestAmount)
      console.log("investAmount:",investAmount.toString(),"feeAmount:",feeAmount.toString(),"totalInvestAmount:",totalInvestAmount.toString())
      console.log("financePrice",await vaultInvest.financePrice())
      console.log("maxsupply:",maxSupply)
      const USDT = await ethers.getContractAt(
        "MockUSDT",
        usdt.address,
        investSigner
      );
      await USDT.mint(whitelists[0], totalInvestAmount);
      await USDT.approve(vault, totalInvestAmount);
      await expect(vaultInvest.deposit(investAmount)).to.be.revertedWith(
        "Vault: maxSupply exceeded"
      );
  });

  //认购期限截止后认购
  it("tc-30:Subscribe after the subscription period ends", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-30", "RBF-30",
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
    
    const VaultRouter = await deployments.get("VaultRouter");
    const vaultRouter = await hre.ethers.getContractAt(
            "VaultRouter",
            VaultRouter.address
          );
    const vaultId = await vaultRouter.vaultNonce();
    const subStartTime = Math.floor(Date.now() / 1000) - 24 * 3600;
    const subEndTime = subStartTime + 3600;
    const vaultDeployData = {
        vaultId: vaultId,
        name: "RbfVaultForTc30",
        symbol: "RbfVaultForTc30",
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
      const manageFee = await vaultInvest.manageFee();
      const maxSupply = await vaultInvest.maxSupply();
      const investAmount = maxSupply + BigInt(10000000000);
      // const investAmount = BigInt(Math.floor(distribution[i] * 1e6));
      const feeAmount = investAmount * BigInt(manageFee) / BigInt(10000);
      const totalInvestAmount = investAmount + feeAmount;
      // investArr.push(totalInvestAmount)
      console.log("investAmount:",investAmount.toString(),"feeAmount:",feeAmount.toString(),"totalInvestAmount:",totalInvestAmount.toString())

      const USDT = await ethers.getContractAt(
        "MockUSDT",
        usdt.address,
        investSigner
      );
      await USDT.mint(whitelists[0], totalInvestAmount);
      await USDT.approve(vault, totalInvestAmount);
      await expect(vaultInvest.deposit(investAmount)).to.be.revertedWith(
        "Vault: Invalid time"
      );
  });

  //融资达到最大供应量导致融资提前结束，然后继续认购
  it("tc-31:The financing reached the maximum supply, causing the financing to end early, and then the subscription continued.", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-31", "RBF-31",
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
      name: "RbfVaultForTc31",
      symbol: "RbfVaultForTc31",
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
      const maxSupply = await vaultInvest.maxSupply();
      const investAmount = BigInt(maxSupply);
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
      const balance =await vaultInvest.balanceOf(whitelists[0]);
      expect(balance).to.equal(investAmount);

      const minAmount = await vaultInvest.minDepositAmount();
      console.log("minAmount:",minAmount.toString())
      const investAmount2 = BigInt(minAmount);
      const feeAmount2 = investAmount2 * BigInt(manageFee) / BigInt(10000);
      const totalInvestAmount2 = investAmount2 + feeAmount2;
      const investSigner2 = await ethers.getSigner(whitelists[1]);
      console.log("investAmount2:",investAmount2.toString(),"feeAmount2:",feeAmount2.toString(),"totalInvestAmount2:",totalInvestAmount2.toString())
      const USDT_2 = await ethers.getContractAt(
        "MockUSDT",
        usdt.address,
        investSigner2
      );
      await USDT_2.mint(whitelists[1], totalInvestAmount2);

      await USDT_2.approve(vault, totalInvestAmount2);
      // await vaultInvest.deposit(investAmount2);
      await expect(vaultInvest.deposit(investAmount2)).to.be.revertedWith(
        "ERC20: insufficient allowance"
      );
  });

  //通过VaultRouter部署Vault，传入的rbf为零地址:Error: Transaction reverted without a reason string
  it("tc-32:rbf is zero address", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-32", "RBF-32",
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
    
    const VaultRouter = await deployments.get("VaultRouter");
    const vaultRouter = await hre.ethers.getContractAt(
            "VaultRouter",
            VaultRouter.address
          );
    const vaultId = await vaultRouter.vaultNonce();
    const subStartTime = Math.floor(Date.now() / 1000) 
    const subEndTime = subStartTime + 3600;
    console.log("rbfData.rbf:",rbfData.rbf)
    const vaultDeployData = {
        vaultId: vaultId,
        name: "RbfVaultForTc32",
        symbol: "RbfVaultForTc32",
        assetToken: usdt.address,
        rbf: ethers.ZeroAddress,
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
    let err:any;
    try{
      await vaultRouter.deployVault(vaultDeployData);
    }catch(e){
      err = e;
      console.log(e)
    }finally{
      expect(err.message).to.include("Transaction reverted without a reason string");
    }
    
  });

  //tc-52:maxSupply小于0
  it.skip("tc-52:maxSupply is less than 0", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-52", "RBF-52",
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
    
    const VaultRouter = await deployments.get("VaultRouter");
    const vaultRouter = await hre.ethers.getContractAt(
            "VaultRouter",
            VaultRouter.address
          );
    const vaultId = await vaultRouter.vaultNonce();
    const subStartTime = Math.floor(Date.now() / 1000) 
    const subEndTime = subStartTime + 3600;
    console.log("rbfData.rbf:",rbfData.rbf)
    // const maxSupply = BigInt(0);
    const vaultDeployData = {
        vaultId: vaultId,
        name: "RbfVaultForTc52",
        symbol: "RbfVaultForTc52",
        assetToken: usdt.address,
        rbf: ethers.ZeroAddress,
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
        maxSupply: BigInt(0)-BigInt(1),
        financePrice: "100000000",
    };
    // await vaultRouter.deployVault(vaultDeployData);
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
      "Vault: Invalid maxSupply"
    );
      
  });
  //maxSupply等于0
  it("tc-33:maxSupply is equal to 0", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-33", "RBF-33",
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
    
    const VaultRouter = await deployments.get("VaultRouter");
    const vaultRouter = await hre.ethers.getContractAt(
            "VaultRouter",
            VaultRouter.address
          );
    const vaultId = await vaultRouter.vaultNonce();
    const subStartTime = Math.floor(Date.now() / 1000) 
    const subEndTime = subStartTime + 3600;
    console.log("rbfData.rbf:",rbfData.rbf)
    // const maxSupply = BigInt(0);
    const vaultDeployData = {
        vaultId: vaultId,
        name: "RbfVaultForTc33",
        symbol: "RbfVaultForTc33",
        assetToken: usdt.address,
        rbf: ethers.ZeroAddress,
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
        maxSupply: "0",
        financePrice: "100000000",
    };
    let err:any;
    try{
      await vaultRouter.deployVault(vaultDeployData);
    }catch(e){
      err = e;
      console.log(e)
    }finally{
      expect(err.message).to.include("Transaction reverted without a reason string");
    }
        
  });

  //融资阈值为0
  it("tc-34:fundThreshold is equal to 0", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-34", "RBF-34",
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
    
    const VaultRouter = await deployments.get("VaultRouter");
    const vaultRouter = await hre.ethers.getContractAt(
      "VaultRouter",
      VaultRouter.address
    );
    const vaultId = await vaultRouter.vaultNonce();
    const subStartTime = Math.floor(Date.now() / 1000) 
    const subEndTime = subStartTime + 3600;

    //融资阈值为0
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc34",
      symbol: "RbfVaultForTc34",
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "0",
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
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
      "Vault: Invalid fundThreshold"
    );

    //融资阈值大于100%
    const vaultDeployData_1 = {
      vaultId: vaultId,
      name: "RbfVaultForTc56",
      symbol: "RbfVaultForTc56",
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "11000",
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
    await expect(vaultRouter.deployVault(vaultDeployData_1)).to.be.revertedWith(
      "Vault: Invalid fundThreshold"
    );

    //融资价格等于0
    const vaultDeployData_2 = {
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
      whitelists: whitelists,
      guardian: guardian,
      maxSupply: "10000000000",
      financePrice: "0",
    };
    await expect(vaultRouter.deployVault(vaultDeployData_2)).to.be.revertedWith(
      "Vault: Invalid financePrice"
    );

    //锁定期等于0
    const vaultDeployData_3 = {
      vaultId: vaultId,
      name: "RbfVaultForTc58",
      symbol: "RbfVaultForTc58",
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "0",
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
    await expect(vaultRouter.deployVault(vaultDeployData_3)).to.be.revertedWith(
      "Vault: Invalid duration"
    );

    //最小投资金额等于0
    const vaultDeployData_4 = {
      vaultId: vaultId,
      name: "RbfVaultForTc59",
      symbol: "RbfVaultForTc59",
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "3000",
      minDepositAmount: "0",
      manageFee: "50",
      manager: manager,
      feeReceiver: feeReceiver,
      dividendEscrow: manager, // 添加这一行
      whitelists: whitelists,
      guardian: guardian,
      maxSupply: "10000000000",
      financePrice: "100000000",
    };
    await expect(vaultRouter.deployVault(vaultDeployData_4)).to.be.revertedWith(
      "Vault: Invalid minDepositAmount"
    );

    //管理费大于100%
    const vaultDeployData_6 = {
      vaultId: vaultId,
      name: "RbfVaultForTc61",
      symbol: "RbfVaultForTc61",
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "3000",
      minDepositAmount: "1000000",
      manageFee: "11000",
      manager: manager,
      feeReceiver: feeReceiver,
      dividendEscrow: manager, // 添加这一行
      whitelists: whitelists,
      guardian: guardian,
      maxSupply: "10000000000",
      financePrice: "100000000",
    };
    await expect(vaultRouter.deployVault(vaultDeployData_6)).to.be.revertedWith(
      "Vault: Invalid managerFee"
    );

    //最小投资金额大于最大供应量
    const vaultDeployData_7 = {
      vaultId: vaultId,
      name: "RbfVaultForTc62",
      symbol: "RbfVaultForTc62",
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "3000",
      minDepositAmount: "20000000000",
      manageFee: "3000",
      manager: manager,
      feeReceiver: feeReceiver,
      dividendEscrow: manager, // 添加这一行
      whitelists: whitelists,
      guardian: guardian,
      maxSupply: "10000000000",
      financePrice: "100000000",
    };
    await expect(vaultRouter.deployVault(vaultDeployData_7)).to.be.revertedWith(
      "Vault: Invalid minDepositAmount"
    );  

    //白名单为空
    const vaultDeployData_8 = {
      vaultId: vaultId,
      name: "RbfVaultForTc63",
      symbol: "RbfVaultForTc63",
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "3000",
      minDepositAmount: "100000",
      manageFee: "3000",
      manager: manager,
      feeReceiver: feeReceiver,
      dividendEscrow: manager, // 添加这一行
      whitelists: [],
      guardian: guardian,
      maxSupply: "10000000000",
      financePrice: "100000000",
    };
    await expect(vaultRouter.deployVault(vaultDeployData_8)).to.be.revertedWith(
      "Vault: Invalid whitelists length"
    );  

    //白名单长度大于100
    const wallets = generateWallets(101);
    console.log("Generated Wallets:", wallets);
    const whitelists_101 = wallets.map(wallet => wallet.address);
    const vaultDeployData_9 = {
      vaultId: vaultId,
      name: "RbfVaultForTc65",
      symbol: "RbfVaultForTc65",
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "3000",
      minDepositAmount: "100000",
      manageFee: "3000",
      manager: manager,
      feeReceiver: feeReceiver,
      dividendEscrow: manager, // 添加这一行
      whitelists: whitelists_101,
      guardian: guardian,
      maxSupply: "10000000000",
      financePrice: "100000000",
    };
    console.log("whitelists length:",whitelists_101.length);
    await expect(vaultRouter.deployVault(vaultDeployData_9)).to.be.revertedWith(
      "Vault: Invalid whitelists length"
    );  

    //白名单长度等于100
    const wallets_100 = generateWallets(100);
    console.log("Generated Wallets:", wallets_100);
    const whitelists_100 = wallets_100.map(wallet => wallet.address);
    const vaultDeployData_10 = {
        vaultId: vaultId,
        name: "RbfVaultForTc64",
        symbol: "RbfVaultForTc64",
        assetToken: usdt.address,
        rbf: rbfData.rbf,
        subStartTime: subStartTime,
        subEndTime: subEndTime,
        duration: "2592000",
        fundThreshold: "3000",
        minDepositAmount: "100000",
        manageFee: "3000",
        manager: manager,
        feeReceiver: feeReceiver,
        dividendEscrow: manager, // 添加这一行
        whitelists: whitelists_100,
        guardian: guardian,
        maxSupply: "10000000000",
        financePrice: "100000000",
    };
    console.log("whitelists length:",whitelists_100.length);
    var res = await vaultRouter.deployVault(vaultDeployData_10);
    var receipt = await res.wait();
    if (!receipt) throw new Error("Transaction failed");
    expect(receipt.status).to.equal(1);
  
  });

  //管理费等于100%
  it("tc-37:manageFee is equal to 100%", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-36", "RBF-36",
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
        name: "RbfVaultForTc36",
        symbol: "RbfVaultForTc36",
        assetToken: usdt.address,
        rbf: rbfData.rbf,
        subStartTime: subStartTime,
        subEndTime: subEndTime,
        duration: "2592000",
        fundThreshold: "3000",
        minDepositAmount: "1000000",
        manageFee: "10000",
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
  
  });

  it("tc-35", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-35", "RBF-35",
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
    
    const VaultRouter = await deployments.get("VaultRouter");
    const vaultRouter = await hre.ethers.getContractAt(
      "VaultRouter",
      VaultRouter.address,
      await ethers.getSigner(investor1)
    );
    const vaultId = await vaultRouter.vaultNonce();
    const subStartTime = Math.floor(Date.now() / 1000) 
    const subEndTime = subStartTime + 3600;
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc35",
      symbol: "RbfVaultForTc35",
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
    
    //部署Vault：not rbf owner
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
      "only rbf owner can deploy vault"
    );

    //部署Vault：rbf owner
    const vaultRouter_1 = await hre.ethers.getContractAt(
      "VaultRouter",
      VaultRouter.address
    );
    await expect(vaultRouter_1.deployVault(vaultDeployData)).not.to.be.reverted;

    const vaultDeployData_1 = {
      vaultId: vaultId + 1n,
      name: "RbfVaultForTc82",
      symbol: "RbfVaultForTc82",
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

    //部署Vault：vaultId已存在
    await expect(vaultRouter_1.deployVault(vaultDeployData_1)).to.be.revertedWith(
      "rbf vault already exist"
    );

  });

  //升级vault
  it("tc-36:Upgrade Vault", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-84", "RBF-84",
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
        name: "RbfVaultForTc84",
        symbol: "RbfVaultForTc84",
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
    const vaultProxyAdmin = vaultData.vaultProxyAdmin;
    const vaultImpl = vaultData.vaultImpl;
    console.log("vaultProxyAdmin:",vaultProxyAdmin);
    console.log("vaultImpl:",vaultImpl);
    let newImplementation: any;
    // 部署新的实现合约
    const VaultV2 = await ethers.getContractFactory("VaultV2");
    newImplementation = await VaultV2.deploy();
    // 等待合约部署完成
    await newImplementation.waitForDeployment();
    console.log("newImplementation",newImplementation)
    const guardianSigner = await ethers.getSigner(guardian);
    
    // 记录旧的实现地址
    const oldImplementation = vaultImpl;
    // 获取 ProxyAdmin 实例
    const proxyAdmin = await ethers.getContractAt("ProxyAdmin", vaultProxyAdmin);
    
    //不使用guardian升级，升级失败
    await expect(proxyAdmin.upgrade(vault, newImplementation)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );

    //使用guardian升级，升级成功
    await proxyAdmin.connect(guardianSigner).upgrade(vault, newImplementation);
    
    // 验证实现地址已更新
    const currentImplementation = await proxyAdmin.getProxyImplementation(vault);
    expect(currentImplementation).to.equal(await newImplementation.getAddress());
    expect(currentImplementation).to.not.equal(oldImplementation);
    // 验证升级后新增的方法
    const upgradedVault = await ethers.getContractAt("VaultV2", vault);
    // 调用新版本合约中的print方法验证升级结果
    expect(await upgradedVault.newFunction()).to.equal("This is VaultV2!");

    const oldVault = await ethers.getContractAt("Vault", vault);
    //验证原有数据的完整性
    expect(await upgradedVault.name()).to.equal(await oldVault.name());
    expect(await upgradedVault.symbol()).to.equal(await oldVault.symbol());

  });

  //升级RBF
  it("tc-38:Upgrade RBF", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-38", "RBF-38",
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
    const rbfProxyAdmin = rbfData.rbfProxyAdmin;
    const rbfImpl = rbfData.rbfImpl;
    console.log("rbfProxyAdmin:",rbfProxyAdmin);
    console.log("rbfImpl:",rbfImpl);

    const RBFV2 = await ethers.getContractFactory("RBFV2");
    const newImplementation = await RBFV2.deploy();
    await newImplementation.waitForDeployment();
    console.log("newImplementation",newImplementation);
    
    // 记录旧的实现地址
    const oldImplementation = rbfImpl;
    // 获取 ProxyAdmin 实例
    const proxyAdmin = await ethers.getContractAt("ProxyAdmin", rbfProxyAdmin);

    const guardianSigner = await ethers.getSigner(guardian);
    
    //不使用guardian升级，升级失败
    await expect(proxyAdmin.upgrade(rbf, newImplementation)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );

    //使用guardian升级，升级成功
    await proxyAdmin.connect(guardianSigner).upgrade(rbf, newImplementation);
    
    // 验证实现地址已更新
    const currentImplementation = await proxyAdmin.getProxyImplementation(rbf);
    expect(currentImplementation).to.equal(await newImplementation.getAddress());
    expect(currentImplementation).to.not.equal(oldImplementation);

    // 验证升级后新增的方法
    const upgradedRBF = await ethers.getContractAt("RBFV2", rbf);
    // 调用新版本合约中的print方法验证升级结果
    expect(await upgradedRBF.newFunction()).to.equal("This is RBFV2!");

    const oldRbf = await ethers.getContractAt("RBF", rbf);
    //验证原有数据的完整性
    expect(await upgradedRBF.name()).to.equal(await oldRbf.name());
    expect(await upgradedRBF.symbol()).to.equal(await oldRbf.symbol());

  });

  //invalid vaultId
  it("tc-59", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-59", "RBF-59",
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
    
    const VaultRouter = await deployments.get("VaultRouter");
    const vaultRouter = await hre.ethers.getContractAt(
      "VaultRouter",
      VaultRouter.address,
      await ethers.getSigner(investor1)
    );
    const vaultId = await vaultRouter.vaultNonce();
    const subStartTime = Math.floor(Date.now() / 1000) 
    const subEndTime = subStartTime + 3600;
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc59",
      symbol: "RbfVaultForTc59",
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

    //部署Vault：vaultId等于Nounce
    const vaultRouter_1 = await hre.ethers.getContractAt(
      "VaultRouter",
      VaultRouter.address
    );

    await expect(vaultRouter_1.deployVault(vaultDeployData)).not.to.be.reverted;


    // await expect(vaultRouter_1.deployVault(vaultDeployData)).to.be.revertedWith("Invalid vaultId");

    const vaultDeployData_1 = {
      vaultId: vaultId ,
      name: "RbfVaultForTc60",
      symbol: "RbfVaultForTc60",
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

    //部署Vault：vaultId小于Nounce
    await expect(vaultRouter_1.deployVault(vaultDeployData_1)).to.be.revertedWith(
      "Invalid vaultId"
    );

    const vaultDeployData_2 = {
      vaultId: vaultId + 2n,
      name: "RbfVaultForTc60",
      symbol: "RbfVaultForTc60",
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

    //部署Vault：vaultId大于Nounce
    await expect(vaultRouter_1.deployVault(vaultDeployData_2)).to.be.revertedWith(
      "Invalid vaultId"
    );

  });

   //管理费等于0
   it("tc-60:manageFee is equal to 0", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
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
        name: "RbfVaultForTc60",
        symbol: "RbfVaultForTc60",
        assetToken: usdt.address,
        rbf: rbfData.rbf,
        subStartTime: subStartTime,
        subEndTime: subEndTime,
        duration: "2592000",
        fundThreshold: "3000",
        minDepositAmount: "1000000",
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
  
  });

  it.skip("tc-85", async function () {
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
        "RBF-66", "RBF-66",
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
    //是MANAGER_ROLE角色的账户执行setVault
    await expect(rbfManager.setVault(rbf)).not.to.be.reverted;

    await rbfManager.requestDeposit(BigInt(11000000000));
    // expect(await VAULT.assetBalance()).to.equal(BigInt(10));
    //setVault之后执行策略，既是MANAGER_ROLE又是vault，然后执行策略
    // await expect(vaultManager.execStrategy()).not.to.be.reverted;
  });
  function generateWallets(count: number) {
    const wallets = [];
    for (let i = 0; i < count; i++) {
      const wallet = ethers.Wallet.createRandom();
      wallets.push(wallet);
    }
    return wallets;
  }
  
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

  
})
