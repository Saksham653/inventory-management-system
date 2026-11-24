import { useState } from "react"
import { Plus } from "lucide-react"
import { api } from "../lib/api"
import { useAuth } from "../lib/auth"
import { useApi } from "../lib/useApi"
import { useToast } from "../lib/motion"
import { date, rupees } from "../lib/format"
import { Alert, Button, Confirm, DataTable, Input, Modal, PageHead, Pill, SearchBox, Select, useForm } from "../components/ui"

const EMPTY = { name: "", email: "", role: "Staff", gender: "", contact: "", dob: "", doj: "", address: "", salary: "" }

export default function Team() {
  const { can } = useAuth()
  const toast = useToast()
  const { data, loading, error, reload } = useApi("/employees/", [])
  const [q, setQ] = useState("")
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  const { values: f, setValues, set } = useForm(EMPTY)

  const open = e => {
    setErr("")
    setValues(e === "new" ? EMPTY : Object.fromEntries(Object.keys(EMPTY).map(k => [k, e[k] ?? ""])))
    setEditing(e)
  }
  const save = async () => {
    if (!f.name.trim() || !f.email.trim()) return setErr("Name and email are required")
    setBusy(true); setErr("")
    try {
      const body = { ...f, name: f.name.trim(), email: f.email.trim(), salary: f.salary === "" ? null : +f.salary }
      for (const k of ["gender", "contact", "dob", "doj", "address"]) body[k] = body[k] || null
      if (editing === "new") await api("/employees/", { method: "POST", body })
      else await api(`/employees/${editing.id}`, { method: "PATCH", body })
      toast(editing === "new" ? `Added ${f.name.trim()}` : `Saved ${f.name.trim()}`)
      setEditing(null); reload()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  const payroll = data.reduce((a, e) => a + (e.salary || 0), 0)
  const rows = data.filter(e => !q || e.name.toLowerCase().includes(q.toLowerCase()) || e.email.toLowerCase().includes(q.toLowerCase()))
  const cols = [
    { key: "name", label: "Name", render: e => <div><div className="strong">{e.name}</div><div className="faint" style={{ fontSize: 12 }}>{e.email}</div></div> },
    { key: "role", label: "Role", render: e => <Pill tone={e.role === "Admin" ? "ok" : e.role === "Manager" ? "info" : ""}>{e.role}</Pill> },
    { key: "contact", label: "Phone", render: e => e.contact ? <span className="num">{e.contact}</span> : <span className="faint">—</span> },
    { key: "address", label: "City", render: e => e.address || <span className="faint">—</span> },
    { key: "doj", label: "Joined", render: e => <span className="muted">{date(e.doj)}</span> },
    { key: "salary", label: "Salary / month", align: "right", render: e => e.salary ? <span className="num">{rupees(e.salary)}</span> : <span className="faint">—</span> },
  ]

  return (
    <>
      <PageHead title="Team" sub={`${data.length} people · ${rupees(payroll)} monthly payroll`}>
        {can.admin && <Button variant="primary" icon={Plus} onClick={() => open("new")}>Add person</Button>}
      </PageHead>
      <Alert>{error}</Alert>
      <div className="card">
        <div className="toolbar"><SearchBox value={q} onChange={setQ} placeholder="Search team" /></div>
        <DataTable cols={cols} rows={rows} loading={loading} empty="No team members yet"
          onEdit={can.admin ? open : undefined} onDelete={can.admin ? setDeleting : undefined} />
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Add team member" : "Edit team member"} width={580}>
        <div className="form-grid">
          <Input className="full" label="Full name" value={f.name} onChange={set("name")} />
          <Input label="Email" type="email" value={f.email} onChange={set("email")} />
          <Input label="Phone" type="tel" value={f.contact} onChange={set("contact")} />
          <Select label="Role" value={f.role} onChange={set("role")} placeholder="Choose role" options={["Admin", "Manager", "Staff"].map(r => ({ value: r, label: r }))} />
          <Select label="Gender" value={f.gender} onChange={set("gender")} placeholder="Prefer not to say" options={["Female", "Male", "Other"].map(r => ({ value: r, label: r }))} />
          <Input label="Date of birth" type="date" value={f.dob} onChange={set("dob")} />
          <Input label="Joining date" type="date" value={f.doj} onChange={set("doj")} />
          <Input label="Monthly salary (₹)" type="number" min="0" value={f.salary} onChange={set("salary")} />
          <Input label="City or address" value={f.address} onChange={set("address")} />
        </div>
        <Alert>{err}</Alert>
        <div className="form-actions">
          <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={save}>{editing === "new" ? "Add person" : "Save changes"}</Button>
        </div>
      </Modal>
      <Confirm open={!!deleting} onClose={() => setDeleting(null)} title="Remove team member?"
        message={`${deleting?.name} will be removed from the team list.`} confirmLabel="Remove"
        onConfirm={async () => { await api(`/employees/${deleting.id}`, { method: "DELETE" }); toast(`Removed ${deleting.name}`); reload() }} />
    </>
  )
}
