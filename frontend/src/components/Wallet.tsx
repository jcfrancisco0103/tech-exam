import { useMemo, useState } from 'react'
import { ethers } from 'ethers'
import { connectWallet, getBalanceEth } from '../services/ethers'
import { fetchLastTransactions, txExplorerUrl } from '../utils/etherscan'
import { Tx } from '../types'
import { myTokenAbi } from '../contracts/myTokenAbi'

type State =
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'connected'; address: string; chainId: number; balanceEth: string; txs: Tx[]; provider: ethers.BrowserProvider; tokens: number[]; tokenMeta?: Record<number, { name: string; image: string }>; blockNumber?: number; gasPriceWei?: string }
  | { status: 'error'; message: string }

export default function Wallet() {
  const [state, setState] = useState<State>({ status: 'idle' })
  const apiKey = useMemo(() => import.meta.env.VITE_ETHERSCAN_API_KEY, [])

  async function onConnect() {
    try {
      setState({ status: 'connecting' })
      const { provider, address, chainId } = await connectWallet()
      const desired = Number(import.meta.env.VITE_CONTRACT_CHAIN_ID || 0)
      const desiredHex = `0x${desired.toString(16)}`
      if (desired && chainId !== desired) {
        try {
          await provider.send('wallet_switchEthereumChain', [{ chainId: desiredHex }])
        } catch {
          try {
            if (desired === 31337) {
              await provider.send('wallet_addEthereumChain', [{
                chainId: desiredHex,
                chainName: 'Localhost 8545',
                rpcUrls: ['http://127.0.0.1:8545'],
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              }])
              await provider.send('wallet_switchEthereumChain', [{ chainId: desiredHex }])
            }
          } catch {}
        }
      }
      const net = await provider.getNetwork()
      const finalChainId = Number(net.chainId)
      const balanceEth = await getBalanceEth(provider, address)
      let txs: Tx[] = []
      try {
        txs = await fetchLastTransactions(address, chainId, apiKey)
      } catch (e) {
        txs = []
      }
      setState({ status: 'connected', address, chainId: finalChainId, balanceEth, txs, provider, tokens: [], tokenMeta: {} })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Connection failed'
      setState({ status: 'error', message })
    }
  }

  async function onMint() {
    if (state.status !== 'connected') return
    const contractAddr = import.meta.env.VITE_CONTRACT_ADDRESS
    const cfgChainId = Number(import.meta.env.VITE_CONTRACT_CHAIN_ID || 0)
    if (!contractAddr || !cfgChainId || cfgChainId !== state.chainId) return
    const signer = await state.provider.getSigner()
    const contract = new ethers.Contract(contractAddr, myTokenAbi, signer)
    const tx = await contract.safeMint(state.address)
    const receipt = await tx.wait()
    let mintedId = ''
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log)
        if (parsed?.name === 'Transfer' && parsed.args.from === ethers.ZeroAddress && parsed.args.to === state.address) {
          mintedId = parsed.args.tokenId.toString()
          break
        }
      } catch {}
    }
    if (mintedId) {
      alert(`Minted token #${mintedId}`)
      const idNum = Number(mintedId)
      setState({ ...state, tokens: [...state.tokens, idNum] })
      await loadTokens()
    }
  }

  async function loadTokens() {
    if (state.status !== 'connected') return
    const contractAddr = import.meta.env.VITE_CONTRACT_ADDRESS
    const cfgChainId = Number(import.meta.env.VITE_CONTRACT_CHAIN_ID || 0)
    if (!contractAddr || !cfgChainId || cfgChainId !== state.chainId) return
    const network = state.chainId === 1 ? 'mainnet' : state.chainId === 11155111 ? 'sepolia' : ''
    if (!network) {
      const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545')
      const contract = new ethers.Contract(contractAddr, myTokenAbi, provider)
      const code = await provider.getCode(contractAddr)
      if (code === '0x') {
        alert('Contract not found at configured address on local RPC. Redeploy or update VITE_CONTRACT_ADDRESS.')
        return
      }
      const bal: bigint = await contract.balanceOf(state.address)
      const count = Number(bal)
      const ids: number[] = []
      for (let i = 0; i < count; i++) {
        const id: bigint = await contract.tokenOfOwnerByIndex(state.address, i)
        ids.push(Number(id))
      }
      setState({ ...state, tokens: ids })
      await loadTokenMetadata(ids)
      return
    }
    const url = `http://localhost:3001/api/tokens/${state.address}?network=${network}&contract=${contractAddr}`
    const res = await fetch(url)
    if (!res.ok) return
    const json = await res.json()
    const ids = Array.isArray(json.tokens) ? (json.tokens as number[]) : []
    setState({ ...state, tokens: ids })
    await loadTokenMetadata(ids)
  }

  async function loadTokenMetadata(ids: number[]) {
    if (state.status !== 'connected') return
    const contractAddr = import.meta.env.VITE_CONTRACT_ADDRESS
    const cfgChainId = Number(import.meta.env.VITE_CONTRACT_CHAIN_ID || 0)
    if (!contractAddr || !cfgChainId || cfgChainId !== state.chainId) return
    const isLocal = state.chainId !== 1 && state.chainId !== 11155111
    const provider = isLocal ? new ethers.JsonRpcProvider('http://127.0.0.1:8545') : state.provider
    const contract = new ethers.Contract(contractAddr, myTokenAbi, provider)
    const meta: Record<number, { name: string; image: string }> = {}
    for (const id of ids) {
      try {
        const uri: string = await contract.tokenURI(id)
        const res = await fetch(uri)
        if (!res.ok) continue
        const json = await res.json()
        const name = typeof json.name === 'string' ? json.name : `Token #${id}`
        const image = typeof json.image === 'string' ? json.image : ''
        meta[id] = { name, image }
      } catch {}
    }
    setState({ ...state, tokenMeta: { ...(state.tokenMeta || {}), ...meta } })
  }

  async function loadAccountInfo() {
    if (state.status !== 'connected') return
    const network = state.chainId === 1 ? 'mainnet' : state.chainId === 11155111 ? 'sepolia' : ''
    if (!network) return
    const url = `http://localhost:3001/api/account/${state.address}?network=${network}`
    const res = await fetch(url)
    if (!res.ok) return
    const json = await res.json()
    setState({ ...state, blockNumber: json.blockNumber, gasPriceWei: json.gasPriceWei })
  }

  if (state.status === 'idle') {
    return (
      <div>
        <button onClick={onConnect} style={{ padding: '8px 12px' }}>Connect MetaMask</button>
      </div>
    )
  }

  if (state.status === 'connecting') {
    return <div>Connecting...</div>
  }

  if (state.status === 'error') {
    return (
      <div>
        <button onClick={onConnect} style={{ padding: '8px 12px' }}>Retry Connect</button>
        <div style={{ color: 'red', marginTop: 8 }}>{state.message}</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div>Address: {state.address}</div>
        <div>Balance: {state.balanceEth} ETH</div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <h3>Mint Token</h3>
        <button onClick={onMint} style={{ padding: '8px 12px' }}>Mint</button>
        <button onClick={async () => {
          if (state.status !== 'connected') return
          const res = await fetch('http://localhost:3001/api/local/mint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: state.address }),
          })
          if (res.ok) {
            await loadTokens()
          }
        }} style={{ padding: '8px 12px', marginLeft: 8 }}>Server Mint (Local)</button>
      </div>
      <div style={{ marginBottom: 12 }}>
        <h3>Account Info</h3>
        <button onClick={loadAccountInfo} style={{ padding: '6px 10px', marginRight: 8 }}>Load Info</button>
        {state.blockNumber !== undefined && (
          <div>Block: {state.blockNumber} • Gas Price (wei): {state.gasPriceWei}</div>
        )}
      </div>
      <div>
        <h3>Recent Transactions</h3>
        {state.txs.length === 0 ? (
          <div>No transactions to display.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {state.txs.map((t) => (
              <li key={t.hash} style={{ marginBottom: 8 }}>
                <a href={txExplorerUrl(state.chainId, t.hash)} target="_blank" rel="noreferrer">
                  {t.hash.slice(0, 10)}...
                </a>
                <span> • {t.valueEth} ETH</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3>My Tokens</h3>
        <button onClick={loadTokens} style={{ padding: '6px 10px', marginBottom: 8 }}>Load Tokens</button>
        {state.tokens.length === 0 ? (
          <div>No tokens to display.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {state.tokens.map((id) => (
              <li key={id} style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 64, height: 64, background: '#eee', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  {state.tokenMeta?.[id]?.image ? (
                    <img src={state.tokenMeta[id].image} alt={state.tokenMeta[id].name} style={{ maxWidth: '64px', maxHeight: '64px' }} />
                  ) : (
                    <span>#{id}</span>
                  )}
                </div>
                <div>{state.tokenMeta?.[id]?.name || `Token #${id}`}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
