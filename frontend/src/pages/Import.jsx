import { useState } from "react"
import { FileSpreadsheet, Upload } from "lucide-react"
import { api } from "../lib/api"
import { useToast } from "../lib/motion"
import { Alert, Button, PageHead, Stat } from "../components/ui"

export default function Import() {
  const toast = useToast()
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null)
  const [err, setErr] = useState("")

  const upload = async () => {
    if (!file) return
    setBusy(true); setErr(""); setRes(null)
    const form = new FormData()
    form.append("file", file)
    try { const r = await api("/uploader/upload", { method: "POST", form }); setRes(r); toast(`Imported ${r.summary.added} new, ${r.summary.updated} updated`) } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div style={{ maxWidth: 820 }}>
      <PageHead title="Import data" sub="Add or update products from a spreadsheet. Stock changes are written to the ledger." />
      <label htmlFor="import-file" className={`drop ${file ? "has-file" : ""}`}>
        <FileSpreadsheet size={36} className={file ? "up" : "faint"} style={{ marginBottom: 10 }} />
        <div style={{ fontWeight: 600, fontSize: 16 }}>{file ? file.name : "Choose a CSV, Excel, JSON or XML file"}</div>
        <div className="faint" style={{ marginTop: 4 }}>{file ? `${Math.round(file.size / 1024)} KB · click to change` : "Up to 5 MB"}</div>
        <input id="import-file" type="file" accept=".csv,.xlsx,.xls,.json,.xml" hidden
          onChange={e => { setFile(e.target.files[0] || null); setRes(null); setErr("") }} />
      </label>
      <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
        <Button variant="primary" icon={Upload} loading={busy} disabled={!file} onClick={upload}>Import</Button>
      </div>
      <div style={{ marginTop: 16 }}><Alert>{err}</Alert></div>
      {res && (
        <div style={{ marginTop: 8 }}>
          <Alert type="success">{res.message}</Alert>
          <div className="stats">
            <Stat label="New products" value={res.summary.added} />
            <Stat label="Updated" value={res.summary.updated} />
            <Stat label="Rows in file" value={res.total_rows} />
          </div>
          {res.summary.errors.length > 0 && (
            <div className="card card-pad">
              <h3 style={{ fontSize: 15, marginBottom: 8 }}>{res.summary.errors.length} rows skipped</h3>
              <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>{res.summary.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )}
        </div>
      )}
      <div className="card card-pad" style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 15, marginBottom: 6 }}>File format</h3>
        <p className="muted" style={{ marginBottom: 12 }}>Required columns: <b>name, sku, qty, price</b>. Optional: <b>cost_price, brand</b>. Products are matched by SKU.</p>
        <pre className="sample">{`name,sku,qty,price,cost_price,brand
iPhone 15,APL-IP15,50,79900,70200,Apple
Galaxy S24,SAM-S24,30,74999,66000,Samsung`}</pre>
      </div>
    </div>
  )
}
