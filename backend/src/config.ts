import 'dotenv/config'

export type Network = 'mainnet' | 'sepolia'

export function rpcUrlFor(network: Network) {
  if (network === 'mainnet') return process.env.RPC_URL_MAINNET || 'https://rpc.ankr.com/eth'
  if (network === 'sepolia') return process.env.RPC_URL_SEPOLIA || 'https://rpc.ankr.com/eth_sepolia'
  return process.env.RPC_URL_MAINNET || 'https://rpc.ankr.com/eth'
}
