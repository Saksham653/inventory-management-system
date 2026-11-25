import { useCallback, useState } from "react"
import {
  ArrowRight, Bot, CheckCircle2, ClipboardList, Compass, CornerDownLeft, HelpCircle, Loader2, MessageSquareText,
  PackagePlus, RotateCcw, ShoppingCart, Tag, TriangleAlert, XCircle,
} from "lucide-react"
import { api } from "../lib/api"
import { rupees } from "../lib/format"
import { useToast } from "../lib/motion"
import { Pill } from "./ui"

const KIND = {
  draft_purchase_order: { icon: ClipboardList, label: "Purchase order" },
  adjust_stock: { icon: PackagePlus, label: "Stock change" },
  record_sale: { icon: ShoppingCart, label: "Sale" },
  update_price: { icon: Tag, label: "Price change" },
  answer: { icon: MessageSquareText, label: "Answer" },
  navigate: { icon: Compass, label: "Open" },
  clarify: { icon: HelpCircle, label: "Which one?" },
  unsupported: { icon: Bot, label: "Try this" },
}
const STATUS = { proposed: ["Needs your OK", "warn"], done: ["Done", "ok"], undone: ["Undone", ""], answered: ["", ""], expired: ["Expired", "crit"], failed: ["Failed", "crit"] }

const changed = () => window.dispatchEvent(new Event("sw:data-changed"))

// Plan -> confirm -> undo, shared by the command palette and the Assistant page.
export function useCommand({ onNavigate } = {}) {
  const toast = useToast()
  const [action, setAction] = useState(null)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")

  const undo = useCallback(async a => {
    setBusy("undo"); setError("")
    try {
      const r = await api(`/assistant/actions/${a.id}/undo`, { method: "POST" })
      setAction(cur => (cur && cur.id === r.id ? r : cur))
      toast(`Undone: ${a.preview.title}`)
      changed()
      return r
    } catch (e) { setError(e.message) } finally { setBusy("") }
  }, [toast])

  const run = useCallback(async text => {
    setBusy("plan"); setError("")
    try {
      const a = await api("/assistant/plan", { method: "POST", body: { text } })
      setAction(a)
      if (a.preview.navigate && onNavigate) onNavigate(a.preview.navigate)
      return a
    } catch (e) { setError(e.message); setAction(null) } finally { setBusy("") }
  }, [onNavigate])

  const confirm = useCallback(async () => {
    if (!action?.can_execute) return
    setBusy("exec"); setError("")
    try {
      const a = await api(`/assistant/actions/${action.id}/execute`, { method: "POST" })
      setAction(a)
      const extra = a.result?.numbers ? ` · ${a.result.numbers.join(", ")}` : ""
      toast(`${a.preview.title}${extra}`, { action: { label: "Undo", onClick: () => undo(a) } })
      changed()
      return a
    } catch (e) { setError(e.message) } finally { setBusy("") }
  }, [action, toast, undo])

  return { action, setAction, busy, error, setError, run, confirm, undo: () => action && undo(action), reset: () => { setAction(null); setError("") } }
}

function Lines({ p }) {
  if (!p.lines?.length) return null
  if (p.kind === "draft_purchase_order") {
    return (
      <div className="cr-table">
        {p.lines.map(l => (
          <div className="cr-row" key={l.product_id}>
            <div><b>{l.product}</b><span className="faint">{l.supplier} · {l.reason}</span></div>
            <span className="num">{l.qty} × {rupees(l.unit_cost)}</span>
            <span className="num cr-strong">{rupees(l.total)}</span>
          </div>
        ))}
      </div>
    )
  }
  if (p.kind === "adjust_stock") {
    const l = p.lines[0]
    return (
      <div className="cr-delta">
        <span className="faint">{l.product}</span>
        <span className="num">{l.before}</span><ArrowRight size={14} className="faint" /><span className="num cr-strong">{l.after}</span>
        <Pill tone={l.change > 0 ? "ok" : "crit"}>{l.change > 0 ? "+" : ""}{l.change}</Pill>
      </div>
    )
  }
  if (p.kind === "record_sale") {
    const l = p.lines[0]
    return (
      <div className="cr-delta">
        <span className="num">{l.qty} × {rupees(l.unit_price)}</span><span className="faint">=</span><span className="num cr-strong">{rupees(l.total)}</span>
        <span className="faint" style={{ marginLeft: "auto" }}>stock {l.before} → {l.after}</span>
      </div>
    )
  }
  if (p.kind === "update_price") {
    const l = p.lines[0]
    return (
      <div className="cr-delta">
        <span className="num">{rupees(l.before)}</span><ArrowRight size={14} className="faint" /><span className="num cr-strong">{rupees(l.after)}</span>
        {l.margin != null && <span className="faint" style={{ marginLeft: "auto" }}>margin {l.margin}%</span>}
      </div>
    )
  }
  return null
}

export function CommandResult({ action, busy, error, onConfirm, onUndo, onRun, onCancel, onOpen, compact }) {
  if (busy === "plan") {
    return <div className="cr cr-loading"><Loader2 size={16} className="spin" />Working out what to do…</div>
  }
  if (!action) return error ? <div className="cr"><div className="cr-block"><XCircle size={15} />{error}</div></div> : null
  const p = action.preview
  const k = KIND[p.kind] || KIND.unsupported
  const [statusLabel, statusTone] = STATUS[action.status] || ["", ""]
  return (
    <div className={`cr ${compact ? "compact" : ""}`}>
      <div className="cr-head">
        <span className="cr-icon"><k.icon size={17} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="cr-title">{p.title}</div>
          <div className="faint cr-cmd">“{action.command}”</div>
        </div>
        {statusLabel && <Pill tone={statusTone} dot>{statusLabel}</Pill>}
      </div>
      {p.summary && <p className="cr-summary">{p.summary}</p>}
      {p.answer && <p className="cr-answer">{p.answer}</p>}
      <Lines p={p} />
      {p.rows?.length > 0 && (
        <div className="cr-table">
          {p.rows.map(r => (
            <div className="cr-row" key={r.label}><div><b>{r.label}</b>{r.detail && <span className="faint">{r.detail}</span>}</div><span className="num cr-strong">{r.value}</span></div>
          ))}
        </div>
      )}
      {p.warnings?.map(w => <div key={w} className="cr-warn"><TriangleAlert size={14} />{w}</div>)}
      {p.blocking && <div className="cr-block"><XCircle size={15} />{p.blocking}</div>}
      {error && <div className="cr-block"><XCircle size={15} />{error}</div>}
      {p.suggestions?.length > 0 && (
        <div className="cr-sugg">
          {p.suggestions.map(s => <button key={s} className="chip" onClick={() => onRun?.(s)}>{s}</button>)}
        </div>
      )}
      <div className="cr-foot">
        <span className="faint">{action.interpreted_by === "rules" ? "Understood without AI" : action.interpreted_by ? `Understood by ${action.interpreted_by.split(":")[0]}` : ""}</span>
        <span style={{ flex: 1 }} />
        {action.can_execute && <>
          {onCancel && <button className="btn sm ghost" onClick={onCancel}>Cancel</button>}
          <button className="btn sm primary" onClick={onConfirm} disabled={busy === "exec"}>
            {busy === "exec" ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}Confirm<kbd className="cr-kbd"><CornerDownLeft size={11} /></kbd>
          </button>
        </>}
        {action.status === "done" && <>
          {action.can_undo && <button className="btn sm" onClick={onUndo} disabled={busy === "undo"}>{busy === "undo" ? <Loader2 size={14} className="spin" /> : <RotateCcw size={14} />}Undo</button>}
          {onOpen && action.kind === "draft_purchase_order" && <button className="btn sm" onClick={() => onOpen({ page: "orders" })}>Open purchase orders</button>}
          {onOpen && ["adjust_stock", "record_sale"].includes(action.kind) && action.result?.product_id &&
            <button className="btn sm" onClick={() => onOpen({ page: "ledger", product_id: action.result.product_id })}>Open stock ledger</button>}
        </>}
      </div>
    </div>
  )
}
