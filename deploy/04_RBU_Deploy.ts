
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const rbuParams = require("../config/rbu");


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts,ethers} = hre;
    const {deploy,execute} = deployments;
    const {deployer} = await getNamedAccounts();

    const deployInitParams = rbuParams[hre.network.name];
    if (!deployInitParams) return;

    const name=deployInitParams.name;
    const symbol=deployInitParams.symbol;
    const assetToken= await deployments.get("MockUSDT"); 
    const maxSupply=deployInitParams.maxSupply;
    const activeStartTime = deployInitParams.activeStartTime;
    const activeEndTime = deployInitParams.activeEndTime;
    const minDepositAmount=deployInitParams.minDepositAmount;
    const managerFee=deployInitParams.managerFee;
    const depositTreasury=deployInitParams.depositTreasury;
    const initialPrice = deployInitParams.initialPrice;
    const manager=deployInitParams.manager;
   
    console.log("name:",name);
    console.log("symbol:",symbol);
    console.log("assetToken:",assetToken.address);
    console.log("maxSupply:",maxSupply);
    console.log("activeStartTime:",activeStartTime);
    console.log("activeEndTime:",activeEndTime);
    console.log("minDepositAmount:",minDepositAmount);
    console.log("managerFee:",managerFee);
    console.log("depositTreasury:",depositTreasury);
    console.log("initialPrice:",initialPrice);
    console.log("manager:",manager);

     // 通过部署信息获取合约实例
  const rbuRouterDeployment = await deployments.get("RBURouter"); // 替换为你的合约名称
  const rbuRouter = await hre.ethers.getContractAt(
    "RBURouter", // 替换为你的合约名称
    rbuRouterDeployment.address
  );

  console.log("RBURouter deployed at:", rbuRouterDeployment.address);
  // 调用查询方法
  const rbuId = await rbuRouter.getRbuNonce(); // 替换为具体方法名
  console.log("rbuId:",rbuId);

  

  const abiCoder = new ethers.AbiCoder();
  const deployData = abiCoder.encode(
    [
      "uint256", // rbuId
      "string", // name
      "string", // symbol
      "address", // assetToken
      "uint256", // maxSupply
      "uint256", // activeStartTime
      "uint256", // activeEndTime
      "uint256", // minDepositAmount
      "uint256", // managerFee
      "address", // depositTreasury
      "uint256", // initialPrice
      "address", // deployer
      "address", // manager
    ],
    [
      rbuId,
      name,
      symbol,
      assetToken.address,
      maxSupply,
      activeStartTime,
      activeEndTime,
      minDepositAmount,
      managerFee,
      depositTreasury,
      initialPrice,
      manager,
      manager,
    ]
  );

  const deployDataHash = ethers.keccak256(deployData);
  const signer = await ethers.getSigner(deployer);
  const signature = await signer.signMessage(ethers.getBytes(deployDataHash));
  const isValid = await rbuRouter.verify(deployer, deployData, signature);
  console.log("isValid:",isValid);
  const signatures = [signature];
  await execute(
    'RBURouter', 
    { from: deployer, log: true,  gasLimit: 10000000  },
    'deployRBU',
    deployData,
    signatures
  );

  const rbuInfo = await rbuRouter.getRBUInfo(rbuId);
  console.log("rbuInfo:",rbuInfo);





  
};

export default func;
func.tags = ['04_RBU_Deploy'];