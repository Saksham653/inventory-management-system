import { lazy, Suspense, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { AuthProvider, useAuth } from "./lib/auth"
import { ToastProvider } from "./lib/motion"
import Shell, { Ambient, PAGES } from "./components/Shell"
import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"
import Today from "./pages/Today"
import Radar from "./pages/Radar"
import Orders from "./pages/Orders"
import StockIn from "./pages/StockIn"
import Products from "./pages/Products"
import Sales from "./pages/Sales"
import Ledger from "./pages/Ledger"
import Categories from "./pages/Categories"
import Suppliers from "./pages/Suppliers"
import Team from "./pages/Team"
import Import from "./pages/Import"
import Assistant from "./pages/Assistant"
import WhatsApp from "./pages/WhatsApp"

const Landing = lazy(() => import("./pages/Landing"))

// Pages are addressed by the URL hash (#products) so they can be bookmarked and survive reloads.
function readHash() {
  const id = window.location.hash.slice(1)
  return PAGES.some(p => p.id === id) ? id : "today"
}

function Workspace() {
  const { can } = useAuth()
  const [page, setPageState] = useState(readHash)
  const [ledgerProduct, setLedgerProduct] = useState(null)

  useEffect(() => {
    const onHash = () => setPageState(readHash())
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])

  const setPage = id => {
    if (id !== "ledger") setLedgerProduct(null)
    window.location.hash = id
    setPageState(id)
    window.scrollTo(0, 0)
  }
  const openLedger = productId => { setLedgerProduct(productId); window.location.hash = "ledger"; setPageState("ledger") }

  const def = PAGES.find(p => p.id === page)
  const allowed = !def?.needs || can[def.needs]
  const view = !allowed ? <Today setPage={setPage} openLedger={openLedger} /> : {
    today: <Today setPage={setPage} openLedger={openLedger} />,
    radar: <Radar openLedger={openLedger} />,
    orders: <Orders setPage={setPage} />,
    stockin: <StockIn openLedger={openLedger} />,
    dashboard: <Dashboard setPage={setPage} />,
    products: <Products openLedger={openLedger} />,
    sales: <Sales />,
    ledger: <Ledger productId={ledgerProduct} setProductId={setLedgerProduct} />,
    categories: <Categories />,
    suppliers: <Suppliers />,
    team: <Team />,
    import: <Import />,
    assistant: <Assistant setPage={setPage} openLedger={openLedger} />,
    whatsapp: <WhatsApp />,
  }[page]

  return <Shell page={allowed ? page : "today"} setPage={setPage} openProduct={openLedger}>{view}</Shell>
}

// Signed-out visitors see the landing page; people who have signed in on this device before,
// or who open #login, go straight to the sign-in screen. #home always shows the landing page.
function publicView() {
  const h = window.location.hash.slice(1)
  if (h === "login" || h === "home") return h
  try { if (localStorage.getItem("sw:returning")) return "login" } catch { /* storage blocked */ }
  return "home"
}

function Gate() {
  const { user, checking } = useAuth()
  const [, rerender] = useState(0)
  useEffect(() => {
    const onHash = () => rerender(n => n + 1)
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])
  if (checking) {
    return <><Ambient /><div style={{ height: "100%", display: "grid", placeItems: "center", position: "relative" }}><Loader2 className="spin faint" /></div></>
  }
  if (user) return <Workspace />
  if (publicView() === "login") return <Login />
  return <Suspense fallback={<div style={{ minHeight: "100%", background: "var(--bg)" }} />}><Landing /></Suspense>
}

export default function App() {
  return <AuthProvider><ToastProvider><Gate /></ToastProvider></AuthProvider>
}
