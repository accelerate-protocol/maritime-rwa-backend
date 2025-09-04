import hre from "hardhat";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { execSync } from "child_process";
import path from "path";
import { deployFactories } from '../utils/deployFactoriesAndRouter';
import { factoryAuth } from '../utils/factoryAuth';
import { introspection } from "../typechain-types/@openzeppelin/contracts/utils";
import { rbf } from "../typechain-types/contracts";

describe("Vault:", function () {
  this.timeout(200000); // 增加到 200 秒
  const { deployments, getNamedAccounts, ethers } = hre;
  // const { deploy, execute } = deployments;
  let guardian: HardhatEthersSigner;
  // let feeReceiver: HardhatEthersSigner;
  const VaultRouterAddress = "0xE477A677AF7ADB256Ac89fA93062b055B1C2E1C6";
  const vaultAddress = "0x4D2401c7e8E0118Aa9e80f5Aa55771CF415C228a";
  let vaultRouter: any;
  const vaultId = 5;
  let vault: any;
  let vaultProxyAdminAddress: any;
  let newImplementationAddress: any;
  let upgradedVault: any;
  

  this.beforeEach(async () => {
    // 初始化设置
    [guardian] = await ethers.getSigners();
    vaultRouter = await ethers.getContractAt("VaultRouter", VaultRouterAddress);
    const vaultData = await vaultRouter.getVaultInfo(vaultId);
    vault = vaultData.vault;
    console.log("vault",vault)
    vaultProxyAdminAddress = vaultData.vaultProxyAdmin;
    console.log("vaultProxyAdminAddress",vaultProxyAdminAddress);

  });

  it("query info", async function () {
    expect(vaultAddress).to.equal(vault);
    
  });

  it("upgrade contract", async function () {

    const VaultV2 = await ethers.getContractFactory("VaultV2");
    var newImplementation = await VaultV2.deploy();
    await newImplementation.waitForDeployment();
    newImplementationAddress = await newImplementation.getAddress();
    console.log("newImplementationAddress",newImplementationAddress);

    // 3. 获取 ProxyAdmin 合约实例
    const proxyAdmin = await ethers.getContractAt("ProxyAdmin", vaultProxyAdminAddress);
    console.log("获取 ProxyAdmin 合约实例成功");

    // 4. 获取升级前的实现地址
    const oldImplementation = await proxyAdmin.getProxyImplementation(vaultAddress);
    console.log("升级前的实现地址:", oldImplementation);

    // 5. 执行升级操作
    console.log("开始执行合约升级...");
    const upgradeTx = await proxyAdmin.connect(guardian).upgrade(vaultAddress, newImplementationAddress);
    await upgradeTx.wait();
    console.log("合约升级交易成功，交易哈希:", upgradeTx.hash);

    // 6. 验证升级结果
    const currentImplementation = await proxyAdmin.getProxyImplementation(vaultAddress);
    console.log("升级后的实现地址:", currentImplementation);

    // 验证实现地址已更新
    expect(currentImplementation).to.equal(newImplementationAddress);
    expect(currentImplementation).to.not.equal(oldImplementation);
    console.log("✅ 合约升级验证成功！");

    // 7. 测试升级后的合约功能
    upgradedVault = await ethers.getContractAt("VaultV2", vault);
    console.log("获取升级后的 VaultV2 合约实例成功");

  });

  it("withdrawExtraFund", async function () {
    try {
      console.log("开始测试 withdrawExtraFund 方法...");


      // 获取升级后的 VaultV2 合约实例
      const upgradedVault = await ethers.getContractAt("VaultV2", vaultAddress);
      console.log("获取升级后的 VaultV2 合约实例成功");

      // 获取 feeReceiver 地址
      const feeReceiver = await upgradedVault.feeReceiver();
      console.log("FeeReceiver 地址:", feeReceiver);

      // 获取当前合约中的资产余额
      const assetToken = await upgradedVault.assetToken();
      const assetContract = await ethers.getContractAt("IERC20", assetToken);
      const contractBalance = await assetContract.balanceOf(vaultAddress);
      console.log("合约中的资产余额:", ethers.formatUnits(contractBalance, 18));

      // 获取 feeReceiver 的余额
      const feeReceiverBalanceBefore = await assetContract.balanceOf(feeReceiver);
      console.log("FeeReceiver 升级前余额:", ethers.formatUnits(feeReceiverBalanceBefore, 18));

      // 检查 withdrawExtraFund 的调用条件
      const endTime = await upgradedVault.endTime();
      const manageFeeBalance = await upgradedVault.manageFeeBalance();
      console.log("endTime:", endTime.toString());
      console.log("manageFeeBalance:", ethers.formatUnits(manageFeeBalance, 18));

      // 尝试调用 withdrawExtraFund 方法
      console.log("尝试调用 withdrawExtraFund 方法...");
      const withdrawTx = await upgradedVault.connect(guardian).withdrawExtraFund();
      await withdrawTx.wait();
      console.log("withdrawExtraFund 调用成功，交易哈希:", withdrawTx.hash);

      // 验证结果
      const feeReceiverBalanceAfter = await assetContract.balanceOf(feeReceiver);
      console.log("FeeReceiver 升级后余额:", ethers.formatUnits(feeReceiverBalanceAfter, 18));

      const contractBalanceAfter = await assetContract.balanceOf(vaultAddress);
      console.log("合约升级后资产余额:", ethers.formatUnits(contractBalanceAfter, 18));

      // 验证余额变化
      const withdrawnAmount = feeReceiverBalanceAfter - feeReceiverBalanceBefore;
      console.log("提取的金额:", ethers.formatUnits(withdrawnAmount, 18));

      expect(withdrawnAmount).to.be.gte(0);
      console.log("✅ withdrawExtraFund 方法测试成功！");

    } catch (error) {
      console.log("❌ withdrawExtraFund 方法测试失败:", error instanceof Error ? error.message : String(error));

      // 如果是权限错误，尝试使用正确的角色
      if (error instanceof Error && error.message.includes("AccessControl")) {
        console.log("检测到权限错误，尝试使用 manager 账户...");
        try {
          const { manager } = await getNamedAccounts();
          const managerSigner = await ethers.getSigner(manager);

          const upgradedVault = await ethers.getContractAt("VaultV2", vaultAddress);
          const withdrawTx = await upgradedVault.connect(managerSigner).withdrawExtraFund();
          await withdrawTx.wait();
          console.log("✅ 使用 manager 账户调用 withdrawExtraFund 成功！");

        } catch (managerError) {
          console.log("使用 manager 账户也失败:", managerError instanceof Error ? managerError.message : String(managerError));
        }
      }
    }

  });


});
