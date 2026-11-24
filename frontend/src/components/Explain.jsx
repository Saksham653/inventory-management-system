import { BookOpenText } from "lucide-react"
import { date, number, rupees } from "../lib/format"
import { Button, Modal, Pill } from "./ui"

export const STATUS = {
  dead: { label: "Stuck", tone: "crit" },
  slow: { label: "Slow", tone: "warn" },
  reorder: { label: "Reorder", tone: "warn" },
  healthy: { label: "Healthy", tone: "ok" },
}

function Step({ label, formula, result, note }) {
  return (
    <div className="xp-step">
      <div className="xp-label">{label}</div>
      <div className="xp-formula num">{formula}</div>
      <div className="xp-result num">{result}</div>
      {note && <div className="xp-note">{note}</div>}
    </div>
  )
}

// Shows the arithmetic behind one product's radar numbers.
export function ExplainProduct({ item, rules, onClose, openLedger }) {
  if (!item) return null
  const r = item.daily_rate
  const st = STATUS[item.status]
  return (
    <Modal open onClose={onClose} title={item.name} width={560}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <Pill tone={st.tone} dot>{st.label}</Pill>
        {item.category && <Pill>{item.category}</Pill>}
        {item.supplier && <Pill>{item.supplier}</Pill>}
      </div>
      <div className="xp">
        <Step label="Daily selling rate" formula={`${number(item.sold_30d)} sold in ${rules.velocity_days} days ÷ ${rules.velocity_days}`} result={`${r} / day`} />
        <Step label="Days of stock left" formula={r > 0 ? `${item.qty} in stock ÷ ${r} per day` : "no sales in 30 days"} result={item.days_of_cover != null ? `${item.days_of_cover} days` : "—"} />
        <Step label="Reorder point" formula={`${r} × (${item.lead_time} lead + ${rules.safety_days} buffer days)`} result={`${item.reorder_point} units`}
          note={item.needs_reorder ? `Stock (${item.qty}) is at or below this, so it's flagged.` : `Stock (${item.qty}) is above this.`} />
        {item.needs_reorder && <>
          <Step label="Suggested order" formula={`${r} × (${item.lead_time} + ${rules.target_cover_days} days) − ${item.qty} in stock`} result={`${item.suggested_qty} units · ${rupees(item.suggested_cost)}`} />
          <Step label="Sales at risk" formula={`${item.shortfall_units} units short × ${rupees(item.price)}`} result={rupees(item.sales_at_risk)}
            note="Units you'd run short of before a delivery ordered today could arrive." />
        </>}
        <Step label="Money in this stock" formula={`${item.qty} × ${rupees(item.cost_price)} cost`} result={rupees(item.stock_value)} />
        <Step label="Last sold" formula={item.never_sold ? "never, counting from when it was stocked" : date(item.last_sold_at)}
          result={`${item.days_idle} days ago`}
          note={item.status === "dead" ? `No sale for ${rules.dead_days}+ days counts as stuck.` : item.status === "slow" ? `More than ${rules.slow_weeks} weeks of stock at this pace counts as slow.` : null} />
      </div>
      {item.suggestions?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Ways to free this cash</div>
          {item.suggestions.map(s => (
            <div className="list-row" key={s.label}>
              <div><div className="title">{s.label}</div><div className="meta">{s.detail}</div></div>
              {s.value > 0 && <span className="num up">{rupees(s.value)}</span>}
            </div>
          ))}
        </div>
      )}
      <div className="form-actions" style={{ marginTop: 18 }}>
        <Button icon={BookOpenText} onClick={() => { onClose(); openLedger(item.id) }}>Open stock ledger</Button>
        <Button variant="primary" onClick={onClose}>Done</Button>
      </div>
    </Modal>
  )
}

// Explains the headline: what "stuck" means and which products sit in each age bucket.
export function ExplainHeadline({ radar, onClose, onPick }) {
  if (!radar) return null
  const byId = Object.fromEntries(radar.items.map(i => [i.id, i]))
  const { rules } = radar
  return (
    <Modal open onClose={onClose} title="How Paisa Radar counts your money" width={600}>
      <p className="muted" style={{ marginBottom: 16 }}>
        Every figure is arithmetic on your recorded sales and the stock ledger. Nothing is estimated by AI.
      </p>
      <div className="xp">
        <Step label="Money in stock" formula="Σ stock × cost price, every product" result={rupees(radar.totals.inventory_value)} />
        <Step label="Stuck money" formula={`Σ stock × cost, products with no sale in ${rules.dead_days}+ days`} result={rupees(radar.totals.stuck_value)} />
        <Step label="Age of stock" formula="days since each product last sold (or was stocked, if never sold)" result="4 buckets" />
      </div>
      <div style={{ marginTop: 16 }}>
        {radar.buckets.map(b => (
          <div key={b.label} style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <b style={{ fontWeight: 500 }}>{b.label}</b><span className="num">{rupees(b.value)}</span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {b.products.length === 0 && <span className="faint" style={{ fontSize: 12.5 }}>No products</span>}
              {b.products.map(id => (
                <button key={id} className="chip" onClick={() => onPick(byId[id])}>{byId[id].name} · {rupees(byId[id].stock_value)}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
