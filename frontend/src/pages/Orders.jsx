import { useState } from "react"
import { Check, PackageCheck, Send, X } from "lucide-react"
import { api } from "../lib/api"
import { useAuth } from "../lib/auth"
import { useApi } from "../lib/useApi"
import { dateTime, rupees } from "../lib/format"
import { useToast } from "../lib/motion"
import { Alert, Button, Confirm, PageHead, Pill, Segmented, Stat } from "../components/ui"

const TONE = { draft: "", sent: "info", received: "ok", cancelled: "crit" }
const LABEL = { draft: "Draft", sent: "Sent", received: "Received", cancelled: "Cancelled" }

function OrderCard({ po, canManage, onChange }) {
  const toast = useToast()
  const [busy, setBusy] = useState("")
  const [err, setErr] = useState("")
  const [lines, setLines] = useState(po.lines.map(l => ({ ...l })))
  const [confirmCancel, setConfirmCancel] = useState(false)
  const dirty = po.status === "draft" && lines.some((l, i) => +l.qty !== po.lines[i].qty)

  const act = async (kind, fn, msg) => {
    setBusy(kind); setErr("")
    try { await fn(); toast(msg); onChange() } catch (e) { setErr(e.message) } finally { setBusy("") }
  }
  const saveQty = () => act("save", () => api(`/purchase-orders/${po.id}`, {
    method: "PATCH", body: { lines: lines.filter(l => +l.qty > 0).map(l => ({ product_id: l.product_id, qty: +l.qty, unit_cost: l.unit_cost })) },
  }), `${po.number} updated`)

  const total = lines.reduce((a, l) => a + (+l.qty || 0) * l.unit_cost, 0)
  return (
    <div className="card po">
      <div className="po-head">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h3 className="num" style={{ fontSize: 15 }}>{po.number}</h3>
            <Pill tone={TONE[po.status]} dot>{LABEL[po.status]}</Pill>
            {po.source === "radar" && <Pill>From Paisa Radar</Pill>}
          </div>
          <div className="faint" style={{ fontSize: 12.5, marginTop: 4 }}>
            {po.supplier_name}{po.supplier_contact ? ` · ${po.supplier_contact}` : ""} · created {dateTime(po.created_at)} by {po.created_by || "system"}
            {po.received_at && ` · received ${dateTime(po.received_at)}`}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="num" style={{ fontSize: 20, color: "var(--ink)" }}>{rupees(total)}</div>
          <div className="faint" style={{ fontSize: 12 }}>{lines.reduce((a, l) => a + (+l.qty || 0), 0)} units</div>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Product</th><th className="r">Qty</th><th className="r">Cost each</th><th className="r">Line total</th></tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id}>
                <td className="strong">{l.product_name}</td>
                <td className="r">
                  {po.status === "draft" && canManage
                    ? <input className="input qty-input num" type="number" min="0" value={l.qty} aria-label={`Quantity of ${l.product_name}`}
                        onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} />
                    : <span className="num">{l.qty}</span>}
                </td>
                <td className="r num">{rupees(l.unit_cost)}</td>
                <td className="r num" style={{ color: "var(--ink)" }}>{rupees((+l.qty || 0) * l.unit_cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {po.note && <p className="faint" style={{ fontSize: 12.5, padding: "0 20px 12px" }}>{po.note}</p>}
      {err && <div style={{ padding: "0 20px" }}><Alert>{err}</Alert></div>}
      {canManage && ["draft", "sent"].includes(po.status) && (
        <div className="po-actions">
          <Button variant="ghost" size="sm" icon={X} onClick={() => setConfirmCancel(true)}>Cancel order</Button>
          <span style={{ flex: 1 }} />
          {dirty && <Button size="sm" icon={Check} loading={busy === "save"} onClick={saveQty}>Save quantities</Button>}
          {po.status === "draft" && !dirty && <Button size="sm" icon={Send} loading={busy === "send"}
            onClick={() => act("send", () => api(`/purchase-orders/${po.id}/send`, { method: "POST" }), `${po.number} marked as sent`)}>Mark as sent</Button>}
          {!dirty && <Button variant="primary" size="sm" icon={PackageCheck} loading={busy === "recv"}
            onClick={() => act("recv", () => api(`/purchase-orders/${po.id}/receive`, { method: "POST" }), `${po.number} received · stock added to the ledger`)}>Stock arrived</Button>}
        </div>
      )}
      <Confirm open={confirmCancel} onClose={() => setConfirmCancel(false)} title={`Cancel ${po.number}?`} confirmLabel="Cancel order"
        message="The order stays in your history as cancelled. No stock changes."
        onConfirm={async () => { await api(`/purchase-orders/${po.id}/cancel`, { method: "POST" }); toast(`${po.number} cancelled`); onChange() }} />
    </div>
  )
}

export default function Orders({ setPage }) {
  const { can } = useAuth()
  const { data, loading, error, reload } = useApi("/purchase-orders/", [])
  const [filter, setFilter] = useState("open")
  const open = data.filter(p => ["draft", "sent"].includes(p.status))
  const shown = filter === "open" ? open : filter === "done" ? data.filter(p => !["draft", "sent"].includes(p.status)) : data
  const openValue = open.reduce((a, p) => a + p.total, 0)

  return (
    <>
      <PageHead title="Purchase orders" sub="Drafted from Paisa Radar or by hand. When stock arrives, receiving the order adds it through the ledger.">
        <Button onClick={() => setPage("today")}>Back to Today</Button>
      </PageHead>
      <div className="stats">
        <Stat label="Open orders" count={open.length} sub={`${open.filter(p => p.status === "draft").length} drafts · ${open.filter(p => p.status === "sent").length} sent`} />
        <Stat label="Money committed" count={openValue} format={rupees} sub="in open orders" />
        <Stat label="Received" count={data.filter(p => p.status === "received").length} sub="all time" />
      </div>
      <Alert>{error}</Alert>
      <div style={{ marginBottom: 14 }}>
        <Segmented value={filter} onChange={setFilter} options={[{ value: "open", label: `Open ${open.length}` }, { value: "done", label: "Closed" }, { value: "all", label: "All" }]} />
      </div>
      {loading && <div className="card card-pad"><div className="skeleton" style={{ height: 160 }} /></div>}
      {!loading && shown.length === 0 && (
        <div className="card empty">
          {filter === "open" ? "No open orders. Draft them from the Today screen when Paisa Radar flags items running low." : "Nothing here yet."}
        </div>
      )}
      <div className="po-list">
        {shown.map(po => <OrderCard key={`${po.id}-${po.status}-${po.total}`} po={po} canManage={can.manage} onChange={reload} />)}
      </div>
    </>
  )
}
