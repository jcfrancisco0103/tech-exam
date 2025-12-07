import { Tx } from '../types'

function apiBase(chainId: number) {
  if (chainId === 1) return 'https://api.etherscan.io/api'
  if (chainId === 11155111) return 'https://api-sepolia.etherscan.io/api'
  return null
}

function explorerBase(chainId: number) {
  if (chainId === 1) return 'https://etherscan.io/tx/'
  if (chainId === 11155111) return 'https://sepolia.etherscan.io/tx/'
  return null
}

export function txExplorerUrl(chainId: number, hash: string) {
  const base = explorerBase(chainId)
  if (!base) return ''
  return `${base}${hash}`
}

export async function fetchLastTransactions(address: string, chainId: number, apiKey?: string): Promise<Tx[]> {
  const base = apiBase(chainId)
  if (!base) throw new Error('Unsupported network for transactions')
  if (!apiKey) throw new Error('Missing Etherscan API key')
  const url = `${base}?module=account&action=txlist&address=${address}&sort=desc&page=1&offset=10&apikey=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch transactions')
  const json = (await res.json()) as {
    status: string
    result: {
      hash: string
      from: string
      to: string | null
      value: string
      timeStamp: string
    }[]
  }
  if (json.status !== '1') return []
  return json.result.map((t) => ({
    hash: t.hash,
    from: t.from,
    to: t.to || null,
    valueEth: (Number(t.value) / 1e18).toString(),
    timestamp: Number(t.timeStamp),
  }))
}
