import { useEffect, useRef, useState } from "react"
import { ArrowRight, ArrowUpRight, ClipboardList, Eye, EyeOff, PackagePlus, ShieldCheck, TrendingDown } from "lucide-react"
import { api } from "../lib/api"
import { useAuth } from "../lib/auth"
import { Alert, Button, Field } from "../components/ui"
import { LogoMark, Wordmark } from "../components/Brand"

// Free MotionSites background ("Particle Wave"), tinted orange/teal in CSS.
const BG_VIDEO = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_135039_b04d00db-6ee2-4e2a-a7f5-b2dfd3d24fd2.mp4"

const TICKER = [
  { icon: PackagePlus, text: "Stock in · USB-C Hub 7-in-1", value: "+40", tone: "up" },
  { icon: ArrowUpRight, text: "Sale · Samsung Galaxy S24 × 2", value: "+₹1,59,998", tone: "up" },
  { icon: TrendingDown, text: "Stuck 96 days · MacBook Air M3", value: "₹8.1L", tone: "down" },
  { icon: ClipboardList, text: "Reorder drafted · iPhone 15 Pro", value: "+11", tone: "up" },
]

const HEADLINE = ["Know", "where", "your", "money", "sits", "on", "the", "shelf."]

function useTicker(n, ms = 2600) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI(x => (x + 1) % n), ms)
    return () => clearInterval(t)
  }, [n, ms])
  return i
}

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [show, setShow] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [demo, setDemo] = useState([])
  const [videoOk, setVideoOk] = useState(true)
  const root = useRef(null)
  const tick = useTicker(TICKER.length)

  useEffect(() => { api("/auth/demo-accounts").then(setDemo).catch(() => setDemo([])) }, [])

  // Soft pointer light across the background.
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
    let raf = 0
    const onMove = e => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        root.current?.style.setProperty("--px", `${e.clientX}px`)
        root.current?.style.setProperty("--py", `${e.clientY}px`)
      })
    }
    window.addEventListener("pointermove", onMove, { passive: true })
    return () => window.removeEventListener("pointermove", onMove)
  }, [])

  const submit = async e => {
    e.preventDefault()
    setError("")
    setBusy(true)
    try { await login(email.trim(), password) } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <div className="auth" ref={root}>
      <div className="auth-bg" aria-hidden="true">
        {videoOk && <video className="auth-video" src={BG_VIDEO} autoPlay muted loop playsInline onError={() => setVideoOk(false)} />}
        <div className="auth-tint" />
        <div className="auth-dots" />
        <div className="auth-orb o" />
        <div className="auth-orb t" />
        <div className="auth-pointer" />
        <div className="auth-vignette" />
      </div>

      <header className="auth-nav">
        <span className="brand-lockup"><LogoMark size={28} animated /><Wordmark size={19} /></span>
        <span className="auth-live">Inventory, counted in rupees</span>
      </header>

      <main className="auth-main">
        <section className="auth-hero">
          <h1 className="auth-title" aria-label={HEADLINE.join(" ")}>
            {HEADLINE.map((w, i) => (
              <span key={i} className={`w ${w === "money" ? "money" : ""}`} style={{ animationDelay: `${0.35 + i * 0.07}s` }} aria-hidden="true">{w} </span>
            ))}
          </h1>
          <p className="auth-sub">See what's selling, what's stuck and what to reorder before it runs out. One calm screen, every morning.</p>

          <div className="auth-ticker" aria-live="off">
            <span className="tk-label">Live</span>
            <div className="tk-window">
              {TICKER.map((t, i) => (
                <div key={t.text} className={`tk-row ${i === tick ? "on" : i === (tick + TICKER.length - 1) % TICKER.length ? "off" : ""}`}>
                  <t.icon size={15} className={t.tone} />
                  <span className="tk-text">{t.text}</span>
                  <span className={`num ${t.tone}`}>{t.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="auth-side">
          <div className="auth-card-wrap">
            <form className="auth-card" onSubmit={submit} noValidate>
              <div className="auth-card-head">
                <h2>Sign in</h2>
                <p className="muted">Welcome back. Use your work email.</p>
              </div>

              <Field label="Email" htmlFor="login-email">
                <input id="login-email" className="input" type="email" autoComplete="username" placeholder="you@shop.com"
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </Field>
              <Field label="Password" htmlFor="login-password">
                <div className="pw">
                  <input id="login-password" className="input" type={show ? "text" : "password"} autoComplete="current-password" placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)} required />
                  <button type="button" className="pw-toggle" onClick={() => setShow(s => !s)} aria-label={show ? "Hide password" : "Show password"}>
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>
              <Alert>{error}</Alert>
              <Button type="submit" variant="primary" block loading={busy} disabled={!email || !password} className="auth-submit">
                Sign in {!busy && <ArrowRight size={16} />}
              </Button>

              {demo.length > 0 && (
                <div className="auth-demo">
                  <div className="auth-demo-label"><span />Try a demo account<span /></div>
                  <div className="auth-demo-row">
                    {demo.map(d => (
                      <button type="button" key={d.email} className={`demo-chip ${email === d.email ? "on" : ""}`}
                        onClick={() => { setEmail(d.email); setPassword(d.password); setError("") }}>
                        <b>{d.role}</b>
                        <span>{d.email}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <p className="auth-foot"><ShieldCheck size={13} />Passwords are checked on the server and stored hashed.</p>
            </form>
          </div>
        </section>
      </main>
    </div>
  )
}
