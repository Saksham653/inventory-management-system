import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { AlertTriangle, ArrowDownRight, ArrowUpRight, IndianRupee, PackageCheck, Plus, TrendingUp, Wallet } from "lucide-react"
import { useApi } from "../lib/useApi"
import { dateTime, pctChange, rupees, rupeesShort } from "../lib/format"
import { CountUp } from "../lib/motion"
import { Alert, Button, PageHead, Pill, Segmented, Stat } from "../components/ui"

const CAT_COLORS = ["var(--teal)", "var(--orange)", "var(--blue)", "var(--violet)", "var(--coral)"]

function FlowTip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="tip">
      <div className="t">{d.full}</div>
      <div className="r"><span><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--teal)", marginRight: 6 }} />Sales</span><b>{rupees(d.revenue)}</b></div>
      <div className="r"><span><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--coral)", marginRight: 6 }} />Cost of goods</span><b>{rupees(d.cost)}</b></div>
      <div className="r" style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--line)" }}><span>Profit</span><b className="up">{rupees(d.revenue - d.cost)}</b></div>
    </div>
  )
}

function coverTone(r) {
  if (r.days_of_cover === null || r.qty <= 0) return "crit"
  return r.days_of_cover < r.lead_time ? "crit" : "warn"
}

export default function Dashboard({ setPage }) {
  const { data: d, loading, error } = useApi("/dashboard/stats")
  const [range, setRange] = useState("30d")
  const hour = new Date().getHours()
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  const flow = useMemo(() => {
    if (!d) return []
    if (range === "6m") return d.monthly_revenue.map(m => ({ label: m.month, full: `${m.month} ${m.year}${m.partial ? " · so far" : ""}`, revenue: m.revenue, cost: m.cost }))
    const days = range === "7d" ? d.daily.slice(-7) : d.daily
    return days.map(x => {
      const dt = new Date(x.date + "T00:00:00")
      return {
        label: dt.toLocaleDateString("en-IN", range === "7d" ? { weekday: "short" } : { day: "numeric" }),
        full: dt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }),
        revenue: x.revenue, cost: x.cost,
      }
    })
  }, [d, range])

  if (error) return <><PageHead title="Dashboard" /><Alert>{error}</Alert></>
  if (loading || !d) {
    return (
      <>
        <PageHead title={greet} sub="Pulling your numbers together…" />
        <div className="stats">{[0, 1, 2, 3].map(i => <div key={i} className="card stat"><div className="skeleton" style={{ height: 70 }} /></div>)}</div>
        <div className="card card-pad"><div className="skeleton" style={{ height: 280 }} /></div>
      </>
    )
  }

  const change = pctChange(d.revenue_30d, d.revenue_prev_30d)
  const margin = d.revenue_30d ? Math.round((d.gross_profit_30d / d.revenue_30d) * 100) : 0
  const catTotal = d.stock_value_by_category.reduce((a, c) => a + c.value, 0) || 1
  const flowTotal = flow.reduce((a, x) => a + x.revenue, 0)
  const flowAvg = flow.length ? flowTotal / flow.length : 0
  const markup = d.inventory_value_cost ? Math.round(((d.inventory_value_retail - d.inventory_value_cost) / d.inventory_value_cost) * 100) : 0

  return (
    <>
      <PageHead title={<><span className="grad">{greet}.</span></>} sub="Your shop at a glance: every figure is computed from recorded sales and stock movements.">
        <Button variant="primary" icon={Plus} onClick={() => setPage("sales")}>Record sale</Button>
      </PageHead>

      <div className="chips-row stagger">
        {d.stock_value_by_category.map((c, i) => (
          <span key={c.category} className="cat-chip" style={{ "--i": i }}>
            <i style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />{c.category}<b>{rupeesShort(c.value)}</b>
          </span>
        ))}
        <span className="cat-chip" style={{ "--i": d.stock_value_by_category.length }}>
          <i style={{ background: "var(--ink-3)" }} />Suppliers<b>{d.supplier_count}</b>
        </span>
      </div>

      <div className="stats">
        <div className="frame">
          <div className="card stat">
            <div className="label"><Wallet size={15} />Money in stock</div>
            <div className="value" style={{ fontSize: 30 }}><CountUp value={d.inventory_value_cost} format={rupees} /></div>
            <div className="sub">at cost · <span className="num" style={{ color: "var(--ink-2)" }}>{rupees(d.inventory_value_retail)}</span> to sell <span className="delta up">+{markup}%</span></div>
            <div style={{ display: "flex", height: 5, borderRadius: 99, overflow: "hidden", marginTop: 14, gap: 2 }}>
              {d.stock_value_by_category.map((c, i) => (
                <span key={c.category} title={`${c.category}: ${rupees(c.value)}`}
                  style={{ width: `${(c.value / catTotal) * 100}%`, background: CAT_COLORS[i % CAT_COLORS.length], borderRadius: 99, transformOrigin: "left", animation: `grow 1s var(--ease) both ${0.3 + i * 0.08}s` }} />
              ))}
            </div>
          </div>
        </div>
        <Stat icon={IndianRupee} label="Sales · 30 days" count={d.revenue_30d} format={rupees}
          sub={change === null ? `${d.sales_count_30d} sales` : <><span className={`delta ${change >= 0 ? "up" : "down"}`}>{change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(change)}%</span> vs previous 30 days</>} />
        <Stat icon={TrendingUp} label="Gross profit · 30 days" count={d.gross_profit_30d} format={rupees}
          sub={<><span className="delta up">{margin}%</span> margin on {d.sales_count_30d} sales</>} />
        <Stat icon={AlertTriangle} label="Needs reorder" count={d.at_risk.length}
          sub={`${d.low_stock_count} below minimum · ${d.product_count} products`} subClass={d.at_risk.length ? "down" : ""} />
      </div>

      <div className="grid-2">
        <div className="card card-pad">
          <div className="card-head">
            <div>
              <h3>Cash flow</h3>
              <div className="faint" style={{ fontSize: 12.5, marginTop: 4 }}>
                <span className="num" style={{ color: "var(--ink)", fontSize: 18 }}><CountUp value={flowTotal} format={rupees} duration={700} /></span>
                <span style={{ marginLeft: 8 }}>in sales</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div className="legend desktop-only"><span><i style={{ background: "var(--teal)" }} />Sales</span><span><i style={{ background: "var(--coral)" }} />Cost</span></div>
              <Segmented value={range} onChange={setRange} options={[{ value: "7d", label: "7 days" }, { value: "30d", label: "30 days" }, { value: "6m", label: "6 months" }]} />
            </div>
          </div>
          <div style={{ height: 270 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flow} barGap={3} barCategoryGap={range === "30d" ? "18%" : "28%"} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gTeal" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3cf0cd" /><stop offset="100%" stopColor="#0e9c84" /></linearGradient>
                  <linearGradient id="gCoral" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff6d71" /><stop offset="100%" stopColor="#a8323a" /></linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,.05)" strokeDasharray="2 6" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "var(--ink-3)", fontSize: 11.5 }} axisLine={false} tickLine={false} interval={range === "30d" ? 2 : 0} />
                <YAxis tick={{ fill: "var(--ink-3)", fontSize: 11.5 }} axisLine={false} tickLine={false} width={52} tickFormatter={rupeesShort} />
                <Tooltip content={<FlowTip />} cursor={{ fill: "rgba(255,255,255,.04)", radius: 6 }} />
                <ReferenceLine y={flowAvg} stroke="rgba(255,255,255,.28)" strokeDasharray="4 4"
                  label={{ value: `avg ${rupeesShort(flowAvg)}`, position: "insideTopLeft", fill: "var(--ink-3)", fontSize: 11 }} />
                <Bar dataKey="revenue" fill="url(#gTeal)" radius={[5, 5, 1, 1]} animationDuration={900} animationEasing="ease-out" />
                <Bar dataKey="cost" fill="url(#gCoral)" radius={[5, 5, 1, 1]} animationDuration={900} animationBegin={120} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card card-pad">
          <div className="card-head">
            <h3>Order before it runs out</h3>
            <Button size="sm" onClick={() => setPage("products")}>All products</Button>
          </div>
          {d.at_risk.length === 0 && (
            <div className="list-row"><span className="muted" style={{ display: "flex", gap: 8, alignItems: "center" }}><PackageCheck size={16} className="up" /> Stock covers every supplier's lead time.</span></div>
          )}
          {d.at_risk.map(r => {
            const tone = coverTone(r)
            const pct = r.days_of_cover === null ? 4 : Math.max(5, Math.min(100, (r.days_of_cover / ((r.lead_time || 1) * 2)) * 100))
            return (
              <div className="list-row" key={r.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="title">{r.name}</div>
                  <div className="meta">{r.qty} left · sells {r.avg_daily_sales}/day · {r.lead_time}-day lead</div>
                </div>
                <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                  <Pill tone={tone} dot>{r.days_of_cover === null ? "Out of stock" : `${r.days_of_cover} days left`}</Pill>
                  <div className="cover-bar"><span style={{ width: `${pct}%`, background: `var(--${tone})`, color: `var(--${tone})` }} /></div>
                </div>
              </div>
            )
          })}
          <p className="faint" style={{ fontSize: 12, marginTop: 14, lineHeight: 1.5 }}>
            Flagged when stock won't last until a new order arrives: days left &lt; supplier lead time + 3 days.
          </p>
        </div>
      </div>

      <div className="grid-2 even">
        <div className="card card-pad">
          <div className="card-head">
            <h3>Recent sales</h3>
            <Button size="sm" onClick={() => setPage("sales")}>View all</Button>
          </div>
          {d.recent_sales.length === 0 && <p className="faint">No sales recorded yet.</p>}
          {d.recent_sales.map(s => (
            <div className="list-row" key={s.id}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
                <span className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{(s.product_name || "?").slice(0, 2).toUpperCase()}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="title">{s.product_name} <span className="faint">× {s.qty}</span></div>
                  <div className="meta">{dateTime(s.date)} · {s.sold_by}</div>
                </div>
              </div>
              <span className="num up" style={{ fontWeight: 500 }}>+{rupees(s.total_price)}</span>
            </div>
          ))}
        </div>

        <div className="card card-pad">
          <div className="card-head"><h3>Where the money sits</h3><span className="faint" style={{ fontSize: 12 }}>stock at cost</span></div>
          {d.stock_value_by_category.length === 0 && <p className="faint">No stock with a cost price yet.</p>}
          {d.stock_value_by_category.map((c, i) => {
            const pct = (c.value / catTotal) * 100
            const color = CAT_COLORS[i % CAT_COLORS.length]
            return (
              <div key={c.category} style={{ padding: "10px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "var(--ink)" }}>{c.category}</span>
                  <span className="num">{rupees(c.value)} <span className="faint">{Math.round(pct)}%</span></span>
                </div>
                <div className="cover-bar" style={{ width: "100%", height: 6 }}>
                  <span style={{ width: `${pct}%`, background: color, color, animationDelay: `${0.3 + i * 0.1}s` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
