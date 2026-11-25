import { useRef, useState } from "react"
import { RotateCcw, Sparkles } from "lucide-react"
import { useApi } from "../lib/useApi"
import { dateTime } from "../lib/format"
import { Alert, Button, DataTable, PageHead, Pill } from "../components/ui"
import { CommandResult, useCommand } from "../components/CommandResult"

const KIND_LABEL = {
  draft_purchase_order: "Purchase order", adjust_stock: "Stock change", record_sale: "Sale", update_price: "Price change",
  answer: "Answer", navigate: "Open", clarify: "Which one?", unsupported: "Not understood",
}
const ACTIONS = new Set(["draft_purchase_order", "adjust_stock", "record_sale", "update_price"])
const STATUS_TONE = { done: "ok", proposed: "warn", undone: "", answered: "info", expired: "crit", failed: "crit" }
const STATUS_LABEL = { done: "Done", proposed: "Not confirmed", undone: "Undone", answered: "Answered", expired: "Expired", failed: "Failed" }

export default function Assistant({ setPage, openLedger }) {
  const info = useApi("/assistant/info", { ai: false, examples: [] })
  const history = useApi("/assistant/actions", [])
  const [text, setText] = useState("")
  const input = useRef(null)
  const cmd = useCommand({ onNavigate: nav => (nav.page === "ledger" && nav.product_id ? openLedger(nav.product_id) : setPage(nav.page)) })

  const run = async t => {
    const value = (t ?? text).trim()
    if (!value) return
    setText(value)
    await cmd.run(value)
    history.reload()
  }

  const undoRow = async row => {
    cmd.setAction(row)
    await cmd.undo()
    history.reload()
  }

  const cols = [
    { key: "command", label: "Command", render: a => <span className="strong" style={{ whiteSpace: "normal" }}>{a.command}</span> },
    { key: "kind", label: "Type", render: a => <span className="muted">{KIND_LABEL[a.kind] || a.kind}</span> },
    { key: "status", label: "Status", render: a => {
      const blocked = a.status === "answered" && ACTIONS.has(a.kind)
      return <Pill tone={blocked ? "crit" : STATUS_TONE[a.status]} dot>{blocked ? "Blocked" : STATUS_LABEL[a.status] || a.status}</Pill>
    } },
    { key: "user_name", label: "By", render: a => <span className="muted">{a.user_name}</span> },
    { key: "created_at", label: "When", render: a => <span className="muted">{dateTime(a.executed_at || a.created_at)}</span> },
    { key: "undo", label: "", render: a => a.can_undo ? <button className="btn sm ghost" onClick={() => undoRow(a)}><RotateCcw size={13} />Undo</button> : null },
  ]

  return (
    <>
      <PageHead title="Assistant" sub="Type what you want done. You'll see exactly what will change, and nothing happens until you confirm. Press Ctrl K anywhere for the same thing." />
      {!info.data.ai && (
        <Alert type="info">Everyday commands work now. To also ask free-form questions or use your own wording, add <b>GROQ_API_KEY</b> or <b>ANTHROPIC_API_KEY</b> on the server.</Alert>
      )}
      <div className="card card-pad assistant-box">
        <form className="assistant-input" onSubmit={e => { e.preventDefault(); run() }}>
          <Sparkles size={18} className="faint" />
          <input ref={input} className="input" value={text} onChange={e => setText(e.target.value)}
            placeholder="reorder iPhones · add 20 USB-C Hub at 2200 · what's running low?" aria-label="Command" />
          <Button type="submit" variant="primary" loading={cmd.busy === "plan"} disabled={!text.trim()}>Run</Button>
        </form>
        {!cmd.action && !cmd.error && cmd.busy !== "plan" && (
          <div className="chips" style={{ padding: "12px 0 0", border: 0 }}>
            {info.data.examples.slice(0, 8).map(e => <button key={e} className="chip" onClick={() => { setText(e); run(e) }}>{e}</button>)}
          </div>
        )}
        {(cmd.action || cmd.error || cmd.busy === "plan") && (
          <div style={{ marginTop: 14 }}>
            <CommandResult action={cmd.action} busy={cmd.busy} error={cmd.error}
              onConfirm={async () => { await cmd.confirm(); history.reload() }}
              onUndo={async () => { await cmd.undo(); history.reload() }}
              onRun={run} onCancel={() => { cmd.reset(); input.current?.focus() }}
              onOpen={nav => (nav.page === "ledger" ? openLedger(nav.product_id) : setPage(nav.page))} />
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="toolbar">
          <h3 style={{ fontSize: 15 }}>Action log</h3>
          <span className="faint" style={{ fontSize: 12.5 }}>Every command, what it changed, and who ran it</span>
        </div>
        <DataTable cols={cols} rows={history.data} loading={history.loading} empty="No commands yet. Try one above." />
      </div>
    </>
  )
}
