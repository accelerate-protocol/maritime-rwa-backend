const { ethers } = require("hardhat");

describe("MockUSDT Balance 查询", function () {
  it("查询指定地址的 MockUSDT 余额", async function () {
    // 替换为你的 MockUSDT 合约地址
    const contractAddress = "0xc3b12FD7Eb8Ad08b0D088fc9d1c686387e6F2104";
    // 替换为你要查询余额的账户地址
    const account = "0xeE9B06dDbB91863006F6cC363f71376055A9714F";

    // 获取合约实例
    const MockUSDT = await ethers.getContractAt("contracts/v2/mocks/MockUSDT.sol:MockUSDT", contractAddress);

    // 查询余额
    const balance = await MockUSDT.balanceOf(account);

    // 打印余额（USDT 通常是6位小数）
    console.log(`账户 ${account} 的 MockUSDT 余额为:`, ethers.formatUnits(balance, 6), "USDT");
  });
});