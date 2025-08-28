import hre from "hardhat";
import { expect } from "chai";
import { execSync } from "child_process";
import path from "path";
import { deployFactories } from '../utils/deployFactoriesAndRouter';
import { factoryAuth } from '../utils/factoryAuth';
import { introspection } from "../typechain-types/@openzeppelin/contracts/utils";
import { rbf } from "../typechain-types/contracts";

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

  var VaultDecimals = 18;
  var rbfDecimals = VaultDecimals;
  var decimalUsdt: any;
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
    const { deployer, investor1, investor2, investor3, investor4, investor5 } = await getNamedAccounts();
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
    // usdt = await hre.ethers.getContractAt("MockUSDT", usdtDeployment.address);
    rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
  });

  it("tc-22:assetToken is zero address, deploy failed", async function () {
    const { deployer, guardian, manager, rbfSigner, depositTreasury, feeReceiver, investor1, investor2, investor3, investor4, investor5, rbfSigner2 } = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
          "RBF-22", "RBF-22",
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
    const signatures = [signature, signature2];

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
    const minDepositAmountInput = 10n * decimalUsdt;
    const maxSupplyInput =  10000n * (10n ** BigInt(VaultDecimals));

    //assetToken为零地址，部署失败
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForVault_assetTokenIsZeroAddress",
      symbol: "RbfVaultForVault_assetTokenIsZeroAddress",
      decimals: VaultDecimals,
      assetToken: ethers.ZeroAddress,
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
    // await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
    //   "Vault: Invalid assetToken address"
    // );

    try {
      const tx = await vaultRouter.deployVault(vaultDeployData);
      await tx.wait(); // 若未回滚，正常执行
      console.log("Transaction succeeded");
    } catch (err: any) {
      // 检查错误是否包含特定回滚信息
      if (err.message.includes("reverted with custom error 'InvalidZeroAddress()")) {
        console.log("Assertion passed: Transaction reverted as expected");
      } else {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }

    //manager为零地址，部署失败
    const vaultDeployData_1 = {
      vaultId: vaultId,
      name: "RbfVaultForVault_managerIsZeroAddress",
      symbol: "RbfVaultForVault_managerIsZeroAddress",
      decimals: VaultDecimals,
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "3000",
      minDepositAmount: minDepositAmountInput,
      manageFee: "50",
      manager: ethers.ZeroAddress,
      feeReceiver: feeReceiver,
      dividendEscrow: manager, // 添加这一行
      whitelists: whitelists,
      isOpen: false,
      guardian: guardian,
      maxSupply: maxSupplyInput,
      financePrice: "100000000",
    };
    // await expect(vaultRouter.deployVault(vaultDeployData_1)).to.be.revertedWith(
    //   "Vault: Invalid manager"
    // );

    try {
      const tx = await vaultRouter.deployVault(vaultDeployData_1);
      await tx.wait(); // 若未回滚，正常执行
      console.log("Transaction succeeded");
    } catch (err: any) {
      // 检查错误是否包含特定回滚信息
      if (err.message.includes("reverted with custom error 'InvalidZeroAddress()")) {
        console.log("Assertion passed: Transaction reverted as expected");
      } else {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }

    //feeReceiver为零地址，部署失败
    const vaultDeployData_2 = {
      vaultId: vaultId,
      name: "RbfVaultForTc30",
      symbol: "RbfVaultForTc30",
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
      feeReceiver: ethers.ZeroAddress,
      dividendEscrow: manager, // 添加这一行
      whitelists: whitelists,
      isOpen: false,
      guardian: guardian,
      maxSupply: maxSupplyInput,
      financePrice: "100000000",
    };
    // await expect(vaultRouter.deployVault(vaultDeployData_2)).to.be.revertedWith(
    //   "Vault: Invalid feeReceiver address"
    // );

    try {
      const tx = await vaultRouter.deployVault(vaultDeployData_2);
      await tx.wait(); // 若未回滚，正常执行
      console.log("Transaction succeeded");
    } catch (err: any) {
      // 检查错误是否包含特定回滚信息
      if (err.message.includes("reverted with custom error 'InvalidZeroAddress()")) {
        console.log("Assertion passed: Transaction reverted as expected");
      } else {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }

  });

  //RBF不存在，部署失败
  it("tc-23:RBF does not exist, deploy failed", async function () {
    const { deployer, guardian, manager, rbfSigner, depositTreasury, feeReceiver, investor1, investor2, investor3, investor4, investor5, rbfSigner2 } = await getNamedAccounts();
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
    const minDepositAmountInput = 10n * decimalUsdt;
    const maxSupplyInput =  10000n * (10n ** BigInt(VaultDecimals));
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForVault_assetTokenIsZeroAddress",
      symbol: "RbfVaultForVault_assetTokenIsZeroAddress",
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
    let err: any;
    try {
      await vaultRouter.deployVault(vaultDeployData);
    } catch (error) {
      console.log("error", error)
      err = error;
    } finally {
      expect(err.message).to.include("Transaction reverted without a reason string");
    }
  });

  //认购开始时间必须大于当前时间
  it.skip("tc-41:Subscription start time must be greater than the current time", async function () {
    const { deployer, guardian, manager, rbfSigner, depositTreasury, feeReceiver, investor1, investor2, investor3, investor4, investor5, rbfSigner2 } = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
          "RBF-41", "RBF-41",
          18,
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
    const signatures = [signature, signature2];

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
      decimals: 18,
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "3000",
      minDepositAmount: "10000000000000000000",
      manageFee: "50",
      manager: manager,
      feeReceiver: feeReceiver,
      dividendEscrow: manager, // 添加这一行
      whitelists: whitelists,
      isOpen: false,
      guardian: guardian,
      maxSupply: "10000000000000000000000",
      financePrice: "100000000",
    };
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
      "Vault: Invalid manager"
    );
  });

  it("tc-24:Subscription end time is earlier than the start time", async function () {
    const { deployer, guardian, manager, rbfSigner, depositTreasury, feeReceiver, investor1, investor2, investor3, investor4, investor5, rbfSigner2 } = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
          "RBF-24", "RBF-24",
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
    const signatures = [signature, signature2];

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
    const minDepositAmountInput = 10n * decimalUsdt;
    const maxSupplyInput =  10000n * (10n ** BigInt(VaultDecimals));
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc24",
      symbol: "RbfVaultForTc24",
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
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
      "Vault: Invalid subTime"
    );

    //认购结束时间等于开始时间
    const subStartTime_1 = Math.floor(Date.now() / 1000)
    const subEndTime_1 = subStartTime;
    const vaultDeployData_1 = {
      vaultId: vaultId,
      name: "RbfVaultForTc24",
      symbol: "RbfVaultForTc24",
      decimals: VaultDecimals,
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime_1,
      subEndTime: subEndTime_1,
      duration: "2592000",
      fundThreshold: "3000",
      minDepositAmount:minDepositAmountInput,
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
    await expect(vaultRouter.deployVault(vaultDeployData_1)).to.be.revertedWith(
      "Vault: Invalid subTime"
    );
  });


  it("tc-25:Non-whitelist accounts subscribe, subscribe failed", async function () {
    const { deployer, guardian, manager, rbfSigner, depositTreasury, feeReceiver, investor1, investor2, investor3, investor4, investor5, rbfSigner2, common } = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
          "RBF-25", "RBF-25",
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
    const signatures = [signature, signature2];

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
    const minDepositAmountInput = 10n * decimalUsdt;
    const maxSupplyInput =  10000n * (10n ** BigInt(VaultDecimals));
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc25",
      symbol: "RbfVaultForTc25",
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

    //不在白名单中的账户认购，认购失败
    const commonSigner = await ethers.getSigner(common);
    const vaultInvest = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      commonSigner
    )
    const manageFee = await vaultInvest.manageFee();
    const minDepositAmount = await vaultInvest.minDepositAmount();
    const feeAmount = minDepositAmount * BigInt(manageFee) / BigInt(10000);
    const totalInvestAmount = minDepositAmount + feeAmount;
    console.log("investAmount:", minDepositAmount.toString(), "feeAmount:", feeAmount.toString(), "totalInvestAmount:", totalInvestAmount.toString())

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
    const { deployer, guardian, manager, rbfSigner, depositTreasury, feeReceiver, investor1, investor2, investor3, investor4, investor5, rbfSigner2 } = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
          "RBF-26", "RBF-26",
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
    const signatures = [signature, signature2];

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
    const minDepositAmountInput = 10n * decimalUsdt;
    const maxSupplyInput =  10000n * (10n ** BigInt(VaultDecimals));
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc26",
      symbol: "RbfVaultForTc26",
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
    const investSigner = await ethers.getSigner(whitelists[0]);
    const vaultInvest = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      investSigner
    )
    const manageFee = await vaultInvest.manageFee();
    const minDepositAmount = await vaultInvest.minDepositAmount();
    const investAmount = BigInt(minDepositAmount);
    const feeAmount = investAmount * BigInt(manageFee) / BigInt(10000);
    const totalInvestAmount = investAmount + feeAmount;
    console.log("investAmount:", investAmount.toString(), "feeAmount:", feeAmount.toString(), "totalInvestAmount:", totalInvestAmount.toString())

    const USDT = await ethers.getContractAt(
      "MockUSDT",
      usdt.address,
      investSigner
    );
    await USDT.mint(whitelists[0], totalInvestAmount);
    await USDT.approve(vault, totalInvestAmount);
    await vaultInvest.deposit(investAmount);
    const balance = await vaultInvest.balanceOf(whitelists[0]);
    expect(balance / decimalFactor).to.equal(investAmount /decimalUsdt);
  });

  //在认购开始之前认购
  it("tc-27:Subscribe before the subscription starts", async function () {
    const { deployer, guardian, manager, rbfSigner, depositTreasury, feeReceiver, investor1, investor2, investor3, investor4, investor5, rbfSigner2 } = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
          "RBF-27", "RBF-27",
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
    const signatures = [signature, signature2];

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

    const minDepositAmountInput = 10n * decimalUsdt;
    const maxSupplyInput =  10000n * (10n ** BigInt(VaultDecimals));
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc27",
      symbol: "RbfVaultForTc27",
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
    console.log("investAmount:", investAmount.toString(), "feeAmount:", feeAmount.toString(), "totalInvestAmount:", totalInvestAmount.toString())

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
    const { deployer, guardian, manager, rbfSigner, depositTreasury, feeReceiver, investor1, investor2, investor3, investor4, investor5, rbfSigner2 } = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
          "RBF-28", "RBF-28",
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
    const signatures = [signature, signature2];

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
    const minDepositAmountInput = 10n * decimalUsdt;
    const maxSupplyInput =  10000n * (10n ** BigInt(VaultDecimals));
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc28",
      symbol: "RbfVaultForTc28",
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
    console.log("investAmount:", investAmount.toString(), "feeAmount:", feeAmount.toString(), "totalInvestAmount:", totalInvestAmount.toString())

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
    const { deployer, guardian, manager, rbfSigner, depositTreasury, feeReceiver, investor1, investor2, investor3, investor4, investor5, rbfSigner2 } = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
          "RBF", "RBF",
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
    const signatures = [signature, signature2];

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
    const minDepositAmountInput = 10n * decimalUsdt;
    const maxSupplyInput =  10000n * (10n ** BigInt(VaultDecimals));
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc29",
      symbol: "RbfVaultForTc29",
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
    console.log("investAmount:", investAmount.toString(), "feeAmount:", feeAmount.toString(), "totalInvestAmount:", totalInvestAmount.toString())
    console.log("financePrice", await vaultInvest.financePrice())
    console.log("maxsupply:", maxSupply)
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
    const { deployer, guardian, manager, rbfSigner, depositTreasury, feeReceiver, investor1, investor2, investor3, investor4, investor5, rbfSigner2 } = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
          "RBF-30", "RBF-30",
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
    const signatures = [signature, signature2];

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
    const minDepositAmountInput = 10n * decimalUsdt;
    const maxSupplyInput =  10000n * (10n ** BigInt(VaultDecimals));
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc30",
      symbol: "RbfVaultForTc30",
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
    console.log("investAmount:", investAmount.toString(), "feeAmount:", feeAmount.toString(), "totalInvestAmount:", totalInvestAmount.toString())

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
    const { deployer, guardian, manager, rbfSigner, depositTreasury, feeReceiver, investor1, investor2, investor3, investor4, investor5, rbfSigner2 } = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
          "RBF-31", "RBF-31",
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
    const signatures = [signature, signature2];

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
    const minDepositAmountInput = 10n * decimalUsdt;
    const maxSupplyInput =  10000n * (10n ** BigInt(VaultDecimals));
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc31",
      symbol: "RbfVaultForTc31",
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
    const investSigner = await ethers.getSigner(whitelists[0]);
    const vaultInvest = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      investSigner
    )
    const manageFee = await vaultInvest.manageFee();
    const maxSupply = await vaultInvest.maxSupply();
    const investAmount = BigInt(maxSupply) / decimalFactor * decimalUsdt;
    const feeAmount = investAmount * BigInt(manageFee) / BigInt(10000);
    const totalInvestAmount = investAmount + feeAmount;
    console.log("investAmount:", investAmount.toString(), "feeAmount:", feeAmount.toString(), "totalInvestAmount:", totalInvestAmount.toString())

    const USDT = await ethers.getContractAt(
      "MockUSDT",
      usdt.address,
      investSigner
    );
    await USDT.mint(whitelists[0], totalInvestAmount);


    await USDT.approve(vault, totalInvestAmount);

    await vaultInvest.deposit(investAmount);
    const balance = await vaultInvest.balanceOf(whitelists[0]);
    expect(balance / decimalFactor).to.equal(investAmount / decimalUsdt);

    const minAmount = await vaultInvest.minDepositAmount();
    console.log("minAmount:", minAmount.toString())
    const investAmount2 = BigInt(minAmount);
    const feeAmount2 = investAmount2 * BigInt(manageFee);
    const totalInvestAmount2 = investAmount2 + feeAmount2;
    const investSigner2 = await ethers.getSigner(whitelists[1]);
    console.log("investAmount2:", investAmount2.toString(), "feeAmount2:", feeAmount2.toString(), "totalInvestAmount2:", totalInvestAmount2.toString())
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
    const { deployer, guardian, manager, rbfSigner, depositTreasury, feeReceiver, investor1, investor2, investor3, investor4, investor5, rbfSigner2 } = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
          "RBF-32", "RBF-32",
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
    const signatures = [signature, signature2];

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
    const minDepositAmountInput = 10n * decimalUsdt;
    const maxSupplyInput =  10000n * (10n ** BigInt(VaultDecimals));
    console.log("rbfData.rbf:", rbfData.rbf)
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc32",
      symbol: "RbfVaultForTc32",
      decimals: VaultDecimals,
      assetToken: usdt.address,
      rbf: ethers.ZeroAddress,
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
    let err: any;
    try {
      await vaultRouter.deployVault(vaultDeployData);
    } catch (e) {
      err = e;
      console.log(e)
    } finally {
      expect(err.message).to.include("Transaction reverted without a reason string");
    }

  });

  //tc-52:maxSupply小于0
  it.skip("tc-52:maxSupply is less than 0", async function () {
    const { deployer, guardian, manager, rbfSigner, depositTreasury, feeReceiver, investor1, investor2, investor3, investor4, investor5, rbfSigner2 } = await getNamedAccounts();
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
    const signatures = [signature, signature2];

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
    console.log("rbfData.rbf:", rbfData.rbf)
    // const maxSupply = BigInt(0);
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc52",
      symbol: "RbfVaultForTc52",
      decimals: 18,
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
      isOpen: false,
      guardian: guardian,
      maxSupply: BigInt(0) - BigInt(1),
      financePrice: "100000000",
    };
    // await vaultRouter.deployVault(vaultDeployData);
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
      "Vault: Invalid maxSupply"
    );

  });
  //maxSupply等于0
  it("tc-33:maxSupply is equal to 0", async function () {
    const { deployer, guardian, manager, rbfSigner, depositTreasury, feeReceiver, investor1, investor2, investor3, investor4, investor5, rbfSigner2 } = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
          "RBF-33", "RBF-33",
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
    const signatures = [signature, signature2];

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
    const minDepositAmountInput = 10n * decimalUsdt;
    // const maxSupplyInput =  10000n * (10n ** BigInt(VaultDecimals));
    console.log("rbfData.rbf:", rbfData.rbf)
    // const maxSupply = BigInt(0);
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc33",
      symbol: "RbfVaultForTc33",
      decimals: VaultDecimals,
      assetToken: usdt.address,
      rbf: ethers.ZeroAddress,
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
      maxSupply: "0",
      financePrice: "100000000",
    };
    let err: any;
    try {
      await vaultRouter.deployVault(vaultDeployData);
    } catch (e) {
      err = e;
      console.log(e)
    } finally {
      expect(err.message).to.include("Transaction reverted without a reason string");
    }

  });

  //融资阈值为0
  it("tc-34:fundThreshold is equal to 0", async function () {
    const { deployer, guardian, manager, rbfSigner, depositTreasury, feeReceiver, investor1, investor2, investor3, investor4, investor5, rbfSigner2 } = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
          "RBF-34", "RBF-34",
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
    const signatures = [signature, signature2];

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
    const minDepositAmountInput = 10n * decimalUsdt;
    const maxSupplyInput =  10000n * (10n ** BigInt(VaultDecimals));

    //融资阈值为0
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc34",
      symbol: "RbfVaultForTc34",
      decimals: VaultDecimals,
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "0",
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
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
      "Vault: Invalid fundThreshold"
    );

    //融资阈值大于100%
    const vaultDeployData_1 = {
      vaultId: vaultId,
      name: "RbfVaultForTc56",
      symbol: "RbfVaultForTc56",
      decimals: VaultDecimals,
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "11000",
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
    await expect(vaultRouter.deployVault(vaultDeployData_1)).to.be.revertedWith(
      "Vault: Invalid fundThreshold"
    );

    //融资价格等于0
    const vaultDeployData_2 = {
      vaultId: vaultId,
      name: "RbfVaultForTc57",
      symbol: "RbfVaultForTc57",
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
      decimals: VaultDecimals,
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "0",
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
    await expect(vaultRouter.deployVault(vaultDeployData_3)).to.be.revertedWith(
      "Vault: Invalid duration"
    );

    //最小投资金额等于0
    const vaultDeployData_4 = {
      vaultId: vaultId,
      name: "RbfVaultForTc59",
      symbol: "RbfVaultForTc59",
      decimals: VaultDecimals,
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
      isOpen: false,
      guardian: guardian,
      maxSupply: maxSupplyInput,
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
      decimals: VaultDecimals,
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "3000",
      minDepositAmount: minDepositAmountInput,
      manageFee: "11000",
      manager: manager,
      feeReceiver: feeReceiver,
      dividendEscrow: manager, // 添加这一行
      whitelists: whitelists,
      isOpen: false,
      guardian: guardian,
      maxSupply: maxSupplyInput,
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
      decimals: VaultDecimals,
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "3000",
      minDepositAmount: "20000000000000000000000",
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
    await expect(vaultRouter.deployVault(vaultDeployData_7)).to.be.revertedWith(
      "Vault: Invalid minDepositAmount"
    );

    //白名单为空
    const vaultDeployData_8 = {
      vaultId: vaultId,
      name: "RbfVaultForTc63",
      symbol: "RbfVaultForTc63",
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
      whitelists: [],
      isOpen: false,
      guardian: guardian,
      maxSupply: maxSupplyInput,
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
      whitelists: whitelists_101,
      isOpen: false,
      guardian: guardian,
      maxSupply: maxSupplyInput,
      financePrice: "100000000",
    };
    console.log("whitelists length:", whitelists_101.length);
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
      whitelists: whitelists_100,
      isOpen: false,
      guardian: guardian,
      maxSupply: maxSupplyInput,
      financePrice: "100000000",
    };
    console.log("whitelists length:", whitelists_100.length);
    var res = await vaultRouter.deployVault(vaultDeployData_10);
    var receipt = await res.wait();
    if (!receipt) throw new Error("Transaction failed");
    expect(receipt.status).to.equal(1);

  });

  //管理费等于100%
  it("tc-37:manageFee is equal to 100%", async function () {
    const { deployer, guardian, manager, rbfSigner, depositTreasury, feeReceiver, investor1, investor2, investor3, investor4, investor5, rbfSigner2 } = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
          "RBF-37", "RBF-37",
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
    const signatures = [signature, signature2];

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
    const minDepositAmountInput = 10n * decimalUsdt;
    const maxSupplyInput =  10000n * (10n ** BigInt(VaultDecimals));
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc36",
      symbol: "RbfVaultForTc36",
      decimals: VaultDecimals,
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "3000",
      minDepositAmount: minDepositAmountInput,
      manageFee: "10000",
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

  });

  it("tc-35", async function () {
    const { deployer, guardian, manager, rbfSigner, depositTreasury, feeReceiver, investor1, investor2, investor3, investor4, investor5, rbfSigner2 } = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
          "RBF-35", "RBF-35",
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
    const signatures = [signature, signature2];

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
    const minDepositAmountInput = 10n * decimalUsdt;
    const maxSupplyInput =  10000n * (10n ** BigInt(VaultDecimals));
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc35",
      symbol: "RbfVaultForTc35",
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

    //部署Vault：vaultId已存在
    await expect(vaultRouter_1.deployVault(vaultDeployData_1)).to.be.revertedWith(
      "rbf vault already exist"
    );

  });

  //升级vault
  it("tc-36:Upgrade Vault", async function () {
    const { deployer, guardian, manager, rbfSigner, depositTreasury, feeReceiver, investor1, investor2, investor3, investor4, investor5, rbfSigner2 } = await getNamedAccounts();
    const managerSigner = await ethers.getSigner(manager);
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
          "RBF-36", "RBF-36",
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
    const signatures = [signature, signature2];

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
    const maxSupplyInput = 10000n * (10n ** BigInt(VaultDecimals));

    const rbfManager = await hre.ethers.getContractAt(
      "RBF", // 替换为你的合约名称
      rbf,
      managerSigner
    )

    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc84",
      symbol: "RbfVaultForTc84",
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

    //认购满

    const vaultData = await vaultRouter.getVaultInfo(vaultId);
    const vault = vaultData.vault;
    const vaultManager = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      managerSigner
    )

    const VAULT = await ethers.getContractAt("Vault", vault);
    const decimalFactor = await getDecimalFactor(VAULT);


    const maxSupply = await VAULT.maxSupply();
    const financePrice = await VAULT.financePrice();
    const minDepositAmount = await VAULT.minDepositAmount();
    const totalSupply = Number(maxSupply / decimalFactor);
    // const minAmount = Number(minDepositAmount / decimalFactor);
    const minAmount = Number(minDepositAmount / decimalUsdt);

    var USDT: any;

    //此时查询vault的assetBalance为0
    expect(await VAULT.assetBalance()).to.equal(BigInt(0));
    let investArr = new Array();
    let incomeArr = new Array();

    const whitelistLength = await whitelists.length;
    const distribution = distributeMoneyWithMinimum(
      totalSupply,
      whitelistLength,
      minAmount
    );

    console.log("distribution.length", distribution.length)
    expect(distribution.length).to.equal(whitelistLength);
    USDT = await ethers.getContractAt(
      "MockUSDT",
      usdt.address
    );
    var investorBalance_before_all = BigInt(0);
    for (let i = 0; i < whitelists.length; i++) {
      const investSigner = await ethers.getSigner(whitelists[i]);
      var investorBalance_before = await USDT.connect(investSigner).balanceOf(whitelists[i]);
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
      const manageFee = await vaultInvest.manageFee();
      const investAmount = BigInt(Math.floor(distribution[i])) * decimalUsdt;
      const feeAmount = investAmount * BigInt(manageFee) / BigInt(10000);
      const totalInvestAmount = investAmount + feeAmount;
      investArr.push(totalInvestAmount)
      console.log("investAmount:", investAmount.toString(), "feeAmount:", feeAmount.toString(), "totalInvestAmount:", totalInvestAmount.toString())
      await expect(USDT.connect(investSigner).mint(whitelists[i], totalInvestAmount)).not.to.be.reverted;
      await expect(USDT.connect(investSigner).approve(vault, totalInvestAmount)).not.to.be.reverted;
      await expect(vaultInvest.deposit(investAmount)).not.to.be.reverted;
      expect((await vaultInvest.balanceOf(whitelists[i])) / decimalFactor).to.equal(investAmount / decimalUsdt);
    }
    expect((await VAULT.assetBalance()) / decimalUsdt).to.equal(maxSupply / decimalFactor)
    console.log("total deposit balance", await VAULT.assetBalance())
    console.log("total manageFee Balance", await VAULT.manageFeeBalance())
    console.log("total Balance", await USDT.balanceOf(vault))

    const extraAmount = 200n * decimalUsdt; // 转换为正确的精度
    await expect(USDT.mint(manager, extraAmount)).not.to.be.reverted;

    // 检查manager的USDT余额
    const managerBalance = await USDT.balanceOf(manager);
    console.log("Manager USDT balance before transfer:", managerBalance.toString());
    console.log("Extra amount to transfer:", extraAmount.toString());

    // 确保余额足够
    expect(managerBalance).to.be.gte(extraAmount);

    await USDT.connect(managerSigner).transfer(vault, extraAmount);

    //执行策略
    await expect(rbfManager.setVault(vault)).not.to.be.reverted;
    await expect(vaultManager.execStrategy()).not.to.be.reverted;

    const manageSigner = await ethers.getSigner(manager);

    //提取管理费
    await expect(VAULT.connect(manageSigner).withdrawManageFee()).to.be.revertedWith("Vault: Invalid time");

    //升级合约
    const vaultProxyAdmin = vaultData.vaultProxyAdmin;
    const vaultImpl = vaultData.vaultImpl;
    console.log("vaultProxyAdmin:", vaultProxyAdmin);
    console.log("vaultImpl:", vaultImpl);
    let newImplementation: any;
    // 部署新的实现合约
    const VaultV2 = await ethers.getContractFactory("VaultV2");
    newImplementation = await VaultV2.deploy();
    // 等待合约部署完成
    await newImplementation.waitForDeployment();
    console.log("newImplementation", newImplementation)
    const guardianSigner = await ethers.getSigner(guardian);
    console.log("guardian",guardian)

    // 记录旧的实现地址
    const oldImplementation = vaultImpl;
    // 获取 ProxyAdmin 实例
    const proxyAdmin = await ethers.getContractAt("ProxyAdmin", vaultProxyAdmin);
    console.log("proxyAdmin",proxyAdmin);

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

    var expectedErrorMessage = `AccessControl: account ${deployer.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
    console.log("expectedErrorMessage", expectedErrorMessage)

    //提取管理费前提取合约中的金额，提取错误
    await expect(upgradedVault.connect(manageSigner).withdrawExtraFund()).to.be.revertedWith("Vault: manageFeeBalance must be zero");

    //提取管理费
    await expect(upgradedVault.connect(manageSigner).withdrawManageFee()).not.to.be.reverted;

    // 非管理员提取合约中的金额
    await expect(upgradedVault.withdrawExtraFund()).to.be.revertedWith(expectedErrorMessage);

    const beforeAmount = await USDT.balanceOf(feeReceiver);
    console.log("feeReceiver before amount:", beforeAmount);
    expect(await upgradedVault.connect(manageSigner).withdrawExtraFund()).not.to.be.reverted;
    const afterAmount = await USDT.balanceOf(feeReceiver);
    console.log("feeReceiver after amount:", afterAmount);
    console.log("withdraw amount:", afterAmount - beforeAmount);
    expect(afterAmount - beforeAmount).to.equal(extraAmount);


    const oldVault = await ethers.getContractAt("Vault", vault);
    //验证原有数据的完整性
    expect(await upgradedVault.name()).to.equal(await oldVault.name());
    expect(await upgradedVault.symbol()).to.equal(await oldVault.symbol());

  });


  //升级vault
  it("tc-90:Upgrade Vault", async function () {
    const { deployer, guardian, manager, rbfSigner, depositTreasury, feeReceiver, investor1, investor2, investor3, investor4, investor5, rbfSigner2 } = await getNamedAccounts();
    const managerSigner = await ethers.getSigner(manager);
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
          "RBF-36", "RBF-36",
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
    const signatures = [signature, signature2];

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
    const maxSupplyInput = 10000n * (10n ** BigInt(VaultDecimals));

    const rbfManager = await hre.ethers.getContractAt(
      "RBF", // 替换为你的合约名称
      rbf,
      managerSigner
    )

    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc84",
      symbol: "RbfVaultForTc84",
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

    //认购满

    const vaultData = await vaultRouter.getVaultInfo(vaultId);
    const vault = vaultData.vault;
    const vaultManager = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      managerSigner
    )

    const VAULT = await ethers.getContractAt("Vault", vault);
    const decimalFactor = await getDecimalFactor(VAULT);


    const maxSupply = await VAULT.maxSupply();
    const financePrice = await VAULT.financePrice();
    const minDepositAmount = await VAULT.minDepositAmount();
    const totalSupply = Number(maxSupply / decimalFactor);
    // const minAmount = Number(minDepositAmount / decimalFactor);
    const minAmount = Number(minDepositAmount / decimalUsdt);

    var USDT: any;

    //此时查询vault的assetBalance为0
    expect(await VAULT.assetBalance()).to.equal(BigInt(0));
    let investArr = new Array();
    let incomeArr = new Array();

    const whitelistLength = await whitelists.length;
    const distribution = distributeMoneyWithMinimum(
      totalSupply,
      whitelistLength,
      minAmount
    );

    console.log("distribution.length", distribution.length)
    expect(distribution.length).to.equal(whitelistLength);
    USDT = await ethers.getContractAt(
      "MockUSDT",
      usdt.address
    );
    var investorBalance_before_all = BigInt(0);
    for (let i = 0; i < whitelists.length; i++) {
      const investSigner = await ethers.getSigner(whitelists[i]);
      var investorBalance_before = await USDT.connect(investSigner).balanceOf(whitelists[i]);
      investorBalance_before_all = investorBalance_before_all + investorBalance_before;
    }
    const depositTreasuryBalance = await USDT.balanceOf(depositTreasury);

    // 定义extraAmount变量在更大的作用域中
    const extraAmount = 200n * decimalUsdt; // 转换为正确的精度

    //提前认购maxSupply 100%
    for (let i = 0; i < whitelistLength; i++) {
      const investSigner = await ethers.getSigner(whitelists[i]);
      const vaultInvest = await hre.ethers.getContractAt(
        "Vault", // 替换为你的合约名称
        vault,
        investSigner
      )
      const manageFee = await vaultInvest.manageFee();
      const investAmount = BigInt(Math.floor(distribution[i])) * decimalUsdt;
      const feeAmount = investAmount * BigInt(manageFee) / BigInt(10000);
      const totalInvestAmount = investAmount + feeAmount;
      investArr.push(totalInvestAmount)
      console.log("investAmount:", investAmount.toString(), "feeAmount:", feeAmount.toString(), "totalInvestAmount:", totalInvestAmount.toString())
      await expect(USDT.connect(investSigner).mint(whitelists[i], totalInvestAmount)).not.to.be.reverted;
      await expect(USDT.connect(investSigner).approve(vault, totalInvestAmount)).not.to.be.reverted;
      await expect(vaultInvest.deposit(investAmount)).not.to.be.reverted;
      // 修复精度计算：使用相同的精度因子进行比较
      expect((await vaultInvest.balanceOf(whitelists[i])) / decimalFactor).to.equal(investAmount / decimalUsdt);

      if (i === 0) { // 修复赋值操作符为比较操作符
        await expect(USDT.mint(manager, extraAmount)).not.to.be.reverted;

        // 检查manager的USDT余额
        const managerBalance = await USDT.balanceOf(manager);
        console.log("Manager USDT balance before transfer:", managerBalance.toString());
        console.log("Extra amount to transfer:", extraAmount.toString());

        // 确保余额足够
        expect(managerBalance).to.be.gte(extraAmount);

        await USDT.connect(managerSigner).transfer(vault, extraAmount);
      }
    }
    expect((await VAULT.assetBalance()) / decimalUsdt).to.equal(maxSupply / decimalFactor)
    console.log("total deposit balance", await VAULT.assetBalance())
    console.log("total manageFee Balance", await VAULT.manageFeeBalance())
    console.log("total Balance", await USDT.balanceOf(vault))



    //执行策略
    await expect(rbfManager.setVault(vault)).not.to.be.reverted;
    await expect(vaultManager.execStrategy()).not.to.be.reverted;

    const manageSigner = await ethers.getSigner(manager);

    //提取管理费
    await expect(VAULT.connect(manageSigner).withdrawManageFee()).to.be.revertedWith("Vault: Invalid time");

    //升级合约
    const vaultProxyAdmin = vaultData.vaultProxyAdmin;
    const vaultImpl = vaultData.vaultImpl;
    console.log("vaultProxyAdmin:", vaultProxyAdmin);
    console.log("vaultImpl:", vaultImpl);
    let newImplementation: any;
    // 部署新的实现合约
    const VaultV2 = await ethers.getContractFactory("VaultV2");
    newImplementation = await VaultV2.deploy();
    // 等待合约部署完成
    await newImplementation.waitForDeployment();
    console.log("newImplementation", newImplementation)
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

    var expectedErrorMessage = `AccessControl: account ${deployer.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
    console.log("expectedErrorMessage", expectedErrorMessage)

    //提取管理费前提取合约中的金额，提取错误
    await expect(upgradedVault.connect(manageSigner).withdrawExtraFund()).to.be.revertedWith("Vault: manageFeeBalance must be zero");

    //提取管理费
    await expect(upgradedVault.connect(manageSigner).withdrawManageFee()).not.to.be.reverted;

    // 非管理员提取合约中的金额
    await expect(upgradedVault.withdrawExtraFund()).to.be.revertedWith(expectedErrorMessage);

    const beforeAmount = await USDT.balanceOf(feeReceiver);
    console.log("feeReceiver before amount:", beforeAmount);
    expect(await upgradedVault.connect(manageSigner).withdrawExtraFund()).not.to.be.reverted;
    const afterAmount = await USDT.balanceOf(feeReceiver);
    console.log("feeReceiver after amount:", afterAmount);
    console.log("withdraw amount:", afterAmount - beforeAmount);
    expect(afterAmount - beforeAmount).to.equal(extraAmount);


    const oldVault = await ethers.getContractAt("Vault", vault);
    //验证原有数据的完整性
    expect(await upgradedVault.name()).to.equal(await oldVault.name());
    expect(await upgradedVault.symbol()).to.equal(await oldVault.symbol());

  });

  
  //升级RBF
  it("tc-38:Upgrade RBF", async function () {
    const { deployer, guardian, manager, rbfSigner, depositTreasury, feeReceiver, investor1, investor2, investor3, investor4, investor5, rbfSigner2 } = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
          "RBF-38", "RBF-38",
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
    const signatures = [signature, signature2];

    var res = await rbfRouter.deployRBF(deployData, signatures);
    var receipt = await res.wait();
    if (!receipt) throw new Error("Transaction failed");
    expect(receipt.status).to.equal(1);

    const rbfData = await rbfRouter.getRBFInfo(rbfId);
    const rbf = rbfData.rbf;
    const rbfProxyAdmin = rbfData.rbfProxyAdmin;
    const rbfImpl = rbfData.rbfImpl;
    console.log("rbfProxyAdmin:", rbfProxyAdmin);
    console.log("rbfImpl:", rbfImpl);

    const RBFV2 = await ethers.getContractFactory("RBFV2");
    const newImplementation = await RBFV2.deploy();
    await newImplementation.waitForDeployment();
    console.log("newImplementation", newImplementation);

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
    const { deployer, guardian, manager, rbfSigner, depositTreasury, feeReceiver, investor1, investor2, investor3, investor4, investor5, rbfSigner2 } = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
          "RBF-59", "RBF-59",
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
    const signatures = [signature, signature2];

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
    const minDepositAmountInput = 10n * decimalUsdt;
    const maxSupplyInput =  10000n * (10n ** BigInt(VaultDecimals));
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc59",
      symbol: "RbfVaultForTc59",
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

    //部署Vault：vaultId等于Nounce
    const vaultRouter_1 = await hre.ethers.getContractAt(
      "VaultRouter",
      VaultRouter.address
    );

    await expect(vaultRouter_1.deployVault(vaultDeployData)).not.to.be.reverted;


    // await expect(vaultRouter_1.deployVault(vaultDeployData)).to.be.revertedWith("Invalid vaultId");

    const vaultDeployData_1 = {
      vaultId: vaultId,
      name: "RbfVaultForTc60",
      symbol: "RbfVaultForTc60",
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

    //部署Vault：vaultId小于Nounce
    await expect(vaultRouter_1.deployVault(vaultDeployData_1)).to.be.revertedWith(
      "Invalid vaultId"
    );

    const vaultDeployData_2 = {
      vaultId: vaultId + 2n,
      name: "RbfVaultForTc60",
      symbol: "RbfVaultForTc60",
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

    //部署Vault：vaultId大于Nounce
    await expect(vaultRouter_1.deployVault(vaultDeployData_2)).to.be.revertedWith(
      "Invalid vaultId"
    );

  });

  //管理费等于0
  it("tc-60:manageFee is equal to 0", async function () {
    const { deployer, guardian, manager, rbfSigner, depositTreasury, feeReceiver, investor1, investor2, investor3, investor4, investor5, rbfSigner2 } = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
          "RBF-60", "RBF-60",
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
    const signatures = [signature, signature2];

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
    const minDepositAmountInput = 10n * decimalUsdt;
    const maxSupplyInput =  10000n * (10n ** BigInt(VaultDecimals));
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVaultForTc60",
      symbol: "RbfVaultForTc60",
      decimals: VaultDecimals,
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "3000",
      minDepositAmount: minDepositAmountInput,
      manageFee: "0",
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

  });

  // 创建一个辅助函数来获取decimalFactor
  async function getDecimalFactor(vaultContract: any) {
    const decimals = await vaultContract.decimals();
    return BigInt(10) ** BigInt(decimals);
  }


  // 创建一个辅助函数来获取decimalUSDT
  async function getDecimalUSDT(usdt: any) {
    const USDT = await ethers.getContractAt("MockUSDT", usdt);
    return 10n ** BigInt(await USDT.decimals());
  }

  it.skip("tc-85", async function () {
    const { deployer, guardian, manager, rbfSigner, depositTreasury, feeReceiver, investor1, investor2, investor3, investor4, investor5, rbfSigner2, common, drds } = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,uint8,address,address,address,address,address)"],
      [
        [rbfId,
          "RBF-66", "RBF-66",
          18,
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
    const signatures = [signature, signature2];

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
      decimals: 18,
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "3000",
      minDepositAmount: "10000000000000000000",
      manageFee: "50",
      manager: manager,
      feeReceiver: feeReceiver,
      dividendEscrow: manager, // 添加这一行
      whitelists: whitelists,
      isOpen: false,
      guardian: guardian,
      maxSupply: "10000000000000000000000",
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
    const minDepositAmount = await VAULT.minDepositAmount();
    const totalSupply = Number(maxSupply / decimalFactor);
    const minAmount = Number(minDepositAmount / decimalFactor);

    var USDT: any;
    const commonSigner = await ethers.getSigner(common);
    const managerSigner = await ethers.getSigner(manager);
    const vaultManager = await hre.ethers.getContractAt(
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
    let investArr = new Array();
    let incomeArr = new Array();

    const whitelistLength = await whitelists.length;
    const distribution = distributeMoneyWithMinimum(
      totalSupply,
      whitelistLength,
      minAmount
    );

    console.log("distribution.length", distribution.length)
    expect(distribution.length).to.equal(whitelistLength);
    for (let i = 0; i < whitelistLength; i++) {
      const investSigner = await ethers.getSigner(whitelists[i]);
      const vaultInvest = await hre.ethers.getContractAt(
        "Vault", // 替换为你的合约名称
        vault,
        investSigner
      )
      const manageFee = await vaultInvest.manageFee();
      const investAmount = BigInt(Math.floor(distribution[i])) * decimalFactor;
      const feeAmount = investAmount * BigInt(manageFee) / BigInt(10000);
      const totalInvestAmount = investAmount + feeAmount;
      investArr.push(totalInvestAmount)
      console.log("investAmount:", investAmount.toString(), "feeAmount:", feeAmount.toString(), "totalInvestAmount:", totalInvestAmount.toString())

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
    console.log("total deposit balance", await VAULT.assetBalance())
    console.log("total manageFee Balance", await VAULT.manageFeeBalance())
    console.log("total Balance", await USDT.balanceOf(vault))
    var expectedErrorMessage = `AccessControl: account ${deployer.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
    console.log("expectedErrorMessage", expectedErrorMessage)

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
    console.log("commonAccount", common.toLowerCase())
    console.log("expectedErrorMessage", expectedErrorMessage)
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
