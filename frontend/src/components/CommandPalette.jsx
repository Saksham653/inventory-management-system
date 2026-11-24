import { useEffect, useMemo, useRef, useState } from "react"
import { Boxes, CornerDownLeft, Search } from "lucide-react"
import { api } from "../lib/api"
import { rupees } from "../lib/format"

// Ctrl/Cmd+K: jump to any page or product.
export default function CommandPalette({ open, onClose, pages, onPage, onProduct }) {
  const [q, setQ] = useState("")
  const [sel, setSel] = useState(0)
  const [products, setProducts] = useState([])
  const input = useRef(null)

  useEffect(() => {
    if (!open) return
    setQ(""); setSel(0)
    setTimeout(() => input.current?.focus(), 10)
    api("/products/").then(setProducts).catch(() => {})
  }, [open])

  const items = useMemo(() => {
    const s = q.trim().toLowerCase()
    const pg = pages.filter(p => !s || p.label.toLowerCase().includes(s)).map(p => ({ kind: "page", id: p.id, label: p.label, icon: p.icon }))
    const pr = products.filter(p => s && (p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s))).slice(0, 6)
      .map(p => ({ kind: "product", id: p.id, label: p.name, icon: Boxes, meta: `${p.qty} in stock · ${rupees(p.price)}` }))
    return [...pg, ...pr]
  }, [q, pages, products])

  useEffect(() => { setSel(0) }, [q])
  if (!open) return null

  const run = it => {
    if (!it) return
    onClose()
    it.kind === "page" ? onPage(it.id) : onProduct(it.id)
  }
  const onKey = e => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(items.length - 1, s + 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(0, s - 1)) }
    else if (e.key === "Enter") { e.preventDefault(); run(items[sel]) }
    else if (e.key === "Escape") onClose()
  }

  let lastKind = null
  return (
    <div className="cmdk-back" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Search">
        <div className="cmdk-input">
          <Search size={18} />
          <input ref={input} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search pages or products…" aria-label="Search pages or products" />
          <kbd>Esc</kbd>
        </div>
        <div className="cmdk-list">
          {items.length === 0 && <div className="empty" style={{ padding: 28 }}>No matches for “{q}”</div>}
          {items.map((it, i) => {
            const header = it.kind !== lastKind ? (lastKind = it.kind, <div className="cmdk-group" key={`g-${it.kind}`}>{it.kind === "page" ? "Go to" : "Products · open stock history"}</div>) : null
            return (
              <div key={`${it.kind}-${it.id}`}>
                {header}
                <button className={`cmdk-item ${i === sel ? "sel" : ""}`} onMouseEnter={() => setSel(i)} onClick={() => run(it)}>
                  <it.icon size={17} />
                  <span>{it.label}</span>
                  {it.meta ? <span className="num">{it.meta}</span> : i === sel && <CornerDownLeft size={14} style={{ marginLeft: "auto" }} className="faint" />}
                </button>
              </div>
            )
          })}
        </div>
        <div className="cmdk-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span></div>
      </div>
    </div>
  )
}
