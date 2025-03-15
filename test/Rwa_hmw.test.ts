import hre, { ethers } from "hardhat";
import { expect } from "chai";
import path from "path";
import { deployFactories } from '../utils/deployFactories';
import { factoryAuth } from '../utils/factoryAuth';
import { execSync } from "child_process";
import common from "mocha/lib/interfaces/common";
import { bigint } from "hardhat/internal/core/params/argumentTypes";
import { setMaxIdleHTTPParsers } from "http";
describe("RWA:", function () {
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
    const fundThreshold = await VAULT.fundThreshold();
    const target = maxSupply * fundThreshold / BigInt(10000);
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
    // console.log("whitelists.lenght-1",VAULT.whitelists.length)
    // console.log("whitelists-1",VAULT.whitelists)
    // //要删除的账户不在白名单中，删除失败
    // await expect(vaultManager.removeFromWhitelist(common)).to.be.revertedWith("Vault: Address is not in the whitelist");
    // console.log("whitelists.lenght-2",VAULT.whitelists.length)
    // console.log("whitelists-2",VAULT.whitelists)
    // //要删除的账户在白名单中，删除成功
    // await expect(vaultManager.removeFromWhitelist(investor1)).not.to.be.reverted;
    // console.log("whitelists.lenght-3",VAULT.whitelists.length)
    // console.log("whitelists-3",VAULT.whitelists)
    
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
    await expect(rbfManager.setDepositPirceAndMintAmount(financePrice,maxSupply)).to.be.revertedWith(expectedErrorMessage);

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
    await expect(rbfDrds.setDepositPirceAndMintAmount(financePrice,BigInt(0))).not.to.be.reverted;
    await expect(rbfManager.claimDeposit()).to.be.revertedWith("RBF: depositMintAmount must be greater than 0");
    
    //depositMintAmount和depositPrice不为0，执行claimDeposit，执行成功
    await expect(rbfDrds.setDepositPirceAndMintAmount(financePrice,maxSupply)).not.to.be.reverted;
    expect(await rbfDrds.depositPirce()).to.be.equal(financePrice);
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
    const investors = signers.slice(0, 100);  // 获取前99个签名者
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
    const fundThreshold = await VAULT.fundThreshold();
    const target = maxSupply * fundThreshold / BigInt(10000);
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

  //   //用户已经在白名单，继续往白名单列表中添加
  //   const account1 = signers[1];
  //   await expect(vaultManager.addToWhitelist(account1.address)).to.be.revertedWith("Vault: Address is already whitelisted");
    
  //  //继续添加白名单，白名单中的个数为100
  //  const account100 = signers[99];
  //  await expect(vaultManager.addToWhitelist(account100.address)).not.to.be.reverted;

  //  //白名单已满继续添加白名单，添加失败
  //  const account101 = signers[100];
  //  await expect(vaultManager.addToWhitelist(account101.address)).to.be.revertedWith("Vault: Whitelist is full");

    const rbfManager = await hre.ethers.getContractAt(
      "RBF", // 替换为你的合约名称
      rbf,
      managerSigner
    )
    

    let investArr= new Array();
    let incomeArr = new Array();

    const distribution = distributeMoneyWithMinimum(
      totalSupply,
      whitelists.length,
      minAmount
    );
    console.log("distribution:",distribution)


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

    await expect(rbfDrds.setDepositPirceAndMintAmount(financePrice,maxSupply)).not.to.be.reverted;
    expect(await rbfDrds.depositPirce()).to.be.equal(financePrice);
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
    var vaultDividendBalance:any;
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

  //融资结束时间到，但是没有达到投资阈值
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
        fundThreshold: "10000",
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
    // const balance =await vaultInvest.balanceOf(whitelists[0]);
    // expect(balance).to.equal(investAmount);

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
    await expect(rbfDrds.setDepositPirceAndMintAmount(financePrice,maxSupply)).not.to.be.reverted;
    expect(await rbfDrds.depositPirce()).to.be.equal(financePrice);
    expect(await rbfDrds.depositMintAmount()).to.be.equal(maxSupply);

    //此时查询RBF的金额为0
    expect(await rbfManager.balanceOf(vault)).to.be.equal(0);
    //depositMintAmount不在范围内，执行claimDeposit，执行失败
    await expect(rbfManager.claimDeposit()).to.be.revertedWith("RBF: depositMintAmount is not in the range");
    //此时查询RBF的金额为0
    expect(await rbfManager.balanceOf(vault)).to.be.equal(0);


    //depositMintAmount不在范围内，执行claimDeposit，执行失败
    await expect(rbfDrds.setDepositPirceAndMintAmount(financePrice,target-BigInt(2000000))).not.to.be.reverted;
    expect(await rbfDrds.depositPirce()).to.be.equal(financePrice);
    expect(await rbfDrds.depositMintAmount()).to.be.equal(target-BigInt(2000000));

    //depositMintAmount不在范围内，执行claimDeposit，执行失败
    await expect(rbfManager.claimDeposit()).to.be.revertedWith("RBF: depositMintAmount is not in the range");
    //此时查询RBF的金额为0
    expect(await rbfManager.balanceOf(vault)).to.be.equal(0);

    await expect(rbfDrds.setDepositPirceAndMintAmount(financePrice,target)).not.to.be.reverted;
    expect(await rbfDrds.depositPirce()).to.be.equal(financePrice);
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

  //融资时间结束且达到融资阈值，派息
  it.only("tc-72", async function () {
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
    await expect(rbfDrds.setDepositPirceAndMintAmount(financePrice,maxSupply)).not.to.be.reverted;
    expect(await rbfDrds.depositPirce()).to.be.equal(financePrice);
    expect(await rbfDrds.depositMintAmount()).to.be.equal(maxSupply);

    //此时查询RBF的金额为0
    expect(await rbfManager.balanceOf(vault)).to.be.equal(0);
    //depositMintAmount不在范围内，执行claimDeposit，执行失败
    await expect(rbfManager.claimDeposit()).to.be.revertedWith("RBF: depositMintAmount is not in the range");
    //此时查询RBF的金额为0
    expect(await rbfManager.balanceOf(vault)).to.be.equal(0);


    //depositMintAmount不在范围内，执行claimDeposit，执行失败
    await expect(rbfDrds.setDepositPirceAndMintAmount(financePrice,target-BigInt(2000000))).not.to.be.reverted;
    expect(await rbfDrds.depositPirce()).to.be.equal(financePrice);
    expect(await rbfDrds.depositMintAmount()).to.be.equal(target-BigInt(2000000));

    //depositMintAmount不在范围内，执行claimDeposit，执行失败
    await expect(rbfManager.claimDeposit()).to.be.revertedWith("RBF: depositMintAmount is not in the range");
    //此时查询RBF的金额为0
    expect(await rbfManager.balanceOf(vault)).to.be.equal(0);

    await expect(rbfDrds.setDepositPirceAndMintAmount(financePrice,target)).not.to.be.reverted;
    expect(await rbfDrds.depositPirce()).to.be.equal(financePrice);
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

  //测试删除已经部署的Vault的白名单
  it("tc-73", async function () {
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
        "RBF-73", "RBF-73",
        usdt.address,
        depositTreasury,
        "0",
        deployer,
        manager,
        guardian,]
      ]
    );
    // const rbfDeployData = {
    //   rbfId: rbfId,
    //   name: "RBFForTc66",
    //   symbol: "RBFForTc66",
    //   assetToken: usdt.address,
    //   maxSupply: "10000000000",
    //   manageFee: "50",
    //   depositTreasury: depositTreasury,
    //   mintSlippageBps:"0",
    //   initialPrice: "1000000000",
    //   deployer: deployer,
    //   manager: manager,
    //   guardian: guardian,
    // };
    // const deployData = await rbfRouter.getEncodeData(rbfDeployData);
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
    const fundThreshold = await VAULT.fundThreshold();
    const target = maxSupply * fundThreshold / BigInt(10000);
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
    await expect(rbfManager.setDepositPirceAndMintAmount(financePrice,maxSupply)).to.be.revertedWith(expectedErrorMessage);

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
    await expect(rbfDrds.setDepositPirceAndMintAmount(financePrice,BigInt(0))).not.to.be.reverted;
    await expect(rbfManager.claimDeposit()).to.be.revertedWith("RBF: depositMintAmount must be greater than 0");
    
    //depositMintAmount和depositPrice不为0，执行claimDeposit，执行成功
    await expect(rbfDrds.setDepositPirceAndMintAmount(financePrice,maxSupply)).not.to.be.reverted;
    expect(await rbfDrds.depositPirce()).to.be.equal(financePrice);
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
  });

  //认购期删除白名单成员，然后认购派息
  it.only("tc-77", async function () {
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
      name: "RbfVaultForTc77",
      symbol: "RbfVaultForTc77",
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

    var USDT:any;
    const commonSigner = await ethers.getSigner(common);
    const managerSigner = await ethers.getSigner(manager);
    const vaultManager=await hre.ethers.getContractAt(
      "Vault", // 替换为你的合约名称
      vault,
      managerSigner
    )
    console.log("1-whitelists.lenght",await VAULT.getWhiteListsLen())
    expect(await VAULT.getWhiteListsLen()).to.equal(whitelists.length)
    //要删除的账户不在白名单中，删除失败
    await expect(vaultManager.removeFromWhitelist(common)).to.be.revertedWith("Vault: Address is not in the whitelist");
    expect(await VAULT.getWhiteListsLen()).to.equal(whitelists.length)
    //要删除的账户在白名单中，删除成功
    await expect(vaultManager.removeFromWhitelist(investor1)).not.to.be.reverted;
    expect(await VAULT.getWhiteListsLen()).to.equal(BigInt(whitelists.length - 1))
    console.log(await VAULT.whiteListMap(investor1));
    expect(await VAULT.whiteListMap(investor1)).to.be.equals(false);
    console.log("2-whitelists.lenght",await VAULT.getWhiteListsLen())
    
    // const commonAccount = await hre.ethers.getContractAt(
    //   "RBF", // 替换为你的合约名称
    //   rbf,
    //   commonSigner
    // )
    // const rbfManager = await hre.ethers.getContractAt(
    //   "RBF", // 替换为你的合约名称
    //   rbf,
    //   managerSigner
    // )

    // //此时查询vault的assetBalance为0
    // expect(await VAULT.assetBalance()).to.equal(BigInt(0));
    // let investArr= new Array();
    // let incomeArr = new Array();

    // const whitelistLength = await whitelists.length;
    // const distribution = distributeMoneyWithMinimum(
    //   totalSupply,
    //   whitelistLength,
    //   minAmount
    // );

    // console.log("distribution.length",distribution.length)
    // expect(distribution.length).to.equal(whitelistLength);
    // for (let i = 0; i < whitelistLength; i++) {
    //   const investSigner = await ethers.getSigner(whitelists[i]);
    //   const vaultInvest = await hre.ethers.getContractAt(
    //     "Vault", // 替换为你的合约名称
    //     vault,
    //     investSigner
    //   )
    //   const manageFee=await vaultInvest.manageFee();
    //   const investAmount = BigInt(Math.floor(distribution[i] * 1e6));
    //   const feeAmount = investAmount * BigInt(manageFee) / BigInt(10000);
    //   const totalInvestAmount = investAmount + feeAmount;
    //   investArr.push(totalInvestAmount)
    //   console.log("investAmount:",investAmount.toString(),"feeAmount:",feeAmount.toString(),"totalInvestAmount:",totalInvestAmount.toString())

    //   USDT = await ethers.getContractAt(
    //     "MockUSDT",
    //     usdt.address,
    //     investSigner
    //   );
    //   await expect(USDT.mint(whitelists[i], totalInvestAmount)).not.to.be.reverted;
    //   await expect(USDT.approve(vault, totalInvestAmount)).not.to.be.reverted;
    //   await expect(vaultInvest.deposit(investAmount)).not.to.be.reverted;
    //   expect(await vaultInvest.balanceOf(whitelists[i])).to.equal(investAmount);
    // }
    // expect(await VAULT.assetBalance()).to.equal(maxSupply)
    // console.log("total deposit balance",await VAULT.assetBalance())
    // console.log("total manageFee Balance",await VAULT.manageFeeBalance())
    // console.log("total Balance",await USDT.balanceOf(vault))
    // var expectedErrorMessage = `AccessControl: account ${deployer.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
    // console.log("expectedErrorMessage",expectedErrorMessage)
    // //不是MANAGER_ROLE角色的账户执行策略
    // await expect(
    //   VAULT.execStrategy()
    // ).to.be.revertedWith(expectedErrorMessage);
    // //是MANAGER_ROLE角色的账户但不是vault的ownner执行策略
    // await expect(
    //   vaultManager.execStrategy()
    // ).to.be.revertedWith("RBF: you are not vault"); //不是Vaul执行requestDeposit
    // //不是MANAGER_ROLE角色的账户执行setVault
    // expectedErrorMessage = `AccessControl: account ${common.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
    // console.log("commonAccount",common.toLowerCase())
    // console.log("expectedErrorMessage",expectedErrorMessage)
    // await expect(commonAccount.setVault(vault)).to.be.revertedWith(expectedErrorMessage);
    // //是MANAGER_ROLE角色的账户执行setVault
    // await expect(rbfManager.setVault(vault)).not.to.be.reverted;
    // //setVault之后执行策略，既是MANAGER_ROLE又是vault，然后执行策略
    // await expect(vaultManager.execStrategy()).not.to.be.reverted;

    // //不是PRICE_MINT_AMOUNT_SETTER_ROLE角色的账户执行setDepositPirceAndMintAmount，执行失败
    // expectedErrorMessage = `AccessControl: account ${manager.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("PRICE_MINT_AMOUNT_SETTER_ROLE"))}`;
    // await expect(rbfManager.setDepositPirceAndMintAmount(financePrice,maxSupply)).to.be.revertedWith(expectedErrorMessage);

    // const rbfDeployer = await hre.ethers.getContractAt(
    //   "RBF", // 替换为你的合约名称
    //   rbf
    // )
    // //不是MANAGER_ROLE角色的账户执行grantRole，执行失败
    // expectedErrorMessage = `AccessControl: account ${deployer.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
    // await expect(rbfDeployer.grantRole(ethers.keccak256(ethers.toUtf8Bytes("PRICE_MINT_AMOUNT_SETTER_ROLE")),manager)).to.be.revertedWith(expectedErrorMessage);
    // //是MANAGER_ROLE角色的账户执行grantRole，执行成功
    // await expect(rbfManager.grantRole(ethers.keccak256(ethers.toUtf8Bytes("PRICE_MINT_AMOUNT_SETTER_ROLE")),drds)).not.to.be.reverted;

    // //是PRICE_MINT_AMOUNT_SETTER_ROLE角色的账户执行setDepositPirceAndMintAmount，执行成功
    // const drdsSigner = await ethers.getSigner(drds);
    // const rbfDrds =await hre.ethers.getContractAt(
    //   "RBF", 
    //   rbf,
    //   drdsSigner
    // )

    // //depositPirce为0，执行claimDeposit，执行失败
    // await expect(rbfManager.claimDeposit()).to.be.revertedWith("RBF: depositPirce must be greater than 0");
    // //depositMintAmount为0，执行claimDeposit，执行失败
    // await expect(rbfDrds.setDepositPirceAndMintAmount(financePrice,BigInt(0))).not.to.be.reverted;
    // await expect(rbfManager.claimDeposit()).to.be.revertedWith("RBF: depositMintAmount must be greater than 0");
    
    // //depositMintAmount和depositPrice不为0，执行claimDeposit，执行成功
    // await expect(rbfDrds.setDepositPirceAndMintAmount(financePrice,maxSupply)).not.to.be.reverted;
    // expect(await rbfDrds.depositPirce()).to.be.equal(financePrice);
    // expect(await rbfDrds.depositMintAmount()).to.be.equal(maxSupply);

    // //此时查询RBF的金额为0
    // expect(await rbfManager.balanceOf(vault)).to.be.equal(0);
    // expectedErrorMessage = `AccessControl: account ${drds.toLowerCase()} is missing role ${ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"))}`;
    // //不是MANAGER_ROLE角色的账户执行claimDeposit，执行失败
    // await expect(rbfDrds.claimDeposit()).to.be.revertedWith(expectedErrorMessage);
    // //是MANAGER_ROLE角色的账户执行claimDeposit，执行成功
    // await expect(rbfManager.claimDeposit()).not.to.be.reverted;
    // expect(await rbfManager.balanceOf(vault)).to.be.equal(maxSupply);
    // //不是MANAGER_ROLE角色的账户执行dividend，执行失败
    // await expect(rbfDrds.dividend()).to.be.revertedWith(expectedErrorMessage);
    // //totalDividend为0，执行dividend，执行失败
    // await expect(
    //   rbfManager.dividend()
    // ).to.be.revertedWith("RBF: totalDividend must be greater than 0");

    // //派息
    // const randomMultiplier = 1.1 + Math.random() * 0.4;
    // console.log("派息系数:",randomMultiplier)
    // const principalInterest = Math.floor(totalSupply * randomMultiplier);
    // const waitMint = BigInt(Math.floor(principalInterest - totalSupply) * 1e6);
    // await expect(USDT.mint(depositTreasury, waitMint)).not.to.be.reverted;
    // const dividendCountArr = distributeMoneyWithMinimum(
    //       principalInterest,
    //       whitelists.length,
    //       1
    // );
    // const totalNav= await USDT.balanceOf(depositTreasury);
    // console.log("总派息资产:",totalNav.toString())

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
    //   await expect(USDTdepositTreasury.transfer(rbfDividendTreasury, dividendAmount)).not.to.be.reverted;
    //   await expect(rbfManager.dividend()).not.to.be.reverted;
    //   await expect(vaultManager.dividend()).not.to.be.reverted;
    // }

    // var totalDividend=await USDT.balanceOf(
    //   vaultDividendTreasury
    // );;
    // console.log("金库剩余派息金额:",totalDividend.toString());
    // var investorBalance=await USDT.balanceOf(vaultDividendTreasury);
    // for (let i = 0; i < whitelists.length; i++) {
    //   investorBalance=await USDT.balanceOf(whitelists[i]);
    //   incomeArr.push(investorBalance);
    //   totalDividend=totalDividend+investorBalance;
    // }
    // console.log("总派息额",totalDividend)
    // console.log(investArr)
    // console.log(incomeArr)
    // expect(totalDividend).to.equal(totalNav);
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

