import { useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { api } from "../lib/api"
import { useAuth } from "../lib/auth"
import { useApi } from "../lib/useApi"
import { useToast } from "../lib/motion"
import { dateTime, rupees } from "../lib/format"
import { Alert, Button, Confirm, DataTable, Input, Modal, PageHead, Pill, SearchBox, Select, Stat } from "../components/ui"

function SaleModal({ open, onClose, products, onDone }) {
  const toast = useToast()
  const [pid, setPid] = useState("")
  const [qty, setQty] = useState(1)
  const [customer, setCustomer] = useState("")
  const [quote, setQuote] = useState(null)
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  const product = products.find(p => p.id === +pid)

  useEffect(() => { if (open) { setPid(""); setQty(1); setCustomer(""); setErr(""); setQuote(null) } }, [open])

  useEffect(() => {
    if (!product || !(+qty > 0)) { setQuote(null); return }
    let live = true
    api(`/products/${product.id}/price?qty=${+qty}`).then(q => live && setQuote(q)).catch(() => live && setQuote(null))
    return () => { live = false }
  }, [product, qty])

  const unit = quote?.unit_price ?? product?.price ?? 0
  const save = async () => {
    setErr("")
    if (!product) return setErr("Choose a product")
    if (!(+qty > 0)) return setErr("Quantity must be at least 1")
    if (+qty > product.qty) return setErr(`Only ${product.qty} in stock`)
    setBusy(true)
    try {
      await api("/sales/", { method: "POST", body: { product_id: product.id, qty: +qty, customer: customer || null } })
      onDone()
      onClose()
      toast(`Sale recorded · ${qty} × ${product.name} · ${rupees(unit * +qty)}`)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Record a sale" width={440}>
      <Select label="Product" value={pid} onChange={setPid} placeholder="Choose a product"
        options={products.filter(p => p.qty > 0).map(p => ({ value: p.id, label: `${p.name} · ${p.qty} in stock` }))} />
      <Input label="Quantity" type="number" min="1" value={qty} onChange={setQty} />
      <Input label="Customer phone (optional)" type="tel" value={customer} onChange={setCustomer} />
      {product && (
        <div className="card" style={{ padding: "12px 14px", marginBottom: 14, background: "var(--sunk)", border: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="muted">Price each</span>
            <span className="num">{quote?.is_tiered && <s className="faint" style={{ marginRight: 6 }}>{rupees(product.price)}</s>}{rupees(unit)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontWeight: 600 }}>
            <span>Total</span><span className="num up">{rupees(unit * (+qty || 0))}</span>
          </div>
        </div>
      )}
      <Alert>{err}</Alert>
      <div className="form-actions">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={busy} onClick={save}>Record sale</Button>
      </div>
    </Modal>
  )
}

export default function Sales() {
  const { can } = useAuth()
  const toast = useToast()
  const sales = useApi("/sales/", [])
  const products = useApi("/products/", [])
  const [open, setOpen] = useState(false)
  const [voiding, setVoiding] = useState(null)
  const [q, setQ] = useState("")

  const now = Date.now()
  const today = new Date().toDateString()
  const last30 = sales.data.filter(s => now - new Date(s.date) < 30 * 864e5)
  const rev30 = last30.reduce((a, s) => a + s.total_price, 0)
  const profit30 = last30.reduce((a, s) => a + s.total_price - s.qty * (s.unit_cost || 0), 0)
  const todayRev = sales.data.filter(s => new Date(s.date).toDateString() === today).reduce((a, s) => a + s.total_price, 0)
  const rows = sales.data.filter(s => {
    const t = q.toLowerCase()
    return !t || (s.product_name || "").toLowerCase().includes(t) || (s.customer || "").includes(t) || (s.sold_by || "").toLowerCase().includes(t)
  })

  const cols = [
    { key: "date", label: "When", render: s => <span className="muted">{dateTime(s.date)}</span> },
    { key: "product_name", label: "Product", render: s => <span className="strong">{s.product_name || "Deleted product"}</span> },
    { key: "qty", label: "Qty", align: "right", render: s => <span className="num">{s.qty}</span> },
    { key: "unit_price", label: "Price each", align: "right", render: s => <span className="num">{rupees(s.unit_price)}</span> },
    { key: "total_price", label: "Total", align: "right", render: s => <span className="num up" style={{ fontWeight: 600 }}>{rupees(s.total_price)}</span> },
    { key: "profit", label: "Profit", align: "right", render: s => s.unit_cost ? <span className="num">{rupees(s.total_price - s.qty * s.unit_cost)}</span> : <span className="faint">—</span> },
    { key: "customer", label: "Customer", render: s => s.customer || <span className="faint">—</span> },
    { key: "sold_by", label: "Sold by", render: s => <Pill>{s.sold_by}</Pill> },
  ]

  return (
    <>
      <PageHead title="Sales" sub="Every sale takes stock out through the ledger.">
        <Button variant="primary" icon={Plus} onClick={() => setOpen(true)}>Record sale</Button>
      </PageHead>
      <div className="stats">
        <Stat label="Today" value={rupees(todayRev)} />
        <Stat label="Last 30 days" value={rupees(rev30)} sub={`${last30.length} sales`} />
        <Stat label="Profit, last 30 days" value={rupees(profit30)} sub={rev30 ? `${Math.round((profit30 / rev30) * 100)}% margin` : ""} />
        <Stat label="Average sale" value={rupees(last30.length ? rev30 / last30.length : 0)} sub="last 30 days" />
      </div>
      <Alert>{sales.error}</Alert>
      <div className="card">
        <div className="toolbar"><SearchBox value={q} onChange={setQ} placeholder="Search product, customer or seller" /></div>
        <DataTable cols={cols} rows={rows} loading={sales.loading} empty="No sales yet"
          onDelete={can.admin ? s => setVoiding({ ...s, name: s.product_name }) : undefined} />
      </div>
      <SaleModal open={open} onClose={() => setOpen(false)} products={products.data} onDone={() => { sales.reload(); products.reload() }} />
      <Confirm open={!!voiding} onClose={() => setVoiding(null)} title="Void this sale?" confirmLabel="Void sale"
        message={`${voiding?.qty} × ${voiding?.product_name} will go back into stock. The ledger keeps a record of the void.`}
        onConfirm={async () => { await api(`/sales/${voiding.id}`, { method: "DELETE" }); toast("Sale voided, stock returned"); sales.reload(); products.reload() }} />
    </>
  )
}
