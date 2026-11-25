import { useEffect, useMemo, useRef, useState } from "react"
import { Camera, Check, CheckCircle2, FileImage, Plus, ScanLine, Trash2, Upload, ZoomIn, ZoomOut } from "lucide-react"
import { api } from "../lib/api"
import { useApi } from "../lib/useApi"
import { compressImage, fetchImageUrl } from "../lib/image"
import { dateTime, rupees } from "../lib/format"
import { useToast } from "../lib/motion"
import { Alert, Button, Confirm, DataTable, PageHead, Pill } from "../components/ui"

const STATUS = {
  matched: { label: "Matched", tone: "ok" },
  check: { label: "Check match", tone: "warn" },
  new: { label: "New product", tone: "info" },
  unmatched: { label: "Pick a product", tone: "crit" },
  skipped: { label: "Skipped", tone: "" },
}
const BILL_TONE = { draft: "warn", posted: "ok", discarded: "" }
const SCAN_STEPS = ["Reading the bill", "Finding each item line", "Matching to your products"]

function useImageUrl(billId) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!billId) return
    let alive = true, made = null
    fetchImageUrl(`/bills/${billId}/image`).then(u => { made = u; alive ? setUrl(u) : URL.revokeObjectURL(u) }).catch(() => {})
    return () => { alive = false; if (made) URL.revokeObjectURL(made) }
  }, [billId])
  return url
}

function Uploader({ onPicked, disabled }) {
  const [drag, setDrag] = useState(false)
  const camera = useRef(null)
  const pick = files => { const f = files?.[0]; if (f) onPicked(f) }
  return (
    <div className={`snap-drop ${drag ? "drag" : ""} ${disabled ? "off" : ""}`}
      onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); if (!disabled) pick(e.dataTransfer.files) }}>
      <div className="snap-icon"><ScanLine size={28} /></div>
      <h3>Snap a supplier bill</h3>
      <p className="muted">Printed or handwritten. Each line is read, matched to your products, and waits for your OK before stock changes.</p>
      <div className="snap-actions">
        <Button variant="primary" icon={Camera} disabled={disabled} onClick={() => camera.current?.click()}>Take a photo</Button>
        <label className={`btn ${disabled ? "is-disabled" : ""}`} htmlFor="bill-file"><Upload size={15} />Upload image</label>
      </div>
      <span className="faint" style={{ fontSize: 12 }}>or drop a photo here · JPEG, PNG or WebP</span>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden disabled={disabled} onChange={e => pick(e.target.files)} />
      <input id="bill-file" type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={disabled} onChange={e => pick(e.target.files)} />
    </div>
  )
}

function Scanning({ preview }) {
  const [step, setStep] = useState(0)
  useEffect(() => { const t = setInterval(() => setStep(s => Math.min(s + 1, SCAN_STEPS.length - 1)), 1800); return () => clearInterval(t) }, [])
  return (
    <div className="card scan-card">
      <div className="scan-photo">
        {preview && <img src={preview} alt="Bill being read" />}
        <span className="scan-laser" />
      </div>
      <div className="scan-steps">
        {SCAN_STEPS.map((s, i) => (
          <div key={s} className={`scan-step ${i < step ? "done" : i === step ? "now" : ""}`}>
            {i < step ? <Check size={14} /> : <span className="dot" />}{s}
          </div>
        ))}
        <p className="faint" style={{ fontSize: 12.5, marginTop: 8 }}>Usually takes a few seconds.</p>
      </div>
    </div>
  )
}

function LineCard({ line, index, products, readOnly, onChange }) {
  const st = STATUS[line.status] || STATUS.matched
  const pct = line.match_score != null ? Math.round(line.match_score * 100) : null
  const candidateIds = new Set(line.candidates.map(c => c.product_id))
  const setAction = action => onChange({ action, status: action === "skip" ? "skipped" : action === "create" ? "new" : line.product_id ? "check" : "unmatched" })
  return (
    <div className={`bill-line ${line.action === "skip" ? "is-skip" : ""}`}>
      <div className="bl-head">
        <span className="bl-no num">{index + 1}</span>
        <div className="bl-raw">
          <span className="eyebrow">On the bill</span>
          <code>{line.raw_text}</code>
        </div>
        <Pill tone={st.tone} dot>{st.label}{pct != null && line.status !== "new" && line.status !== "skipped" ? ` · ${pct}%` : ""}</Pill>
      </div>

      {!readOnly && (
        <div className="bl-modes" role="radiogroup" aria-label={`What to do with line ${index + 1}`}>
          {[["match", "Existing product"], ["create", "New product"], ["skip", "Skip"]].map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={line.action === v} className={line.action === v ? "on" : ""} onClick={() => setAction(v)}>{l}</button>
          ))}
        </div>
      )}

      {line.action === "match" && (
        <div className="bl-grid">
          <label className="field full"><span>Product</span>
            <select className="select" disabled={readOnly} value={line.product_id ?? ""}
              onChange={e => onChange({ product_id: e.target.value ? +e.target.value : null, status: e.target.value ? "matched" : "unmatched", match_score: 1 })}>
              <option value="">Choose a product…</option>
              {line.candidates.length > 0 && (
                <optgroup label="Best matches">
                  {line.candidates.map(c => <option key={c.product_id} value={c.product_id}>{c.name} · {Math.round(c.score * 100)}%{c.via === "remembered" ? " · remembered" : ""}</option>)}
                </optgroup>
              )}
              <optgroup label="All products">
                {products.filter(p => !candidateIds.has(p.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </optgroup>
            </select>
          </label>
        </div>
      )}
      {line.action === "create" && (
        <div className="bl-grid">
          <label className="field full"><span>New product name</span>
            <input className="input" disabled={readOnly} value={line.new_name ?? ""} onChange={e => onChange({ new_name: e.target.value })} /></label>
          <label className="field"><span>SKU</span>
            <input className="input num" disabled={readOnly} value={line.new_sku ?? ""} onChange={e => onChange({ new_sku: e.target.value.toUpperCase() })} /></label>
          <label className="field"><span>Selling price (₹)</span>
            <input className="input num" type="number" min="0" disabled={readOnly} value={line.new_price ?? ""} onChange={e => onChange({ new_price: e.target.value === "" ? null : +e.target.value })} /></label>
        </div>
      )}
      {line.action !== "skip" && (
        <div className="bl-grid three">
          <label className="field"><span>Quantity</span>
            <input className="input num" type="number" min="0" step="1" disabled={readOnly} value={line.qty ?? ""} onChange={e => onChange({ qty: e.target.value === "" ? null : +e.target.value })} /></label>
          <label className="field"><span>Cost each (₹)</span>
            <input className="input num" type="number" min="0" disabled={readOnly} value={line.unit_cost ?? ""} onChange={e => onChange({ unit_cost: e.target.value === "" ? null : +e.target.value })} /></label>
          <div className="field"><span>Line total</span>
            <div className="bl-total num">{rupees((line.qty || 0) * (line.unit_cost || 0))}{line.amount_on_bill ? <small className="faint"> bill: {rupees(line.amount_on_bill)}</small> : null}</div></div>
        </div>
      )}
      {line.flags?.map(f => <div key={f} className="bl-flag">{f}</div>)}
    </div>
  )
}

function Review({ initial, onDone, onClose }) {
  const toast = useToast()
  const products = useApi("/products/", [])
  const suppliers = useApi("/suppliers/", [])
  const [bill, setBill] = useState(initial)
  const [lines, setLines] = useState(initial.lines)
  const [busy, setBusy] = useState("")
  const [err, setErr] = useState("")
  const [zoom, setZoom] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const photo = useImageUrl(bill.id)
  const readOnly = bill.status !== "draft"

  const active = lines.filter(l => l.action !== "skip")
  const total = active.reduce((a, l) => a + (l.qty || 0) * (l.unit_cost || 0), 0)
  const units = active.reduce((a, l) => a + (l.qty || 0), 0)
  const expected = bill.subtotal_on_bill || (bill.total_on_bill && bill.total_on_bill - (bill.tax_on_bill || 0)) || null
  const off = expected && Math.abs(expected - total) > Math.max(1, expected * 0.01)
  const needsWork = active.filter(l => (l.action === "match" && !l.product_id) || (l.action === "create" && (!l.new_name || !l.new_sku || l.new_price == null)) || !l.qty || l.unit_cost == null).length

  const patchBody = () => ({
    supplier_id: bill.supplier_id, bill_no: bill.bill_no, bill_date: bill.bill_date,
    lines: lines.map(l => ({ id: l.id, action: l.action, product_id: l.product_id, qty: l.qty, unit_cost: l.unit_cost, new_name: l.new_name, new_sku: l.new_sku, new_price: l.new_price })),
  })
  const update = (id, change) => setLines(ls => ls.map(l => l.id === id ? { ...l, ...change } : l))

  const save = async () => {
    setBusy("save"); setErr("")
    try { const b = await api(`/bills/${bill.id}`, { method: "PATCH", body: patchBody() }); setBill(b); setLines(b.lines); toast("Draft saved") }
    catch (e) { setErr(e.message) } finally { setBusy("") }
  }
  const post = async () => {
    setBusy("post"); setErr("")
    try {
      await api(`/bills/${bill.id}`, { method: "PATCH", body: patchBody() })
      const r = await api(`/bills/${bill.id}/post`, { method: "POST" })
      toast(`Added ${r.summary.units} units to stock · ${rupees(r.summary.value)}`)
      onDone(r)
    } catch (e) { setErr(e.message) } finally { setBusy("") }
  }

  return (
    <>
      <div className="bill-grid">
        <aside className="bill-photo card">
          <div className="bp-head">
            <span className="eyebrow"><FileImage size={13} style={{ verticalAlign: -2 }} /> {bill.number}</span>
            <button className="icon-btn" onClick={() => setZoom(z => !z)} aria-label={zoom ? "Zoom out" : "Zoom in"}>{zoom ? <ZoomOut size={16} /> : <ZoomIn size={16} />}</button>
          </div>
          <div className={`bp-frame ${zoom ? "zoomed" : ""}`}>
            {photo ? <img src={photo} alt={`Photo of ${bill.number}`} onClick={() => setZoom(z => !z)} /> : <div className="skeleton" style={{ height: 420 }} />}
          </div>
          {bill.reader_notes && <p className="faint" style={{ fontSize: 12, padding: "0 14px 14px" }}>Reader's note: {bill.reader_notes}</p>}
        </aside>

        <section className="bill-form">
          <div className="card card-pad">
            <div className="bf-head">
              <div>
                <h3 style={{ fontSize: 17 }}>{readOnly ? `${bill.number} · ${bill.status}` : "Check what was read"}</h3>
                <p className="faint" style={{ fontSize: 12.5, marginTop: 4 }}>
                  {bill.counts.matched} matched · {bill.counts.check} to check · {bill.counts.new} new{bill.counts.skipped ? ` · ${bill.counts.skipped} skipped` : ""} · read by {bill.reader?.split(":")[0]}
                </p>
              </div>
              <Pill tone={BILL_TONE[bill.status]} dot>{bill.status}</Pill>
            </div>
            <div className="bl-grid three" style={{ marginTop: 14 }}>
              <label className="field"><span>Supplier</span>
                <select className="select" disabled={readOnly} value={bill.supplier_id ?? ""} onChange={e => setBill(b => ({ ...b, supplier_id: e.target.value ? +e.target.value : null }))}>
                  <option value="">Not set</option>
                  {suppliers.data.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {bill.supplier_name_raw && <small className="faint">On the bill: {bill.supplier_name_raw}</small>}
              </label>
              <label className="field"><span>Bill number</span>
                <input className="input num" disabled={readOnly} value={bill.bill_no ?? ""} onChange={e => setBill(b => ({ ...b, bill_no: e.target.value }))} /></label>
              <label className="field"><span>Bill date</span>
                <input className="input num" disabled={readOnly} value={bill.bill_date ?? ""} placeholder="YYYY-MM-DD" onChange={e => setBill(b => ({ ...b, bill_date: e.target.value }))} /></label>
            </div>
            {bill.warnings?.map(w => <Alert key={w} type="info">{w}</Alert>)}
          </div>

          <div className="bill-lines stagger">
            {lines.map((l, i) => (
              <div key={l.id} style={{ "--i": i }}>
                <LineCard line={l} index={i} products={products.data} readOnly={readOnly} onChange={c => update(l.id, c)} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="snap-bar">
        <div className="sb-totals">
          <div><span className="faint">Adding</span> <b className="num">{units} units</b> <span className="faint">from {active.length} lines</span></div>
          <div className="num" style={{ fontSize: 18, color: "var(--ink)" }}>{rupees(total)}
            {expected ? <span className={`sb-check ${off ? "down" : "up"}`}>{off ? `bill says ${rupees(expected)}` : "matches the bill"}</span> : null}
          </div>
        </div>
        {err && <div className="sb-err">{err}</div>}
        <div className="sb-actions">
          <Button variant="ghost" onClick={onClose}>Back</Button>
          {!readOnly && <>
            <Button variant="ghost" icon={Trash2} onClick={() => setDiscarding(true)}>Discard</Button>
            <Button loading={busy === "save"} onClick={save}>Save draft</Button>
            <Button variant="primary" icon={Plus} loading={busy === "post"} disabled={!active.length || needsWork > 0} onClick={post}
              title={needsWork ? `${needsWork} line(s) need a product, price or quantity` : undefined}>
              {needsWork ? `${needsWork} line${needsWork > 1 ? "s" : ""} to finish` : `Add ${units} to stock`}
            </Button>
          </>}
        </div>
      </div>
      <Confirm open={discarding} onClose={() => setDiscarding(false)} title={`Discard ${bill.number}?`} confirmLabel="Discard"
        message="Nothing has been added to stock yet. The bill stays in your history as discarded."
        onConfirm={async () => { await api(`/bills/${bill.id}/discard`, { method: "POST" }); toast(`${bill.number} discarded`); onClose() }} />
    </>
  )
}

function Done({ result, onAnother, openLedger }) {
  const { summary, bill } = result
  const first = bill.lines.find(l => l.action !== "skip" && l.product_id)
  return (
    <div className="card done-card">
      <div className="done-icon"><CheckCircle2 size={34} /></div>
      <h2>{summary.units} units added to stock</h2>
      <p className="muted">{bill.number}{bill.bill_no ? ` (bill ${bill.bill_no})` : ""} · {rupees(summary.value)} at cost · every line is in the stock ledger.</p>
      {summary.created.length > 0 && <p className="muted" style={{ marginTop: 6 }}>New products: {summary.created.join(", ")}</p>}
      <p className="faint" style={{ fontSize: 12.5, marginTop: 10 }}>StockWaves remembers how this supplier names each product, so their next bill matches straight away.</p>
      <div className="snap-actions" style={{ marginTop: 18 }}>
        <Button variant="primary" icon={ScanLine} onClick={onAnother}>Scan another bill</Button>
        {first && <Button onClick={() => openLedger(first.product_id)}>Open stock ledger</Button>}
      </div>
    </div>
  )
}

export default function StockIn({ openLedger }) {
  const reader = useApi("/bills/reader", null)
  const history = useApi("/bills/", [])
  const [view, setView] = useState("upload")
  const [preview, setPreview] = useState(null)
  const [bill, setBill] = useState(null)
  const [result, setResult] = useState(null)
  const [err, setErr] = useState("")

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const scan = async file => {
    setErr("")
    if (!file.type.startsWith("image/")) return setErr("That isn't an image. Upload a photo of the bill.")
    const small = await compressImage(file)
    setPreview(URL.createObjectURL(small))
    setView("scanning")
    const form = new FormData()
    form.append("image", small)
    try {
      setBill(await api("/bills/scan", { method: "POST", form }))
      setView("review")
    } catch (e) {
      setErr(e.message)
      setView("upload")
    }
  }
  const open = async id => { setErr(""); try { setBill(await api(`/bills/${id}`)); setView("review") } catch (e) { setErr(e.message) } }
  const reset = () => { setView("upload"); setBill(null); setResult(null); history.reload() }

  const cols = useMemo(() => [
    { key: "number", label: "Bill", render: b => <span className="strong num">{b.number}</span> },
    { key: "supplier_name", label: "Supplier", render: b => b.supplier_name || <span className="faint">—</span> },
    { key: "bill_no", label: "Bill no.", render: b => b.bill_no ? <span className="num">{b.bill_no}</span> : <span className="faint">—</span> },
    { key: "lines", label: "Lines", align: "right", render: b => <span className="num">{b.lines}</span> },
    { key: "total", label: "Value", align: "right", render: b => <span className="num">{rupees(b.total)}</span> },
    { key: "status", label: "Status", render: b => <Pill tone={BILL_TONE[b.status]} dot>{b.status}</Pill> },
    { key: "created_at", label: "Scanned", render: b => <span className="muted">{dateTime(b.created_at)}</span> },
    { key: "open", label: "", render: b => <button className="btn sm ghost" onClick={() => open(b.id)}>{b.status === "draft" ? "Continue" : "View"}</button> },
  ], [])

  const unavailable = reader.data && !reader.data.available

  return (
    <>
      <PageHead title="Stock in" sub="Photograph a supplier bill. StockWaves reads it, matches each line to your products, and adds it to stock when you confirm." />
      {unavailable && view === "upload" && (
        <Alert type="info">Bill scanning isn't switched on yet. Add <b>ANTHROPIC_API_KEY</b> or <b>GROQ_API_KEY</b> to the API service's variables, then reload this page.</Alert>
      )}
      <Alert>{err}</Alert>
      {view === "upload" && (
        <>
          <Uploader onPicked={scan} disabled={unavailable} />
          <div className="card" style={{ marginTop: 18 }}>
            <div className="toolbar"><h3 style={{ fontSize: 15 }}>Recent bills</h3></div>
            <DataTable cols={cols} rows={history.data} loading={history.loading} empty="No bills scanned yet" />
          </div>
        </>
      )}
      {view === "scanning" && <Scanning preview={preview} />}
      {view === "review" && bill && <Review key={bill.id} initial={bill} onClose={reset} onDone={r => { setResult(r); setView("done") }} />}
      {view === "done" && result && <Done result={result} onAnother={reset} openLedger={openLedger} />}
    </>
  )
}
