#! /bin/bash

# 获取当前脚本的目录
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"

# 获取项目根目录（假设脚本在 scripts/ 目录下）
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# 准备链环境
cd "${PROJECT_ROOT}"
logdir="${PROJECT_ROOT}/logs"
mkdir -p "${logdir}"

# 获取当前时间戳
timestamp=$(date "+%Y%m%d_%H%M%S")

# 执行测试并将结果写入日志文件
npx hardhat test test/Auth.test.ts --network localhost > "${logdir}/Auth.test_${timestamp}.log"
npx hardhat test test/Business.test.ts --network localhost > "${logdir}/Business.test_${timestamp}.log"
npx hardhat test test/Factory.test.ts --network localhost > "${logdir}/Factory.test_${timestamp}.log"
npx hardhat test test/RBF.test.ts --network localhost > "${logdir}/RBF.test_${timestamp}.log"
npx hardhat test test/Vault.test.ts --network localhost > "${logdir}/Vault.test_${timestamp}.log"

# 从OnlyRun.test.ts中提取测试用例名称
tests=($(grep -o 'it("tc-[0-9]\+"' "${PROJECT_ROOT}/test/OnlyRun.test.ts" | awk -F'"' '{print $2}'))

# 遍历测试用例数组并逐个执行
for test in "${tests[@]}"; do
    echo "Running test case: $test"
    npx hardhat test test/OnlyRun.test.ts --network localhost --grep "$test" > "${logdir}/OnlyRun.test_${test}_${timestamp}.log"
    # 每个测试用例执行后等待5秒，确保环境稳定
    sleep 5
done

