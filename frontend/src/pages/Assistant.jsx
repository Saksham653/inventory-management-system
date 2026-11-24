import { useEffect, useRef, useState } from "react"
import { Send, Trash2 } from "lucide-react"
import { api } from "../lib/api"
import { useAuth } from "../lib/auth"
import { Button, PageHead } from "../components/ui"

const QUICK = ["Which products are running low?", "What sold best this month?", "Which items haven't sold recently?", "What's my stock worth?"]

export default function Assistant() {
  const { user } = useAuth()
  const hello = { role: "bot", text: `Hi ${user.name.split(" ")[0]}. Ask me about your stock, sales or what to reorder. I read your live data.` }
  const [msgs, setMsgs] = useState([hello])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const end = useRef(null)

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }) }, [msgs, busy])

  const send = async text => {
    const message = (text ?? input).trim()
    if (!message || busy) return
    setMsgs(m => [...m, { role: "me", text: message }])
    setInput("")
    setBusy(true)
    try {
      const r = await api("/chatbot/chat", { method: "POST", body: { message } })
      setMsgs(m => [...m, { role: "bot", text: r.reply }])
    } catch (e) {
      setMsgs(m => [...m, { role: "bot", text: `I couldn't answer that: ${e.message}` }])
    } finally { setBusy(false) }
  }

  return (
    <>
      <PageHead title="Assistant" sub="Plain-language answers from your inventory data.">
        <Button variant="ghost" icon={Trash2} onClick={() => setMsgs([hello])}>Clear chat</Button>
      </PageHead>
      <div className="card chat">
        <div className="chat-log" aria-live="polite">
          {msgs.map((m, i) => <div key={i} className={`msg ${m.role}`}>{m.text}</div>)}
          {busy && <div className="msg bot typing" aria-label="Thinking"><span /><span /><span /></div>}
          <div ref={end} />
        </div>
        <div className="chips">{QUICK.map(q => <button key={q} className="chip" onClick={() => send(q)}>{q}</button>)}</div>
        <form className="chat-input" onSubmit={e => { e.preventDefault(); send() }}>
          <input className="input" value={input} onChange={e => setInput(e.target.value)} placeholder="Ask about stock, sales or suppliers" aria-label="Message" />
          <Button type="submit" variant="primary" icon={Send} disabled={!input.trim() || busy}>Send</Button>
        </form>
      </div>
    </>
  )
}
