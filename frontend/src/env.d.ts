interface ImportMetaEnv {
  readonly VITE_ETHERSCAN_API_KEY?: string
  readonly VITE_CONTRACT_ADDRESS?: string
  readonly VITE_CONTRACT_CHAIN_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
