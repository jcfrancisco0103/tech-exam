import express, { type Request, type Response } from 'express'
import cors from 'cors'
import { z } from 'zod'
import { ethers } from 'ethers'
import { getBalanceEth, getNetworkInfo, providerFor } from './eth'
import { TTLCache } from './cache'
import type { Network } from './config'

const app = express()
app.use(cors())
app.use(express.json())

const querySchema = z.object({ network: z.enum(['mainnet', 'sepolia']).default('mainnet') })
const paramsSchema = z.object({ address: z.string().regex(/^0x[a-fA-F0-9]{40}$/) })

const netCache = new TTLCache<{ gasPriceWei: string; blockNumber: number }>(30_000)

app.get('/api/account/:address', async (req: Request, res: Response) => {
  const parseQuery = querySchema.safeParse(req.query)
  const parseParams = paramsSchema.safeParse(req.params)
  if (!parseQuery.success || !parseParams.success) {
    return res.status(400).json({ error: 'Invalid request' })
  }
  const network = parseQuery.data.network as Network
  const address = parseParams.data.address

  try {
    const cacheKey = `net:${network}`
    let net = netCache.get(cacheKey)
    if (!net) {
      net = await getNetworkInfo(network)
      netCache.set(cacheKey, net)
    }
    const balanceEth = await getBalanceEth(network, address)
    return res.json({
      network,
      blockNumber: net.blockNumber,
      gasPriceWei: net.gasPriceWei,
      balanceEth,
      address,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return res.status(500).json({ error: message })
  }
})

app.get('/api/health', async (req: Request, res: Response) => {
  const parseQuery = querySchema.safeParse(req.query)
  if (!parseQuery.success) return res.status(400).json({ error: 'Invalid request' })
  const network = parseQuery.data.network as Network
  try {
    const net = await getNetworkInfo(network)
    return res.json({ network, blockNumber: net.blockNumber, gasPriceWei: net.gasPriceWei })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return res.status(500).json({ error: message })
  }
})

const tokenQuerySchema = z.object({
  network: z.enum(['mainnet', 'sepolia']).default('mainnet'),
  contract: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
})

app.get('/api/tokens/:address', async (req: Request, res: Response) => {
  const parseQuery = tokenQuerySchema.safeParse(req.query)
  const parseParams = paramsSchema.safeParse(req.params)
  if (!parseQuery.success || !parseParams.success) {
    return res.status(400).json({ error: 'Invalid request' })
  }
  const network = parseQuery.data.network as Network
  const address = parseParams.data.address
  const contractAddr = parseQuery.data.contract

  try {
    const provider = providerFor(network)
    const abi = [
      'function balanceOf(address owner) view returns (uint256)',
      'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
    ]
    const contract = new ethers.Contract(contractAddr, abi, provider)
    const bal: bigint = await contract.balanceOf(address)
    const count = Number(bal)
    const tokens: number[] = []
    for (let i = 0; i < count; i++) {
      const id: bigint = await contract.tokenOfOwnerByIndex(address, i)
      tokens.push(Number(id))
    }
    return res.json({ address, network, contract: contractAddr, tokens })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return res.status(500).json({ error: message })
  }
})

const localMintSchema = z.object({ to: z.string().regex(/^0x[a-fA-F0-9]{40}$/) })

app.post('/api/local/mint', async (req: Request, res: Response) => {
  try {
    const parsed = localMintSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid request' })
    const to = parsed.data.to
    const rpc = process.env.LOCAL_RPC_URL || 'http://127.0.0.1:8545'
    const pk = process.env.LOCAL_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    const contractAddr = process.env.CONTRACT_ADDRESS_LOCAL || '0xa85233C63b9Ee964Add6F2cffe00Fd84eb32338f'
    const provider = new ethers.JsonRpcProvider(rpc)
    const wallet = new ethers.Wallet(pk, provider)
    const abi = [
      'function safeMint(address to) returns (uint256)',
      'function balanceOf(address owner) view returns (uint256)',
      'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)'
    ]
    const contract = new ethers.Contract(contractAddr, abi, wallet)
    const tx = await contract.safeMint(to)
    const receipt = await tx.wait()
    return res.json({ txHash: tx.hash, blockNumber: receipt?.blockNumber })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return res.status(500).json({ error: message })
  }
})

const mintSchema = z.object({
  to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  network: z.enum(['sepolia', 'localhost']).default('localhost'),
  contract: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
})

app.post('/api/mint', async (req: Request, res: Response) => {
  try {
    const parsed = mintSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid request' })
    const { to, network } = parsed.data
    const rpc = network === 'sepolia' ? (process.env.RPC_URL_SEPOLIA || '') : (process.env.LOCAL_RPC_URL || 'http://127.0.0.1:8545')
    const pk = network === 'sepolia' ? (process.env.SEPOLIA_PRIVATE_KEY || '') : (process.env.LOCAL_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')
    const defaultAddr = network === 'sepolia' ? (process.env.CONTRACT_ADDRESS_SEPOLIA || '') : (process.env.CONTRACT_ADDRESS_LOCAL || '0x5FbDB2315678afecb367f032d93F642f64180aa3')
    const contractAddr = parsed.data.contract || defaultAddr
    if (!rpc || !pk || !contractAddr) return res.status(400).json({ error: 'Missing RPC/private key/contract address for selected network' })
    const provider = new ethers.JsonRpcProvider(rpc)
    const code = await provider.getCode(contractAddr)
    if (code === '0x') return res.status(400).json({ error: 'Contract not found at address on selected network' })
    const wallet = new ethers.Wallet(pk, provider)
    const abi = [
      'function safeMint(address to) returns (uint256)',
      'function tokenURI(uint256 tokenId) view returns (string)'
    ]
    const contract = new ethers.Contract(contractAddr, abi, wallet)
    const tx = await contract.safeMint(to)
    const receipt = await tx.wait()
    return res.json({ txHash: tx.hash, blockNumber: receipt?.blockNumber })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return res.status(500).json({ error: message })
  }
})

const tokenUriSchema = z.object({
  network: z.enum(['mainnet', 'sepolia', 'localhost']).default('mainnet'),
  contract: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  id: z.string().regex(/^\d+$/),
  fetch: z.enum(['0', '1']).default('1'),
})

app.get('/api/tokenUri', async (req: Request, res: Response) => {
  const parseQuery = tokenUriSchema.safeParse(req.query)
  if (!parseQuery.success) return res.status(400).json({ error: 'Invalid request' })
  const networkParam = parseQuery.data.network
  const contractAddr = parseQuery.data.contract
  const idNum = Number(parseQuery.data.id)
  const shouldFetch = parseQuery.data.fetch === '1'
  try {
    const provider = networkParam === 'localhost'
      ? new ethers.JsonRpcProvider(process.env.LOCAL_RPC_URL || 'http://127.0.0.1:8545')
      : providerFor(networkParam as Network)
    const code = await provider.getCode(contractAddr)
    if (code === '0x') return res.status(400).json({ error: 'Contract not found' })
    const abi = ['function tokenURI(uint256 tokenId) view returns (string)']
    const contract = new ethers.Contract(contractAddr, abi, provider)
    const uri: string = await contract.tokenURI(idNum)
    if (!shouldFetch) return res.json({ uri })
    const r = await fetch(uri)
    if (!r.ok) return res.json({ uri, error: 'Failed to fetch metadata' })
    const json = await r.json()
    return res.json({ uri, metadata: json })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return res.status(500).json({ error: message })
  }
})

app.get('/metadata/:id', async (req: Request, res: Response) => {
  try {
    const idStr = String(req.params.id)
    const idNum = Number(idStr)
    if (!Number.isFinite(idNum) || idNum < 0) return res.status(400).json({ error: 'Invalid id' })
    const name = `TechExamToken #${idNum}`
    const description = 'Demo NFT from tech-exam'
    const image = `https://via.placeholder.com/512?text=Token%20%23${idNum}`
    return res.json({ name, description, image })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return res.status(500).json({ error: message })
  }
})

const port = process.env.PORT ? Number(process.env.PORT) : 3001
app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`)
})
