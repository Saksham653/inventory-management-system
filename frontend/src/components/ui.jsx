import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, Info, Loader2, Pencil, Search, Trash2, X } from "lucide-react"
import { CountUp } from "../lib/motion"

export function Button({ variant, size, block, icon: Icon, loading, children, className = "", ...props }) {
  const cls = ["btn", variant, size, block && "block", className].filter(Boolean).join(" ")
  return (
    <button type="button" className={cls} disabled={loading || props.disabled} {...props}>
      {loading ? <Loader2 size={15} className="spin" /> : Icon && <Icon size={15} />}
      {children}
    </button>
  )
}

export function PageHead({ title, sub, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="actions">{children}</div>}
    </div>
  )
}

/* Pass `count` (a number) plus `format` to animate the figure, or `value` for static text. */
export function Stat({ label, value, count, format, sub, subClass, icon: Icon, className = "" }) {
  return (
    <div className={`card stat ${className}`}>
      <div className="label">{Icon && <Icon size={15} />}{label}</div>
      <div className="value">{count != null ? <CountUp value={count} format={format} /> : value}</div>
      {sub && <div className={`sub ${subClass || ""}`}>{sub}</div>}
    </div>
  )
}

export function Segmented({ options, value, onChange }) {
  const refs = useRef({})
  const [pill, setPill] = useState(null)
  useLayoutEffect(() => {
    const el = refs.current[value]
    if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth })
  }, [value])
  return (
    <div className="seg" role="tablist">
      {pill && <span className="seg-pill" style={pill} />}
      {options.map(o => (
        <button key={o.value} ref={el => (refs.current[o.value] = el)} role="tab" aria-selected={value === o.value}
          className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  )
}

export function Pill({ tone, dot, children }) {
  return <span className={`pill ${tone || ""}`}>{dot && <span className="dot" />}{children}</span>
}

const ALERT_ICONS = { error: AlertTriangle, success: CheckCircle2, info: Info }
export function Alert({ type = "error", children }) {
  if (!children) return null
  const Icon = ALERT_ICONS[type]
  return <div className={`alert ${type}`} role={type === "error" ? "alert" : "status"}><Icon size={16} style={{ flexShrink: 0, marginTop: 1 }} /><div>{children}</div></div>
}

export function Field({ label, hint, className = "", children, htmlFor }) {
  return (
    <div className={`field ${className}`}>
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

export function Input({ label, hint, className, id, onChange, ...props }) {
  const fid = id || (label ? "f-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-") : undefined)
  return (
    <Field label={label} hint={hint} className={className} htmlFor={fid}>
      <input id={fid} className="input" onChange={e => onChange?.(e.target.value)} {...props} />
    </Field>
  )
}

export function Select({ label, hint, className, id, options, placeholder = "Select…", onChange, value, ...props }) {
  const fid = id || (label ? "f-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-") : undefined)
  return (
    <Field label={label} hint={hint} className={className} htmlFor={fid}>
      <select id={fid} className="select" value={value ?? ""} onChange={e => onChange?.(e.target.value)} {...props}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  )
}

export function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="search">
      <Search size={15} />
      <input className="input" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </div>
  )
}

export function Modal({ open, onClose, title, width = 520, children }) {
  useEffect(() => {
    if (!open) return
    const onKey = e => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="modal-back" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function Confirm({ open, onClose, onConfirm, title = "Are you sure?", message, confirmLabel = "Delete" }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  useEffect(() => { if (open) setErr("") }, [open])
  const go = async () => {
    setBusy(true)
    setErr("")
    try { await onConfirm(); onClose() } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title={title} width={420}>
      <p className="muted" style={{ marginBottom: 16 }}>{message}</p>
      <Alert>{err}</Alert>
      <div className="form-actions">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="danger" icon={Trash2} loading={busy} onClick={go}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}

/* cols: [{ key, label, render?, align? }] */
export function DataTable({ cols, rows, loading, empty = "Nothing here yet", onEdit, onDelete }) {
  const hasActions = !!(onEdit || onDelete)
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {cols.map(c => <th key={c.key} className={c.align === "right" ? "r" : ""}>{c.label}</th>)}
            {hasActions && <th aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {loading && [0, 1, 2].map(i => (
            <tr key={i}>{cols.map(c => <td key={c.key}><div className="skeleton" style={{ height: 14, width: "70%" }} /></td>)}{hasActions && <td />}</tr>
          ))}
          {!loading && rows.length === 0 && (
            <tr><td colSpan={cols.length + (hasActions ? 1 : 0)} className="empty">{empty}</td></tr>
          )}
          {!loading && rows.map(row => (
            <tr key={row.id}>
              {cols.map(c => (
                <td key={c.key} className={c.align === "right" ? "r" : ""}>{c.render ? c.render(row) : (row[c.key] ?? "—")}</td>
              ))}
              {hasActions && (
                <td className="r">
                  <div className="row-actions">
                    {onEdit && <button className="icon-btn" onClick={() => onEdit(row)} aria-label={`Edit ${row.name || ""}`}><Pencil size={15} /></button>}
                    {onDelete && <button className="icon-btn" onClick={() => onDelete(row)} aria-label={`Delete ${row.name || ""}`}><Trash2 size={15} /></button>}
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

/* Form state for create/edit modals. */
export function useForm(initial) {
  const [values, setValues] = useState(initial)
  const set = key => v => setValues(s => ({ ...s, [key]: v }))
  return { values, setValues, set }
}
