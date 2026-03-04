
import { useState, useEffect, useRef } from "react"
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"

// ── Icons (inline SVG to avoid import issues) ────────────────────────────────
const Icon = ({ d, size = 18, color = "currentColor", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
)
const Icons = {
  dashboard: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  package: ["M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z", "M3.27 6.96L12 12.01l8.73-5.05", "M12 22.08V12"],
  users: ["M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2", "M23 21v-2a4 4 0 00-3-3.87", "M16 3.13a4 4 0 010 7.75"],
  truck: ["M1 3h15v13H1z", "M16 8h4l3 3v5h-7V8z", "M5.5 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3z", "M18.5 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"],
  tag: ["M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z", "M7 7h.01"],
  cart: ["M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z", "M3 6h18", "M16 10a4 4 0 01-8 0"],
  bot: ["M12 2a2 2 0 012 2v2a2 2 0 01-2 2 2 2 0 01-2-2V4a2 2 0 012-2z", "M2 12h4m12 0h4M12 8v4m-4 4a4 4 0 008 0H8z"],
  logout: ["M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4", "M16 17l5-5-5-5", "M21 12H9"],
  menu: "M3 12h18M3 6h18M3 18h18",
  plus: "M12 5v14M5 12h14",
  edit: ["M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7", "M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"],
  trash: ["M3 6h18", "M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"],
  search: ["M11 19a8 8 0 100-16 8 8 0 000 16z", "M21 21l-4.35-4.35"],
  x: "M18 6L6 18M6 6l12 12",
  check: "M20 6L9 17l-5-5",
  eye: ["M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z", "M12 9a3 3 0 100 6 3 3 0 000-6z"],
  eyeoff: ["M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24", "M1 1l22 22"],
  refresh: "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
  alert: ["M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z", "M12 9v4", "M12 17h.01"],
  trend: "M23 6l-9.5 9.5-5-5L1 18",
  dollar: ["M12 1v22", "M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"],
  warehouse: ["M22 8.35V20a2 2 0 01-2 2H4a2 2 0 01-2-2V8.35A2 2 0 012.9 6.5l8-4.67a2 2 0 012.2 0l8 4.67A2 2 0 0122 8.35z", "M6 18h12", "M6 14h12"],
  send: ["M22 2L11 13", "M22 2L15 22l-4-9-9-4 20-7z"],
  activity: "M22 12h-4l-3 9L9 3l-3 9H2",
}
const I = ({ name, size = 18, color = "currentColor" }) => <Icon d={Icons[name]} size={size} color={color} />

// ── Theme ──────────────────────────────────────────────────────────────────
const C = {
  bg: "#0f172a", card: "#1e293b", cardHov: "#334155",
  border: "#334155", borderLt: "#475569",
  gold: "#0066CC", goldGlow: "rgba(0,102,204,0.12)",
  green: "#10b981", red: "#ef4444", blue: "#0052A3", purple: "#8b5cf6",
  text: "#ffffff", dim: "#94a3b8", muted: "#64748b",
}

// ── Seed data ─────────────────────────────────────────────────────────────
const USERS = [
  { id: "u1", email: "admin@sam.com", password: "admin123", name: "Admin User", role: "admin", initial: "A" },
  { id: "u2", email: "manager@sam.com", password: "pass123", name: "Sarah Chen", role: "manager", initial: "S" },
  { id: "u3", email: "staff@sam.com", password: "pass123", name: "John Staff", role: "staff", initial: "J" },
]
const seedCats = [
  { id: "c1", name: "Smartphones", desc: "Mobile phones & accessories", created: "2024-01-15" },
  { id: "c2", name: "Laptops", desc: "Notebooks and ultrabooks", created: "2024-01-15" },
  { id: "c3", name: "Accessories", desc: "Peripherals & add-ons", created: "2024-02-01" },
  { id: "c4", name: "Tablets", desc: "iPad & Android tablets", created: "2024-02-10" },
]
const seedSups = [
  { id: "s1", name: "Apple Pvt Ltd", contact: "9876543210", email: "supply@apple.com", desc: "iPhone & Mac supplier", addr: "Cupertino, CA", created: "2024-01-10" },
  { id: "s2", name: "Samsung Electronics", contact: "8765432109", email: "b2b@samsung.com", desc: "Android & displays", addr: "Seoul, Korea", created: "2024-01-12" },
  { id: "s3", name: "Vivo Pvt Ltd", contact: "7654321098", email: "supply@vivo.com", desc: "Budget smartphones", addr: "Mumbai, India", created: "2024-01-20" },
  { id: "s4", name: "HP India", contact: "6543210987", email: "supply@hp.com", desc: "Laptops & peripherals", addr: "Bangalore, India", created: "2024-02-05" },
]
const seedProds = [
  { id: "p1", name: "Vivo V12", sku: "VIV-V12", catId: "c1", supId: "s3", qty: 20, price: 20000, brand: "VIVO", thresh: 5 },
  { id: "p2", name: "iPhone 15 Pro", sku: "APL-IP15P", catId: "c1", supId: "s1", qty: 3, price: 134900, brand: "APPLE", thresh: 5 },
  { id: "p3", name: "Samsung Galaxy S24", sku: "SAM-GS24", catId: "c1", supId: "s2", qty: 15, price: 79999, brand: "SAMSUNG", thresh: 5 },
  { id: "p4", name: "MacBook Air M3", sku: "APL-MBA", catId: "c2", supId: "s1", qty: 8, price: 114900, brand: "APPLE", thresh: 3 },
  { id: "p5", name: "HP Pavilion 15", sku: "HP-PAV15", catId: "c2", supId: "s4", qty: 2, price: 52000, brand: "HP", thresh: 3 },
  { id: "p6", name: "USB-C Hub 7-in-1", sku: "ACC-HUB7", catId: "c3", supId: "s2", qty: 45, price: 2499, brand: "SAMSUNG", thresh: 10 },
  { id: "p7", name: "iPad Air 5", sku: "APL-IPAD5", catId: "c4", supId: "s1", qty: 6, price: 59900, brand: "APPLE", thresh: 3 },
]
const seedEmps = [
  { id: "e1", name: "Raj Patel", email: "raj@sam.com", gender: "Male", contact: "9876543210", dob: "1990-03-15", doj: "2022-01-10", role: "Admin", addr: "Mumbai", salary: 75000 },
  { id: "e2", name: "Priya Singh", email: "priya@sam.com", gender: "Female", contact: "8765432109", dob: "1993-07-22", doj: "2022-03-15", role: "Manager", addr: "Delhi", salary: 55000 },
  { id: "e3", name: "Amit Kumar", email: "amit@sam.com", gender: "Male", contact: "7654321098", dob: "1995-11-08", doj: "2023-06-01", role: "Staff", addr: "Bangalore", salary: 35000 },
  { id: "e4", name: "Sneha Joshi", email: "sneha@sam.com", gender: "Female", contact: "6543210987", dob: "1997-02-14", doj: "2023-09-20", role: "Staff", addr: "Pune", salary: 32000 },
]
const seedSales = [
  { id: "sl1", pid: "p1", prod: "Vivo V12", qty: 3, unit: 20000, total: 60000, cust: "9876543210", by: "Raj Patel", date: "2025-03-01" },
  { id: "sl2", pid: "p3", prod: "Samsung Galaxy S24", qty: 1, unit: 79999, total: 79999, cust: "8765432109", by: "Priya Singh", date: "2025-03-01" },
  { id: "sl3", pid: "p4", prod: "MacBook Air M3", qty: 1, unit: 114900, total: 114900, cust: "7654321098", by: "Raj Patel", date: "2025-03-02" },
  { id: "sl4", pid: "p6", prod: "USB-C Hub 7-in-1", qty: 5, unit: 2499, total: 12495, cust: "6543210987", by: "Amit Kumar", date: "2025-03-02" },
  { id: "sl5", pid: "p2", prod: "iPhone 15 Pro", qty: 2, unit: 134900, total: 269800, cust: "9871234560", by: "Raj Patel", date: "2025-03-03" },
]
const CHART = [
  { m: "Oct", v: 312000 }, { m: "Nov", v: 428000 }, { m: "Dec", v: 615000 }, { m: "Jan", v: 389000 }, { m: "Feb", v: 471000 }, { m: "Mar", v: 537194 },
]
const PIE = [
  { name: "Smartphones", value: 38, color: C.gold }, { name: "Laptops", value: 10, color: C.blue },
  { name: "Accessories", value: 45, color: C.green }, { name: "Tablets", value: 6, color: C.purple },
]

// ── Utils ─────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2)
const fmt = n => "₹" + Number(n).toLocaleString("en-IN")
const today = () => new Date().toISOString().slice(0, 10)

// ── Reusable micro-components ─────────────────────────────────────────────
function Badge({ text, color = C.gold }) {
  return (
    <span style={{
      background: color + "22", color, border: `1px solid ${color}44`,
      borderRadius: 6, padding: "2px 9px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap"
    }}>
      {text}
    </span>
  )
}

function Btn({ onClick, children, variant = "primary", size = "md", disabled, full }) {
  const pad = size === "sm" ? "6px 13px" : "10px 20px"
  const fs = size === "sm" ? 12 : 13
  const base = {
    cursor: disabled ? "not-allowed" : "pointer", border: "none", borderRadius: 8,
    fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6,
    transition: "opacity .15s", opacity: disabled ? 0.45 : 1, width: full ? "100%" : undefined,
    justifyContent: full ? "center" : undefined, padding: pad, fontSize: fs
  }
  const v = {
    primary: { background: C.gold, color: "#000" },
    ghost: { background: "transparent", color: C.dim },
    danger: { background: C.red + "22", color: C.red, border: `1px solid ${C.red}44` },
    outline: { background: "transparent", color: C.gold, border: `1px solid ${C.gold}55` },
  }
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...v[variant] }}>{children}</button>
}

function TextInput({ label, value, onChange, type = "text", placeholder = "", required }) {
  const [show, setShow] = useState(false)
  const t = type === "password" ? (show ? "text" : "password") : type
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <label style={{
          display: "block", fontSize: 11, color: C.muted, marginBottom: 5,
          fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase"
        }}>
          {label}{required && <span style={{ color: C.red }}> *</span>}
        </label>
      )}
      <div style={{ position: "relative" }}>
        <input type={t} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{
            width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: `10px ${type === "password" ? 38 : 13}px 10px 13px`,
            color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box"
          }} />
        {type === "password" && (
          <button type="button" onClick={() => setShow(!show)}
            style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", color: C.muted
            }}>
            <I name={show ? "eyeoff" : "eye"} size={15} />
          </button>
        )}
      </div>
    </div>
  )
}

function SelInput({ label, value, onChange, options, required }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <label style={{
          display: "block", fontSize: 11, color: C.muted, marginBottom: 5,
          fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase"
        }}>
          {label}{required && <span style={{ color: C.red }}> *</span>}
        </label>
      )}
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: "10px 13px", color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box"
        }}>
        <option value="">— Select —</option>
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  )
}

function Modal({ open, onClose, title, children, width = 500 }) {
  if (!open) return null
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.8)",
      zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20
    }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
          width: "100%", maxWidth: width, maxHeight: "90vh", overflow: "auto",
          boxShadow: "0 40px 80px rgba(0,0,0,.7)"
        }}>
        <div style={{
          padding: "20px 26px", borderBottom: `1px solid ${C.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: C.text }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}>
            <I name="x" size={19} />
          </button>
        </div>
        <div style={{ padding: 26 }}>{children}</div>
      </div>
    </div>
  )
}

function Confirm({ open, onClose, onOk, msg }) {
  return (
    <Modal open={open} onClose={onClose} title="Confirm Delete" width={400}>
      <p style={{ color: C.dim, marginBottom: 24, fontSize: 14 }}>{msg || "This action cannot be undone."}</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="danger" onClick={onOk}><I name="trash" size={13} /> Delete</Btn>
      </div>
    </Modal>
  )
}

function DataTable({ cols, rows, onEdit, onDelete, canEdit = true, canDel = true }) {
  return (
    <div style={{ overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c.k} style={{
                padding: "10px 15px", textAlign: "left", fontSize: 11,
                fontWeight: 700, color: C.muted, letterSpacing: "0.7px", textTransform: "uppercase",
                borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap"
              }}>
                {c.label}
              </th>
            ))}
            {(canEdit || canDel) && <th style={{ borderBottom: `1px solid ${C.border}`, padding: "10px 15px" }} />}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={cols.length + 1} style={{ padding: 40, textAlign: "center", color: C.muted, fontSize: 13 }}>
              No records found
            </td></tr>
          )}
          {rows.map((row, i) => (
            <tr key={row.id || i}
              onMouseEnter={e => e.currentTarget.style.background = C.cardHov}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              style={{ borderBottom: `1px solid ${C.border}22`, transition: "background .1s" }}>
              {cols.map(c => (
                <td key={c.k} style={{ padding: "11px 15px", fontSize: 13, color: C.dim, whiteSpace: "nowrap" }}>
                  {c.render ? c.render(row) : row[c.k] ?? "—"}
                </td>
              ))}
              {(canEdit || canDel) && (
                <td style={{ padding: "11px 15px", textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    {canEdit && <Btn size="sm" variant="ghost" onClick={() => onEdit(row)}><I name="edit" size={13} /></Btn>}
                    {canDel && <Btn size="sm" variant="danger" onClick={() => onDelete(row)}><I name="trash" size={13} /></Btn>}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PageHead({ title, sub, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 26 }}>
      <div>
        <h1 style={{ fontSize: 23, fontWeight: 800, color: C.text, margin: 0 }}>{title}</h1>
        {sub && <p style={{ color: C.muted, margin: "4px 0 0", fontSize: 13 }}>{sub}</p>}
      </div>
      {action}
    </div>
  )
}

function StatCard({ icon, label, value, sub, color = C.gold }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 22px", flex: 1, minWidth: 155 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", margin: 0 }}>{label}</p>
          <p style={{ color: C.text, fontSize: 26, fontWeight: 800, margin: "6px 0 4px" }}>{value}</p>
          {sub && <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>{sub}</p>}
        </div>
        <div style={{ background: color + "22", borderRadius: 9, padding: 10 }}>
          <I name={icon} size={20} color={color} />
        </div>
      </div>
    </div>
  )
}

function SearchBar({ value, onChange, placeholder }) {
  return (
    <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ position: "relative", maxWidth: 340 }}>
        <I name="search" size={14} color={C.muted}
          style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{
            width: "100%", paddingLeft: 34, padding: "8px 8px 8px 34px", background: C.bg,
            border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13,
            outline: "none", boxSizing: "border-box"
          }} />
      </div>
    </div>
  )
}

function Alert({ type = "warning", children }) {
  const cc = type === "danger" ? C.red : type === "success" ? C.green : C.gold
  return (
    <div style={{
      background: cc + "18", border: `1px solid ${cc}44`, borderRadius: 8,
      padding: "10px 14px", marginBottom: 14, fontSize: 13, color: cc, display: "flex", gap: 8, alignItems: "center"
    }}>
      <I name="alert" size={15} color={cc} />{children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [email, setEmail] = useState("admin@sam.com")
  const [pass, setPass] = useState("admin123")
  const [err, setErr] = useState("")
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setErr(""); setLoading(true)
    await new Promise(r => setTimeout(r, 500))
    const u = USERS.find(u => u.email === email && u.password === pass)
    u ? onLogin(u) : setErr("Invalid email or password")
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: 20, fontFamily: "inherit"
    }}>

      {/* Brand */}
      <div style={{ textAlign: "center", marginBottom: 30 }}>
        <svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" width="120" height="120" style={{ marginBottom: 20 }}>
          <rect width="300" height="300" rx="60" fill="url(#grad)" />
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0066CC" />
              <stop offset="100%" stopColor="#00ccff" />
            </linearGradient>
          </defs>
          <path d="M 80 180 L 120 120 L 160 160 L 220 80 L 220 120 L 160 200 L 120 160 L 80 220 Z" fill="white" />
        </svg>
        <h1 style={{ color: "white", marginBottom: 10, fontSize: "2rem", fontWeight: 800 }}>Welcome to STOCKWAVE</h1>
        <p style={{ color: "#888", marginBottom: 40, fontSize: 16 }}>Real-Time Inventory Intelligence</p>
      </div>

      <div style={{ width: "100%", maxWidth: 400 }}>
        <TextInput label="" type="email" value={email} onChange={setEmail} placeholder="Email" required />
        <TextInput label="" type="password" value={pass} onChange={setPass} placeholder="Password" required />
        {err && <Alert type="danger">{err}</Alert>}

        <button onClick={submit} disabled={loading}
          style={{
            width: "100%", padding: 13, background: "linear-gradient(135deg, #0066CC, #0052A3)",
            color: "white", border: "none", borderRadius: 8, cursor: loading ? "wait" : "pointer",
            fontWeight: 600, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            opacity: loading ? 0.7 : 1, transition: "opacity .15s", marginTop: 10
          }}>
          {loading ? <><I name="refresh" size={16} color="white" /> Signing in…</> : "Sign In"}
        </button>

        <div style={{ marginTop: 30, background: "rgba(255, 255, 255, 0.05)", borderRadius: 10, padding: "16px" }}>
          <p style={{
            color: "#888", fontSize: 11, marginBottom: 12, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.6px"
          }}>Demo Accounts</p>
          {USERS.map(u => (
            <div key={u.id} onClick={() => { setEmail(u.email); setPass(u.password) }}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 0", borderBottom: `1px solid rgba(255,255,255,0.05)`, cursor: "pointer"
              }}>
              <span style={{ fontSize: 13, color: "#ccc" }}>{u.email}</span>
              <Badge text={u.role} color={u.role === "admin" ? C.gold : u.role === "manager" ? C.blue : C.green} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────
const NAV = [
  { id: "dash", label: "Dashboard", icon: "dashboard" },
  { id: "prods", label: "Products", icon: "package" },
  { id: "cats", label: "Categories", icon: "tag" },
  { id: "sups", label: "Suppliers", icon: "truck" },
  { id: "emps", label: "Employees", icon: "users" },
  { id: "sales", label: "Sales", icon: "cart" },
  { id: "chat", label: "AI Assistant", icon: "bot" },
  { id: "upload", label: "Data Uploader", icon: "refresh" },
]

function Sidebar({ page, setPage, user, onLogout, collapsed, setCollapsed }) {
  return (
    <div style={{
      width: collapsed ? 66 : 230, background: C.card, borderRight: `1px solid ${C.border}`,
      display: "flex", flexDirection: "column", transition: "width .2s", flexShrink: 0, zIndex: 10
    }}>
      {/* Header */}
      <div style={{
        padding: "18px 14px", borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", gap: 10, overflow: "hidden"
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 32, height: 32, flexShrink: 0
        }}>
          <svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" width="32" height="32">
            <rect width="300" height="300" rx="60" fill="url(#grad2)" />
            <defs>
              <linearGradient id="grad2" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#0066CC" />
                <stop offset="100%" stopColor="#00ccff" />
              </linearGradient>
            </defs>
            <path d="M 80 180 L 120 120 L 160 160 L 220 80 L 220 120 L 160 200 L 120 160 L 80 220 Z" fill="white" />
          </svg>
        </div>
        {!collapsed && <span style={{ fontWeight: 900, fontSize: 13, color: "white", letterSpacing: 1, whiteSpace: "nowrap" }}>STOCKWAVE</span>}
        <button onClick={() => setCollapsed(!collapsed)}
          style={{
            marginLeft: "auto", background: "none", border: "none", cursor: "pointer",
            color: C.muted, flexShrink: 0
          }}>
          <I name="menu" size={16} />
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto", overflowX: "hidden" }}>
        {NAV.map(n => {
          const active = page === n.id
          return (
            <button key={n.id} onClick={() => setPage(n.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 11,
                padding: "10px 11px", borderRadius: 9, border: "none", cursor: "pointer",
                marginBottom: 2, background: active ? C.goldGlow : "transparent",
                color: active ? C.gold : C.muted, textAlign: "left", transition: "all .12s",
                overflow: "hidden"
              }}
              onMouseEnter={e => !active && (e.currentTarget.style.background = C.bg)}
              onMouseLeave={e => !active && (e.currentTarget.style.background = "transparent")}>
              <I name={n.icon} size={17} color={active ? C.gold : C.muted} />
              {!collapsed && (
                <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, whiteSpace: "nowrap" }}>
                  {n.label}
                </span>
              )}
              {!collapsed && n.id === "chat" && (
                <span style={{
                  marginLeft: "auto", background: C.gold, color: "white",
                  borderRadius: 4, fontSize: 9, fontWeight: 900, padding: "1px 6px"
                }}>AI</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* User */}
      <div style={{ padding: "10px 8px", borderTop: `1px solid ${C.border}` }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "9px 11px",
          borderRadius: 9, overflow: "hidden"
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 7, background: "linear-gradient(135deg, #0066CC, #00ccff)",
            border: `1px solid ${C.gold}44`, display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontWeight: 800, fontSize: 12, flexShrink: 0
          }}>
            {user.initial}
          </div>
          {!collapsed && (
            <>
              <div style={{ overflow: "hidden", flex: 1 }}>
                <p style={{
                  margin: 0, fontSize: 12, fontWeight: 700, color: C.text,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                }}>{user.name}</p>
                <Badge text={user.role} color={user.role === "admin" ? C.gold : user.role === "manager" ? C.blue : C.green} />
              </div>
              <button onClick={onLogout}
                style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, flexShrink: 0 }}>
                <I name="logout" size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function Dashboard({ products, employees, suppliers, sales, setPage }) {
  const [psrRisks, setPsrRisks] = useState([])
  const [loadingPSR, setLoadingPSR] = useState(true)

  useEffect(() => {
    fetch("/api/v1/products/replenishment-risk")
      .then(res => res.json())
      .then(data => {
        setPsrRisks(data.filter(r => r.at_risk))
        setLoadingPSR(false)
      })
      .catch(() => setLoadingPSR(false))
  }, [])

  const low = products.filter(p => p.qty <= p.thresh)
  const rev = sales.reduce((a, s) => a + (s.total_price || 0), 0)

  return (
    <div>
      <PageHead title="Dashboard"
        sub={new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} />

      <div style={{ display: "flex", gap: 14, marginBottom: 22, flexWrap: "wrap" }}>
        <StatCard icon="package" label="Products" value={products.length} sub={`${low.length} low stock`} color={C.gold} />
        <StatCard icon="cart" label="Sales" value={sales.length} sub={fmt(rev)} color={C.green} />
        <StatCard icon="truck" label="Suppliers" value={suppliers.length} sub="Active vendors" color={C.blue} />
        <StatCard icon="users" label="Employees" value={employees.length} sub="Team members" color={C.purple} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 22 }}>
        {/* Revenue chart */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 22 }}>
          <h3 style={{ color: C.text, fontSize: 14, fontWeight: 700, margin: "0 0 18px" }}>Monthly Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={CHART}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.gold} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.gold} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="m" tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false}
                tickFormatter={v => "₹" + (v / 1000) + "K"} />
              <Tooltip formatter={v => fmt(v)}
                contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.text }} />
              <Area type="monotone" dataKey="v" stroke={C.gold} strokeWidth={2.5} fill="url(#g1)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 22 }}>
          <h3 style={{ color: C.text, fontSize: 14, fontWeight: 700, margin: "0 0 18px" }}>Stock by Category</h3>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={PIE} cx="50%" cy="50%" innerRadius={48} outerRadius={76} paddingAngle={4} dataKey="value">
                {PIE.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {PIE.map(e => (
              <div key={e.name} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.dim }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: e.color }} /> {e.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* PSR Risk Alerts */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ color: C.gold, fontSize: 14, fontWeight: 700, margin: 0 }}>🚀 Predictive Stockout Risks</h3>
            <Badge text="PSR Active" color={C.blue} />
          </div>
          {loadingPSR ? (
            <p style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "20px 0" }}>Analyzing sales velocity...</p>
          ) : psrRisks.length === 0 ? (
            <p style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "20px 0" }}>No predictive stockout risks found ✓</p>
          ) : (
            psrRisks.map(r => (
              <div key={r.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "11px 0", borderBottom: `1px solid ${C.border}22`
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, color: C.text, fontWeight: 600 }}>{r.name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: C.muted }}>Runs out in <span style={{ color: C.red }}>{r.days_of_cover} days</span> · Lead time: {r.lead_time}d</p>
                </div>
                <Btn size="sm" variant="outline">Reorder</Btn>
              </div>
            ))
          )}
        </div>

        {/* Recent sales */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ color: C.text, fontSize: 14, fontWeight: 700, margin: 0 }}>Recent Sales</h3>
            <Btn size="sm" variant="outline" onClick={() => setPage("sales")}>View All</Btn>
          </div>
          {[...sales].reverse().slice(0, 5).map(s => (
            <div key={s.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "9px 0", borderBottom: `1px solid ${C.border}22`
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, color: C.text, fontWeight: 600 }}>{s.prod}</p>
                <p style={{ margin: 0, fontSize: 11, color: C.muted }}>{s.date} · {s.by}</p>
              </div>
              <span style={{ color: C.green, fontWeight: 700, fontSize: 13 }}>{fmt(s.total)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────────────────────────────────────
function Products({ products, setProducts, cats, sups, user }) {
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState(null)
  const [del, setDel] = useState(null)
  const [f, setF] = useState({ name: "", sku: "", catId: "", supId: "", qty: 0, price: 0, brand: "", thresh: 5, lead_time_days: 3 })
  const [psrData, setPsrData] = useState({})

  useEffect(() => {
    fetch("/api/v1/products/replenishment-risk")
      .then(res => res.json())
      .then(data => {
        const mapping = {}
        data.forEach(item => { mapping[item.id] = item })
        setPsrData(mapping)
      })
  }, [products])

  const canEdit = user.role !== "staff"
  const catName = id => cats.find(c => c.id === id)?.name || "—"

  const filt = products.filter(p =>
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    p.sku.toLowerCase().includes(q.toLowerCase()) ||
    p.brand.toLowerCase().includes(q.toLowerCase())
  )

  const openAdd = () => { setEdit(null); setF({ name: "", sku: "", catId: "", supId: "", qty: 0, price: 0, brand: "", thresh: 5, lead_time_days: 3 }); setOpen(true) }
  const openEd = p => { setEdit(p); setF({ name: p.name, sku: p.sku, catId: p.catId, supId: p.supId, qty: p.qty, price: p.price, brand: p.brand, thresh: p.thresh, lead_time_days: p.lead_time_days || 3 }); setOpen(true) }

  const save = () => {
    if (!f.name || !f.sku || !f.catId) return
    const row = { ...f, qty: +f.qty, price: +f.price, thresh: +f.thresh, lead_time_days: +f.lead_time_days }
    edit
      ? setProducts(ps => ps.map(p => p.id === edit.id ? { ...p, ...row } : p))
      : setProducts(ps => [...ps, { ...row, id: uid() }])
    setOpen(false)
  }
  const doDel = () => { setProducts(ps => ps.filter(p => p.id !== del.id)); setDel(null) }

  const cols = [
    { k: "name", label: "Product", render: p => <span style={{ color: C.text, fontWeight: 600 }}>{p.name}</span> },
    { k: "sku", label: "SKU", render: p => <code style={{ background: C.bg, padding: "2px 8px", borderRadius: 4, fontSize: 11, color: C.dim }}>{p.sku}</code> },
    {
      k: "doc", label: "Stock Cover", render: p => {
        const r = psrData[p.id]
        if (!r) return <Badge text="No Data" color={C.dim} />
        return <Badge text={`${r.days_of_cover} days`} color={r.at_risk ? C.red : C.green} />
      }
    },
    { k: "catId", label: "Category", render: p => <Badge text={catName(p.catId)} color={C.blue} /> },
    { k: "brand", label: "Brand" },
    { k: "qty", label: "Stock", render: p => <Badge text={`${p.qty} units`} color={p.qty <= p.thresh ? C.red : C.green} /> },
    { k: "price", label: "Price", render: p => <span style={{ color: C.gold, fontWeight: 700 }}>{fmt(p.price)}</span> },
  ]

  return (
    <div>
      <PageHead title="Products" sub={`${products.length} items · ${products.filter(p => p.qty <= p.thresh).length} low stock`}
        action={canEdit && <Btn onClick={openAdd}><I name="plus" size={14} /> Add Product</Btn>} />

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <SearchBar value={q} onChange={setQ} placeholder="Search by name, SKU, brand…" />
        <DataTable cols={cols} rows={filt} onEdit={openEd} onDelete={setDel}
          canEdit={canEdit} canDel={user.role === "admin"} />
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={edit ? "Edit Product" : "New Product"}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div style={{ gridColumn: "1/-1" }}><TextInput label="Product Name" value={f.name} onChange={v => setF(x => ({ ...x, name: v }))} required /></div>
          <TextInput label="SKU" value={f.sku} onChange={v => setF(x => ({ ...x, sku: v }))} required />
          <TextInput label="Brand" value={f.brand} onChange={v => setF(x => ({ ...x, brand: v }))} />
          <SelInput label="Category" value={f.catId} onChange={v => setF(x => ({ ...x, catId: v }))} options={cats.map(c => ({ v: c.id, l: c.name }))} required />
          <SelInput label="Supplier" value={f.supId} onChange={v => setF(x => ({ ...x, supId: v }))} options={sups.map(s => ({ v: s.id, l: s.name }))} />
          <TextInput label="Quantity" type="number" value={f.qty} onChange={v => setF(x => ({ ...x, qty: v }))} />
          <TextInput label="Price (₹)" type="number" value={f.price} onChange={v => setF(x => ({ ...x, price: v }))} required />
          <div style={{ gridColumn: "1/-1" }}><TextInput label="Low Stock Threshold" type="number" value={f.thresh} onChange={v => setF(x => ({ ...x, thresh: v }))} /></div>
          <div style={{ gridColumn: "1/-1" }}><TextInput label="Supplier Lead Time (Days)" type="number" value={f.lead_time_days} onChange={v => setF(x => ({ ...x, lead_time_days: v }))} /></div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
          <Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn>
          <Btn onClick={save}><I name="check" size={13} /> {edit ? "Update" : "Create"}</Btn>
        </div>
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} onOk={doDel} msg={`Delete "${del?.name}"?`} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────
function Categories({ cats, setCats, products, user }) {
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState(null)
  const [del, setDel] = useState(null)
  const [f, setF] = useState({ name: "", desc: "" })
  const canEdit = user.role !== "staff"
  const count = id => products.filter(p => p.catId === id).length

  const openAdd = () => { setEdit(null); setF({ name: "", desc: "" }); setOpen(true) }
  const openEd = c => { setEdit(c); setF({ name: c.name, desc: c.desc }); setOpen(true) }
  const save = () => {
    if (!f.name) return
    edit
      ? setCats(cs => cs.map(c => c.id === edit.id ? { ...c, ...f } : c))
      : setCats(cs => [...cs, { ...f, id: uid(), created: today() }])
    setOpen(false)
  }
  const doDel = () => { setCats(cs => cs.filter(c => c.id !== del.id)); setDel(null) }

  const cols = [
    { k: "name", label: "Category", render: c => <span style={{ color: C.text, fontWeight: 600 }}>{c.name}</span> },
    { k: "desc", label: "Description" },
    { k: "id", label: "Products", render: c => <Badge text={`${count(c.id)} items`} color={C.blue} /> },
    { k: "created", label: "Created" },
  ]

  return (
    <div>
      <PageHead title="Categories" sub={`${cats.length} categories`}
        action={canEdit && <Btn onClick={openAdd}><I name="plus" size={14} /> Add Category</Btn>} />
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <DataTable cols={cols} rows={cats} onEdit={openEd} onDelete={setDel} canEdit={canEdit} canDel={user.role === "admin"} />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={edit ? "Edit Category" : "New Category"} width={420}>
        <TextInput label="Category Name" value={f.name} onChange={v => setF(x => ({ ...x, name: v }))} required />
        <TextInput label="Description" value={f.desc} onChange={v => setF(x => ({ ...x, desc: v }))} />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn>
          <Btn onClick={save}><I name="check" size={13} /> {edit ? "Update" : "Create"}</Btn>
        </div>
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} onOk={doDel} msg={`Delete "${del?.name}"?`} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPPLIERS
// ─────────────────────────────────────────────────────────────────────────────
function Suppliers({ sups, setSups, user }) {
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState(null)
  const [del, setDel] = useState(null)
  const [f, setF] = useState({ name: "", contact: "", email: "", desc: "", addr: "" })
  const canEdit = ["admin", "manager"].includes(user.role)

  const filt = sups.filter(s =>
    s.name.toLowerCase().includes(q.toLowerCase()) ||
    s.email.toLowerCase().includes(q.toLowerCase())
  )
  const openAdd = () => { setEdit(null); setF({ name: "", contact: "", email: "", desc: "", addr: "" }); setOpen(true) }
  const openEd = s => { setEdit(s); setF({ name: s.name, contact: s.contact, email: s.email, desc: s.desc, addr: s.addr }); setOpen(true) }
  const save = () => {
    if (!f.name) return
    edit
      ? setSups(ss => ss.map(s => s.id === edit.id ? { ...s, ...f } : s))
      : setSups(ss => [...ss, { ...f, id: uid(), created: today() }])
    setOpen(false)
  }
  const doDel = () => { setSups(ss => ss.filter(s => s.id !== del.id)); setDel(null) }

  const cols = [
    { k: "name", label: "Supplier", render: s => <span style={{ color: C.text, fontWeight: 600 }}>{s.name}</span> },
    { k: "contact", label: "Contact" },
    { k: "email", label: "Email", render: s => <a href={`mailto:${s.email}`} style={{ color: C.blue, textDecoration: "none" }}>{s.email}</a> },
    { k: "desc", label: "Description" },
    { k: "addr", label: "Address" },
    { k: "created", label: "Added" },
  ]

  return (
    <div>
      <PageHead title="Suppliers" sub={`${sups.length} vendors`}
        action={canEdit && <Btn onClick={openAdd}><I name="plus" size={14} /> Add Supplier</Btn>} />
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <SearchBar value={q} onChange={setQ} placeholder="Search suppliers…" />
        <DataTable cols={cols} rows={filt} onEdit={openEd} onDelete={setDel} canEdit={canEdit} canDel={user.role === "admin"} />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={edit ? "Edit Supplier" : "New Supplier"}>
        <TextInput label="Supplier Name" value={f.name} onChange={v => setF(x => ({ ...x, name: v }))} required />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <TextInput label="Contact" value={f.contact} onChange={v => setF(x => ({ ...x, contact: v }))} />
          <TextInput label="Email" type="email" value={f.email} onChange={v => setF(x => ({ ...x, email: v }))} />
        </div>
        <TextInput label="Address" value={f.addr} onChange={v => setF(x => ({ ...x, addr: v }))} />
        <TextInput label="Description" value={f.desc} onChange={v => setF(x => ({ ...x, desc: v }))} />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn>
          <Btn onClick={save}><I name="check" size={13} /> {edit ? "Update" : "Create"}</Btn>
        </div>
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} onOk={doDel} msg={`Delete "${del?.name}"?`} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEES
// ─────────────────────────────────────────────────────────────────────────────
function Employees({ emps, setEmps, user }) {
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState(null)
  const [del, setDel] = useState(null)
  const [f, setF] = useState({ name: "", email: "", gender: "Male", contact: "", dob: "", doj: "", role: "Staff", addr: "", salary: "" })
  const canEdit = user.role === "admin"

  const filt = emps.filter(e =>
    e.name.toLowerCase().includes(q.toLowerCase()) ||
    e.email.toLowerCase().includes(q.toLowerCase())
  )
  const openAdd = () => { setEdit(null); setF({ name: "", email: "", gender: "Male", contact: "", dob: "", doj: "", role: "Staff", addr: "", salary: "" }); setOpen(true) }
  const openEd = e => { setEdit(e); setF({ name: e.name, email: e.email, gender: e.gender, contact: e.contact, dob: e.dob, doj: e.doj, role: e.role, addr: e.addr, salary: e.salary }); setOpen(true) }
  const save = () => {
    if (!f.name || !f.email) return
    edit
      ? setEmps(es => es.map(e => e.id === edit.id ? { ...e, ...f, salary: +f.salary } : e))
      : setEmps(es => [...es, { ...f, id: uid(), salary: +f.salary }])
    setOpen(false)
  }
  const doDel = () => { setEmps(es => es.filter(e => e.id !== del.id)); setDel(null) }

  const cols = [
    { k: "name", label: "Name", render: e => <span style={{ color: C.text, fontWeight: 600 }}>{e.name}</span> },
    { k: "email", label: "Email", render: e => <span style={{ color: C.blue }}>{e.email}</span> },
    { k: "gender", label: "Gender" },
    { k: "contact", label: "Contact" },
    { k: "role", label: "Role", render: e => <Badge text={e.role} color={e.role === "Admin" ? C.gold : e.role === "Manager" ? C.blue : C.green} /> },
    { k: "doj", label: "Joined" },
    { k: "salary", label: "Salary", render: e => <span style={{ color: C.green, fontWeight: 700 }}>{fmt(e.salary)}</span> },
  ]

  return (
    <div>
      <PageHead title="Employees" sub={`${emps.length} team members`}
        action={canEdit && <Btn onClick={openAdd}><I name="plus" size={14} /> Add Employee</Btn>} />
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <SearchBar value={q} onChange={setQ} placeholder="Search employees…" />
        <DataTable cols={cols} rows={filt} onEdit={openEd} onDelete={setDel} canEdit={canEdit} canDel={canEdit} />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={edit ? "Edit Employee" : "New Employee"} width={560}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div style={{ gridColumn: "1/-1" }}><TextInput label="Full Name" value={f.name} onChange={v => setF(x => ({ ...x, name: v }))} required /></div>
          <TextInput label="Email" type="email" value={f.email} onChange={v => setF(x => ({ ...x, email: v }))} required />
          <TextInput label="Contact" value={f.contact} onChange={v => setF(x => ({ ...x, contact: v }))} />
          <SelInput label="Gender" value={f.gender} onChange={v => setF(x => ({ ...x, gender: v }))} options={["Male", "Female", "Other"].map(x => ({ v: x, l: x }))} />
          <SelInput label="Role" value={f.role} onChange={v => setF(x => ({ ...x, role: v }))} options={["Admin", "Manager", "Staff"].map(x => ({ v: x, l: x }))} />
          <TextInput label="Date of Birth" type="date" value={f.dob} onChange={v => setF(x => ({ ...x, dob: v }))} />
          <TextInput label="Date of Joining" type="date" value={f.doj} onChange={v => setF(x => ({ ...x, doj: v }))} />
          <TextInput label="Salary (₹)" type="number" value={f.salary} onChange={v => setF(x => ({ ...x, salary: v }))} />
          <div style={{ gridColumn: "1/-1" }}><TextInput label="Address" value={f.addr} onChange={v => setF(x => ({ ...x, addr: v }))} /></div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
          <Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn>
          <Btn onClick={save}><I name="check" size={13} /> {edit ? "Update" : "Create"}</Btn>
        </div>
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} onOk={doDel} msg={`Delete "${del?.name}"?`} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SALES
// ─────────────────────────────────────────────────────────────────────────────
function Sales({ sales, setSales, products, setProducts, user }) {
  const [open, setOpen] = useState(false)
  const [del, setDel] = useState(null)
  const [f, setF] = useState({ pid: "", qty: 1, cust: "" })
  const [err, setErr] = useState("")
  const [unitPrice, setUnitPrice] = useState(0)
  const [isTiered, setIsTiered] = useState(false)

  useEffect(() => {
    if (f.pid && f.qty > 0) {
      const p = products.find(x => x.id === f.pid)
      if (p) {
        // In a real app, we'd fetch from /api/v1/products/{id}/price?qty={n}
        // For the demo, we'll simulate tiered pricing: 10+ units = 10% off
        const basePrice = p.price
        const tiered = f.qty >= 10
        const price = tiered ? basePrice * 0.9 : basePrice
        setUnitPrice(price)
        setIsTiered(tiered)
      }
    } else {
      setUnitPrice(0)
      setIsTiered(false)
    }
  }, [f.pid, f.qty, products])

  const rev = sales.reduce((a, s) => a + (s.total_price || 0), 0)
  const today_rev = sales.filter(s => new Date(s.date).toISOString().slice(0, 10) === today()).reduce((a, s) => a + (s.total_price || 0), 0)

  const save = async () => {
    setErr("")
    const p = products.find(x => x.id === f.pid)
    if (!p) return setErr("Select a product")
    if (+f.qty <= 0) return setErr("Quantity must be > 0")
    if (+f.qty > p.qty) return setErr(`Only ${p.qty} units in stock`)

    try {
      const res = await fetch("/api/v1/sales/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: p.id,
          qty: +f.qty,
          unit_price: unitPrice,
          total_price: +f.qty * unitPrice,
          customer: f.cust,
          sold_by: user.name
        })
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || "Failed to record sale")
      }

      const newSale = await res.json()
      setSales(ss => [newSale, ...ss])
      setProducts(ps => ps.map(x => x.id === p.id ? { ...x, qty: x.qty - +f.qty } : x))
      setOpen(false); setF({ pid: "", qty: 1, cust: "" })
    } catch (e) {
      setErr(e.message)
    }
  }
  const doDel = () => { setSales(ss => ss.filter(s => s.id !== del.id)); setDel(null) }

  const cols = [
    { k: "product_id", label: "Product", render: s => <span style={{ color: C.text, fontWeight: 600 }}>{products.find(p => p.id === s.product_id)?.name || "Unknown"}</span> },
    { k: "qty", label: "Qty", render: s => <Badge text={s.qty} color={C.blue} /> },
    { k: "unit_price", label: "Unit Price", render: s => fmt(s.unit_price) },
    { k: "total_price", label: "Total", render: s => <span style={{ color: C.green, fontWeight: 700 }}>{fmt(s.total_price)}</span> },
    { k: "customer", label: "Customer" },
    { k: "sold_by", label: "Sold By" },
    { k: "date", label: "Date", render: s => new Date(s.date).toLocaleDateString() },
  ]

  return (
    <div>
      <PageHead title="Sales" sub="Transaction history"
        action={<Btn onClick={() => { setErr(""); setOpen(true) }}><I name="plus" size={14} /> Record Sale</Btn>} />

      <div style={{ display: "flex", gap: 14, marginBottom: 22, flexWrap: "wrap" }}>
        <StatCard icon="dollar" label="Total Revenue" value={fmt(rev)} sub={`${sales.length} transactions`} color={C.green} />
        <StatCard icon="activity" label="Today's Revenue" value={fmt(today_rev)} sub="Today" color={C.gold} />
        <StatCard icon="trend" label="Avg Sale" value={fmt(sales.length ? Math.round(rev / sales.length) : 0)} sub="Per transaction" color={C.blue} />
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <DataTable cols={cols} rows={[...sales].reverse()} onEdit={() => { }} onDelete={setDel} canEdit={false} canDel={user.role === "admin"} />
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Record New Sale" width={420}>
        <SelInput label="Product" value={f.pid} onChange={v => setF(x => ({ ...x, pid: v }))}
          options={products.filter(p => p.qty > 0).map(p => ({ v: p.id, l: `${p.name} — ${p.qty} in stock (${fmt(p.price)})` }))} required />
        <TextInput label="Quantity" type="number" value={f.qty} onChange={v => setF(x => ({ ...x, qty: v }))} required />
        <TextInput label="Customer Contact" value={f.cust} onChange={v => setF(x => ({ ...x, cust: v }))} placeholder="Phone number" />
        {err && <Alert type="danger">{err}</Alert>}
        {f.pid && (
          <div style={{ background: C.bg, borderRadius: 8, padding: "12px 14px", marginBottom: 14, fontSize: 13, color: C.muted }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span>Unit Price:</span>
              <span>
                {isTiered && <span style={{ textDecoration: "line-through", marginRight: 8, fontSize: 11 }}>{fmt((products.find(p => p.id === f.pid)?.price) || 0)}</span>}
                <strong style={{ color: isTiered ? C.gold : C.text }}>{fmt(unitPrice)}</strong>
                {isTiered && <Badge text="10% Bulk Discount" color={C.gold} />}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${C.border}44`, paddingTop: 6 }}>
              <span>Estimated Total:</span>
              <strong style={{ color: C.green, fontSize: 15 }}>{fmt((+f.qty || 0) * unitPrice)}</strong>
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn>
          <Btn onClick={save}><I name="check" size={13} /> Record Sale</Btn>
        </div>
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} onOk={doDel} msg="Delete this sales record?" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AI CHATBOT
// ─────────────────────────────────────────────────────────────────────────────
function Chatbot({ products, emps, sups, cats, sales, user }) {
  const [msgs, setMsgs] = useState([{
    role: "assistant",
    text: `Hello ${user.name}! 👋 I'm your IMS Assistant, powered by Claude AI.\n\nI have live access to your inventory data. Ask me anything:\n• Stock levels and low-stock alerts\n• Sales summaries and trends\n• Employee or supplier info\n• How to use any system feature\n\nWhat would you like to know?`
  }])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [msgs])

  const send = async () => {
    if (!input.trim() || busy) return

    const userMsg = { role: "user", text: input.trim() }
    setMsgs(m => [...m, userMsg])
    setInput("")
    setBusy(true)

    try {
      const res = await fetch("/api/v1/chatbot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg.text
        })
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || "Server error")
      }

      const data = await res.json()
      const reply = data.reply || "Sorry, I couldn't process that."
      setMsgs(m => [...m, { role: "assistant", text: reply }])
    } catch (e) {
      setMsgs(m => [...m, { role: "assistant", text: `⚠️ Error: ${e.message}. Please ensure the backend is running and the GROQ_API_KEY is correctly set in the .env file.` }])
    }
    setBusy(false)
  }

  const QUICK = ["Show low stock items", "Today's sales total", "List all products", "How many employees?", "Top selling products"]

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 130px)" }}>
      <PageHead title="AI Assistant" sub="Groq-powered inventory intelligence" />


      <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Messages */}
        <div style={{ flex: 1, overflow: "auto", padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 10, justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              {m.role === "assistant" && (
                <div style={{ width: 30, height: 30, background: C.goldGlow, border: `1px solid ${C.gold}44`, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <I name="bot" size={15} color={C.gold} />
                </div>
              )}
              <div style={{
                maxWidth: "70%", padding: "11px 15px",
                background: m.role === "user" ? C.gold + "1a" : C.bg,
                border: `1px solid ${m.role === "user" ? C.gold + "44" : C.border}`,
                borderRadius: 10, color: C.text, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap"
              }}>{m.text}</div>
              {m.role === "user" && (
                <div style={{ width: 30, height: 30, background: C.blue + "22", border: `1px solid ${C.blue}44`, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: C.blue, fontWeight: 700, fontSize: 12 }}>
                  {user.initial}
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 30, height: 30, background: C.goldGlow, border: `1px solid ${C.gold}44`, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <I name="bot" size={15} color={C.gold} />
              </div>
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 15px", fontSize: 13, color: C.muted }}>
                Thinking<span style={{ animation: "pulse 1s infinite" }}>…</span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Quick prompts */}
        <div style={{ padding: "10px 18px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {QUICK.map(q => (
            <button key={q} onClick={() => setInput(q)}
              style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 20, padding: "5px 13px", fontSize: 11, color: C.dim, cursor: "pointer", transition: "border-color .12s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.gold}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
              {q}
            </button>
          ))}
          <button onClick={() => setMsgs([{ role: "assistant", text: "Conversation cleared." }])}
            style={{ marginLeft: "auto", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 20, padding: "5px 13px", fontSize: 11, color: C.dim, cursor: "pointer" }}>
            🗑️ Clear Chat
          </button>
        </div>

        {/* Input */}
        <div style={{ padding: "12px 18px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 10 }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Ask about inventory, sales, stock levels… (Enter to send)"
            style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9, padding: "11px 15px", color: C.text, fontSize: 13, outline: "none" }} />
          <button onClick={send} disabled={!input.trim() || busy}
            style={{ background: C.gold, border: "none", borderRadius: 9, padding: "11px 16px", cursor: "pointer", opacity: (!input.trim() || busy) ? 0.45 : 1, transition: "opacity .15s" }}>
            <I name="send" size={15} color="#000" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA UPLOADER
// ─────────────────────────────────────────────────────────────────────────────
function Uploader({ user, setProducts }) {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null)
  const [err, setErr] = useState("")

  const handleFile = (e) => {
    setFile(e.target.files[0])
    setRes(null)
    setErr("")
  }

  const upload = async () => {
    if (!file || busy) return
    setBusy(true); setErr(""); setRes(null)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch("/api/v1/uploader/upload", {
        method: "POST",
        body: formData
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || "Upload failed")
      }

      const data = await response.json()
      setRes(data)

      // Refresh products list
      const pRes = await fetch("/api/v1/products/")
      const pData = await pRes.json()
      setProducts(Array.isArray(pData) ? pData : [])
    } catch (e) {
      setErr(e.message)
    }
    setBusy(false)
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <PageHead title="Data Uploader" sub="Import inventory from CSV, Excel, JSON, or XML" />

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 30, textAlign: "center" }}>
        <div style={{ marginBottom: 20 }}>
          <I name="refresh" size={48} color={C.gold} style={{ opacity: 0.5, marginBottom: 15 }} />
          <h3 style={{ color: C.text, fontSize: 18, fontWeight: 700 }}>Select Data File</h3>
          <p style={{ color: C.dim, fontSize: 13 }}>Supported formats: .csv, .xlsx, .json, .xml</p>
        </div>

        <input type="file" onChange={handleFile} accept=".csv,.xlsx,.xls,.json,.xml"
          style={{ display: "none" }} id="file-upload" />

        <label htmlFor="file-upload" style={{
          display: "inline-flex", alignItems: "center", gap: 10, background: C.bg,
          border: `2px dashed ${C.border}`, borderRadius: 12, padding: "20px 40px",
          cursor: "pointer", transition: "border-color .2s", color: file ? C.gold : C.dim
        }} onMouseEnter={e => e.currentTarget.style.borderColor = C.gold}
          onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
          <I name="plus" size={20} />
          <span style={{ fontWeight: 600 }}>{file ? file.name : "Choose File"}</span>
        </label>

        <div style={{ marginTop: 24 }}>
          <Btn onClick={upload} disabled={!file || busy} full style={{ maxWidth: 200, margin: "0 auto" }}>
            {busy ? "Processing..." : "Start Upload"}
          </Btn>
        </div>

        {err && <div style={{ marginTop: 20 }}><Alert type="danger">{err}</Alert></div>}

        {res && (
          <div style={{ marginTop: 30, textAlign: "left", background: C.bg, borderRadius: 10, padding: 20, border: `1px solid ${C.green}44` }}>
            <h4 style={{ color: C.green, marginBottom: 15, display: "flex", alignItems: "center", gap: 8 }}>
              <I name="check" size={16} /> Upload Complete
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 15 }}>
              <div style={{ background: C.card, padding: 15, borderRadius: 8, border: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 11, color: C.dim, textTransform: "uppercase", fontWeight: 700 }}>Added</p>
                <p style={{ fontSize: 24, fontWeight: 800, color: C.text }}>{res.summary.added}</p>
              </div>
              <div style={{ background: C.card, padding: 15, borderRadius: 8, border: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 11, color: C.dim, textTransform: "uppercase", fontWeight: 700 }}>Updated</p>
                <p style={{ fontSize: 24, fontWeight: 800, color: C.text }}>{res.summary.updated}</p>
              </div>
              <div style={{ background: C.card, padding: 15, borderRadius: 8, border: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 11, color: C.dim, textTransform: "uppercase", fontWeight: 700 }}>Total Rows</p>
                <p style={{ fontSize: 24, fontWeight: 800, color: C.text }}>{res.total_rows}</p>
              </div>
            </div>
            {res.summary.errors.length > 0 && (
              <div style={{ marginTop: 15, color: C.red, fontSize: 12 }}>
                <strong>Errors:</strong>
                <ul style={{ paddingLeft: 20, marginTop: 5 }}>
                  {res.summary.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: 30 }}>
        <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700, marginBottom: 15 }}>Expected CSV Format</h3>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 15, overflow: "auto" }}>
          <code style={{ fontSize: 12, color: C.dim, whiteSpace: "pre" }}>
            name,sku,qty,price,brand{"\n"}
            iPhone 15,APL-IP15,50,79900,Apple{"\n"}
            Galaxy S24,SAM-S24,30,74999,Samsung
          </code>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState("dash")
  const [col, setCol] = useState(false)
  const [products, setProducts] = useState([])
  const [cats, setCats] = useState([])
  const [sups, setSups] = useState([])
  const [emps, setEmps] = useState([])
  const [sales, setSales] = useState([])

  useEffect(() => {
    if (!user) return

    // Initial data fetch
    const fetchAll = async () => {
      try {
        const [p, c, s, e, sl] = await Promise.all([
          fetch("/api/v1/products/").then(r => r.json()),
          fetch("/api/v1/categories/").then(r => r.json()),
          fetch("/api/v1/suppliers/").then(r => r.json()),
          fetch("/api/v1/employees/").then(r => r.json()),
          fetch("/api/v1/sales/").then(r => r.json())
        ])
        setProducts(Array.isArray(p) ? p : [])
        setCats(Array.isArray(c) ? c : [])
        setSups(Array.isArray(s) ? s : [])
        setEmps(Array.isArray(e) ? e : [])
        setSales(Array.isArray(sl) ? sl : [])
      } catch (err) {
        console.error("Failed to fetch initial data:", err)
      }
    }
    fetchAll()
  }, [user])

  if (!user) return <Login onLogin={setUser} />

  const pages = {
    dash: <Dashboard products={products} employees={emps} suppliers={sups} sales={sales} setPage={setPage} />,
    prods: <Products products={products} setProducts={setProducts} cats={cats} sups={sups} user={user} />,
    cats: <Categories cats={cats} setCats={setCats} products={products} user={user} />,
    sups: <Suppliers sups={sups} setSups={setSups} user={user} />,
    emps: <Employees emps={emps} setEmps={setEmps} user={user} />,
    sales: <Sales sales={sales} setSales={setSales} products={products} setProducts={setProducts} user={user} />,
    chat: <Chatbot products={products} emps={emps} sups={sups} cats={cats} sales={sales} user={user} />,
    upload: <Uploader user={user} setProducts={setProducts} />,
  }

  return (
    <div style={{
      display: "flex", minHeight: "100vh", background: C.bg, color: C.text,
      fontFamily: "'DM Sans',system-ui,sans-serif"
    }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:${C.bg};margin:0}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes spin{to{transform:rotate(360deg)}}
        select option{background:${C.card};color:${C.text}}
      `}</style>

      <Sidebar page={page} setPage={setPage} user={user} onLogout={() => setUser(null)} collapsed={col} setCollapsed={setCol} />

      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
        {/* Topbar */}
        <div style={{
          padding: "14px 30px", borderBottom: `1px solid ${C.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          position: "sticky", top: 0, background: C.bg + "f0", backdropFilter: "blur(12px)", zIndex: 5
        }}>
          <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>
            {NAV.find(n => n.id === page)?.label}
          </span>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px"
          }}>
            <div style={{
              width: 26, height: 26, background: "linear-gradient(135deg, #0066CC, #00ccff)", border: `1px solid ${C.gold}44`,
              borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
              color: "white", fontWeight: 800, fontSize: 11
            }}>{user.initial}</div>
            <span style={{ fontSize: 13, color: C.dim }}>{user.name}</span>
            <Badge text={user.role} color={user.role === "admin" ? C.gold : user.role === "manager" ? C.blue : C.green} />
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "26px 30px", flex: 1 }}>
          {pages[page]}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 30px", borderTop: `1px solid ${C.border}`,
          textAlign: "center", color: C.dim, fontSize: 13, background: C.card
        }}>
          &copy; {new Date().getFullYear()} Saksham Srivastava. All rights reserved. | Email: <a href="mailto:sakshamsrivastava7000@gmail.com" style={{ color: "#00ccff", textDecoration: "none" }}>sakshamsrivastava7000@gmail.com</a>
        </div>
      </div>
    </div>
  )
}
