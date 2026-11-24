import { useEffect, useState } from "react"
import { ArrowDownLeft, ArrowRight, ArrowUpRight, PackagePlus } from "lucide-react"
import { api } from "../lib/api"
import { useAuth } from "../lib/auth"
import { useSpotlight } from "../lib/motion"
import { Alert, Button, Input, Pill } from "../components/ui"
import { Ambient, Logo } from "../components/Shell"

const TICKER = [
  { icon: PackagePlus, label: "Stock in · USB-C Hub 7-in-1", value: "+40", tone: "up" },
  { icon: ArrowUpRight, label: "Sale · Samsung Galaxy S24", value: "+₹1,59,998", tone: "up" },
  { icon: ArrowDownLeft, label: "Reorder · iPhone 15 Pro, 6 days left", value: "−3", tone: "down" },
]

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [demo, setDemo] = useState([])
  useSpotlight()

  useEffect(() => { api("/auth/demo-accounts").then(setDemo).catch(() => setDemo([])) }, [])

  const submit = async e => {
    e.preventDefault()
    setError("")
    setBusy(true)
    try { await login(email.trim(), password) } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <>
      <Ambient />
      <div className="login">
        <header className="login-nav">
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <span className="brand-mark"><Logo /></span>
            <span className="brand-name">StockWaves</span>
          </div>
          <span className="faint" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><span className="live-dot" />Inventory, counted in rupees</span>
        </header>

        <main className="login-main">
          <section className="login-hero page">
            <Pill tone="ok" dot>Stock ledger · every change traced</Pill>
            <h1 style={{ marginTop: 22 }}>Know where your <span>money</span> sits on the shelf.</h1>
            <p>Stock, sales and suppliers in one calm place. See what's selling, what's stuck and what to reorder before it runs out.</p>
            <div className="ticker">
              {TICKER.map(t => (
                <div className="ticker-row" key={t.label}>
                  <t.icon size={16} className={t.tone} />
                  <span>{t.label}</span>
                  <span className={`num ${t.tone}`}>{t.value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="page">
            <div className="frame">
              <form className="card login-card" onSubmit={submit} noValidate>
                <h2>Welcome back</h2>
                <p className="muted" style={{ margin: "6px 0 24px" }}>Sign in with your work email.</p>
                <Input label="Email" id="login-email" type="email" autoComplete="username" placeholder="you@shop.com" value={email} onChange={setEmail} required />
                <Input label="Password" id="login-password" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={setPassword} required />
                <Alert>{error}</Alert>
                <Button type="submit" variant="primary" block loading={busy} disabled={!email || !password}>
                  Sign in {!busy && <ArrowRight size={16} />}
                </Button>

                {demo.length > 0 && (
                  <div className="demo-list">
                    <div className="eyebrow">Demo accounts · tap to fill</div>
                    {demo.map(d => (
                      <button type="button" key={d.email} onClick={() => { setEmail(d.email); setPassword(d.password) }}>
                        <span>{d.email}</span>
                        <Pill tone={d.role === "admin" ? "ok" : d.role === "manager" ? "info" : ""}>{d.role}</Pill>
                      </button>
                    ))}
                  </div>
                )}
              </form>
            </div>
          </section>
        </main>
      </div>
    </>
  )
}
