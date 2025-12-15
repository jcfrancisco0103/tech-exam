import Wallet from './Wallet'

export default function Home() {
  return (
    <div className="container">
      <section className="intro">
        <p>Connect your wallet to view balance, mint tokens and inspect recent transactions.</p>
      </section>

      <section className="wallet-section">
        <Wallet />
      </section>
    </div>
  )
}
