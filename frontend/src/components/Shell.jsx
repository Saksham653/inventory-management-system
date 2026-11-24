import { useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  BookOpenText, Boxes, Bot, FolderTree, LayoutDashboard, LogOut, Menu, PanelLeftClose,
  PanelLeftOpen, Search, ShoppingCart, Truck, Upload, Users,
} from "lucide-react"
import { useAuth } from "../lib/auth"
import { initials } from "../lib/format"
import { useSpotlight } from "../lib/motion"
import { Pill } from "./ui"
import CommandPalette from "./CommandPalette"

export const PAGES = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Shop" },
  { id: "products", label: "Products", icon: Boxes, group: "Shop" },
  { id: "sales", label: "Sales", icon: ShoppingCart, group: "Shop" },
  { id: "ledger", label: "Stock ledger", icon: BookOpenText, group: "Shop" },
  { id: "categories", label: "Categories", icon: FolderTree, group: "Setup" },
  { id: "suppliers", label: "Suppliers", icon: Truck, group: "Setup" },
  { id: "team", label: "Team", icon: Users, group: "Setup", needs: "manage" },
  { id: "import", label: "Import data", icon: Upload, group: "Setup", needs: "manage" },
  { id: "assistant", label: "Assistant", icon: Bot, group: "Tools" },
]

export function Logo({ size = 18 }) {
  // Three stacked waves: stock flowing in.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M3 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M3 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0" opacity=".75" />
      <path d="M3 7c2-2 4-2 6 0s4 2 6 0 4-2 6 0" opacity=".45" />
    </svg>
  )
}

export function Ambient() {
  return <div className="ambient" aria-hidden="true"><div className="glow o" /><div className="glow t" /></div>
}

export default function Shell({ page, setPage, openProduct, children }) {
  const { user, logout, can } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [cmdk, setCmdk] = useState(false)
  const [indicator, setIndicator] = useState(null)
  const itemRefs = useRef({})
  const visible = PAGES.filter(p => !p.needs || can[p.needs])
  const groups = [...new Set(visible.map(p => p.group))]
  const current = PAGES.find(p => p.id === page)
  useSpotlight()

  useEffect(() => { setMobileOpen(false) }, [page])

  // Sliding active-page indicator.
  useLayoutEffect(() => {
    const el = itemRefs.current[page]
    if (el) setIndicator(el.offsetTop)
  }, [page, collapsed, visible.length])

  useEffect(() => {
    const onKey = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdk(o => !o) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <>
      <Ambient />
      <div className={`shell ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
        <aside className="side">
          <div className="brand">
            <span className="brand-mark"><Logo /></span>
            <span className="brand-name">StockWaves</span>
          </div>
          <button className="side-cmd" onClick={() => setCmdk(true)} title="Search (Ctrl K)">
            <Search size={16} /><span>Search</span><kbd>Ctrl K</kbd>
          </button>
          <nav aria-label="Main">
            {indicator !== null && <span className="nav-indicator" style={{ transform: `translateY(${indicator - 4}px)`, top: 4 }} />}
            {groups.map(g => (
              <div key={g} style={{ display: "contents" }}>
                <div className="nav-sep">{g}</div>
                {visible.filter(p => p.group === g).map(p => (
                  <button key={p.id} ref={el => (itemRefs.current[p.id] = el)} className={`nav-item ${page === p.id ? "active" : ""}`}
                    onClick={() => setPage(p.id)} aria-current={page === p.id ? "page" : undefined} title={collapsed ? p.label : undefined}>
                    <p.icon size={18} strokeWidth={1.8} />
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="side-foot">
            <div className="user-chip">
              <span className="avatar">{initials(user.name)}</span>
              <div className="user-meta">
                <b>{user.name}</b>
                <Pill tone={user.role === "admin" ? "ok" : user.role === "manager" ? "info" : ""}>{user.role}</Pill>
              </div>
              <button className="icon-btn" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
            </div>
          </div>
        </aside>

        {mobileOpen && <div className="scrim" onClick={() => setMobileOpen(false)} aria-hidden="true" />}

        <div className="main">
          <header className="topbar">
            <button className="icon-btn mobile-only" onClick={() => setMobileOpen(o => !o)} aria-label="Open menu"><Menu size={18} /></button>
            <button className="icon-btn desktop-only" onClick={() => setCollapsed(c => !c)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
            <span className="crumb"><span className="faint desktop-only">StockWaves /</span>{current?.label}</span>
            <span className="spacer" />
            <span className="desktop-only faint" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <span className="live-dot" /> Live · {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
            </span>
            <button className="icon-btn mobile-only" onClick={() => setCmdk(true)} aria-label="Search"><Search size={18} /></button>
          </header>
          <main className="content">
            <div className="page" key={page}>{children}</div>
          </main>
        </div>
      </div>
      <CommandPalette open={cmdk} onClose={() => setCmdk(false)} pages={visible} onPage={setPage} onProduct={openProduct} />
    </>
  )
}
