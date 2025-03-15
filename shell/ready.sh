#! /bin/bash

# 获取当前脚本的目录
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"

# 获取项目根目录（假设脚本在 scripts/ 目录下）
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

kill -9 $(lsof -t -i:8545)

# 清除缓存
rm -rf "${PROJECT_ROOT}/cache"
rm -rf "${PROJECT_ROOT}/deployments"

# 准备链环境
cd "${PROJECT_ROOT}"
npx hardhat node > "${PROJECT_ROOT}/hardhat.log" 2>&1 &

# 等待链环境启动
sleep 30

