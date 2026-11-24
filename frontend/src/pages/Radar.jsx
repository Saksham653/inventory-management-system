import { useMemo, useState } from "react"
import { useApi } from "../lib/useApi"
import { rupees } from "../lib/format"
import { Alert, DataTable, PageHead, Pill, SearchBox, Segmented, Stat } from "../components/ui"
import { ExplainProduct, STATUS } from "../components/Explain"

const SORTS = {
  value: (a, b) => b.stock_value - a.stock_value,
  idle: (a, b) => b.days_idle - a.days_idle,
}

export default function Radar({ openLedger }) {
  const { data: r, loading, error } = useApi("/radar/")
  const [filter, setFilter] = useState("all")
  const [q, setQ] = useState("")
  const [explain, setExplain] = useState(null)

  const rows = useMemo(() => {
    if (!r) return []
    return r.items
      .filter(i => filter === "all" || (filter === "stuck" ? ["dead", "slow"].includes(i.status) : i.status === filter))
      .filter(i => !q || i.name.toLowerCase().includes(q.toLowerCase()) || i.sku.toLowerCase().includes(q.toLowerCase()))
      .sort(SORTS.value)
  }, [r, filter, q])

  const counts = r ? {
    all: r.items.length,
    stuck: r.dead.length + r.slow.length,
    reorder: r.reorder.length,
    healthy: r.items.filter(i => i.status === "healthy").length,
  } : {}

  const cols = [
    { key: "name", label: "Product", render: i => <div><div className="strong">{i.name}</div><div className="faint" style={{ fontSize: 12 }}>{[i.category, i.supplier].filter(Boolean).join(" · ")}</div></div> },
    { key: "status", label: "Status", render: i => <Pill tone={STATUS[i.status].tone} dot>{STATUS[i.status].label}</Pill> },
    { key: "stock_value", label: "Money in stock", align: "right", render: i => <span className="num" style={{ color: "var(--ink)" }}>{rupees(i.stock_value)}</span> },
    { key: "days_idle", label: "Last sold", align: "right", render: i => <span className={`num ${i.days_idle >= r.rules.dead_days ? "down" : ""}`}>{i.never_sold ? "never" : `${i.days_idle}d ago`}</span> },
    { key: "daily_rate", label: "Sells / day", align: "right", render: i => <span className="num">{i.daily_rate || "—"}</span> },
    { key: "cover", label: "Days left", align: "right", render: i => <span className="num">{i.days_of_cover ?? "—"}</span> },
    { key: "weeks", label: "Weeks of stock", align: "right", render: i => <span className="num">{i.weeks_of_stock ?? "—"}</span> },
    { key: "suggested", label: "Order", align: "right", render: i => i.suggested_qty ? <span className="num up">+{i.suggested_qty}</span> : <span className="faint">—</span> },
    { key: "open", label: "", render: i => <button className="btn sm ghost" onClick={() => setExplain(i)}>Why?</button> },
  ]

  return (
    <>
      <PageHead title="Paisa Radar" sub="Every product counted in rupees: how much money it holds, how long since it sold, and whether to reorder." />
      <Alert>{error}</Alert>
      {r && (
        <div className="stats">
          <Stat label="Money in stock" count={r.totals.inventory_value} format={rupees} sub="at cost price" />
          <Stat label="Stuck (60+ days unsold)" count={r.totals.stuck_value} format={rupees} subClass="down"
            sub={r.totals.inventory_value ? `${Math.round((r.totals.stuck_value / r.totals.inventory_value) * 100)}% of stock value` : ""} />
          <Stat label="Sales at risk" count={r.totals.at_risk_value} format={rupees} sub={`${r.reorder.length} to reorder`} />
          <Stat label="Suggested orders" count={r.totals.reorder_cost} format={rupees} sub="at current cost prices" />
        </div>
      )}
      <div className="card">
        <div className="toolbar">
          <Segmented value={filter} onChange={setFilter} options={[
            { value: "all", label: `All ${counts.all ?? ""}` },
            { value: "stuck", label: `Stuck ${counts.stuck ?? ""}` },
            { value: "reorder", label: `Reorder ${counts.reorder ?? ""}` },
            { value: "healthy", label: `Healthy ${counts.healthy ?? ""}` },
          ]} />
          <SearchBox value={q} onChange={setQ} placeholder="Search products" />
        </div>
        <DataTable cols={cols} rows={rows} loading={loading} empty="No products in this view" />
      </div>
      {r && <ExplainProduct item={explain} rules={r.rules} onClose={() => setExplain(null)} openLedger={openLedger} />}
    </>
  )
}
