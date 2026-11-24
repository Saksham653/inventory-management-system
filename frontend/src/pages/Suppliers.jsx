import { useState } from "react"
import { Plus } from "lucide-react"
import { api } from "../lib/api"
import { useAuth } from "../lib/auth"
import { useApi } from "../lib/useApi"
import { useToast } from "../lib/motion"
import { Alert, Button, Confirm, DataTable, Input, Modal, PageHead, Pill, SearchBox, useForm } from "../components/ui"

const EMPTY = { name: "", contact: "", email: "", address: "", description: "", lead_time_days: 3 }

export default function Suppliers() {
  const { can } = useAuth()
  const toast = useToast()
  const { data, loading, error, reload } = useApi("/suppliers/", [])
  const [q, setQ] = useState("")
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  const { values: f, setValues, set } = useForm(EMPTY)

  const open = s => {
    setErr("")
    setValues(s === "new" ? EMPTY : Object.fromEntries(Object.keys(EMPTY).map(k => [k, s[k] ?? ""])))
    setEditing(s)
  }
  const save = async () => {
    if (!f.name.trim()) return setErr("Supplier name is required")
    setBusy(true); setErr("")
    try {
      const body = { ...f, name: f.name.trim(), lead_time_days: +f.lead_time_days || 0 }
      for (const k of ["contact", "email", "address", "description"]) body[k] = body[k] || null
      if (editing === "new") await api("/suppliers/", { method: "POST", body })
      else await api(`/suppliers/${editing.id}`, { method: "PATCH", body })
      toast(editing === "new" ? `Added ${f.name.trim()}` : `Saved ${f.name.trim()}`)
      setEditing(null); reload()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  const rows = data.filter(s => !q || s.name.toLowerCase().includes(q.toLowerCase()) || (s.email || "").toLowerCase().includes(q.toLowerCase()))
  const cols = [
    { key: "name", label: "Supplier", render: s => <div><div className="strong">{s.name}</div><div className="faint" style={{ fontSize: 12 }}>{s.description || ""}</div></div> },
    { key: "contact", label: "Phone", render: s => s.contact ? <span className="num">{s.contact}</span> : <span className="faint">—</span> },
    { key: "email", label: "Email", render: s => s.email || <span className="faint">—</span> },
    { key: "address", label: "City", render: s => s.address || <span className="faint">—</span> },
    { key: "lead_time_days", label: "Lead time", render: s => <Pill>{s.lead_time_days} days</Pill> },
    { key: "product_count", label: "Products", align: "right", render: s => <span className="num">{s.product_count}</span> },
  ]

  return (
    <>
      <PageHead title="Suppliers" sub={`${data.length} suppliers`}>
        {can.manage && <Button variant="primary" icon={Plus} onClick={() => open("new")}>Add supplier</Button>}
      </PageHead>
      <Alert>{error}</Alert>
      <div className="card">
        <div className="toolbar"><SearchBox value={q} onChange={setQ} placeholder="Search suppliers" /></div>
        <DataTable cols={cols} rows={rows} loading={loading} empty="No suppliers yet"
          onEdit={can.manage ? open : undefined} onDelete={can.admin ? setDeleting : undefined} />
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Add supplier" : "Edit supplier"}>
        <div className="form-grid">
          <Input className="full" label="Supplier name" value={f.name} onChange={set("name")} />
          <Input label="Phone" type="tel" value={f.contact} onChange={set("contact")} />
          <Input label="Email" type="email" value={f.email} onChange={set("email")} />
          <Input label="City or address" value={f.address} onChange={set("address")} />
          <Input label="Lead time (days)" type="number" min="0" value={f.lead_time_days} onChange={set("lead_time_days")} hint="How long their deliveries take" />
          <Input className="full" label="What they supply" value={f.description} onChange={set("description")} />
        </div>
        <Alert>{err}</Alert>
        <div className="form-actions">
          <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={save}>{editing === "new" ? "Add supplier" : "Save changes"}</Button>
        </div>
      </Modal>
      <Confirm open={!!deleting} onClose={() => setDeleting(null)} title="Delete supplier?"
        message={`Products from ${deleting?.name} will stay, without a supplier.`}
        onConfirm={async () => { await api(`/suppliers/${deleting.id}`, { method: "DELETE" }); toast(`Removed ${deleting.name}`); reload() }} />
    </>
  )
}
