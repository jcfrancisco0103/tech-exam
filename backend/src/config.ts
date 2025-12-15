import 'dotenv/config'

export type Network = 'mainnet' | 'sepolia'

export function rpcUrlFor(network: Network) {
  if (network === 'mainnet') return process.env.RPC_URL_MAINNET || 'https://rpc.ankr.com/eth'
  if (network === 'sepolia') return process.env.RPC_URL_SEPOLIA || 'https://rpc.ankr.com/eth_sepolia'
  return process.env.RPC_URL_MAINNET || 'https://rpc.ankr.com/eth'
}

export function rpcUrlsFor(network: Network) {
  const raw = network === 'mainnet' ? (process.env.RPC_URL_MAINNET || '') : (process.env.RPC_URL_SEPOLIA || '')
  const fallback = network === 'mainnet' ? 'https://rpc.ankr.com/eth' : 'https://rpc.ankr.com/eth_sepolia'
  const list = (raw || fallback).split(',').map(s => s.trim()).filter(Boolean)
  return list.length ? list : [fallback]
}
