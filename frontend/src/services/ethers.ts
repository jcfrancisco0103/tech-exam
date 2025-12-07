import { ethers } from 'ethers'

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>
}

export async function getBrowserProvider() {
  const eth = (window as Window & { ethereum?: Eip1193 }).ethereum
  if (!eth) throw new Error('MetaMask not detected')
  return new ethers.BrowserProvider(eth)
}

export async function connectWallet() {
  const provider = await getBrowserProvider()
  await provider.send('eth_requestAccounts', [])
  const signer = await provider.getSigner()
  const address = await signer.getAddress()
  const network = await provider.getNetwork()
  return { provider, signer, address, chainId: Number(network.chainId) }
}

export async function getBalanceEth(provider: ethers.BrowserProvider, address: string) {
  const bal = await provider.getBalance(address)
  return ethers.formatEther(bal)
}
