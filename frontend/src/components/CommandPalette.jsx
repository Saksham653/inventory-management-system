import { useEffect, useMemo, useRef, useState } from "react"
import { Boxes, CornerDownLeft, Search, Sparkles, Wand2 } from "lucide-react"
import { api } from "../lib/api"
import { rupees } from "../lib/format"
import { CommandResult, useCommand } from "./CommandResult"

const FALLBACK_EXAMPLES = ["reorder everything running low", "add 20 USB-C Hub at 2200", "sold 2 Galaxy S24",
  "set price of iPad Air 5 to 61900", "what's running low?"]

// Ctrl/Cmd+K: jump to a page or product, or type a command ("reorder iPhones") and confirm it.
export default function CommandPalette({ open, onClose, pages, onPage, onProduct }) {
  const [q, setQ] = useState("")
  const [sel, setSel] = useState(0)
  const [products, setProducts] = useState([])
  const [examples, setExamples] = useState(FALLBACK_EXAMPLES)
  const input = useRef(null)
  const go = nav => {
    onClose()
    if (nav.page === "ledger" && nav.product_id) onProduct(nav.product_id)
    else onPage(nav.page)
  }
  const cmd = useCommand({ onNavigate: go })

  useEffect(() => {
    if (!open) return
    setQ(""); setSel(0); cmd.reset()
    setTimeout(() => input.current?.focus(), 10)
    api("/products/").then(setProducts).catch(() => {})
    api("/assistant/info").then(i => i.examples?.length && setExamples(i.examples)).catch(() => {})
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return examples.slice(0, 6).map(e => ({ kind: "example", id: e, label: e, icon: Wand2 }))
    const pg = pages.filter(p => p.label.toLowerCase().includes(s)).map(p => ({ kind: "page", id: p.id, label: p.label, icon: p.icon }))
    const pr = products.filter(p => p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s)).slice(0, 5)
      .map(p => ({ kind: "product", id: p.id, label: p.name, icon: Boxes, meta: `${p.qty} in stock · ${rupees(p.price)}` }))
    const run = { kind: "command", id: "run", label: q.trim(), icon: Sparkles }
    // A plain page/product name puts navigation first; anything longer is most likely a command.
    const looksLikeCommand = s.split(/\s+/).length > 1 || (!pg.length && !pr.length)
    return looksLikeCommand ? [run, ...pg, ...pr] : [...pg, ...pr, run]
  }, [q, pages, products, examples])

  useEffect(() => { setSel(0) }, [q])
  if (!open) return null

  const choose = it => {
    if (!it) return
    if (it.kind === "page") { onClose(); onPage(it.id) }
    else if (it.kind === "product") { onClose(); onProduct(it.id) }
    else if (it.kind === "example") { setQ(it.label); input.current?.focus() }
    else cmd.run(it.label)
  }
  const back = () => { cmd.reset(); setTimeout(() => input.current?.focus(), 10) }
  const showingResult = cmd.action || cmd.busy === "plan" || cmd.error

  const onKey = e => {
    if (showingResult) {
      if (e.key === "Enter" && cmd.action?.can_execute) { e.preventDefault(); cmd.confirm() }
      else if (e.key === "Escape") { e.preventDefault(); cmd.action?.can_execute ? back() : onClose() }
      else if (e.key.length === 1 || e.key === "Backspace") cmd.reset()  // typing again starts a new command
      return
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(items.length - 1, s + 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(0, s - 1)) }
    else if (e.key === "Enter") { e.preventDefault(); choose(items[sel]) }
    else if (e.key === "Escape") onClose()
  }

  let lastKind = null
  const group = { example: "Try a command", command: "Do it", page: "Go to", product: "Products · open stock history" }
  return (
    <div className="cmdk-back" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Command bar">
        <div className="cmdk-input">
          <Search size={18} />
          <input ref={input} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Ask or do anything: reorder iPhones, sold 2 Galaxy S24…" aria-label="Command" />
          <kbd>Esc</kbd>
        </div>
        {showingResult ? (
          <div className="cmdk-result">
            <CommandResult action={cmd.action} busy={cmd.busy} error={cmd.error} onConfirm={cmd.confirm} onUndo={cmd.undo}
              onRun={t => { setQ(t); cmd.run(t) }} onCancel={back} onOpen={go} />
          </div>
        ) : (
          <div className="cmdk-list">
            {items.map((it, i) => {
              const header = it.kind !== lastKind ? (lastKind = it.kind, <div className="cmdk-group" key={`g-${it.kind}`}>{group[it.kind]}</div>) : null
              return (
                <div key={`${it.kind}-${it.id}`}>
                  {header}
                  <button className={`cmdk-item ${i === sel ? "sel" : ""} ${it.kind === "command" ? "is-command" : ""}`} onMouseEnter={() => setSel(i)} onClick={() => choose(it)}>
                    <it.icon size={17} />
                    <span>{it.kind === "command" ? <>Run “<b>{it.label}</b>”</> : it.label}</span>
                    {it.meta ? <span className="num">{it.meta}</span> : i === sel && <CornerDownLeft size={14} style={{ marginLeft: "auto" }} className="faint" />}
                  </button>
                </div>
              )
            })}
          </div>
        )}
        <div className="cmdk-foot">
          {showingResult
            ? <><span><kbd>Enter</kbd> confirm</span><span><kbd>Esc</kbd> back</span><span>Nothing changes until you confirm</span></>
            : <><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open or run</span><span>Every action can be undone</span></>}
        </div>
      </div>
    </div>
  )
}
