# AccumulatedYield 合约测试文档

## 概述

本文档描述了 AccumulatedYield 合约的完整测试流程，该测试模拟了一个基于持币量的收益分配系统，类似于 MasterChef 的设计。

## 测试文件

- `AccumulatedYield.simple.test.js` - 主要测试文件（JavaScript版本，避免TypeScript复杂性）
- `AccumulatedYield.test.ts` - TypeScript版本（可能需要修复ethers v6兼容性）

## 测试依赖的Mock合约

### MockERC20.sol
模拟ERC20代币，支持：
- 自定义精度
- 铸币功能
- 与AccumulatedYield的集成（自动调用转账钩子）

### MockVault.sol
模拟Vault合约，提供：
- validator地址存储
- 基础的访问控制功能

## 核心测试流程

### 测试场景设计

该测试模拟了您提供的完整业务流程：

#### 参与者
- **Alice**: 初始持有1000个ShareToken
- **Bob**: 初始持有2000个ShareToken  
- **Carol**: 初始持有0个ShareToken（后通过转账获得）
- **Manager**: 管理员，负责派息
- **Validator**: 签名验证者

#### 流程步骤

**步骤1-2: 初始状态**
```
ShareToken总供应量: 3000
- Alice: 1000 (33.33%)
- Bob: 2000 (66.67%)
- Carol: 0 (0%)

池子状态:
- totalDividend: 0
- totalAccumulatedShares: 0
```

**步骤3: 第一次派息1500 USDT**
```
需要validator签名验证
池子更新:
- totalDividend: 0 → 1500
- totalAccumulatedShares: 0 → 4,500,000 (3000 * 1500)
```

**步骤4: Alice转账500个代币给Carol**
```
转账触发 updateUserPoolsOnTransfer:
- Alice累积份额更新: 0 → 1,500,000 (1000 * 1500)
- Carol的lastClaimDividend更新: 0 → 1500

余额变化:
- Alice: 1000 → 500
- Carol: 0 → 500
```

**步骤5: 第二次派息1000 USDT**
```
池子更新:
- totalDividend: 1500 → 2500
- totalAccumulatedShares: 4,500,000 → 7,500,000
```

**步骤6-8: 用户领取收益**

Alice:
```
累积份额: 1,500,000 + 500 * (2500-1500) = 2,000,000
总收益: (2,000,000 * 2500) / 7,500,000 = 666.67 USDT
收益比例: 26.67%
```

Bob:
```
累积份额: 0 + 2000 * (2500-0) = 5,000,000
总收益: (5,000,000 * 2500) / 7,500,000 = 1666.67 USDT
收益比例: 66.67%
```

Carol:
```
累积份额: 0 + 500 * (2500-1500) = 500,000
总收益: (500,000 * 2500) / 7,500,000 = 166.67 USDT
收益比例: 6.67%
```

### 验证结果

**总分配验证:**
- 总派息: 1500 + 1000 = 2500 USDT
- 总领取: 666.67 + 1666.67 + 166.67 = 2500 USDT ✓

**收益分配合理性:**
- Alice: 26.67% (转账后持股比例的时间加权平均)
- Bob: 66.67% (始终持有最多代币)
- Carol: 6.67% (只参与了第二次派息)

## 核心算法验证

### 累积份额计算
```solidity
user.accumulatedShares += balanceOf(user) * deltaDiv
pool.totalAccumulatedShares += shareTotalSupply * dividendAmount
```

### 收益计算
```solidity
totalReward = (user.accumulatedShares * pool.totalDividend) / pool.totalAccumulatedShares
pendingReward = totalReward - user.totalClaimed
```

### 签名验证
```solidity
bytes32 payload = keccak256(abi.encodePacked(vault, dividendAmount))
bytes32 ethSignedMessageHash = ECDSA.toEthSignedMessageHash(payload)
address signer = ECDSA.recover(ethSignedMessageHash, signature)
require(signer == validator)
```

## 运行测试

### 环境要求
```bash
npm install @openzeppelin/contracts
npm install @nomicfoundation/hardhat-ethers
npm install ethers
npm install chai
```

### 执行测试
```bash
# 运行简化版JavaScript测试
npx hardhat test test/AccumulatedYield.simple.test.js

# 运行完整测试套件
npx hardhat test test/AccumulatedYield.simple.test.js --verbose
```

### 期望输出
测试应该输出详细的流程日志，包括：
- 每个步骤的状态变化
- 用户余额和收益的实时更新
- 最终的收益分配验证

## 测试覆盖的功能

### ✅ 核心功能
- [x] 合约初始化
- [x] 派息功能（带签名验证）
- [x] 用户池更新（转账触发）
- [x] 收益领取
- [x] 累积份额计算

### ✅ 安全功能
- [x] 签名验证（防止未授权派息）
- [x] 权限控制（onlyManager）
- [x] 重入攻击保护
- [x] 参数验证

### ✅ 边界条件
- [x] 零余额用户处理
- [x] 精度计算验证
- [x] 多次派息累积
- [x] 转账后收益分配

## 注意事项

1. **精度处理**: 测试允许微小的精度误差（±5 wei）
2. **时间依赖**: 测试不依赖具体的区块时间
3. **Gas优化**: Mock合约简化了复杂逻辑以专注于核心算法
4. **兼容性**: JavaScript版本避免了ethers v6的TypeScript类型问题

## 扩展测试建议

未来可以添加的测试场景：
- 大量用户的性能测试
- 极端数值的边界测试
- 恶意攻击场景测试
- Gas消耗优化验证 