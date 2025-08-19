/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  // 关键配置：修改 transformIgnorePatterns 以处理 node_modules 中的 ES 模块
  transformIgnorePatterns: [
    // 默认情况下，node_modules 中的文件不会被转换
    // 但我们需要转换 @nomicfoundation/ethereumjs-tx 包中的文件
    '/node_modules/(?!(@nomicfoundation/ethereumjs-tx)/)'
  ],
};