import { ethers } from 'ethers'
import { rpcUrlFor, type Network } from './config'

export function providerFor(network: Network) {
  return new ethers.JsonRpcProvider(rpcUrlFor(network))
}

export async function getNetworkInfo(network: Network) {
  const provider = providerFor(network)
  const [feeData, blockNumber] = await Promise.all([
    provider.getFeeData(),
    provider.getBlockNumber(),
  ])
  const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? 0n
  return { gasPriceWei: gasPrice.toString(), blockNumber }
}

export async function getBalanceEth(network: Network, address: string) {
  const provider = providerFor(network)
  const bal = await provider.getBalance(address)
  return ethers.formatEther(bal)
}
