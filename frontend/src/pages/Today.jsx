import { useRef, useState } from "react"
import { ArrowDownRight, ArrowUpRight, ClipboardList, HelpCircle, PackageCheck, Repeat2, ShieldAlert, Sparkles, Wallet } from "lucide-react"
import { api } from "../lib/api"
import { useAuth } from "../lib/auth"
import { useApi } from "../lib/useApi"
import { pctChange, rupees, rupeesShort } from "../lib/format"
import { CountUp, useToast } from "../lib/motion"
import { Alert, Button, Pill, Stat } from "../components/ui"
import { ExplainHeadline, ExplainProduct } from "../components/Explain"

const BUCKET_COLORS = ["var(--teal)", "var(--blue)", "var(--amber)", "var(--coral)"]
const ACTION_ICONS = { reorder: ClipboardList, discount: Sparkles, bundle: Repeat2, return: ArrowDownRight, stop: ShieldAlert }

function coverTone(it) {
  if (it.qty <= 0) return "crit"
  return it.days_of_cover != null && it.days_of_cover < it.lead_time ? "crit" : "warn"
}

export default function Today({ setPage, openLedger }) {
  const { user, can } = useAuth()
  const toast = useToast()
  const { data: r, loading, error } = useApi("/radar/")
  const [explain, setExplain] = useState(null)
  const [explainHead, setExplainHead] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [draftErr, setDraftErr] = useState("")
  const clearRef = useRef(null)

  const hour = new Date().getHours()
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })

  if (error) return <Alert>{error}</Alert>
  if (loading || !r) {
    return (
      <>
        <div className="eyebrow" style={{ marginBottom: 14 }}>{today} · Paisa Radar</div>
        <div className="card card-pad" style={{ marginBottom: 14 }}><div className="skeleton" style={{ height: 180 }} /></div>
        <div className="grid-2 even"><div className="card card-pad"><div className="skeleton" style={{ height: 220 }} /></div><div className="card card-pad"><div className="skeleton" style={{ height: 220 }} /></div></div>
      </>
    )
  }

  const t = r.totals
  const h = r.headline
  const weekChange = pctChange(t.sales_this_week, t.sales_last_week)
  const stuckList = [...r.dead, ...r.slow]
  const toClear = stuckList.reduce((a, x) => a + x.stock_value, 0)

  const draftPOs = async () => {
    setDraftErr("")
    setDrafting(true)
    try {
      const res = await api("/purchase-orders/draft-from-radar", { method: "POST", body: {} })
      toast(`Drafted ${res.orders.length} purchase order${res.orders.length > 1 ? "s" : ""} · ${rupees(res.orders.reduce((a, o) => a + o.total, 0))}`)
      setPage("orders")
    } catch (e) { setDraftErr(e.message) } finally { setDrafting(false) }
  }

  return (
    <>
      <div className="eyebrow" style={{ marginBottom: 14 }}>{today} · {greet}, {user.name.split(" ")[0]}</div>

      <div className="today-top">
        <div className="frame">
          <section className="card hero-card">
            <div className="hero-kicker"><Wallet size={15} /> Paisa Radar</div>
            <h1 className="hero-line">
              <span className={`amt ${h.tone}`}><CountUp value={h.amount} format={rupees} duration={1400} /></span> {h.text}
            </h1>
            <p className="hero-detail">{h.detail}</p>

            <div className="agebar" role="img" aria-label="Money in stock by days since last sale">
              {r.buckets.map((b, i) => b.value > 0 && (
                <div key={b.label} style={{ flexGrow: b.value, background: BUCKET_COLORS[i], animationDelay: `${0.35 + i * 0.12}s` }} title={`${b.label}: ${rupees(b.value)}`}>
                  <span>{rupeesShort(b.value)}</span>
                </div>
              ))}
            </div>
            <div className="agekey">
              {r.buckets.map((b, i) => (
                <div key={b.label}><span><i style={{ background: BUCKET_COLORS[i] }} />{b.label}</span><b className="num">{rupees(b.value)}</b></div>
              ))}
            </div>
            <div className="hero-actions">
              {stuckList.length > 0 && <Button variant="primary" onClick={() => clearRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}>See ways to free {rupeesShort(toClear)}</Button>}
              <Button icon={HelpCircle} onClick={() => setExplainHead(true)}>How is this calculated?</Button>
            </div>
          </section>
        </div>

        <div className="kpi-grid">
          <Stat label="Sales this week" count={t.sales_this_week} format={rupees}
            sub={weekChange === null ? "last 7 days" : <><span className={`delta ${weekChange >= 0 ? "up" : "down"}`}>{weekChange >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(weekChange)}%</span> vs last week</>} />
          <Stat label="Sales at risk" count={t.at_risk_value} format={rupees} className={t.at_risk_value > 0 ? "risk" : ""}
            sub={r.reorder.length ? `${r.reorder.length} product${r.reorder.length > 1 ? "s" : ""} running low` : "nothing running low"} />
          <Stat label="Money in stock" count={t.inventory_value} format={rupees} sub={`${rupees(t.inventory_retail)} at selling price`} />
          <Stat label="Stock turns · 90 days" count={t.stock_turns_90d} format={v => `${v.toFixed(1)}×`}
            sub={t.stock_turns_90d >= 3 ? "healthy pace" : "stock is moving slowly"} />
        </div>
      </div>

      {r.actions.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 14 }}>
          <div className="card-head" style={{ marginBottom: 10 }}><h3>Do these first</h3><span className="faint" style={{ fontSize: 12.5 }}>ranked by rupees at stake</span></div>
          <div className="actions-strip stagger">
            {r.actions.map((a, i) => {
              const Icon = ACTION_ICONS[a.kind] || Sparkles
              return (
                <button key={a.label} className="action" style={{ "--i": i }}
                  onClick={() => a.product_id ? setExplain(r.items.find(x => x.id === a.product_id)) : document.getElementById("reorder-card")?.scrollIntoView({ behavior: "smooth", block: "center" })}>
                  <span className="rank num">{i + 1}</span>
                  <Icon size={16} />
                  <span className="a-label">{a.label}</span>
                  <span className="a-value num">{a.value > 0 ? rupeesShort(a.value) : ""}<small>{a.value > 0 ? a.value_label : ""}</small></span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid-2 even">
        <div className="card card-pad" id="reorder-card">
          <div className="card-head">
            <div>
              <h3>Order before it runs out</h3>
              {r.reorder.length > 0 && <div className="faint" style={{ fontSize: 12.5, marginTop: 4 }}>Suggested orders cost <span className="num" style={{ color: "var(--ink)" }}>{rupees(t.reorder_cost)}</span></div>}
            </div>
            {can.manage && r.reorder.length > 0 && <Button variant="primary" size="sm" icon={ClipboardList} loading={drafting} onClick={draftPOs}>Draft purchase orders</Button>}
          </div>
          <Alert>{draftErr}</Alert>
          {r.reorder.length === 0 && <div className="list-row"><span className="muted" style={{ display: "flex", gap: 8, alignItems: "center" }}><PackageCheck size={16} className="up" />Everything lasts until the next delivery.</span></div>}
          {r.reorder.map(it => {
            const tone = coverTone(it)
            const pct = it.days_of_cover == null ? 4 : Math.max(5, Math.min(100, (it.days_of_cover / ((it.lead_time + r.rules.safety_days) * 1.5)) * 100))
            return (
              <button className="list-row row-btn" key={it.id} onClick={() => setExplain(it)}>
                <div style={{ minWidth: 0, textAlign: "left" }}>
                  <div className="title">{it.name}</div>
                  <div className="meta">{it.supplier || "No supplier"} · {it.lead_time}-day lead time</div>
                </div>
                <div className="cover-col">
                  <div className="cover-bar"><span style={{ width: `${pct}%`, background: `var(--${tone})`, color: `var(--${tone})` }} /></div>
                  <div className="cover-l num">{it.qty} left · {it.days_of_cover != null ? `${it.days_of_cover} days` : "out"}</div>
                </div>
                <div className="sugg num">+{it.suggested_qty}<small>{rupeesShort(it.suggested_cost)}</small></div>
              </button>
            )
          })}
          <p className="faint" style={{ fontSize: 12, marginTop: 12 }}>Suggested quantity covers lead time + {r.rules.target_cover_days} days at the last {r.rules.velocity_days} days' pace. Tap a row to see the maths.</p>
        </div>

        <div className="card card-pad" ref={clearRef}>
          <div className="card-head">
            <h3>Slow stock to clear</h3>
            <span className="num" style={{ color: "var(--coral)" }}>{rupees(toClear)}</span>
          </div>
          {stuckList.length === 0 && <div className="list-row"><span className="muted" style={{ display: "flex", gap: 8, alignItems: "center" }}><PackageCheck size={16} className="up" />Nothing is stuck. Everything sold in the last {r.rules.dead_days} days.</span></div>}
          {stuckList.map(it => (
            <div className="stuck" key={it.id}>
              <button className="stuck-head row-btn" onClick={() => setExplain(it)}>
                <div style={{ textAlign: "left", minWidth: 0 }}>
                  <div className="title">{it.name} <span className="faint">× {it.qty}</span></div>
                  <div className="meta">{it.never_sold ? `Never sold · stocked ${it.days_idle} days ago` : it.status === "dead" ? `Last sold ${it.days_idle} days ago` : `${it.weeks_of_stock} weeks of stock at current pace`}</div>
                </div>
                <div style={{ display: "grid", justifyItems: "end", gap: 4 }}>
                  <span className="num" style={{ color: "var(--ink)" }}>{rupees(it.stock_value)}</span>
                  <Pill tone={it.status === "dead" ? "crit" : "warn"}>{it.status === "dead" ? "Stuck" : "Slow"}</Pill>
                </div>
              </button>
              <div className="sugg-chips">
                {it.suggestions.map(s => (
                  <span key={s.label} className="s-chip" title={s.detail}>{s.label}{s.value > 0 && <b className="num">{rupeesShort(s.value)}</b>}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ExplainProduct item={explain} rules={r.rules} onClose={() => setExplain(null)} openLedger={openLedger} />
      {explainHead && <ExplainHeadline radar={r} onClose={() => setExplainHead(false)} onPick={it => { setExplainHead(false); setExplain(it) }} />}
    </>
  )
}
