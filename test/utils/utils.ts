import { ethers } from "hardhat";

// USDT 精度常量
export const USDT_DECIMALS = 6;
export const SHARE_TOKEN_DECIMALS = 6;

// USDT 解析方法
export const parseUSDT = (amount: string | number) => 
  ethers.parseUnits(amount.toString(), USDT_DECIMALS);

// USDT 格式化方法
export const formatUSDT = (amount: bigint) => 
  ethers.formatUnits(amount, USDT_DECIMALS);

// USDT 精度验证
export const isValidUSDTAmount = (amount: string | number) => {
  try {
    parseUSDT(amount);
    return true;
  } catch {
    return false;
  }
};

// USDT 金额比较
export const compareUSDT = (a: bigint, b: bigint) => {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

// 准备链下存款签名
export async function prepareOffChainDepositSignature(amount: any, receiver: any, crowdsaleAddress: any, validator: any) {
    // Off-chain deposit signature: keccak256(abi.encodePacked("offChainDeposit", amount, receiver, chainId, contractAddress))
    const payload = ethers.keccak256(ethers.solidityPacked(
        ["string", "uint256", "address", "uint256", "address"],
        ["offChainDeposit", amount, receiver, await ethers.provider.getNetwork().then(net => net.chainId), crowdsaleAddress]
    ));
    return await validator.signMessage(ethers.getBytes(payload));
}

// 创建所有模块的通用函数
export async function createModules(
    manager: any,
    validator: any,
    dividendTreasury: any,
    rewardToken: any
) {
    // Deploy CoreVault
    const CoreVaultFactory = await ethers.getContractFactory("CoreVault");
    const newVault = await CoreVaultFactory.deploy();
    
    // Initialize vault
    const vaultInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "bool", "address[]"],
        [manager.address, validator.address, false, []]
    );
    await newVault.initiate(vaultInitData);

    // Deploy ShareToken
    const ShareTokenFactory = await ethers.getContractFactory("ShareToken");
    const newShareToken = await ShareTokenFactory.deploy();
    const tokenInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "string", "uint8"],
        ["Test Share Token", "TST", SHARE_TOKEN_DECIMALS]
    );
    await newShareToken.initiate(await newVault.getAddress(), tokenInitData);

    // Deploy AccumulatedYield
    const YieldFactory = await ethers.getContractFactory("AccumulatedYield");
    const newAccumulatedYield = await YieldFactory.deploy();
    
    const yieldInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "address"],
        [await rewardToken.getAddress(), manager.address, dividendTreasury.address]
    );
    await newAccumulatedYield.initiate(await newVault.getAddress(), await newShareToken.getAddress(), yieldInitData);
    
    // Deploy Crowdsale contract
    const CrowdsaleFactory = await ethers.getContractFactory("Crowdsale");
    const newCrowdsale = await CrowdsaleFactory.deploy();
    
    // Initialize Crowdsale with test parameters
    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = currentTime;
    const endTime = currentTime + 86400; // 24 hours from now
    const maxSupply = ethers.parseUnits("10000", SHARE_TOKEN_DECIMALS);
    const softCap = ethers.parseUnits("1000", SHARE_TOKEN_DECIMALS);
    const sharePrice = ethers.parseUnits("1", SHARE_TOKEN_DECIMALS); // 1 USDT per share, 6 decimals
    const minDepositAmount = ethers.parseUnits("10", 6); // 10 USDT minimum
    const manageFeeBps = 1000; // 10% management fee
    
    const crowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address"],
        [startTime, endTime, await rewardToken.getAddress(), maxSupply, softCap, sharePrice, minDepositAmount, manageFeeBps, manager.address, manager.address, manager.address]
    );
    
    await newCrowdsale.initiate(await newVault.getAddress(), newShareToken, crowdsaleInitData);
    
    // Set templates in vault (using manager as owner)
    await newVault.connect(manager).configureModules(
        await newShareToken.getAddress(),
        await newCrowdsale.getAddress(),
        await newAccumulatedYield.getAddress()
    );
    // Unpause token for testing (since it's paused during initialization)
    await newVault.connect(manager).unpauseToken();
    
    return {
        vault: newVault,
        shareToken: newShareToken,
        accumulatedYield: newAccumulatedYield,
        crowdsale: newCrowdsale
    };
}