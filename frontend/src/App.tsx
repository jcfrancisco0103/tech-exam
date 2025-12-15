import './styles.css'
import Home from './components/Home'

export default function App() {
  return (
    <div className="app-root">
      <header className="app-header">
        <h1>Ethereum Wallet</h1>
        <nav className="app-nav">Simple dApp demo</nav>
      </header>
      <main className="app-main">
        <Home />
      </main>
    </div>
  )
}
