import path from "path";
import { execSync } from "child_process";
import hre from "hardhat";
import { expect } from "chai";
import { deployFactories } from '../utils/deployFactories';


describe("FactoryAuth:", function () {
  this.timeout(200000); // 增加到 100 秒
  const { deployments, getNamedAccounts, ethers } = hre;
  let whiteLists: string[];
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

  //当前未给RBFRouter授权，应该不能部署RBF
  it("tc-1:rbf deploy failed;", async function () {
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

    await expect(
      rbfRouter.deployRBF(deployData, signatures)
    ).to.be.revertedWith("Auth/not-authorized");
  });

  //给RBFRouter授权EscrowFactory调用权限：使用一个没有权限的用户授权，应该失败
  it("tc-2:EscrowFactory - rely contract address of RBFRouter with common who does not have permission :", async function () {
    const {execute} = deployments;
        const {common} = await getNamedAccounts();
        const rbuRouterDeployment = await deployments.get("RBFRouter"); // 替换为你的合约名称 
        await expect(
            execute(
                'EscrowFactory', 
                { from: common, log: true,  gasLimit: 10000000  },
                'rely',
                rbuRouterDeployment.address
            )).to.be.revertedWith("Auth/not-authorized");
  });

  //给RBFRouter授权EscrowFactory调用权限：使用一个有权限的用户授权，应该成功
  it("tc-3:EscrowFactory - rely contract address of RBFRouter with common who has been relied",async function () {
    const {execute} = deployments;
    const {common,deployer} = await getNamedAccounts();
    const rbuRouterDeployment = await deployments.get("RBFRouter"); // 替换为你的合约名称 
    const escrowFactoryDeployment = await deployments.get("EscrowFactory"); // 替换为你的合约名称 
    let err : any
    let permission :any
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
  });

  //给RBFRouter仅授权EscrowFactory调用权限后，部署RBF，应该部署失败
  it("tc-4:rbf deploy when RBFRouter has been only relied EscrowFactory:", async function () {
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

    await expect(
      rbfRouter.deployRBF(deployData, signatures)
    ).to.be.revertedWith("Auth/not-authorized");
  });

  //给RBFRouter授权PriceFeedFactory调用权限：使用一个没有权限的用户授权，应该失败
  it("tc-5:PriceFeedFactory - rely contract address of RBFRouter with common who does not have permission :", async function () {
    const {execute} = deployments;
        const {common} = await getNamedAccounts();
        const rbuRouterDeployment = await deployments.get("RBFRouter"); // 替换为你的合约名称 
        await expect(execute(
            'PriceFeedFactory', 
            { from: common, log: true,  gasLimit: 10000000  },
            'rely',
            rbuRouterDeployment.address
        )).to.be.revertedWith("Auth/not-authorized")
  });

  //给RBFRouter授权PriceFeedFactory调用权限：使用一个有权限的用户授权，应该成功
  it("tc-6:PriceFeedFactory - rely contract address of RBFRouter with common who has been relied",async function () {
    const {execute} = deployments;
    const {common,deployer} = await getNamedAccounts();
    const rbuRouterDeployment = await deployments.get("RBFRouter"); // 替换为你的合约名称 
    const PriceFeedFactoryDeployment = await deployments.get("PriceFeedFactory"); // 替换为你的合约名称 
    let err : any
    let permission :any
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
  });

  //给RBFRouter仅授权EscrowFactory、PriceFeedFactory调用权限后，部署RBF，应该部署失败
  it("tc-7:rbf deploy when RBFRouter has been only relied EscrowFactory and PriceFeedFactory:", async function () {
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

    await expect(
      rbfRouter.deployRBF(deployData, signatures)
    ).to.be.revertedWith("Auth/not-authorized");
  });

  //给RBFRouter授权RBFFactory调用权限：使用一个没有权限的用户授权，应该失败
  it("tc-8:RBFFactory - rely contract address of RBFRouter with common who does not have permission :", async function () {
    const {execute} = deployments;
    const {common} = await getNamedAccounts();
    const rbuRouterDeployment = await deployments.get("RBFRouter"); // 替换为你的合约名称 
    await expect(execute(
        'RBFFactory', 
        { from: common, log: true,  gasLimit: 10000000  },
        'rely',
        rbuRouterDeployment.address
    )).to.be.revertedWith("Auth/not-authorized")

  });

  //给RBFRouter授权RBFFactory调用权限：使用一个有权限的用户授权，应该成功
  it("tc-9:RBFFactory - rely contract address of RBFRouter with common who has been relied",async function () {
    const {execute} = deployments;
    const {common,deployer} = await getNamedAccounts();
    const rbuRouterDeployment = await deployments.get("RBFRouter"); // 替换为你的合约名称 
    const RBFFactoryDeployment = await deployments.get("RBFFactory"); // 替换为你的合约名称 
    let err : any
    let permission :any
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
  });

  //部署RBF所有条件满足，部署成功
  it("tc-10:rbf deploy success:", async function () {
    const {deploy} = deployments;
    const {deployer,guardian,manager,rbfSigner,depositTreasury,rbfSigner2} = await getNamedAccounts();
    const RBFRouter = await deployments.get("RBFRouter");
    rbfRouter = await hre.ethers.getContractAt("RBFRouter", RBFRouter.address); 
    usdt = await deploy("MockUSDT", {
      from: deployer,
      args: ["USDC", "UDSC"],
    });
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
  });
  
  //当前未给VaultRouter授权，应该不能部署Vault
  it("tc-21:deploy vault failed when VaultRouter has not been relied", async function () {
    const {manager,feeReceiver,guardian,investor1,investor2,investor3,investor4,investor5} = await getNamedAccounts();
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
        guardian: guardian,
        maxSupply: "10000000000", // Add this
        financePrice: "100000000" // Add this
    };
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
        "Auth/not-authorized"
    );
  })

  //给VaultRouter授权EscrowFactory调用权限：使用没有权限的人给VaultRouter授权，应该失败
  it("tc-22:rely EscrowFactory to VaultRouter with someone has no right", async function () {
    const {investor1} = await getNamedAccounts();
    const {execute} = deployments;
    const vaultRouterDeployment = await deployments.get("VaultRouter"); // 替换为你的合约名称 
    await expect(execute(
        'EscrowFactory', 
        { from: investor1, log: true,  gasLimit: 10000000  },
        'rely',
        vaultRouterDeployment.address
    )).to.be.revertedWith("Auth/not-authorized")
  })

  //给VaultRouter授权EscrowFactory调用权限：使用有权限的人给VaultRouter授权，应该成功
  it("tc-23:rely EscrowFactory to VaultRouter with someone has access", async function () {
    const {common} = await getNamedAccounts();
    const {execute} = deployments;
    const vaultRouterDeployment = await deployments.get("VaultRouter"); // 替换为你的合约名称 
    const EscrowFactoryDeployment = await deployments.get("EscrowFactory"); // 替换为你的合约名称 
    await execute(
        'EscrowFactory', 
        { from: common, log: true,  gasLimit: 10000000  },
        'rely',
        vaultRouterDeployment.address
    )

    const EscrowFactory = await ethers.getContractAt("EscrowFactory", EscrowFactoryDeployment.address);
    const permission = await EscrowFactory.wards(vaultRouterDeployment.address);
    // 添加断言
    expect(permission).to.equal(1);
  })

  //当前仅给VaultRouter授权EscrowFactory操作权限，应该不能部署Vault
  it("tc-24:deploy vault failed when VaultRouter has not been relied", async function () {
    const {manager,feeReceiver,guardian,investor1,investor2,investor3,investor4,investor5} = await getNamedAccounts();
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
        guardian: guardian,
        maxSupply: "10000000000", // Add this
        financePrice: "100000000" // Add this
    };
    await expect(vaultRouter.deployVault(vaultDeployData)).to.be.revertedWith(
        "Auth/not-authorized"
    );
  })

  //给VaultRouter授权VaultFactory调用权限：使用没有权限的人给VaultRouter授权，应该失败
  it("tc-25:rely VaultFactory to VaultRouter with someone has no right", async function () {
    const {investor1} = await getNamedAccounts();
    const {execute} = deployments;
    const vaultRouterDeployment = await deployments.get("VaultRouter"); // 替换为你的合约名称 
    await expect(execute(
        'VaultFactory', 
        { from: investor1, log: true,  gasLimit: 10000000  },
        'rely',
        vaultRouterDeployment.address
    )).to.be.revertedWith("Auth/not-authorized")
    
  })

  //给VaultRouter授权EscrowFactory调用权限：使用有权限的人给VaultRouter授权，应该成功
  it("tc-26:rely VaultFactory to VaultRouter with someone has access", async function () {
    const {common,deployer} = await getNamedAccounts();
    const {execute} = deployments;
    const vaultRouterDeployment = await deployments.get("VaultRouter"); // 替换为你的合约名称 
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
    const permission = await VaultFactory.wards(vaultRouterDeployment.address);
    // 添加断言
    expect(permission).to.equal(1);
  })

  //当前给VaultRouter授权EscrowFactory、VaultFactory操作权限，应该部署Vault成功
  it("tc-27:deploy vault success when VaultRouter has been relied for EscrowFactory and VaultFactory", async function () {
    const {manager,feeReceiver,guardian,investor1,investor2,investor3,investor4,investor5} = await getNamedAccounts();
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
        guardian: guardian,
        maxSupply: "10000000000", // Add this
        financePrice: "100000000" // Add this
    };
 
    var res = await vaultRouter.deployVault(vaultDeployData);
    var receipt = await res.wait();
    if (!receipt) throw new Error("Transaction failed");
    expect(receipt.status).to.equal(1); 
  })
  
  //没有权限的人调用EscrowFactory的newEscrow方法，应该调用不成功
  it("tc-32:Invoke function newEscrow in EscrowFactory with someone has no right", async function () {
    const {investor1} = await getNamedAccounts();
    const managerSigner = await ethers.getSigner(investor1);
    const EscrowFactory = await deployments.get("EscrowFactory");
    const escrowFactory = await hre.ethers.getContractAt(
      "EscrowFactory",
      EscrowFactory.address,
      managerSigner
    );
    await expect(escrowFactory.newEscrow(investor1)).to.be.revertedWith(
      "Auth/not-authorized"
    );
  });

  //有权限的人调用EscrowFactory的newEscrow方法，应该调用成功
  it("tc-33:Invoke function newEscrow in EscrowFactory with someone has access", async function () {
    const {common} = await getNamedAccounts();
    const managerSigner = await ethers.getSigner(common);
    const EscrowFactory = await deployments.get("EscrowFactory");
    const escrowFactory = await hre.ethers.getContractAt(
      "EscrowFactory",
      EscrowFactory.address,
      managerSigner
    );
    const tx = await escrowFactory.newEscrow(common);
    const receipt = await tx.wait();
    if (!receipt) throw new Error("Transaction failed");
    expect(receipt.status).to.equal(1);
  });

  //没有权限的人调用PriceFeedFactory的newPriceFeed方法，应该调用不成功
  it("tc-34:PriceFeedFactory not auth deploy", async function () {
    const {investor1} = await getNamedAccounts();
    const managerSigner = await ethers.getSigner(investor1);
    const PriceFeedFactory = await deployments.get("PriceFeedFactory");
    const priceFeedFactory = await hre.ethers.getContractAt(
      "PriceFeedFactory",
      PriceFeedFactory.address,
      managerSigner
    );

    await expect(
      priceFeedFactory.newPriceFeed(investor1)
    ).to.be.revertedWith("Auth/not-authorized");
  });

  //有权限的人调用PriceFeedFactory的newPriceFeed方法，应该调用成功
  it("tc-35:Invoke function newPriceFeed in PriceFeedFactory with someone has access", async function () {
    const {common} = await getNamedAccounts();
    const managerSigner = await ethers.getSigner(common);
    const PriceFeedFactory = await deployments.get("PriceFeedFactory");
    const priceFeedFactory = await hre.ethers.getContractAt(
      "PriceFeedFactory",
      PriceFeedFactory.address,
      managerSigner
    );

    const tx = await priceFeedFactory.newPriceFeed(common);
    const receipt = await tx.wait();
    if (!receipt) throw new Error("Transaction failed");
    expect(receipt.status).to.equal(1);
  });

  //没有权限的人调用RBFFactory的newRBF方法，应该调用不成功
  it("tc-36:RBFFactory not auth deploy", async function () {
    const {deploy} = deployments;
    const {investor1,deployer,depositTreasury,manager} = await getNamedAccounts();
    const managerSigner = await ethers.getSigner(investor1);
    const RBFFactory = await deployments.get("RBFFactory");
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
      name: "RBF",
      symbol: "RBF",
      assetToken: usdt.address,
      maxSupply: "10000000",
      manageFee: "0",
      depositTreasury: depositTreasury,
      dividendTreasury: manager,
      priceFeed: manager,
      manager: manager,
      mintSlippageBps:"0",
    };

    await expect(rbfFactory.newRBF(deployData, investor1)).to.be.revertedWith(
      "Auth/not-authorized"
    );
  });

  //有权限的人调用RBFFactory的newRBF方法，应该调用成功
  it("tc-37:Invoke function newRBF in RBFFactory with someone has access", async function () {
    const {deploy} = deployments;
    const {common,deployer,depositTreasury,manager} = await getNamedAccounts();
    const managerSigner = await ethers.getSigner(common);
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
      name: "RBF",
      symbol: "RBF",
      assetToken: usdt.address,
      maxSupply: "10000000",
      manageFee: "0",
      depositTreasury: depositTreasury,
      dividendTreasury: manager,
      priceFeed: manager,
      manager: manager,
      mintSlippageBps:"0",
    };
    const tx = await rbfFactory.newRBF(deployData,RBFRouter.address);
    const receipt = await tx.wait();
    if (!receipt) throw new Error("Transaction failed");
    expect(receipt.status).to.equal(1);
  });

  //没有权限的人调用VaultFactory的newVault方法，应该调用不成功
  it("tc-38:Invoke function newVault in VaultFactory with someone has no right", async function () {
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
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-tc38", "RBF-tc38",
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
    const managerSigner = await ethers.getSigner(manager);
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
        name: "RbfVault-38",
        symbol: "RbfVault-38",
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
        guardian: guardian,
        maxSupply: "10000000000", // Add this
        financePrice: "100000000", // Add this
        dividendTreasury: manager,
    };
    // await vaultFactory.newVault(vaultDeployData,investor1)
    await expect(vaultFactory.newVault(vaultDeployData,investor1)).to.be.revertedWith(
      "Auth/not-authorized"
    );
  });

  //有权限的人调用VaultFactory的newVault方法，应该调用成功
  it("tc-39:Invoke function newVault in VaultFactory with someone has access", async function () {
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
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-39", "RBF-39",
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
        name: "RbfVault-39",
        symbol: "RbfVault-39",
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
        maxSupply: "10000000000", // Add this
        financePrice: "100000000", // Add this
        dividendTreasury: manager,
    };
    await expect(vaultFactory.newVault(vaultDeployData,deployer)).not.to.be.reverted;
    
  });

  //部署Vault，传入的rbf为零地址，应该不成功
  it("tc-73:rbf is zero address", async function () {
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
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-39", "RBF-39",
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
        name: "RbfVault-39",
        symbol: "RbfVault-39",
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
  it("tc-31:dividendTreasury is zero address", async function () {
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
      ["(uint64,string,string,address,address,uint256,address,address,address)"],
      [
        [rbfId,
        "RBF-31", "RBF-31",
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
  it("tc-16:Invoke function newRBF in RBFFactory,dividendTreasury is zero address", async function () {
    const {deploy} = deployments;
    const {common,deployer,depositTreasury,manager} = await getNamedAccounts();
    const managerSigner = await ethers.getSigner(common);
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
      mintSlippageBps:"0",
    };
    await expect(rbfFactory.newRBF(deployData,RBFRouter.address)).to.be.revertedWith(
      "RBF: dividendTreasury address cannot be zero address"
    );
  });

  //调用RBFFactory的newRBF方法，priceFeed为零地址，应该失败
  it("tc-17:Invoke function newRBF in RBFFactory,priceFeed is zero address", async function () {
    const {deploy} = deployments;
    const {common,deployer,depositTreasury,manager} = await getNamedAccounts();
    const managerSigner = await ethers.getSigner(common);
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
      mintSlippageBps:"0",
    };
    await expect(rbfFactory.newRBF(deployData,RBFRouter.address)).to.be.revertedWith(
      "RBF: priceFeedAddr can not be zero address"
    );
  });

  //取消common账户的rely权限后，Factory的new方法无法调用
  it("After deny 'common'，it can not call new method in Factory", async function () {
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
      mintSlippageBps:"0",
    };
    await expect(rbfFactory.newRBF(deployData,RBFRouter.address)).to.be.revertedWith(
        "Auth/not-authorized"
      );
  });

  
});
