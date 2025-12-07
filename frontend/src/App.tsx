import Wallet from './components/Wallet'

export default function App() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Ethereum Wallet</h1>
      <p>Connect your wallet to view balance and recent transactions.</p>
      <Wallet />
    </div>
  )
}
