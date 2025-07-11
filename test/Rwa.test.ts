import hre from "hardhat";
import { expect } from "chai";
import { bigint } from "hardhat/internal/core/params/argumentTypes";

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
  var drds: any;
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
  var priceFeed: any;

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
    drds = namedAccounts.drds;
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
    await deployments.fixture(["MockUSDT"]);
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
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [
          rbfId,
          "RBF",
          "RBF",
          usdt.address,
          depositTreasury,
          deployer,
          manager,
          guardian,
        ],
      ]
    );
    const deployDataHash = ethers.keccak256(deployData);
    const signer = await ethers.getSigner(rbfSigner);
    const signature = await signer.signMessage(ethers.getBytes(deployDataHash));
    const signatures = [signature];
    await expect(rbfRouter.deployRBF(deployData, signatures)).not.to.be
      .reverted;
    const rbfData = await rbfRouter.getRBFInfo(rbfId);
    rbf = rbfData.rbf;
    priceFeed = rbfData.priceFeed;
    const deployedRbf = await hre.ethers.getContractAt("RBF", rbf);
    expect(await deployedRbf.owner()).to.be.equal(deployer);
    expect(await deployedRbf.assetToken()).to.be.equal(usdt.address);
    expect(await deployedRbf.depositTreasury()).to.be.equal(depositTreasury);
    expect(await deployedRbf.dividendTreasury()).to.be.equal(
      rbfData.dividendTreasury
    );
    expect(await deployedRbf.priceFeed()).to.be.equal(rbfData.priceFeed);
    expect(await deployedRbf.manager()).to.be.equal(manager);

    const vaultId = await vaultRouter.vaultNonce();
    const subStartTime = Math.floor(Date.now() / 1000);
    const subEndTime = subStartTime + 3600;
    const duration = "2592000";
    const fundThreshold = "3000";
    const minDepositAmount = "10000000";
    const manageFee = "50";
    const maxSupply = "1020000000";
    const financePrice = "100000000";
    const vaultDeployData = {
      vaultId: vaultId,
      name: "RbfVault",
      symbol: "RbfVault",
      assetToken: usdt.address,
      rbf: rbfData.rbf,
      maxSupply: maxSupply,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: duration,
      fundThreshold: fundThreshold,
      financePrice: financePrice,
      minDepositAmount: minDepositAmount,
      manageFee: manageFee,
      manager: manager,
      feeReceiver: feeReceiver,
      whitelists: [manager],
      guardian: guardian,
    };
    await expect(vaultRouter.deployVault(vaultDeployData)).not.to.be.reverted;
    const vaultData = await vaultRouter.getVaultInfo(vaultId);
    vault = vaultData.vault;

    const deployedVault = await hre.ethers.getContractAt("Vault", vault);

    expect(await deployedVault.rbf()).to.be.equal(rbf);
    expect(await deployedVault.assetToken()).to.be.equal(usdt.address);
    expect(await deployedVault.feeReceiver()).to.be.equal(feeReceiver);
    expect(await deployedVault.dividendTreasury()).to.be.equal(
      vaultData.dividendTreasury
    );
    expect(await deployedVault.maxSupply()).to.be.equal(maxSupply);
    expect(await deployedVault.subStartTime()).to.be.equal(subStartTime);
    expect(await deployedVault.subEndTime()).to.be.equal(subEndTime);
    expect(await deployedVault.duration()).to.be.equal(duration);
    expect(await deployedVault.fundThreshold()).to.be.equal(fundThreshold);
    expect(await deployedVault.manageFee()).to.be.equal(manageFee);
    expect(await deployedVault.minDepositAmount()).to.be.equal(
      minDepositAmount
    );
    expect(await deployedVault.decimalsMultiplier()).to.be.equal(1);
    expect(await deployedVault.manager()).to.be.equal(manager);
  });

  it("rbf error sign deploy:", async function () {
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [
          rbfId,
          "RBF",
          "RBF",
          usdt.address,
          depositTreasury,
          deployer,
          manager,
          guardian,
        ],
      ]
    );

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
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [
          rbfId - 1n,
          "RBF",
          "RBF",
          usdt.address,
          depositTreasury,
          deployer,
          manager,
          guardian,
        ],
      ]
    );
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
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      [
        "(uint64,string,string,address,address,uint256,address,address,address)",
      ],
      [
        [
          rbfId,
          "RBF",
          "RBF",
          usdt.address,
          depositTreasury,
          0,
          investor1,
          manager,
          guardian,
        ],
      ]
    );
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

    await expect(priceFeedFactory.newPriceFeed(manager)).to.be.revertedWith(
      "Auth/not-authorized"
    );
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
      maxSupply: "10000000",
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: "2592000",
      fundThreshold: "3000",
      financePrice: "100000000",
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
        await expect(vaultInvest.deposit(investAmount)).not.to.be.reverted;
      } else {
        investArr.push(investAmount);
        await expect(vaultManager.addToOffChainWL(whitelists[i])).not.to.be.reverted;
        await expect(vaultManager.addToOnChainWL(whitelists[i])).to.be.revertedWith("Vault: Address is already offChainWL");
        await expect(vaultManager.offChainDepositMint(whitelists[i],investAmount)).not.to.be.reverted;
      }
      const balance = await vaultInvest.balanceOf(whitelists[i]);
      expect(balance).to.equal(investAmount);
    }

    expect(await VAULT.assetBalance()).to.equal(onChainInvest);
    console.log("total deposit balance", await VAULT.assetBalance());
    console.log("total manageFee Balance", await VAULT.manageFeeBalance());
    console.log("total Balance", await USDT.balanceOf(vault));
    var expectedErrorMessage = `AccessControl: account ${deployer.toLowerCase()} is missing role ${ethers.keccak256(
      ethers.toUtf8Bytes("MANAGER_ROLE")
    )}`;
    await expect(VAULT.execStrategy()).to.be.revertedWith(expectedErrorMessage);
    await expect(vaultManager.execStrategy()).to.be.revertedWith(
      "RBF: you are not vault"
    );

    await expect(rbfManager.setVault(vault)).not.to.be.reverted;
    await expect(rbfManager.setVault(vault)).to.be.revertedWith(
      "RBF: vaultAddr already set"
    );
    await expect(vaultManager.execStrategy()).not.to.be.reverted;
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
    console.log("rbf nav:", await rbfManager.getAssetsNav());
    console.log("vault price:", await vaultManager.price());
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
    console.log("dividend ratio:", randomMultiplier);
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
    console.log("dividend nav:", totalNav.toString());

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
      console.log((i + 1) + " dividend:", dividendAmount);
      await expect(
        USDTdepositTreasury.transfer(rbfDividendTreasury, dividendAmount)
      ).not.to.be.reverted;
      await expect(rbfManager.dividend()).not.to.be.reverted;
      await expect(vaultManager.dividend()).not.to.be.reverted;
    }
    await expect(priceFeedDrds.addPrice(0, Math.floor(Date.now() / 1000))).not
      .to.be.reverted;
    console.log("rbf nav:", await rbfManager.getAssetsNav());
    console.log("vault price:", await vaultManager.price());
    expect(await rbfManager.getAssetsNav()).to.be.equal(0);
    expect(await vaultManager.price()).to.be.equal(0);
    var totalDividend = await USDT.balanceOf(vaultDividendTreasury);
    console.log("remaining  asset amount in the vault:", totalDividend.toString());
    var investorBalance = await USDT.balanceOf(vaultDividendTreasury);
    for (let i = 0; i < whitelists.length; i++) {
      investorBalance = await USDT.balanceOf(whitelists[i]);
      incomeArr.push(investorBalance);
      totalDividend = totalDividend + investorBalance;
    }
    console.log("total dividend", totalDividend);
    console.log(investArr);
    console.log(incomeArr);
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
