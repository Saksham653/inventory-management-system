import { useMemo, useState } from "react"
import { BookOpenText, PackagePlus, Plus } from "lucide-react"
import { api } from "../lib/api"
import { useAuth } from "../lib/auth"
import { useApi } from "../lib/useApi"
import { useToast } from "../lib/motion"
import { rupees } from "../lib/format"
import { Alert, Button, Confirm, DataTable, Input, Modal, PageHead, Pill, SearchBox, Select, useForm } from "../components/ui"

const EMPTY = { name: "", sku: "", brand: "", category_id: "", supplier_id: "", qty: 0, price: "", cost_price: "", unit: "pcs", min_stock: 5, lead_time_days: 3 }

function toBody(v, includeQty) {
  const body = {
    name: v.name.trim(), sku: v.sku.trim(), brand: v.brand || null,
    category_id: v.category_id ? +v.category_id : null, supplier_id: v.supplier_id ? +v.supplier_id : null,
    price: +v.price || 0, cost_price: +v.cost_price || 0, unit: v.unit || "pcs",
    min_stock: +v.min_stock || 0, lead_time_days: +v.lead_time_days || 0,
  }
  if (includeQty) body.qty = +v.qty || 0
  return body
}

function StockCover({ risk }) {
  if (!risk) return <span className="faint">—</span>
  if (risk.qty <= 0) return <Pill tone="crit" dot>Out of stock</Pill>
  if (risk.days_of_cover === null) return <Pill dot>No recent sales</Pill>
  return <Pill tone={risk.at_risk ? (risk.days_of_cover < risk.lead_time ? "crit" : "warn") : "ok"} dot>{risk.days_of_cover} days</Pill>
}

function StockInModal({ product, onClose, onDone }) {
  const toast = useToast()
  const [type, setType] = useState("purchase")
  const [qty, setQty] = useState("")
  const [cost, setCost] = useState(product?.cost_price || "")
  const [note, setNote] = useState("")
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  if (!product) return null
  const signed = type === "adjust" ? +qty : Math.abs(+qty)

  const save = async () => {
    setErr("")
    if (!qty || +qty === 0) return setErr("Enter how many units changed")
    setBusy(true)
    try {
      await api("/stock/adjust", {
        method: "POST",
        body: { product_id: product.id, qty_change: signed, type, unit_cost: type === "purchase" && cost !== "" ? +cost : null, note: note || null },
      })
      onDone()
      onClose()
      toast(`${product.name}: stock ${signed > 0 ? "+" : "−"}${Math.abs(signed)}, now ${product.qty + signed}`)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Update stock · ${product.name}`} width={440}>
      <p className="muted" style={{ marginBottom: 14 }}>Now in stock: <b className="num">{product.qty}</b> {product.unit}. Every change is saved to the stock ledger.</p>
      <Select label="What happened?" value={type} onChange={setType} placeholder="Choose…"
        options={[
          { value: "purchase", label: "Stock arrived from supplier" },
          { value: "return", label: "Customer returned items" },
          { value: "adjust", label: "Correction after counting" },
        ]} />
      <Input label={type === "adjust" ? "Change (use − for fewer, e.g. −2)" : "Units received"} type="number" value={qty} onChange={setQty} />
      {type === "purchase" && <Input label="Cost per unit (₹)" type="number" value={cost} onChange={setCost} hint="Updates the product's cost price" />}
      <Input label="Note (optional)" value={note} onChange={setNote} placeholder={type === "purchase" ? "Bill number, supplier…" : "Reason"} />
      {qty !== "" && +qty !== 0 && <p className="faint" style={{ marginBottom: 12 }}>New stock will be <b className="num">{product.qty + signed}</b>.</p>}
      <Alert>{err}</Alert>
      <div className="form-actions">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={busy} onClick={save}>Save to ledger</Button>
      </div>
    </Modal>
  )
}

export default function Products({ openLedger }) {
  const { can } = useAuth()
  const toast = useToast()
  const products = useApi("/products/", [])
  const risk = useApi("/products/replenishment-risk", [])
  const cats = useApi("/categories/", [])
  const sups = useApi("/suppliers/", [])
  const [q, setQ] = useState("")
  const [editing, setEditing] = useState(null) // null | "new" | product
  const [stockFor, setStockFor] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  const { values: f, setValues, set } = useForm(EMPTY)

  const riskById = useMemo(() => Object.fromEntries(risk.data.map(r => [r.id, r])), [risk.data])
  const catName = id => cats.data.find(c => c.id === id)?.name
  const reload = () => { products.reload(); risk.reload() }

  const rows = products.data.filter(p => {
    const s = q.toLowerCase()
    return !s || p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || (p.brand || "").toLowerCase().includes(s)
  })
  const stockValue = products.data.reduce((a, p) => a + p.qty * (p.cost_price || 0), 0)
  const low = products.data.filter(p => p.qty <= p.min_stock).length

  const openNew = () => { setErr(""); setValues(EMPTY); setEditing("new") }
  const openEdit = p => {
    setErr("")
    setValues({ ...EMPTY, ...p, brand: p.brand || "", category_id: p.category_id ?? "", supplier_id: p.supplier_id ?? "" })
    setEditing(p)
  }
  const save = async () => {
    setErr("")
    if (!f.name.trim() || !f.sku.trim() || f.price === "") return setErr("Name, SKU and selling price are required")
    setBusy(true)
    try {
      if (editing === "new") await api("/products/", { method: "POST", body: toBody(f, true) })
      else await api(`/products/${editing.id}`, { method: "PATCH", body: toBody(f, false) })
      toast(editing === "new" ? `Added ${f.name.trim()}` : `Saved ${f.name.trim()}`)
      setEditing(null)
      reload()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  const cols = [
    { key: "name", label: "Product", render: p => <div><div className="strong">{p.name}</div><div className="faint" style={{ fontSize: 12 }}>{[p.brand, catName(p.category_id)].filter(Boolean).join(" · ") || "—"}</div></div> },
    { key: "sku", label: "SKU", render: p => <span className="code-chip">{p.sku}</span> },
    { key: "qty", label: "In stock", align: "right", render: p => <span className={`num ${p.qty <= p.min_stock ? "down" : ""}`} style={{ fontWeight: 600 }}>{p.qty} <span className="faint" style={{ fontWeight: 400 }}>{p.unit}</span></span> },
    { key: "cover", label: "Lasts", render: p => <StockCover risk={riskById[p.id]} /> },
    { key: "price", label: "Price", align: "right", render: p => <span className="num">{rupees(p.price)}</span> },
    { key: "margin", label: "Margin", align: "right", render: p => p.cost_price ? <span className="num">{Math.round(((p.price - p.cost_price) / p.price) * 100)}%</span> : <span className="faint">add cost</span> },
    { key: "value", label: "Stock value", align: "right", render: p => <span className="num">{rupees(p.qty * (p.cost_price || 0))}</span> },
    {
      key: "tools", label: "", render: p => (
        <div className="row-actions">
          {can.manage && <Button size="sm" icon={PackagePlus} onClick={() => setStockFor(p)}>Stock</Button>}
          <button className="icon-btn" onClick={() => openLedger(p.id)} aria-label={`Stock history for ${p.name}`} title="Stock history"><BookOpenText size={15} /></button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHead title="Products" sub={`${products.data.length} products · ${low} low on stock · ${rupees(stockValue)} in stock at cost`}>
        {can.manage && <Button variant="primary" icon={Plus} onClick={openNew}>Add product</Button>}
      </PageHead>
      <Alert>{products.error}</Alert>
      <div className="card">
        <div className="toolbar"><SearchBox value={q} onChange={setQ} placeholder="Search name, SKU or brand" /></div>
        <DataTable cols={cols} rows={rows} loading={products.loading}
          empty={q ? "No products match your search" : "No products yet. Add one or import a spreadsheet."}
          onEdit={can.manage ? openEdit : undefined} onDelete={can.admin ? setDeleting : undefined} />
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Add product" : "Edit product"} width={600}>
        <div className="form-grid">
          <Input className="full" label="Product name" value={f.name} onChange={set("name")} />
          <Input label="SKU" value={f.sku} onChange={set("sku")} />
          <Input label="Brand" value={f.brand} onChange={set("brand")} />
          <Select label="Category" value={f.category_id} onChange={set("category_id")} placeholder="None" options={cats.data.map(c => ({ value: c.id, label: c.name }))} />
          <Select label="Supplier" value={f.supplier_id} onChange={set("supplier_id")} placeholder="None" options={sups.data.map(s => ({ value: s.id, label: s.name }))} />
          <Input label="Selling price (₹)" type="number" min="0" value={f.price} onChange={set("price")} />
          <Input label="Cost price (₹)" type="number" min="0" value={f.cost_price} onChange={set("cost_price")} hint="What you pay the supplier" />
          {editing === "new"
            ? <Input label="Opening stock" type="number" min="0" value={f.qty} onChange={set("qty")} />
            : <div className="field"><label>Stock</label><p className="faint" style={{ paddingTop: 8 }}>Use the Stock button to change quantity, so it's recorded in the ledger.</p></div>}
          <Input label="Unit" value={f.unit} onChange={set("unit")} placeholder="pcs, kg, box" />
          <Input label="Minimum stock" type="number" min="0" value={f.min_stock} onChange={set("min_stock")} />
          <Input label="Supplier lead time (days)" type="number" min="0" value={f.lead_time_days} onChange={set("lead_time_days")} />
        </div>
        <Alert>{err}</Alert>
        <div className="form-actions">
          <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={save}>{editing === "new" ? "Add product" : "Save changes"}</Button>
        </div>
      </Modal>

      {stockFor && <StockInModal product={stockFor} onClose={() => setStockFor(null)} onDone={reload} />}

      <Confirm open={!!deleting} onClose={() => setDeleting(null)} title="Delete product?"
        message={`${deleting?.name} and its stock history will be removed. Products with sales can't be deleted.`}
        onConfirm={async () => { await api(`/products/${deleting.id}`, { method: "DELETE" }); toast(`Deleted ${deleting.name}`); reload() }} />
    </>
  )
}
