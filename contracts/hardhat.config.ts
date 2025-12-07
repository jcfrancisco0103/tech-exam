import '@nomicfoundation/hardhat-toolbox'
import 'dotenv/config'

const SEPOLIA_URL = process.env.SEPOLIA_RPC_URL || 'https://rpc.ankr.com/eth_sepolia'
const SEPOLIA_KEY = process.env.SEPOLIA_PRIVATE_KEY || '0x' + '0'.repeat(64)

export default {
  solidity: {
    version: '0.8.24',
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    sepolia: {
      url: SEPOLIA_URL,
      accounts: SEPOLIA_KEY.startsWith('0x0') ? [] : [SEPOLIA_KEY],
    },
  },
}
