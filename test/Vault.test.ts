import hre from "hardhat";
import { expect } from "chai";
import { execSync } from "child_process";
import path from "path";
import { deployFactories } from '../utils/deployFactories';
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
  
  //assetToken为零地址，部署失败
  it("tc-28:assetToken is zero address, deploy failed", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-28", "RBF-28",
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
    
  });

  //manager为零地址，部署失败
  it("tc-29:manager is zero address, deploy failed", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-29", "RBF-29",
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
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
      "Vault: Invalid manager"
    );
    
  });

  //feeReceiver为零地址，部署失败
  it("tc-30:feeReceiver is zero address, deploy failed", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-30", "RBF-30",
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
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
      "Vault: Invalid feeReceiver address"
    );
    
  });

  //RBF不存在，部署失败
  it("tc-40:RBF does not exist, deploy failed", async function () {
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
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-41", "RBF-41",
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
  //认购结束时间早于开始时间
  it("tc-42:Subscription end time is earlier than the start time", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-42", "RBF-42",
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
    
    const VaultRouter = await deployments.get("VaultRouter");
    const vaultRouter = await hre.ethers.getContractAt(
            "VaultRouter",
            VaultRouter.address
          );
    const vaultId = await vaultRouter.vaultNonce();
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
  });

  //不在白名单中的账户认购，认购失败
  it("tc-43:Non-whitelist accounts subscribe, subscribe failed", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-43", "RBF-43",
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
    const investSigner = await ethers.getSigner(common);
    const vaultInvest = await hre.ethers.getContractAt(
        "Vault", // 替换为你的合约名称
        vault,
        investSigner
      )
      const manageFee=await vaultInvest.manageFee();
      const minDepositAmount = await vaultInvest.minDepositAmount();
      const feeAmount = minDepositAmount * BigInt(manageFee) / BigInt(10000);
      const totalInvestAmount = minDepositAmount + feeAmount;
      // investArr.push(totalInvestAmount)
      console.log("investAmount:",minDepositAmount.toString(),"feeAmount:",feeAmount.toString(),"totalInvestAmount:",totalInvestAmount.toString())

      const USDT = await ethers.getContractAt(
        "MockUSDT",
        usdt.address,
        investSigner
      );
      await USDT.mint(common, totalInvestAmount);


      await USDT.approve(vault, totalInvestAmount);
      await expect(vaultInvest.deposit(minDepositAmount)).to.be.revertedWith(
        "Vault: you are not int whitelist"
      );
  });

  //白名单中的账户认购，在认购期内，以最小认购金额认
  it("tc-44&45:Whitelist accounts subscribe", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-44", "RBF-44",
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
        name: "RbfVaultForTc44",
        symbol: "RbfVaultForTc44",
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
  it("tc-46:Subscribe before the subscription starts", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-46", "RBF-46",
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
        name: "RbfVaultForTc46",
        symbol: "RbfVaultForTc46",
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
  it("tc-47:Subscribe amount less than the minimum investment amount", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-47", "RBF-47",
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
        name: "RbfVaultForTc47",
        symbol: "RbfVaultForTc47",
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
  it("tc-48:Subscribe amount more than the max supply", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF", "RBF",
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
        name: "RbfVaultForTc48",
        symbol: "RbfVaultForTc48",
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
  it("tc-49:Subscribe after the subscription period ends", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-49", "RBF-49",
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
        name: "RbfVaultForTc49",
        symbol: "RbfVaultForTc49",
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
  it("tc-50:The financing reached the maximum supply, causing the financing to end early, and then the subscription continued.", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-50", "RBF-50",
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
        name: "RbfVaultForTc50",
        symbol: "RbfVaultForTc50",
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

  //tc-51-Vault.test.ts:通过VaultRouter部署Vault，传入的rbf为零地址:Error: Transaction reverted without a reason string
  it("tc-51:rbf is zero address", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-51", "RBF-51",
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
        name: "RbfVaultForTc51",
        symbol: "RbfVaultForTc51",
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
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-52", "RBF-52",
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
  //tc-53:maxSupply等于0
  it("tc-53:maxSupply is equal to 0", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-53", "RBF-53",
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
        name: "RbfVaultForTc53",
        symbol: "RbfVaultForTc53",
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

  //认购结束时间等于开始时间
  it("tc-54:Subscription end time equal to the start time", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-54", "RBF-54",
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
    
    const VaultRouter = await deployments.get("VaultRouter");
    const vaultRouter = await hre.ethers.getContractAt(
            "VaultRouter",
            VaultRouter.address
          );
    const vaultId = await vaultRouter.vaultNonce();
    const subStartTime = Math.floor(Date.now() / 1000) 
    const subEndTime = subStartTime;
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
        whitelists: whitelists,
        guardian: guardian,
        maxSupply: "10000000000",
        financePrice: "100000000",
    };
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
      "Vault: Invalid subTime"
    );
  });

  //融资阈值为0
  it("tc-55:fundThreshold is equal to 0", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-55", "RBF-55",
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
        name: "RbfVaultForTc55",
        symbol: "RbfVaultForTc55",
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
  
  });

  //融资阈值大于100%
  it("tc-56:fundThreshold is greater than 100%", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-56", "RBF-56",
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
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
      "Vault: Invalid fundThreshold"
    );
  
  });

  //融资价格等于0
  it("tc-57:financePrice is equal to 0", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-57", "RBF-57",
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
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
      "Vault: Invalid financePrice"
    );
  
  });

  //锁定期等于0
  it("tc-58:lockPeriod is equal to 0", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-58", "RBF-58",
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
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
      "Vault: Invalid duration"
    );
  
  });

  //最小投资金额等于0
  it("tc-59:minDepositAmount is equal to 0", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-59", "RBF-59",
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
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
      "Vault: Invalid minDepositAmount"
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
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-60", "RBF-60",
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
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
      "Vault: Invalid managerFee"
    );
  
  });

  //管理费等于100%
  it("tc-65:manageFee is equal to 100%", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-65", "RBF-65",
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
        name: "RbfVaultForTc65",
        symbol: "RbfVaultForTc65",
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

  //管理费大于100%
  it("tc-61:manageFee is greater than 100%", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RB-61F", "RB-61F",
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
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
      "Vault: Invalid managerFee"
    );
  
  })

  //最小投资金额大于最大供应量
  it("tc-62:minDepositAmount is greater than maxSupply", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-62", "RBF-62",
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
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
      "Vault: Invalid minDepositAmount"
    );  
  })

  //白名单为空
  it("tc-63:whitelists is empty", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-63", "RBF-63",
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

    const whitelists:any[] = [];
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
        whitelists: whitelists,
        guardian: guardian,
        maxSupply: "10000000000",
        financePrice: "100000000",
    };
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
      "Vault: Invalid whitelists length"
    );  
  })

  //白名单长度等于100
  it("tc-64:whitelists length is equal to 100", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-64", "RBF-64",
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
    
    const VaultRouter = await deployments.get("VaultRouter");
    const vaultRouter = await hre.ethers.getContractAt(
            "VaultRouter",
            VaultRouter.address
          );
    const vaultId = await vaultRouter.vaultNonce();
    const subStartTime = Math.floor(Date.now() / 1000) 
    const subEndTime = subStartTime + 3600;
    const wallets = generateWallets(100);
    console.log("Generated Wallets:", wallets);
    const whitelists = wallets.map(wallet => wallet.address);
    const vaultDeployData = {
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
  })

  //白名单长度大于100
  it("tc-65:whitelists length is greater than 100", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-65", "RBF-65",
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
    
    const VaultRouter = await deployments.get("VaultRouter");
    const vaultRouter = await hre.ethers.getContractAt(
            "VaultRouter",
            VaultRouter.address
          );
    const vaultId = await vaultRouter.vaultNonce();
    const subStartTime = Math.floor(Date.now() / 1000) 
    const subEndTime = subStartTime + 3600;
    const wallets = generateWallets(101);
    console.log("Generated Wallets:", wallets);
    const whitelists = wallets.map(wallet => wallet.address);
    const vaultDeployData = {
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
        whitelists: whitelists,
        guardian: guardian,
        maxSupply: "10000000000",
        financePrice: "100000000",
    };
    console.log("whitelists length:",whitelists.length);
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
      "Vault: Invalid whitelists length"
    );  
  })
  it("tc-82", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-82", "RBF-82",
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
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
      "only rbf owner can deploy vault"
    );
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
    await expect(vaultRouter_1.deployVault(vaultDeployData_1)).to.be.revertedWith(
      "rbf vault already exist"
    );

  });

  //升级vault
  it("tc-84:Upgrade Vault", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-84", "RBF-84",
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

  it.skip("tc-85", async function () {
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

  //Vault白名单地址为零地址
  it("tc-86", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2,common,drds} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData_1 = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-86", "RBF-86",
        usdt.address,
        depositTreasury,
        "0",
        deployer,
        manager,
        ethers.ZeroAddress,]
      ]
    );
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-86", "RBF-86",
        usdt.address,
        depositTreasury,
        "0",
        deployer,
        manager,
        ethers.ZeroAddress,]
      ]
    );
    const deployDataHash_1 = ethers.keccak256(deployData_1);
    const signer_1 = await ethers.getSigner(rbfSigner);
    const signature_1 = await signer_1.signMessage(ethers.getBytes(deployDataHash_1));
    const signer2_1 = await ethers.getSigner(rbfSigner2);
    const signature2_1 = await signer2_1.signMessage(ethers.getBytes(deployDataHash_1));
    const signatures_1 = [signature_1,signature2_1];
    
    await expect(rbfRouter.deployRBF(deployData_1, signatures_1)).to.be.revertedWith("Ownable: new owner is the zero address");

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
    const vaultDeployData_1 = {
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
        guardian: ethers.ZeroAddress,
        maxSupply: "10000000000",
        financePrice: "100000000",
    };

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
  await expect(vaultRouter.deployVault(vaultDeployData_1)).to.be.revertedWith("Ownable: new owner is the zero address");
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

  it.only("tc-91:Upgrade RBF", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-84", "RBF-84",
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
