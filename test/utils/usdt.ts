import { ethers } from "hardhat";

// USDT 精度常量
export const USDT_DECIMALS = 6;

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
