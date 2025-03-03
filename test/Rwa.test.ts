import hre from "hardhat";
import { expect } from "chai";
import ethers from "hardhat";
import { any } from "hardhat/internal/core/params/argumentTypes";

describe("RWA:", function () {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy, execute } = deployments;
  var deployer: any;
  var guardian: any;
  var manager: any;
  var feeReceiver: any;
  var rbfSigner: any;
  var investor1: any;
  var investor2: any;
  var investor3: any;
  var investor4: any;
  var investor5: any;
  var whitelists: any;
  var depositTreasury: any;
  var EscrowFactory: any;
  var PriceFeedFactory: any;
  var RBFFactory: any;
  var VaultFactory: any;
  var RBFRouter: any;
  var VaultRouter: any;
  var usdt: any;

  var rbfRouter: any;
  var vaultRouter: any;

  var rbf: any;
  var vault: any;

  before(async () => {
    const namedAccounts = await getNamedAccounts();
    deployer = namedAccounts.deployer;
    guardian = namedAccounts.guardian;
    manager = namedAccounts.manager;
    investor1 = namedAccounts.investor1;
    investor2 = namedAccounts.investor2;
    investor3 = namedAccounts.investor3;
    investor4 = namedAccounts.investor4;
    investor5 = namedAccounts.investor5;
    whitelists = [investor1, investor2, investor3, investor4, investor5];
    rbfSigner = namedAccounts.rbfSigner;
    feeReceiver = namedAccounts.feeReceiver;
    depositTreasury = namedAccounts.depositTreasury;
    EscrowFactory = await deployments.get("EscrowFactory");
    PriceFeedFactory = await deployments.get("PriceFeedFactory");
    RBFFactory = await deployments.get("RBFFactory");
    VaultFactory = await deployments.get("VaultFactory");
    RBFRouter = await deployments.get("RBFRouter");
    VaultRouter = await deployments.get("VaultRouter");

    usdt = await deploy("MockUSDT", {
      from: deployer,
      args: ["USDC", "UDSC"],
    });
    rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    vaultRouter = await hre.ethers.getContractAt(
      "VaultRouter",
      VaultRouter.address
    );
    const rbfId = await rbfRouter.rbfNonce();


    var maxSupply="10200000000"
    var initialPrice="100000000"
    const rbfDeployData = {
      rbfId: rbfId,
      name: "RBF",
      symbol: "RBF",
      assetToken: usdt.address,
      maxSupply: maxSupply,
      manageFee: "0",
      depositTreasury: depositTreasury,
      initialPrice: initialPrice,
      deployer: deployer,
      manager: manager,
      guardian: guardian,
    };
    const deployData = await rbfRouter.getEncodeData(rbfDeployData);
    const deployDataHash = ethers.keccak256(deployData);
    const signer = await ethers.getSigner(rbfSigner);
    const signature = await signer.signMessage(ethers.getBytes(deployDataHash));
    const signatures = [signature];
    var res = await rbfRouter.deployRBF(deployData, signatures);
    var receipt = await res.wait();
    const rbfData = await rbfRouter.getRBFInfo(rbfId);
    rbf = rbfData.rbf;

    const deployedRbf = await hre.ethers.getContractAt(
      "RBF", // 替换为你的合约名称
      rbf
    )
    expect(await deployedRbf.owner()).to.be.equal(deployer);
    expect(await deployedRbf.assetToken()).to.be.equal(usdt.address);
    expect(await deployedRbf.maxSupply()).to.be.equal(maxSupply);
    expect(await deployedRbf.depositTreasury()).to.be.equal(depositTreasury);
    expect(await deployedRbf.dividendTreasury()).to.be.equal(rbfData.dividendTreasury);
    expect(await deployedRbf.priceFeed()).to.be.equal(rbfData.priceFeed);
    expect(await deployedRbf.manager()).to.be.equal(manager);
    expect(await deployedRbf.manageFee()).to.be.equal("0");
    expect(await deployedRbf.decimalsMultiplier()).to.be.equal(1);
    expect(await deployedRbf.vault()).to.be.equal("0x0000000000000000000000000000000000000000");

    const vaultId = await vaultRouter.vaultNonce();
    const subStartTime = Math.floor(Date.now() / 1000);
    const subEndTime = subStartTime + 3600;
    const duration="2592000"
    const fundThreshold="3000"
    const minDepositAmount="10000000"
    const manageFee="50"
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVault",
      symbol: "RbfVault",
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: duration,
      fundThreshold: fundThreshold,
      minDepositAmount: minDepositAmount,
      manageFee: manageFee,
      manager: manager,
      feeReceiver: feeReceiver,
      whitelists: whitelists,
      guardian: guardian,
    };
    res = await vaultRouter.deployVault(vaultDeployData);
    receipt = await res.wait();
    const vaultData = await vaultRouter.getVaultInfo(vaultId);
    vault = vaultData.vault;

    const deployedVault = await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault
    )

    expect(await deployedVault.rbf()).to.be.equal(rbf);
    expect(await deployedVault.assetToken()).to.be.equal(usdt.address);
    expect(await deployedVault.feeReceiver()).to.be.equal(feeReceiver);
    expect(await deployedVault.dividendTreasury()).to.be.equal(vaultData.dividendTreasury);
    expect(await deployedVault.maxSupply()).to.be.equal(await deployedRbf.maxSupply());

    expect(await deployedVault.subStartTime()).to.be.equal(subStartTime);
    expect(await deployedVault.subEndTime()).to.be.equal(subEndTime);
    expect(await deployedVault.duration()).to.be.equal(duration);
    expect(await deployedVault.fundThreshold()).to.be.equal(fundThreshold);
    expect(await deployedVault.manageFee()).to.be.equal(manageFee);
    expect(await deployedVault.minDepositAmount()).to.be.equal(minDepositAmount);
    expect(await deployedVault.decimalsMultiplier()).to.be.equal(1);
    expect(await deployedVault.manager()).to.be.equal(manager);

  });

  it("rbf error sign deploy:", async function () {
    const rbfId = await rbfRouter.rbfNonce();
    const rbfDeployData = {
      rbfId: rbfId,
      name: "RBF",
      symbol: "RBF",
      assetToken: usdt.address,
      maxSupply: "10000000000",
      manageFee: "50",
      depositTreasury: depositTreasury,
      initialPrice: "1000000000",
      deployer: deployer,
      manager: manager,
      guardian: guardian,
    };
    const deployData = await rbfRouter.getEncodeData(rbfDeployData);
    const deployDataHash = ethers.keccak256(deployData);
    const signer = await ethers.getSigner(deployer);
    const signature = await signer.signMessage(ethers.getBytes(deployDataHash));
    const signatures = [signature];
    await expect(
      rbfRouter.deployRBF(deployData, signatures)
    ).to.be.revertedWith("RBFRouter:Invalid Signer");
  });

  it("rbf error rbfId deploy:", async function () {
    const rbfId = await rbfRouter.rbfNonce();
    const rbfDeployData = {
      rbfId: rbfId - 1n,
      name: "RBF",
      symbol: "RBF",
      assetToken: usdt.address,
      maxSupply: "10000000000",
      manageFee: "50",
      depositTreasury: depositTreasury,
      initialPrice: "1000000000",
      deployer: deployer,
      manager: manager,
      guardian: guardian,
    };
    const deployData = await rbfRouter.getEncodeData(rbfDeployData);
    const deployDataHash = ethers.keccak256(deployData);
    const signer = await ethers.getSigner(rbfSigner);
    const signature = await signer.signMessage(ethers.getBytes(deployDataHash));
    const signatures = [signature];
    await expect(
      rbfRouter.deployRBF(deployData, signatures)
    ).to.be.revertedWith("RBFRouter:Invalid rbfId");
  });

  it("rbf error deployer deploy:", async function () {
    const rbfId = await rbfRouter.rbfNonce();
    const rbfDeployData = {
      rbfId: rbfId,
      name: "RBF",
      symbol: "RBF",
      assetToken: usdt.address,
      maxSupply: "10000000000",
      manageFee: "50",
      depositTreasury: depositTreasury,
      initialPrice: "1000000000",
      deployer: investor1,
      manager: manager,
      guardian: guardian,
    };
    const deployData = await rbfRouter.getEncodeData(rbfDeployData);
    const deployDataHash = ethers.keccak256(deployData);
    const signer = await ethers.getSigner(rbfSigner);
    const signature = await signer.signMessage(ethers.getBytes(deployDataHash));
    const signatures = [signature];
    await expect(
      rbfRouter.deployRBF(deployData, signatures)
    ).to.be.revertedWith("RBFRouter:Invalid deployer");
  });

  it("EscrowFactory not auth deploy", async function () {
    const managerSigner = await ethers.getSigner(manager);
    const escrowFactory = await hre.ethers.getContractAt(
      "EscrowFactory",
      EscrowFactory.address,
      managerSigner
    );
    await expect(escrowFactory.newEscrow(manager)).to.be.revertedWith(
      "Auth/not-authorized"
    );
  });

  it("PriceFeedFactory not auth deploy", async function () {
    const managerSigner = await ethers.getSigner(manager);
    const priceFeedFactory = await hre.ethers.getContractAt(
      "PriceFeedFactory",
      PriceFeedFactory.address,
      managerSigner
    );

    await expect(
      priceFeedFactory.newPriceFeed(deployer,manager, "1000000")
    ).to.be.revertedWith("Auth/not-authorized");
  });

  it("RBFFactory not auth deploy", async function () {
    const managerSigner = await ethers.getSigner(manager);
    const rbfFactory = await hre.ethers.getContractAt(
      "RBFFactory",
      RBFFactory.address,
      managerSigner
    );
    const deployData = {
      name: "RBF",
      symbol: "RBF",
      assetToken: usdt.address,
      maxSupply: "10000000",
      manageFee: "0",
      depositTreasury: depositTreasury,
      dividendTreasury: manager,
      priceFeed: manager,
      manager: manager,
    };

    await expect(rbfFactory.newRBF(deployData, guardian)).to.be.revertedWith(
      "Auth/not-authorized"
    );
  });

  it("VaultFactory not auth deploy", async function () {
    const managerSigner = await ethers.getSigner(manager);
    const vaultFactory = await hre.ethers.getContractAt(
      "VaultFactory",
      VaultFactory.address,
      managerSigner
    );

    const subStartTime = Math.floor(Date.now() / 1000);
    const subEndTime = subStartTime + 3600;

    const deployData = {
      name: "VAULT",
      symbol: "VAULT",
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
      dividendTreasury: manager,
      whitelists: whitelists,
    };
    await expect(
      vaultFactory.newVault(deployData, guardian)
    ).to.be.revertedWith("Auth/not-authorized");
  });

  it("rbf and vault dividend", async function () {

    const VAULT = await ethers.getContractAt("Vault", vault);
    const maxSupply = await VAULT.maxSupply();
    const minDepositAmount = await VAULT.minDepositAmount();
    const totalSupply = Number(maxSupply / BigInt(1e6));
    const minAmount = Number(minDepositAmount / BigInt(1e6));

    const distribution = distributeMoneyWithMinimum(
      totalSupply,
      whitelists.length,
      minAmount
    );
    var vaultInvest:any;
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
    let investArr= new Array();
    let incomeArr = new Array();

    for (let i = 0; i < whitelists.length; i++) {
      const investSigner = await ethers.getSigner(whitelists[i]);
      vaultInvest = await hre.ethers.getContractAt(
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
      await USDT.mint(whitelists[i], totalInvestAmount);


      await USDT.approve(vault, totalInvestAmount);

      await vaultInvest.deposit(investAmount);
      const balance =await vaultInvest.balanceOf(whitelists[i]);
      expect(await vaultInvest.balanceOf(whitelists[i])).to.equal(investAmount);
    }


    expect(await VAULT.assetBalance()).to.equal(maxSupply)
    console.log("total deposit balance",await VAULT.assetBalance())
    console.log("total manageFee Balance",await VAULT.manageFeeBalance())
    console.log("total Balance",await USDT.balanceOf(vault))

    await expect(
      VAULT.execStrategy(maxSupply)
    ).to.be.revertedWith("Vault: you are not manager");

    await expect(
      vaultManager.execStrategy(maxSupply)
    ).to.be.revertedWith("RBF: you are not vault");

    await rbfManager.setVault(vault)
    await vaultManager.execStrategy(maxSupply)

    expect(await rbfManager.balanceOf(vault)).to.be.equal(maxSupply)
    expect(await USDT.balanceOf(depositTreasury)).to.be.equal(maxSupply)

    await expect(
      rbfManager.dividend()
    ).to.be.revertedWith("RBF: totalDividend must be greater than 0");

    const randomMultiplier = 1.1 + Math.random() * 0.4;
    console.log("派息系数:",randomMultiplier)
    const principalInterest = Math.floor(totalSupply * randomMultiplier);
    const waitMint = BigInt(Math.floor(principalInterest - totalSupply) * 1e6);
    await USDT.mint(depositTreasury, waitMint)
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
      await USDTdepositTreasury.transfer(rbfDividendTreasury, dividendAmount);
      await rbfManager.dividend();
      await vaultManager.dividend();
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
