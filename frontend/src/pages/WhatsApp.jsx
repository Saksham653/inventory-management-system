import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  BellRing, Check, CheckCheck, CircleAlert, Clock3, Copy, Languages, Link2, SendHorizontal, Smartphone,
} from "lucide-react"
import { api } from "../lib/api"
import { useApi } from "../lib/useApi"
import { useToast } from "../lib/motion"
import { dateTime, initials } from "../lib/format"
import { Alert, Button, PageHead, Pill, Segmented, Switch } from "../components/ui"
import { LogoMark } from "../components/Brand"
import { WaText } from "../components/WaText"

const DAYS = [{ value: "daily", label: "Every day" }, { value: "mon-sat", label: "Mon–Sat" }]
const LANGS = [{ value: "en", label: "English" }, { value: "hi", label: "Hinglish" }]
const STATUS = { sent: ["Sent", "info"], delivered: ["Delivered", "ok"], read: ["Read", "ok"], failed: ["Failed", "crit"], preview: ["Preview", ""] }
const TRY = ["help", "what's running low?", "reorder iPhones", "undo"]

export function formatPhone(p) {
  if (!p) return ""
  if (p.startsWith("91") && p.length === 12) return `+91 ${p.slice(2, 7)} ${p.slice(7)}`
  return "+" + p
}

function timeLabel(hhmm) {
  const [h, m] = hhmm.split(":").map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`
}

function nextLabel(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })
}

function Ticks({ m }) {
  if (m.direction === "in") return null
  if (m.status === "failed") return <CircleAlert size={13} className="wa-fail" />
  if (m.status === "read") return <CheckCheck size={14} className="wa-read" />
  if (m.status === "delivered") return <CheckCheck size={14} />
  if (m.status === "sent") return <Check size={14} />
  return null
}

function Phone({ thread, busy, onTap, onSend, onBrief, live }) {
  const [text, setText] = useState("")
  const body = useRef(null)
  useLayoutEffect(() => { body.current?.scrollTo({ top: body.current.scrollHeight, behavior: "smooth" }) }, [thread.length, busy])

  const submit = e => {
    e.preventDefault()
    const t = text.trim()
    if (!t || busy) return
    setText("")
    onSend(t)
  }
  let lastDay = ""
  return (
    <div className="phone">
      <div className="phone-screen">
        <div className="phone-head">
          <span className="phone-avatar"><LogoMark size={20} /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <b>StockWaves</b>
            <span>{busy ? "typing…" : live ? "business account" : "preview · nothing is sent"}</span>
          </div>
        </div>
        <div className="phone-body" ref={body}>
          {thread.length === 0 && !busy && (
            <div className="phone-empty">
              <BellRing size={22} />
              <p>This is what lands on your phone each morning.</p>
              <Button size="sm" variant="primary" onClick={onBrief}>Show today's brief</Button>
            </div>
          )}
          {thread.map(m => {
            const day = new Date(m.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
            const showDay = day !== lastDay
            lastDay = day
            return (
              <Fragment key={m.id}>
                {showDay && <div className="wa-day">{day === new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) ? "Today" : day}</div>}
                <div className={`wa-msg ${m.direction}`}>
                  <div className={`wa-bubble ${m.status === "failed" ? "failed" : ""}`} title={m.error || undefined}>
                    <WaText text={m.body || ""} />
                    <span className="wa-meta">
                      {m.simulated && m.direction === "out" && live && <em>preview</em>}
                      {new Date(m.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                      <Ticks m={m} />
                    </span>
                  </div>
                  {m.status === "failed" && m.error && <div className="wa-error">{m.error}</div>}
                  {m.buttons?.length > 0 && (
                    <div className="wa-buttons">
                      {m.buttons.map(b => <button key={b.id} disabled={busy} onClick={() => onTap(b)}>{b.title}</button>)}
                    </div>
                  )}
                </div>
              </Fragment>
            )
          })}
          {busy && <div className="wa-msg out"><div className="wa-bubble wa-typing"><i /><i /><i /></div></div>}
        </div>
        <form className="phone-input" onSubmit={submit}>
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Message" aria-label="Message to StockWaves" maxLength={300} />
          <button type="submit" disabled={!text.trim() || busy} aria-label="Send"><SendHorizontal size={17} /></button>
        </form>
      </div>
    </div>
  )
}

function Recipient({ r, editable, onSaved }) {
  const toast = useToast()
  const [phone, setPhone] = useState(formatPhone(r.phone))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  useEffect(() => { setPhone(formatPhone(r.phone)) }, [r.phone])
  const dirty = phone.replace(/\D/g, "") !== (r.phone || "") && phone !== formatPhone(r.phone)

  const save = async patch => {
    setBusy(true); setErr("")
    try {
      const out = await api(`/whatsapp/recipients/${r.id}`, { method: "PUT", body: patch })
      if ("phone" in patch) toast(out.phone ? `Saved ${formatPhone(out.phone)} for ${r.name}` : `Removed ${r.name}'s number`)
      else toast(out.whatsapp_brief ? `${r.name} gets the morning brief` : `${r.name} won't get the brief`)
      onSaved()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const [label, tone] = r.last_brief ? STATUS[r.last_brief.status] || [r.last_brief.status, ""] : ["Not sent yet", ""]
  return (
    <div className="wa-person">
      <span className="avatar">{initials(r.name)}</span>
      <div className="wa-person-main">
        <div className="wa-person-name"><b>{r.name}</b><span className="faint">{r.role}</span></div>
        <form className="wa-phone-field" onSubmit={e => { e.preventDefault(); dirty && save({ phone }) }}>
          <Smartphone size={14} className="faint" />
          <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Add WhatsApp number"
            disabled={!editable || busy} aria-label={`WhatsApp number for ${r.name}`} inputMode="tel" />
          {dirty && <Button size="sm" type="submit" loading={busy}>Save</Button>}
        </form>
        {err && <div className="wa-person-err">{err}</div>}
      </div>
      <div className="wa-person-side">
        <Switch checked={r.whatsapp_brief} disabled={!editable || busy || !r.phone} label={`Morning brief for ${r.name}`}
          onChange={v => save({ whatsapp_brief: v })} />
        <span title={r.last_brief?.error || (r.last_brief ? dateTime(r.last_brief.at) : "")}><Pill tone={tone} dot={!!r.last_brief}>{label}</Pill></span>
      </div>
    </div>
  )
}

function Connect({ s }) {
  const toast = useToast()
  const copy = async text => {
    try { await navigator.clipboard.writeText(text); toast("Copied") } catch { toast("Couldn't copy. Select the text instead.") }
  }
  const vars = [
    ["WHATSAPP_TOKEN", s.configured.token, "Permanent token of a Meta system user"],
    ["WHATSAPP_PHONE_NUMBER_ID", s.configured.phone_number_id, "WhatsApp > API Setup, under the number"],
    ["WHATSAPP_APP_SECRET", s.configured.app_secret, "App settings > Basic. Used to check webhooks are really from Meta"],
    ["WHATSAPP_VERIFY_TOKEN", s.configured.verify_token, "Any phrase you choose. Enter the same one in Meta"],
    ["WHATSAPP_BRIEF_TEMPLATE", !!s.configured.template, "Optional: for mornings when you haven't messaged in 24 hours"],
  ]
  return (
    <div className="card card-pad">
      <div className="card-head">
        <h3><Link2 size={16} />Connect a WhatsApp number</h3>
        <Pill tone={s.mode === "live" ? "ok" : "warn"} dot>{s.mode === "live" ? "Live" : "Preview mode"}</Pill>
      </div>
      <ol className="wa-steps">
        <li>
          <b>Create a Meta app with WhatsApp</b>
          <span className="muted">On developers.facebook.com, add the WhatsApp product and a business number. The test number works for trying it with up to 5 phones.</span>
        </li>
        <li>
          <b>Add these on Railway</b>
          <span className="muted">stockwaves → api → Variables. The server restarts by itself.</span>
          <div className="wa-vars">
            {vars.map(([k, okv, hint]) => (
              <div key={k} className="wa-var" title={hint}>
                {okv ? <Check size={14} className="up" /> : <span className="wa-var-dot" />}
                <code>{k}</code>
                <span className="faint">{hint}</span>
              </div>
            ))}
          </div>
        </li>
        <li>
          <b>Point Meta's webhook here</b>
          <span className="muted">WhatsApp → Configuration → Callback URL, with the same verify token. Subscribe to <code>messages</code>.</span>
          <div className="wa-url">
            <code>{s.webhook_url}</code>
            <button className="icon-btn" onClick={() => copy(s.webhook_url)} aria-label="Copy webhook URL"><Copy size={15} /></button>
          </div>
        </li>
        <li>
          <b>Say hi once</b>
          <span className="muted">Send "hi" from your phone to the shop number. WhatsApp lets a business message you freely for 24 hours after you write; the brief template covers the other mornings.</span>
        </li>
      </ol>
    </div>
  )
}

export default function WhatsApp() {
  const toast = useToast()
  const status = useApi("/whatsapp/status")
  const thread = useApi("/whatsapp/thread", [])
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(null)
  const [err, setErr] = useState("")
  const s = status.data
  const live = s?.mode === "live"

  // In live mode, pick up real replies and delivery ticks.
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => { if (!document.hidden) thread.reload() }, 8000)
    return () => clearInterval(id)
  }, [live, thread.reload])

  const talk = async (body, echo) => {
    setBusy(true); setErr("")
    setPending(echo ? { id: "pending", direction: "in", body: echo, buttons: [], created_at: new Date().toISOString(), status: "received" } : null)
    try {
      await api("/whatsapp/simulate", { method: "POST", body })
      await thread.reload()
      window.dispatchEvent(new Event("sw:data-changed"))
    } catch (e) { setErr(e.message) } finally { setBusy(false); setPending(null) }
  }
  const sendBrief = async real => {
    setBusy(true); setErr("")
    try {
      const m = await api("/whatsapp/brief/send", { method: "POST", body: { preview_only: !real } })
      await thread.reload()
      if (real) {
        if (m.status === "failed") setErr(m.error)
        else toast("Brief sent to your WhatsApp")
        status.reload()
      }
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const saveSettings = async patch => {
    try {
      const out = await api("/whatsapp/settings", { method: "PUT", body: patch })
      status.setData(d => ({ ...d, settings: out.settings, next_brief_at: out.next_brief_at }))
      toast(out.settings.brief_enabled ? `Morning brief on · ${timeLabel(out.settings.brief_time)}` : "Morning brief off")
    } catch (e) { setErr(e.message) }
  }

  if (status.error) return <Alert>{status.error}</Alert>
  if (!s) {
    return <div className="wa-layout"><div className="card card-pad"><div className="skeleton" style={{ height: 320 }} /></div><div className="skeleton" style={{ height: 620, borderRadius: 34 }} /></div>
  }
  const cfg = s.settings
  const me = s.recipients.find(r => r.id === s.me)
  const getting = s.recipients.filter(r => r.whatsapp_brief && r.phone).length
  const shown = pending ? [...thread.data, pending] : thread.data

  return (
    <>
      <PageHead title="WhatsApp brief" sub={`Paisa Radar on your phone at ${timeLabel(cfg.brief_time)}. Approve the reorder with one tap, or reply with any command.`}>
        {live && <Button icon={SendHorizontal} onClick={() => sendBrief(true)} loading={busy} disabled={!me?.phone} title={me?.phone ? undefined : "Add your number below first"}>Send to my WhatsApp</Button>}
      </PageHead>
      {!live && (
        <Alert type="info">
          <b>Preview mode.</b> Nothing leaves the app yet. The phone works exactly like WhatsApp will: tap its buttons or type a reply, and real purchase orders and stock changes happen. Connect a number below to send for real.
        </Alert>
      )}
      <Alert>{err}</Alert>

      <div className="wa-layout">
        <div className="wa-left">
          <div className="card card-pad">
            <div className="card-head">
              <h3><Clock3 size={16} />Morning brief</h3>
              <Switch checked={cfg.brief_enabled} disabled={!s.can_edit} label="Send the morning brief" onChange={v => saveSettings({ brief_enabled: v })} />
            </div>
            <p className="muted wa-lead">
              Stock value, what runs out before the next delivery, what's stuck, and a ready purchase order. Same numbers as Paisa Radar.
            </p>
            <div className="wa-settings">
              <label className="wa-set">
                <span className="faint">Time (IST)</span>
                <input type="time" className="input" value={cfg.brief_time} disabled={!s.can_edit} step={300}
                  onChange={e => e.target.value && status.setData(d => ({ ...d, settings: { ...d.settings, brief_time: e.target.value } }))}
                  onBlur={e => e.target.value && saveSettings({ brief_time: e.target.value })} />
              </label>
              <div className="wa-set">
                <span className="faint">Days</span>
                {s.can_edit ? <Segmented options={DAYS} value={cfg.brief_days} onChange={v => saveSettings({ brief_days: v })} />
                  : <span>{DAYS.find(d => d.value === cfg.brief_days)?.label}</span>}
              </div>
              <div className="wa-set">
                <span className="faint"><Languages size={13} style={{ verticalAlign: -2 }} /> Language</span>
                {s.can_edit ? <Segmented options={LANGS} value={cfg.language} onChange={v => saveSettings({ language: v })} />
                  : <span>{LANGS.find(d => d.value === cfg.language)?.label}</span>}
              </div>
            </div>
            <div className="wa-next">
              {cfg.brief_enabled
                ? <>Next brief <b>{nextLabel(s.next_brief_at)}</b> to {getting === 1 ? "1 person" : `${getting} people`}{getting === 0 && <span className="faint">: add a number below</span>}</>
                : <span className="faint">Off. {s.can_edit ? "Turn it on to get the numbers every morning." : "An admin can turn it on."}</span>}
            </div>
          </div>

          <div className="card">
            <div className="toolbar">
              <h3 style={{ fontSize: 15 }}>Who gets it</h3>
              <span className="faint" style={{ fontSize: 12.5 }}>{s.can_edit ? "Numbers with country code. Ten digits are taken as Indian." : "Your number. Admins manage the team's."}</span>
            </div>
            {s.recipients.map(r => <Recipient key={r.id} r={r} editable={s.can_edit || r.id === s.me} onSaved={status.reload} />)}
          </div>

          <Connect s={s} />
        </div>

        <div className="wa-right">
          <Phone thread={shown} busy={busy} live={live} onBrief={() => sendBrief(false)}
            onTap={b => talk({ button_id: b.id, button_title: b.title }, b.title)}
            onSend={t => talk({ text: t }, t)} />
          <div className="wa-try">
            <button className="chip" onClick={() => sendBrief(false)} disabled={busy}>Today's brief</button>
            {TRY.map(t => <button key={t} className="chip" disabled={busy} onClick={() => talk({ text: t }, t)}>{t}</button>)}
          </div>
        </div>
      </div>
    </>
  )
}
