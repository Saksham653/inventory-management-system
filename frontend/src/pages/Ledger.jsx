import { useApi } from "../lib/useApi"
import { dateTime, rupees } from "../lib/format"
import { Alert, DataTable, PageHead, Pill, Select } from "../components/ui"

const TYPES = {
  opening: { label: "Opening stock", tone: "info" },
  purchase: { label: "Stock in", tone: "ok" },
  sale: { label: "Sale", tone: "" },
  adjust: { label: "Correction", tone: "warn" },
  return: { label: "Return", tone: "ok" },
  void: { label: "Sale voided", tone: "warn" },
}

export default function Ledger({ productId, setProductId }) {
  const products = useApi("/products/", [])
  const path = `/stock/movements?limit=500${productId ? `&product_id=${productId}` : ""}`
  const { data, loading, error } = useApi(path, [])
  const product = products.data.find(p => p.id === productId)

  const cols = [
    { key: "created_at", label: "When", render: m => <span className="muted">{dateTime(m.created_at)}</span> },
    { key: "product_name", label: "Product", render: m => <span className="strong">{m.product_name}</span> },
    { key: "type", label: "What", render: m => <Pill tone={TYPES[m.type]?.tone}>{TYPES[m.type]?.label || m.type}</Pill> },
    { key: "qty_change", label: "Change", align: "right", render: m => <span className={`num ${m.qty_change > 0 ? "up" : "down"}`} style={{ fontWeight: 600 }}>{m.qty_change > 0 ? "+" : "−"}{Math.abs(m.qty_change)}</span> },
    { key: "qty_after", label: "Stock after", align: "right", render: m => <span className="num">{m.qty_after}</span> },
    { key: "unit_cost", label: "Cost each", align: "right", render: m => m.unit_cost ? <span className="num faint">{rupees(m.unit_cost)}</span> : <span className="faint">—</span> },
    { key: "note", label: "Note", render: m => <span className="muted">{m.note || (m.ref_type === "sale" ? `Sale #${m.ref_id}` : "—")}</span> },
    { key: "user_name", label: "By", render: m => m.user_name || <span className="faint">System</span> },
  ]

  return (
    <>
      <PageHead title="Stock ledger"
        sub={product
          ? `Every change to ${product.name}. Current stock ${product.qty} ${product.unit} equals the sum of these rows.`
          : "Every stock change, newest first. Stock levels are the sum of these entries, so nothing changes without a trace."}>
        <div style={{ minWidth: 240 }}>
          <Select value={productId || ""} onChange={v => setProductId(v ? +v : null)} placeholder="All products"
            options={products.data.map(p => ({ value: p.id, label: p.name }))} aria-label="Filter by product" />
        </div>
      </PageHead>
      <Alert>{error}</Alert>
      <div className="card">
        <DataTable cols={cols} rows={data} loading={loading} empty="No stock movements yet" />
      </div>
    </>
  )
}
