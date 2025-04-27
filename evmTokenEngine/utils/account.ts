const hre = require("hardhat");

export async function getAccount() {
    // 创建随机钱包
    const randomWallet = hre.ethers.Wallet.createRandom();
    console.log("随机钱包地址:", randomWallet.address);
    console.log("随机钱包私钥:", randomWallet.privateKey);

    // 获取测试网络的provider
    const provider = hre.ethers.provider;
    
    // 将钱包连接到provider并获取signer
    const signer = await provider.getSigner(randomWallet.address);
    
    // 获取一个有资金的账户用于转账
    const [fundedSigner] = await hre.ethers.getSigners();
    
    // 检查新钱包初始余额
    const initialBalance = await provider.getBalance(randomWallet.address);
    console.log("初始余额:", hre.ethers.formatEther(initialBalance), "ETH");

    // 转账100 ETH到新钱包
    const tx = await fundedSigner.sendTransaction({
      to: randomWallet.address,
      value: hre.ethers.parseEther("100")
    });
    await tx.wait();

    // 检查转账后的余额
    const newBalance = await provider.getBalance(randomWallet.address);
    console.log("转账后余额:", hre.ethers.formatEther(newBalance), "ETH");

    // 返回钱包地址和私钥
    return {
        address: randomWallet.address,
        privateKey: randomWallet.privateKey
    };
}