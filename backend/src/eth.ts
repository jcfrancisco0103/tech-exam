import { ethers } from 'ethers'
import { rpcUrlsFor, type Network } from './config'

function providerFromUrl(url: string) {
  return new ethers.JsonRpcProvider(url)
}

async function tryWithRpc<T>(network: Network, fn: (provider: ethers.JsonRpcProvider) => Promise<T>) {
  const urls = rpcUrlsFor(network)
  let lastErr: unknown
  for (const url of urls) {
    try {
      const provider = providerFromUrl(url)
      return await fn(provider)
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr
}

export async function getNetworkInfo(network: Network) {
  return tryWithRpc(network, async (provider) => {
    const [feeData, blockNumber] = await Promise.all([
      provider.getFeeData(),
      provider.getBlockNumber(),
    ])
    const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? 0n
    return { gasPriceWei: gasPrice.toString(), blockNumber }
  })
}

export async function getBalanceEth(network: Network, address: string) {
  return tryWithRpc(network, async (provider) => {
    const bal = await provider.getBalance(address)
    return ethers.formatEther(bal)
  })
}
