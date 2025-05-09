import path from "path";
import { execSync } from "child_process";
import hre from "hardhat";
import { expect } from "chai";
import { deployFactories } from '../utils/deployFactoriesAndRouter';
import common from "mocha/lib/interfaces/common";


describe("FactoryAuth:", function () {
  this.timeout(200000); // 增加到 100 秒
  const { deployments, getNamedAccounts, ethers } = hre;
  // let whiteLists: string[];
  let EscrowFactory: any;
  let PriceFeedFactory: any;
  let RBFFactory: any;
  let RBFRouter: any;
  let usdt: any;
  let rbfRouter: any;
  

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
  });

  
  it("tc-1:rbf deploy;", async function () {
    const { deploy} = deployments;
    const {deployer,guardian,manager,rbfSigner,depositTreasury,rbfSigner2} = await getNamedAccounts();
    EscrowFactory = await deployments.get("EscrowFactory");
    PriceFeedFactory = await deployments.get("PriceFeedFactory");
    RBFFactory = await deployments.get("RBFFactory");
    RBFRouter = await deployments.get("RBFRouter");
    usdt = await deploy("MockUSDT", {
      from: deployer,
      args: ["USDC", "UDSC"],
    });

    rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address); 
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

    //当前未给RBFRouter授权，应该不能部署RBF
    await expect(
      rbfRouter.deployRBF(deployData, signatures)
    ).to.be.revertedWith("Auth/not-authorized");

    const {execute} = deployments;
    const {common} = await getNamedAccounts();
    const rbuRouterDeployment = await deployments.get("RBFRouter"); // 替换为你的合约名称 

    //给RBFRouter授权EscrowFactory调用权限：使用一个没有权限的用户授权，应该失败
    await expect(
      execute(
        'EscrowFactory',
        {
          from: common,
          log: true,
          gasLimit: 10000000
        },
        'rely',
        rbuRouterDeployment.address
      )
    ).to.be.revertedWith("Auth/not-authorized");

   
    //继续部署RBF，部署RBF失败
    await expect(
      rbfRouter.deployRBF(deployData, signatures)
    ).to.be.revertedWith("Auth/not-authorized");

    //给RBFRouter授权EscrowFactory调用权限：使用一个有权限的用户授权，应该成功
    let err : any
    let permission :any
    const escrowFactoryDeployment = await deployments.get("EscrowFactory"); // 替换为你的合约名称

    try {
      await execute(
          'EscrowFactory', 
          { from: deployer, log: true,  gasLimit: 10000000  },
          'rely',
          common
      );  
      await execute(
          'EscrowFactory', 
          { from: common, log: true,  gasLimit: 10000000  },
          'rely',
          rbuRouterDeployment.address
      ); 
      const EscrowFactory = await ethers.getContractAt("EscrowFactory", escrowFactoryDeployment.address);
      permission = await EscrowFactory.wards(rbuRouterDeployment.address);
      console.log(permission)
    } catch (error:any) {
      console.log(error)
      err = error
    } finally{
      if(err){
          // 断言错误信息
          expect(err).to.be.undefined; // 这将导致测试用例失败
      }else{
          // 添加断言
          expect(permission).to.equal(1);
      }
    }

    //给RBFRouter仅授权EscrowFactory调用权限后，部署RBF，应该部署失败
    await expect(
      rbfRouter.deployRBF(deployData, signatures)
    ).to.be.revertedWith("Auth/not-authorized");

    //给RBFRouter授权PriceFeedFactory调用权限：使用一个没有权限的用户授权，应该失败
    await expect(
      execute(
        'PriceFeedFactory', 
        { from: common, log: true,  gasLimit: 10000000  },
        'rely',
        rbuRouterDeployment.address
      )
    ).to.be.revertedWith("Auth/not-authorized")

    //给RBFRouter授权PriceFeedFactory调用权限：使用一个有权限的用户授权，应该成功
    const PriceFeedFactoryDeployment = await deployments.get("PriceFeedFactory");
    try {
      await execute(
          'PriceFeedFactory', 
          { from: deployer, log: true,  gasLimit: 10000000  },
          'rely',
          common
      );  
      await execute(
          'PriceFeedFactory', 
          { from: common, log: true,  gasLimit: 10000000  },
          'rely',
          rbuRouterDeployment.address
      ); 
      const PriceFeedFactory = await ethers.getContractAt("PriceFeedFactory", PriceFeedFactoryDeployment.address);
      permission = await PriceFeedFactory.wards(rbuRouterDeployment.address);
      console.log(permission)
    } catch (error:any) {
      console.log(error)
      err = error
    } finally{
      if(err){
          // 断言错误信息
          expect(err).to.be.undefined; // 这将导致测试用例失败
      }else{
          // 添加断言
          expect(permission).to.equal(1);
      }
    }

    //给RBFRouter仅授权EscrowFactory、PriceFeedFactory调用权限后，部署RBF，应该部署失败
    await expect(
      rbfRouter.deployRBF(deployData, signatures)
    ).to.be.revertedWith("Auth/not-authorized");

    //给RBFRouter授权RBFFactory调用权限：使用一个没有权限的用户授权，应该失败
    await expect(
      execute(
        'RBFFactory', 
        { from: common, log: true,  gasLimit: 10000000  },
        'rely',
        rbuRouterDeployment.address
      )
    ).to.be.revertedWith("Auth/not-authorized")

    //给RBFRouter授权RBFFactory调用权限：使用一个有权限的用户授权，应该成功
    const RBFFactoryDeployment = await deployments.get("RBFFactory");
    try {
      await execute(
          'RBFFactory', 
          { from: deployer, log: true,  gasLimit: 10000000  },
          'rely',
          common
      );  
      await execute(
          'RBFFactory', 
          { from: common, log: true,  gasLimit: 10000000  },
          'rely',
          rbuRouterDeployment.address
      ); 
      const RBFFactory = await ethers.getContractAt("RBFFactory", RBFFactoryDeployment.address);
      permission = await RBFFactory.wards(rbuRouterDeployment.address);
      console.log(permission)
    } catch (error:any) {
      console.log(error)
      err = error
    } finally{
      if(err){
          // 断言错误信息
          expect(err).to.be.undefined; // 这将导致测试用例失败
      }else{
          // 添加断言
          expect(permission).to.equal(1);
      }
    }

    //给RBFRouter授权RBFFactory、EscrowFactory、PriceFeedFactory调用权限后，且各参数满足要求，部署RBF，应该部署成功
    var res = await rbfRouter.deployRBF(deployData, signatures);
    var receipt = await res.wait();
    if (!receipt) throw new Error("Transaction failed");
    expect(receipt.status).to.equal(1);

  });
  
  
  it("tc-2:deploy vault ", async function () {
    const {manager,feeReceiver,guardian,investor1,investor2,investor3,investor4,investor5,common} = await getNamedAccounts();
    const whitelists = [investor1, investor2, investor3, investor4, investor5];
    const RBFRouter = await deployments.get("RBFRouter");
    // 获取 RBFRouter 合约实例
    const rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address);
    // 获取最新的 rbfId
    const rbfId = await rbfRouter.rbfNonce();
    const rbfData = await rbfRouter.getRBFInfo(rbfId - 1n);
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
        name: "RbfVault",
        symbol: "RbfVault",
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
        whitelists: whitelists,
        isOpen: false,
        guardian: guardian,
        maxSupply: "10000000000", // Add this
        financePrice: "100000000" // Add this
    };

    //当前未给VaultRouter授权，应该不能部署Vault
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
        "Auth/not-authorized"
    );

    //给VaultRouter授权EscrowFactory调用权限：使用没有权限的人给VaultRouter授权，应该失败
    const {execute} = deployments;
    const vaultRouterDeployment = await deployments.get("VaultRouter"); // 替换为你的合约名称 
    await expect(
      execute(
        'EscrowFactory', 
        { from: investor1, log: true,  gasLimit: 10000000  },
        'rely',
        vaultRouterDeployment.address
      )
    ).to.be.revertedWith("Auth/not-authorized")

    //给VaultRouter授权EscrowFactory调用权限：使用有权限的人给VaultRouter授权，应该成功
    const {deployer} = await getNamedAccounts();
    const EscrowFactoryDeployment = await deployments.get("EscrowFactory"); // 替换为你的合约名称 
    await execute(
        'EscrowFactory', 
        { from: deployer, log: true,  gasLimit: 10000000  },
        'rely',
        vaultRouterDeployment.address
    )
    const EscrowFactory = await ethers.getContractAt("EscrowFactory", EscrowFactoryDeployment.address);
    var permission = await EscrowFactory.wards(vaultRouterDeployment.address);
    expect(permission).to.equal(1);

    //当前仅给VaultRouter授权EscrowFactory操作权限，应该不能部署Vault
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith("Auth/not-authorized");

    //给VaultRouter授权VaultFactory调用权限：使用没有权限的人给VaultRouter授权，应该失败
    await expect(
      execute(
        'VaultFactory', 
        { from: investor1, log: true,  gasLimit: 10000000  },
        'rely',
        vaultRouterDeployment.address
      )
    ).to.be.revertedWith("Auth/not-authorized")

    //给VaultRouter授权EscrowFactory调用权限：使用有权限的人给VaultRouter授权，应该成功
    const VaultFactoryDeployment = await deployments.get("VaultFactory"); // 替换为你的合约名称 

    await execute(
        'VaultFactory', 
        { from: deployer, log: true,  gasLimit: 10000000  },
        'rely',
        common
    )
    await execute(
        'VaultFactory', 
        { from: common, log: true,  gasLimit: 10000000  },
        'rely',
        vaultRouterDeployment.address
    )

    const VaultFactory = await ethers.getContractAt("VaultFactory", VaultFactoryDeployment.address);
    permission = await VaultFactory.wards(vaultRouterDeployment.address);
    expect(permission).to.equal(1);

    //当前给VaultRouter授权EscrowFactory、VaultFactory操作权限，应该部署Vault成功
    var res = await vaultRouter.deployVault(vaultDeployData);
    var receipt = await res.wait();
    if (!receipt) throw new Error("Transaction failed");
    expect(receipt.status).to.equal(1); 

  })
  
  
  it("tc-3:Invoke function newEscrow in EscrowFactory", async function () {
    const {investor1} = await getNamedAccounts();
    const investor1Signer = await ethers.getSigner(investor1);
    const EscrowFactory = await deployments.get("EscrowFactory");
    const escrowFactory = await hre.ethers.getContractAt(
      "EscrowFactory",
      EscrowFactory.address,
    );

    //没有权限的人调用EscrowFactory的newEscrow方法，应该调用不成功
    await expect(escrowFactory.connect(investor1Signer).newEscrow(investor1)).to.be.revertedWith(
      "Auth/not-authorized"
    );

    //有权限的人调用EscrowFactory的newEscrow方法，应该调用成功
    const {deployer} = await getNamedAccounts();
    const deployerSigner = await ethers.getSigner(deployer);
    const tx = await escrowFactory.connect(deployerSigner).newEscrow(deployer);
    const receipt = await tx.wait();
    if (!receipt) throw new Error("Transaction failed");
    expect(receipt.status).to.equal(1);


    //newEscrow传入参数为零地址
    const tx_1 = await escrowFactory.connect(deployerSigner).newEscrow(ethers.ZeroAddress);
    const receipt_1 = await tx_1.wait();
    if (!receipt_1) throw new Error("Transaction failed");
    expect(receipt_1.status).to.equal(1);
  });

  
  it("tc-4:Invoke function newPriceFeed in PriceFeedFactory ", async function () {
    const {investor1,deployer} = await getNamedAccounts();
    const investor1Signer = await ethers.getSigner(investor1);
    const PriceFeedFactory = await deployments.get("PriceFeedFactory");
    const priceFeedFactory = await hre.ethers.getContractAt(
      "PriceFeedFactory",
      PriceFeedFactory.address
    );

    //没有权限的人调用PriceFeedFactory的newPriceFeed方法，应该调用不成功
    await expect(priceFeedFactory.connect(investor1Signer).newPriceFeed(investor1)).to.be.revertedWith("Auth/not-authorized");

    //有权限的人调用PriceFeedFactory的newPriceFeed方法，应该调用成功
    const deployerSigner = await ethers.getSigner(deployer);
    const tx = await priceFeedFactory.connect(deployerSigner).newPriceFeed(deployer);
    const receipt = await tx.wait();
    if (!receipt) throw new Error("Transaction failed");
    expect(receipt.status).to.equal(1);
  });


  
  it("tc-5:Invoke function newRBF in RBFFactory", async function () {
    const {deploy} = deployments;
    const {investor1,deployer,depositTreasury,manager} = await getNamedAccounts();
    const investor1Signer = await ethers.getSigner(investor1);
    const RBFFactory = await deployments.get("RBFFactory");
    const rbfFactory = await hre.ethers.getContractAt(
      "RBFFactory",
      RBFFactory.address,
    );
    const usdt = await deploy("MockUSDT", {
        from: deployer,
        args: ["USDC", "UDSC"],
      });
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

    //没有权限的人调用RBFFactory的newRBF方法，应该调用不成功
    await expect(rbfFactory.connect(investor1Signer).newRBF(deployData, investor1)).to.be.revertedWith(
      "Auth/not-authorized"
    );


    //有权限的人调用RBFFactory的newRBF方法，应该调用成功
    const deployerSigner = await ethers.getSigner(deployer);
    const tx = await rbfFactory.connect(deployerSigner).newRBF(deployData,RBFRouter.address);
    const receipt = await tx.wait();
    if (!receipt) throw new Error("Transaction failed");
    expect(receipt.status).to.equal(1);

  });

  
  it("tc-6:Invoke function newVault in VaultFactory", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,rbfSigner2,investor1,investor2,investor3,investor4,investor5,feeReceiver} = await getNamedAccounts();
    const {deploy} = deployments;
    const RBFRouter = await deployments.get("RBFRouter");
    const usdt = await deploy("MockUSDT", {
      from: deployer,
      args: ["USDC", "UDSC"],
    });

    rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address); 
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-tc6", "RBF-tc6",
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
    const managerSigner = await ethers.getSigner(manager);
    const VaultFactory = await deployments.get("VaultFactory");
    const vaultFactory = await hre.ethers.getContractAt(
      "VaultFactory",
      VaultFactory.address
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
        name: "RbfVault-6",
        symbol: "RbfVault-6",
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
        dividendEscrow: manager, 
        whitelists: whitelists,
        isOpen: false,
        guardian: guardian,
        maxSupply: "10000000000", // Add this
        financePrice: "100000000", // Add this
        dividendTreasury: manager,
    };
    
    //没有权限的人调用VaultFactory的newVault方法，应该调用不成功
    await expect(vaultFactory.connect(managerSigner).newVault(vaultDeployData,investor1)).to.be.revertedWith(
      "Auth/not-authorized"
    );

    //有权限的人调用VaultFactory的newVault方法，应该调用成功
    const deployerSigner = await ethers.getSigner(deployer);
    const tx = await vaultFactory.connect(deployerSigner).newVault(vaultDeployData, deployer);
    console.log("tc-6",tx);
    const txReceipt = await tx.wait();
    if (!txReceipt) throw new Error("Transaction failed");
    expect(txReceipt.status).to.equal(1);
  });

  //取消common账户的rely权限后，Factory的new方法无法调用
  it("tc-11:After deny 'common'，it can not call new method in Factory", async function () {
    const {execute,deploy} = deployments;
    const {common,deployer,manager,depositTreasury} = await getNamedAccounts();
   
    await execute(
        'EscrowFactory', 
        { from: deployer, log: true,  gasLimit: 10000000  },
        'deny',
        common
    ); 
    const managerSigner = await ethers.getSigner(common);
    const EscrowFactory = await deployments.get("EscrowFactory");
    const escrowFactory = await hre.ethers.getContractAt(
      "EscrowFactory",
      EscrowFactory.address,
      managerSigner
    );
    await expect(escrowFactory.newEscrow(common)).to.be.revertedWith(
      "Auth/not-authorized"
    );
    await execute(
        'PriceFeedFactory', 
        { from: deployer, log: true,  gasLimit: 10000000  },
        'deny',
        common
    ); 
    const PriceFeedFactory = await deployments.get("PriceFeedFactory");
    const priceFeedFactory = await hre.ethers.getContractAt(
      "PriceFeedFactory",
      PriceFeedFactory.address,
      managerSigner
    );
    await expect(priceFeedFactory.newPriceFeed(common)).to.be.revertedWith(
      "Auth/not-authorized"
    );
    await execute(
        'RBFFactory', 
        { from: deployer, log: true,  gasLimit: 10000000  },
        'deny',
        common
    );

    const RBFFactory = await deployments.get("RBFFactory");
    const rbfFactory = await hre.ethers.getContractAt(
      "RBFFactory",
      RBFFactory.address,
      managerSigner    // 使用common账户的签名者连接合约
    );
    const usdt = await deploy("MockUSDT", {
        from: deployer,
        args: ["USDC", "UDSC"],
      });
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
    await expect(rbfFactory.newRBF(deployData,RBFRouter.address)).to.be.revertedWith(
        "Auth/not-authorized"
      );
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
