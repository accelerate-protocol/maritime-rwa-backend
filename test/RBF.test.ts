import hre from "hardhat";
import { expect } from "chai";
import { deployFactories } from '../utils/deployFactories';
import { factoryAuth } from '../utils/factoryAuth';
import path from "path";
import { execSync } from "child_process";

describe("RBF:", function () {
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

  //使用不在签名白名单中的账户签名，部署RBF失败报错
  it("tc-11:deploy rbf with error sign :", async function () {
    const {deployer,guardian,manager,depositTreasury,rbfSigner2} = await getNamedAccounts();
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
    const signer = await ethers.getSigner(deployer);
    const signature = await signer.signMessage(ethers.getBytes(deployDataHash));
    const signer2 = await ethers.getSigner(rbfSigner2);
    const signature2 = await signer2.signMessage(ethers.getBytes(deployDataHash));
    const signatures = [signature,signature2];
    await expect(
      rbfRouter.deployRBF(deployData, signatures)
    ).to.be.revertedWith("RBFRouter:Invalid Signer");
  });

  //部署RBF时，消息发送者与deploydata中的deployer不一致，部署失败报错
  it.skip("tc-12:rbf error deployer deploy:", async function () {
    const {investor1,guardian,manager,rbfSigner,depositTreasury,rbfSigner2} = await getNamedAccounts();
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF", "RBF",
        usdt.address,
        depositTreasury,
        investor1,
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
    // await rbfRouter.deployRBF(deployData, signatures)
    await expect(
      rbfRouter.deployRBF(deployData, signatures)
    ).to.be.revertedWith("RBFRouter:Invalid deployer");
  });

  //使用错误的rbfId（唯一性），部署RBF失败报错
  it("tc-13:rbf error rbfId deploy:", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,rbfSigner2} = await getNamedAccounts();
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
    await rbfRouter.deployRBF(deployData, signatures)
    await expect(
      rbfRouter.deployRBF(deployData, signatures)
    ).to.be.revertedWith("RBFRouter:Invalid rbfId");
  });
  //assetToken为零地址，部署报错
  it("tc-14:assetToken address is zero address", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,rbfSigner2} = await getNamedAccounts();
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF", "RBF",
        ethers.ZeroAddress,
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
    await expect(
      rbfRouter.deployRBF(deployData, signatures)
    ).to.be.revertedWith("RBF: assetToken address cannot be zero address");
  });

  //depositTreasury为零地址，部署失败
  it("tc-15:depositTreasury address is zero address", async function () {
    const {deployer,guardian,manager,rbfSigner,rbfSigner2} = await getNamedAccounts();
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF", "RBF",
        usdt.address,
        ethers.ZeroAddress,
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
    ).to.be.revertedWith("RBF: depositTreasury address cannot be zero address");
  });

  //dividendTreasury为零地址，部署失败
  it.skip("tc-16:dividendTreasury address is zero address", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,rbfSigner2} = await getNamedAccounts();
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
    await expect(
      rbfRouter.deployRBF(deployData, signatures)
    ).to.be.revertedWith("RBF: dividendTreasury address cannot be zero address");
  });

  //priceFeed为零地址，部署失败
  it.skip("tc-17:priceFeed address is zero address", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,rbfSigner2} = await getNamedAccounts();
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
    await expect(
      rbfRouter.deployRBF(deployData, signatures)
    ).to.be.revertedWith("RBF: priceFeedAddr can not be zero address");
  });

  //manager为零地址，部署失败
  it("tc-18:manager address is zero address", async function () {
    const {deployer,guardian,rbfSigner,depositTreasury,rbfSigner2} = await getNamedAccounts();
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
        ethers.ZeroAddress,
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
    ).to.be.revertedWith("RBF: manager address can not be zero address");
  });

  //签名数量小于threshold，部署失败
  it("tc-19:sign number less than threshold", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury} = await getNamedAccounts();
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
        ethers.ZeroAddress,
        guardian,]
      ]
    );
    
    const deployDataHash = ethers.keccak256(deployData);
    const signer = await ethers.getSigner(rbfSigner);
    const signature = await signer.signMessage(ethers.getBytes(deployDataHash));
    const signatures = [signature];
    await expect(
      rbfRouter.deployRBF(deployData, signatures)
    ).to.be.revertedWith("RBFRouter:Invalid Threshold");
  }); 

  //参数提供不完整，部署失败
  it.skip("tc-20:parameter is not complete", async function () {
    const {deployer,guardian,manager,rbfSigner,depositTreasury,rbfSigner2} = await getNamedAccounts();
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
        ethers.ZeroAddress,
        guardian,]
      ]
    );
    let err :any;
    try {
      // const deployData = await rbfRouter.getEncodeData(rbfDeployData);
      const deployDataHash = ethers.keccak256(deployData);
      const signer = await ethers.getSigner(rbfSigner);
      const signature = await signer.signMessage(ethers.getBytes(deployDataHash));
      const signer2 = await ethers.getSigner(rbfSigner2);
      const signature2 = await signer2.signMessage(ethers.getBytes(deployDataHash));
      const signatures = [signature,signature2];
      await rbfRouter.deployRBF(deployData, signatures)
    } catch (error) {
      err = error;
    }finally{
      expect(err.message).to.include("types/value length mismatch");
    }
  });

  //设置白名单和阈值
  it("tc-74:setWhiteListsAndThreshold", async function () {
    console.log("tc-74:setWhiteListsAndThreshold")
    const {deployer,guardian,manager,rbfSigner,depositTreasury,rbfSigner2} = await getNamedAccounts();
    await expect(rbfRouter.setWhiteListsAndThreshold([rbfSigner],1)).not.to.be.reverted;
    console.log("threshold-1",await rbfRouter.threshold())
    expect(await rbfRouter.threshold()).to.equal(1);
    console.log("rbfSigner",await rbfRouter.whiteListed(rbfSigner))
    expect(await rbfRouter.whiteListed(rbfSigner)).to.equal(true);
    console.log("rbfSigner2",await rbfRouter.whiteListed(rbfSigner2))
    expect(await rbfRouter.whiteListed(rbfSigner2)).to.equal(false);
    
    const rbfId = await rbfRouter.rbfNonce();
    const abiCoder = new ethers.AbiCoder();
    const deployData = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [rbfId,
        "RBF-74-1", "RBF-74-1",
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
    const signatures = [signature];
    await expect(
      rbfRouter.deployRBF(deployData, signatures)
    ).not.to.be.reverted;

    await expect(rbfRouter.setWhiteListsAndThreshold([rbfSigner,rbfSigner2],2)).not.to.be.reverted;
    console.log("threshold-2",await rbfRouter.threshold())
    expect(await rbfRouter.threshold()).to.equal(2);
    //console.log(await rbfRouter.whiteLists())
    console.log("rbfSigner",await rbfRouter.whiteListed(rbfSigner))
    expect(await rbfRouter.whiteListed(rbfSigner)).to.equal(true);
    console.log("rbfSigner2",await rbfRouter.whiteListed(rbfSigner2))
    expect(await rbfRouter.whiteListed(rbfSigner2)).to.equal(true);
    const rbfId_1 = await rbfRouter.rbfNonce();
    // const abiCoder = new ethers.AbiCoder();
    const deployData1 = abiCoder.encode(
      ["(uint64,string,string,address,address,address,address,address)"],
      [
        [rbfId_1,
        "RBF-74-2", "RBF-74-2",
        usdt.address,
        depositTreasury,
        deployer,
        manager,
        guardian,]
      ]
    );
    const deployDataHash1 = ethers.keccak256(deployData1);
    const signer1 = await ethers.getSigner(rbfSigner);
    const signature1 = await signer1.signMessage(ethers.getBytes(deployDataHash1));
    const signer2 = await ethers.getSigner(rbfSigner2);
    const signature2 = await signer2.signMessage(ethers.getBytes(deployDataHash1));
    const signatures2 = [signature1,signature2];
    await expect(
      rbfRouter.deployRBF(deployData1, signatures2)
    ).not.to.be.reverted;
  });

  //设置白名单和阈值
  it("tc-75:setWhiteListsAndThreshold - whitlist is null", async function () {
    console.log("tc-75")
    const {rbfSigner,rbfSigner2} = await getNamedAccounts();
    console.log("B-threshold",await rbfRouter.threshold())
    expect(await rbfRouter.threshold()).to.equal(2);
    console.log("B-rbfSigner",await rbfRouter.whiteListed(rbfSigner))
    expect(await rbfRouter.whiteListed(rbfSigner)).to.equal(true);
    console.log("B-rbfSigner2",await rbfRouter.whiteListed(rbfSigner2))
    expect(await rbfRouter.whiteListed(rbfSigner2)).to.equal(true);
    await expect(rbfRouter.setWhiteListsAndThreshold([],1)).to.be.revertedWith("whiteLists must not be empty");

    console.log("A-threshold",await rbfRouter.threshold())
    expect(await rbfRouter.threshold()).to.equal(2);
    console.log("A-rbfSigner",await rbfRouter.whiteListed(rbfSigner))
    expect(await rbfRouter.whiteListed(rbfSigner)).to.equal(true);
    console.log("A-rbfSigner2",await rbfRouter.whiteListed(rbfSigner2))
    expect(await rbfRouter.whiteListed(rbfSigner2)).to.equal(true);
  });

  //设置白名单和阈值
  it("tc-76:setWhiteListsAndThreshold - threshhold is 0", async function () {
    console.log("tc-76")
    const {rbfSigner,rbfSigner2} = await getNamedAccounts();
    console.log("B-threshold",await rbfRouter.threshold())
    expect(await rbfRouter.threshold()).to.equal(2);
    console.log("B-rbfSigner",await rbfRouter.whiteListed(rbfSigner))
    expect(await rbfRouter.whiteListed(rbfSigner)).to.equal(true);
    console.log("B-rbfSigner2",await rbfRouter.whiteListed(rbfSigner2))
    expect(await rbfRouter.whiteListed(rbfSigner2)).to.equal(true);

    await expect(rbfRouter.setWhiteListsAndThreshold([rbfSigner2],0)).to.be.revertedWith("threshold must not be zero");
    console.log("A-threshold-2",await rbfRouter.threshold())
    expect(await rbfRouter.threshold()).to.equal(2);
    console.log("A-rbfSigner",await rbfRouter.whiteListed(rbfSigner))
    expect(await rbfRouter.whiteListed(rbfSigner)).to.equal(true);
    console.log("A-rbfSigner2",await rbfRouter.whiteListed(rbfSigner2))
    expect(await rbfRouter.whiteListed(rbfSigner2)).to.equal(true);
  });

  it("tc-83:RBFRouter ", async function () {
    const {deployer,rbfSigner,rbfSigner2} = await getNamedAccounts();
    //白名单为空
    const whiteLists: string[] = [];
    let err:any;

    try
    {
      await deploy('RBFRouter', {from: deployer,args: [whiteLists, 2, RBFFactory.address, EscrowFactory.address, PriceFeedFactory.address],})
    }catch(e)
    {
      console.log(e)
      err = e;
    }finally
    {
      expect(err.message).to.be.include("whiteLists must not be empty");
      //阈值为0
      const whiteLists_1 = [rbfSigner,rbfSigner2];
      try
      {
        await deploy('RBFRouter', {from: deployer,args: [whiteLists_1, 0, RBFFactory.address, EscrowFactory.address, PriceFeedFactory.address],})
      }catch(e)
      {
        console.log(e)
        err = e;
      }finally
      {
        expect(err.message).to.be.include("threshold must >0");
        const whiteLists_1 = [rbfSigner,rbfSigner2];
        try
        {
          //RBFFactory地址为零地址
          await deploy('RBFRouter', {from: deployer,args: [whiteLists_1, 2, ethers.ZeroAddress, EscrowFactory.address, PriceFeedFactory.address],})
        }catch(e)
        {
          console.log(e)
          err = e;
        }finally
        {
          expect(err.message).to.be.include("rbfFactory must not be zero");
          const whiteLists_1 = [rbfSigner,rbfSigner2];
          try
          {
            //EscrowFactory地址为零地址
            await deploy('RBFRouter', {from: deployer,args: [whiteLists_1, 2, RBFFactory.address, ethers.ZeroAddress, PriceFeedFactory.address],})
          }catch(e)
          {
            console.log(e)
            err = e;
          }finally{
            expect(err.message).to.be.include("escrowFactory must not be zero");
            const whiteLists_1 = [rbfSigner,rbfSigner2];
            try
            {
              //PriceFeedFactory地址为零地址
              await deploy('RBFRouter', {from: deployer,args: [whiteLists_1, 2, RBFFactory.address, EscrowFactory.address, ethers.ZeroAddress],})
            }catch(e)
            {
              console.log(e)
              err = e;
            }finally{
              expect(err.message).to.be.include("priceFeedFactory must not be zero");
            }
          }
        }

      }
    }
    

  });
})
