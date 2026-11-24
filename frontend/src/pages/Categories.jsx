import { useState } from "react"
import { Plus } from "lucide-react"
import { api } from "../lib/api"
import { useAuth } from "../lib/auth"
import { useApi } from "../lib/useApi"
import { useToast } from "../lib/motion"
import { date } from "../lib/format"
import { Alert, Button, Confirm, DataTable, Input, Modal, PageHead, Pill, useForm } from "../components/ui"

export default function Categories() {
  const { can } = useAuth()
  const toast = useToast()
  const { data, loading, error, reload } = useApi("/categories/", [])
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  const { values: f, setValues, set } = useForm({ name: "", description: "" })

  const open = c => { setErr(""); setValues(c === "new" ? { name: "", description: "" } : { name: c.name, description: c.description || "" }); setEditing(c) }
  const save = async () => {
    if (!f.name.trim()) return setErr("Give the category a name")
    setBusy(true); setErr("")
    try {
      const body = { name: f.name.trim(), description: f.description || null }
      if (editing === "new") await api("/categories/", { method: "POST", body })
      else await api(`/categories/${editing.id}`, { method: "PATCH", body })
      toast(editing === "new" ? `Added ${f.name.trim()}` : `Saved ${f.name.trim()}`)
      setEditing(null); reload()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  const cols = [
    { key: "name", label: "Category", render: c => <span className="strong">{c.name}</span> },
    { key: "description", label: "Description", render: c => c.description || <span className="faint">—</span> },
    { key: "product_count", label: "Products", render: c => <Pill tone="info">{c.product_count} products</Pill> },
    { key: "created_at", label: "Added", render: c => <span className="muted">{date(c.created_at)}</span> },
  ]

  return (
    <>
      <PageHead title="Categories" sub={`${data.length} categories`}>
        {can.manage && <Button variant="primary" icon={Plus} onClick={() => open("new")}>Add category</Button>}
      </PageHead>
      <Alert>{error}</Alert>
      <div className="card">
        <DataTable cols={cols} rows={data} loading={loading} empty="No categories yet"
          onEdit={can.manage ? open : undefined} onDelete={can.admin ? setDeleting : undefined} />
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Add category" : "Edit category"} width={440}>
        <Input label="Name" value={f.name} onChange={set("name")} />
        <Input label="Description" value={f.description} onChange={set("description")} />
        <Alert>{err}</Alert>
        <div className="form-actions">
          <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={save}>{editing === "new" ? "Add category" : "Save changes"}</Button>
        </div>
      </Modal>
      <Confirm open={!!deleting} onClose={() => setDeleting(null)} title="Delete category?"
        message={`Products in ${deleting?.name} will stay, without a category.`}
        onConfirm={async () => { await api(`/categories/${deleting.id}`, { method: "DELETE" }); toast(`Removed ${deleting.name}`); reload() }} />
    </>
  )
}
