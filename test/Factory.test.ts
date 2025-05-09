import path from "path";
import { execSync } from "child_process";
import hre from "hardhat";
import { expect } from "chai";
import { deployFactories } from '../utils/deployFactoriesAndRouter';
import { factoryAuth } from '../utils/factoryAuth';


describe("RBFFactory:", function () {
  this.timeout(200000); // 增加到 100 秒
  const { deployments, getNamedAccounts, ethers } = hre;
  

  before(async () => {
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
  });

  //部署Vault，传入的rbf为零地址，应该不成功
  it("tc-7:Invoke function newVault in VaultFactory,rbf is zero address", async function () {
    const {deploy} = deployments;  
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    const usdt = await deploy("MockUSDT", {
      from: deployer,
      args: ["USDC", "UDSC"],
    });
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-7", "RBF-7",
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

    
    const managerSigner = await ethers.getSigner(deployer);
    const VaultFactory = await deployments.get("VaultFactory");
    const vaultFactory = await hre.ethers.getContractAt(
      "VaultFactory",
      VaultFactory.address,
      managerSigner
    );

    const whitelists = [investor1, investor2, investor3, investor4, investor5];
    const rbfData = await rbfRouter.getRBFInfo(rbfId);
    console.log("rbfData.rbf",rbfData.rbf);
    
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
      name: "RbfVault-7",
      symbol: "RbfVault-7",
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
      isOpen: false,
      guardian: guardian,
      maxSupply: "10000000000", // Add this
      financePrice: "100000000", // Add this
      dividendTreasury: manager,
    };
    // await expect(vaultFactory.newVault(vaultDeployData,deployer)).not.to.be.reverted;
    await expect(vaultFactory.newVault(vaultDeployData,deployer)).to.be.revertedWith(
      "Vault: Invalid rbf address"
    );
  });

  //dividendEscrow为零地址，部署失败
  it("tc-8:Invoke function newVault in VaultFactory,dividendTreasury is zero address", async function () {
    const {deploy} = deployments;  
    const {deployer,guardian,manager,rbfSigner,depositTreasury,feeReceiver,investor1,investor2,investor3,investor4,investor5,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    const usdt = await deploy("MockUSDT", {
      from: deployer,
      args: ["USDC", "UDSC"],
    });
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
    
    const managerSigner = await ethers.getSigner(deployer);
    const VaultFactory = await deployments.get("VaultFactory");
    const vaultFactory = await hre.ethers.getContractAt(
      "VaultFactory",
      VaultFactory.address,
      managerSigner
    );

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
        name: "RbfVault-31",
        symbol: "RbfVault-31",
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
        isOpen: false,
        guardian: guardian,
        maxSupply: "10000000000", // Add this
        financePrice: "100000000", // Add this
        dividendTreasury: ethers.ZeroAddress,
    };
    // await vaultFactory.newVault(vaultDeployData,deployer);
    await expect(vaultFactory.newVault(vaultDeployData,deployer)).to.be.revertedWith(
      "Vault: Invalid dividendTreasury address"
    );
  });

  //调用RBFFactory的newRBF方法，dividendTreasury为零地址，调用失败
  it("tc-9:Invoke function newRBF in RBFFactory,dividendTreasury is zero address", async function () {
    const {deploy} = deployments;
    const {common,deployer,depositTreasury,manager} = await getNamedAccounts();
    const managerSigner = await ethers.getSigner(deployer);
    const RBFFactory = await deployments.get("RBFFactory");
    const RBFRouter = await deployments.get("RBFRouter");
    const rbfFactory = await hre.ethers.getContractAt(
      "RBFFactory",
      RBFFactory.address,
      managerSigner
    );
    const usdt = await deploy("MockUSDT", {
        from: deployer,
        args: ["USDC", "UDSC"],
      });
    const deployData = {
      name: "RBF-16",
      symbol: "RBF-16",
      assetToken: usdt.address,
      maxSupply: "10000000",
      manageFee: "0",
      depositTreasury: depositTreasury,
      dividendTreasury: ethers.ZeroAddress,
      priceFeed: manager,
      manager: manager,
    };
    await expect(rbfFactory.newRBF(deployData,RBFRouter.address)).to.be.revertedWith(
      "RBF: dividendTreasury address cannot be zero address"
    );
  });

  //调用RBFFactory的newRBF方法，priceFeed为零地址，应该失败
  it("tc-10:Invoke function newRBF in RBFFactory,priceFeed is zero address", async function () {
    const {deploy} = deployments;
    const {common,deployer,depositTreasury,manager} = await getNamedAccounts();
    const managerSigner = await ethers.getSigner(deployer);
    const RBFFactory = await deployments.get("RBFFactory");
    const RBFRouter = await deployments.get("RBFRouter");
    const rbfFactory = await hre.ethers.getContractAt(
      "RBFFactory",
      RBFFactory.address,
      managerSigner
    );
    const usdt = await deploy("MockUSDT", {
        from: deployer,
        args: ["USDC", "UDSC"],
      });
    const deployData = {
      name: "RBF-17",
      symbol: "RBF-17",
      assetToken: usdt.address,
      maxSupply: "10000000",
      manageFee: "0",
      depositTreasury: depositTreasury,
      dividendTreasury: manager,
      priceFeed: ethers.ZeroAddress,
      manager: manager,
    };
    await expect(rbfFactory.newRBF(deployData,RBFRouter.address)).to.be.revertedWith(
      "RBF: priceFeedAddr can not be zero address"
    );
  }); 
});
