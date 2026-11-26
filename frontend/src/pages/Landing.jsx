import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Loader2, Play, Search } from "lucide-react"
import { api } from "../lib/api"
import { useAuth } from "../lib/auth"
import { LogoMark, Wordmark } from "../components/Brand"
import { WaText } from "../components/WaText"
import { CommandResult } from "../components/CommandResult"
import { Pill, Segmented } from "../components/ui"
import { useCountUp } from "../lib/motion"
import "./landing.css"

// Anek Latin is by Ek Type, an Indian foundry. Its narrow widths read like shop signboards and price boards.
const FONT_URL = "https://fonts.googleapis.com/css2?family=Anek+Latin:wdth,wght@75..125,400..800&display=swap"
const REPO = "https://github.com/Saksham653/inventory-management-system"
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
const wait = ms => new Promise(r => setTimeout(r, reduced() ? 0 : ms))

// Every figure below is from the demo shop the "Open the demo shop" button signs you into.
const TODAY = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }).replace(/^(\w+) /, "$1, ")

const BRIEF = {
  en: {
    brief: `*Good morning, Sarah*\nYour shop on ${TODAY}.\n\n*₹30.7L* in stock at cost.\n*₹2.1L* of sales at risk: 2 products will run out before the next delivery.\n*₹11.6L* stuck: no sale in 60+ days (MacBook Air M3, Vivo V12).\n\n*Reorder today* · ₹15.3L\n• iPhone 15 Pro: 11 pcs · ₹13L\n• HP Pavilion 15: 5 pcs · ₹2.3L\n\nYesterday: 2 sales · ₹2.9L.\n\nTap *Approve order* to draft these purchase orders, or reply with any command, like "sold 2 Galaxy S24".`,
    buttons: { approve: "Approve order", stuck: "Stuck stock", skip: "Not today" },
    approve: "Done: drafted PO-0041, PO-0042 · ₹15,32,500 at cost. They're drafts: send them to suppliers from Purchase orders.",
    undo: "Undone: Draft 2 purchase orders.",
    stuck: "*Stuck stock*\n₹11,60,800 is tied up in 2 products that haven't sold in 60+ days.\n• MacBook Air M3: ₹8,08,800 (last sold 96 days ago)\n• Vivo V12: ₹3,52,000 (last sold 63 days ago)\n\nIdeas to free this cash are on Paisa Radar.",
    skip: "Okay, no order today. Tomorrow's brief comes at 9:00 am.",
  },
  hi: {
    brief: `*Good morning, Sarah*\nAaj ka hisaab, ${TODAY}.\n\nDukaan mein *₹30.7L* ka maal hai (cost pe).\n*₹2.1L* ki sale khatre mein: 2 items agli delivery se pehle khatam ho jayenge.\n*₹11.6L* ka maal atka hai: 60+ din se nahi bika (MacBook Air M3, Vivo V12).\n\n*Aaj mangao* · ₹15.3L\n• iPhone 15 Pro: 11 pcs · ₹13L\n• HP Pavilion 15: 5 pcs · ₹2.3L\n\nKal: 2 sales · ₹2.9L.\n\nPO banane ke liye *Order approve* dabao, ya koi bhi command bhejo, jaise "2 Galaxy S24 beche".`,
    buttons: { approve: "Order approve", stuck: "Atka maal", skip: "Aaj nahi" },
    approve: "Ho gaya: PO-0041, PO-0042 draft ban gaye · ₹15,32,500 cost pe. Yeh drafts hain: supplier ko Purchase orders se bhejo.",
    undo: "Wapas le liya: Draft 2 purchase orders.",
    stuck: "*Atka maal*\n₹11,60,800 do items mein atka hai jo 60+ din se nahi bike.\n• MacBook Air M3: ₹8,08,800 (96 din pehle bika)\n• Vivo V12: ₹3,52,000 (63 din pehle bika)\n\nYeh paisa nikalne ke ideas Paisa Radar pe hain.",
    skip: "Theek hai, aaj order nahi. Kal ka hisaab 9:00 am baje aayega.",
  },
}

const SHELF = [
  { label: "Sold in the last 30 days", value: 1602100, color: "var(--teal)", items: "iPhone 15 Pro, Samsung Galaxy S24, HP Pavilion 15, USB-C Hub 7-in-1" },
  { label: "Last sold 31 to 60 days ago", value: 307200, color: "var(--blue)", items: "iPad Air 5" },
  { label: "Last sold 61 to 90 days ago", value: 352000, color: "var(--amber)", items: "Vivo V12", stuck: true },
  { label: "Not sold in over 90 days", value: 808800, color: "var(--coral)", items: "MacBook Air M3", stuck: true },
]
const SHELF_TOTAL = SHELF.reduce((a, r) => a + r.value, 0)
const inr = n => "₹" + new Intl.NumberFormat("en-IN").format(n)

const po = (id, command, lines) => ({
  id, command, kind: "draft_purchase_order", interpreted_by: "rules", status: "proposed", can_execute: true, can_undo: false,
  preview: {
    kind: "draft_purchase_order", title: `Draft ${lines.length > 1 ? "2 purchase orders" : "1 purchase order"}`,
    summary: `${lines.reduce((a, l) => a + l.qty, 0)} units across ${lines.length} product${lines.length > 1 ? "s" : ""} · ${inr(lines.reduce((a, l) => a + l.total, 0))} at cost. Drafts only: nothing is sent to suppliers.`,
    lines, warnings: [],
  },
  done: { numbers: lines.length > 1 ? ["PO-0041", "PO-0042"] : ["PO-0041"] },
})
const IPHONE = { product_id: 2, product: "iPhone 15 Pro", supplier: "Apple Pvt Ltd", reason: "Paisa Radar suggestion", qty: 11, unit_cost: 118500, total: 1303500 }
const HP = { product_id: 5, product: "HP Pavilion 15", supplier: "HP India", reason: "Paisa Radar suggestion", qty: 5, unit_cost: 45800, total: 229000 }
const COMMANDS = {
  "reorder iPhones": po(1, "reorder iPhones", [IPHONE]),
  "20 USB-C Hub aaye": {
    id: 2, command: "20 USB-C Hub aaye", kind: "adjust_stock", interpreted_by: "rules", status: "proposed", can_execute: true, can_undo: false,
    preview: {
      kind: "adjust_stock", title: "Add 20 × USB-C Hub 7-in-1", summary: "Stock in · stock 45 → 65 pcs", warnings: [],
      lines: [{ product_id: 6, product: "USB-C Hub 7-in-1", before: 45, change: 20, after: 65 }],
    },
    done: { product_id: 6 },
  },
  "kya khatam hone wala hai?": {
    id: 3, command: "kya khatam hone wala hai?", kind: "answer", interpreted_by: "rules", status: "answered", can_execute: false, can_undo: false,
    preview: {
      kind: "answer", title: "Answer", answer: "2 products won't last until the next delivery.",
      rows: [
        { label: "iPhone 15 Pro", value: "3 left · 6 days", detail: "order 11 · ₹13,03,500" },
        { label: "HP Pavilion 15", value: "2 left · 7.5 days", detail: "order 5 · ₹2,29,000" },
      ],
      suggestions: ["reorder everything running low"],
    },
  },
  "reorder everything running low": po(4, "reorder everything running low", [IPHONE, HP]),
}
const COMMAND_CHIPS = ["reorder iPhones", "20 USB-C Hub aaye", "kya khatam hone wala hai?"]

const BILL = [
  { text: "APL IPHONE15 PRO 128", qty: 5, rate: "1,18,500", amount: "5,92,500", match: "iPhone 15 Pro", status: "Matched", tone: "ok" },
  { text: "USB C HUB 7IN1 GRY", qty: 20, rate: "2,200", amount: "44,000", match: "USB-C Hub 7-in-1", status: "Matched", tone: "ok" },
  { text: "SAMSNG S24 8/256", qty: 3, rate: "70,400", amount: "2,11,200", match: "Samsung Galaxy S24", status: "Check", tone: "warn" },
  { text: "BOAT AIRDOPES 141", qty: 10, rate: "1,150", amount: "11,500", match: "New product", status: "New", tone: "info" },
]

const TRUST = [
  ["You see it before it happens", "Every command, bill and WhatsApp reply shows exactly what will change. Nothing runs until you confirm."],
  ["Undo is always there", "Orders are cancelled, stock and prices are put back, and the stock ledger keeps a record of both."],
  ["Every unit has a history", "Stock only moves through the ledger: sales, bills, returns and corrections, with who did it and when."],
  ["Every number shows its working", "Tap a figure on Paisa Radar to see the formula and the sales it came from."],
  ["Staff see what they need", "Owners, managers and staff get different permissions. Staff can record sales but can't change prices or draft orders."],
  ["Works without an AI key", "Everyday commands and all the numbers run on plain rules. Add a key for free-form questions and bill photos."],
]

const ROLES = {
  admin: ["Owner", "Everything, including the team and WhatsApp settings"],
  manager: ["Manager", "Stock, purchase orders, prices and supplier bills"],
  staff: ["Staff", "Recording sales and looking up stock"],
}

const FILM = { src: "/film/stockwaves-film.mp4", poster: "/film/stockwaves-poster.jpg", length: "1:09" }
const H1 = "Know where your money is stuck before you open the shop."

/** True once the element has scrolled into view (and stays true). */
function useInView(ref) {
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    if (!("IntersectionObserver" in window)) { setSeen(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect() } }, { rootMargin: "0px 0px -18% 0px" })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, seen])
  return seen
}

/** A rupee figure that counts up when its row comes into view. */
function ShelfAmount({ value, on }) {
  const v = useCountUp(on ? value : 0, 1300)
  return <>{inr(Math.round(v))}</>
}

/** The product film: poster and one play button; the browser's own controls once it plays. */
function FilmPlayer() {
  const ref = useRef(null)
  const [playing, setPlaying] = useState(false)
  const play = () => {
    const v = ref.current
    if (!v) return
    setPlaying(true)
    v.play().catch(() => setPlaying(false))
  }
  return (
    <div className={`lp-film-frame ${playing ? "on" : ""}`}>
      <video ref={ref} src={FILM.src} poster={FILM.poster} preload="none" playsInline controls={playing}
        onEnded={() => setPlaying(false)} aria-label="StockWaves product film" />
      {!playing && (
        <button className="lp-film-play" onClick={play} aria-label={`Play the StockWaves film, ${FILM.length}`}>
          <span className="lp-film-icon"><Play size={30} fill="currentColor" strokeWidth={0} /></span>
          <span className="lp-film-label">Play the film<span className="lp-film-len">{FILM.length}</span></span>
        </button>
      )}
    </div>
  )
}

function useFont() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONT_URL}"]`)) return
    const l = document.createElement("link")
    l.rel = "stylesheet"
    l.href = FONT_URL
    document.head.appendChild(l)
  }, [])
}

/* ---------- Hero: the 9 am WhatsApp brief ---------- */
function BriefPhone() {
  const [lang, setLang] = useState("en")
  const [thread, setThread] = useState([])
  const [typing, setTyping] = useState(true)
  const [used, setUsed] = useState({})
  const body = useRef(null)
  const t = BRIEF[lang]

  useEffect(() => {
    let live = true
    setUsed({})
    setThread([])
    setTyping(true)
    wait(thread.length ? 250 : 1100).then(() => {
      if (!live) return
      setTyping(false)
      setThread([{ id: "brief", dir: "out", text: BRIEF[lang].brief, buttons: ["approve", "stuck", "skip"] }])
    })
    return () => { live = false }
  }, [lang]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => { body.current?.scrollTo({ top: body.current.scrollHeight, behavior: reduced() ? "auto" : "smooth" }) }, [thread.length, typing])

  const tap = async key => {
    if (typing || used[key]) return
    const label = key === "undo" ? "Undo" : t.buttons[key]
    setUsed(u => ({ ...u, [key]: true, ...(key === "approve" ? { skip: true } : {}), ...(key === "skip" ? { approve: true } : {}) }))
    setThread(th => [...th, { id: key + "-in", dir: "in", text: label }])
    setTyping(true)
    await wait(700)
    setTyping(false)
    setThread(th => [...th, { id: key, dir: "out", text: t[key], buttons: key === "approve" ? ["undo"] : [] }])
  }
  const time = new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })

  return (
    <div className="lp-phone">
      <div className="phone">
        <div className="phone-screen">
          <div className="phone-head">
            <span className="phone-avatar"><LogoMark size={20} /></span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <b>StockWaves</b>
              <span>{typing ? "typing…" : "business account"}</span>
            </div>
          </div>
          <div className="phone-body" ref={body}>
            <div className="wa-day">Today</div>
            {thread.map(m => (
              <div key={m.id} className={`wa-msg ${m.dir}`}>
                <div className="wa-bubble">
                  <WaText text={m.text} />
                  <span className="wa-meta">{m.id === "brief" ? "9:00 am" : time}</span>
                </div>
                {m.buttons?.length > 0 && (
                  <div className="wa-buttons">
                    {m.buttons.map(k => (
                      <button key={k} disabled={typing || used[k]} onClick={() => tap(k)}>{k === "undo" ? "Undo" : t.buttons[k]}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {typing && <div className="wa-msg out"><div className="wa-bubble wa-typing"><i /><i /><i /></div></div>}
          </div>
          <div className="phone-input">
            <input readOnly placeholder="Tap a button to reply" aria-label="Replies in this preview are the buttons above" tabIndex={-1} />
          </div>
        </div>
      </div>
      <div className="lp-phone-foot">
        <span>Brief language</span>
        <Segmented options={[{ value: "en", label: "English" }, { value: "hi", label: "Hinglish" }]} value={lang} onChange={setLang} />
      </div>
    </div>
  )
}

/* ---------- The command bar, with the app's own preview card ---------- */
function CommandDemo() {
  const [typed, setTyped] = useState("")
  const [action, setAction] = useState(null)
  const [busy, setBusy] = useState("")
  const run = useRef(0)

  const play = async text => {
    const id = ++run.current
    setAction(null)
    setBusy("")
    if (reduced()) setTyped(text)
    else {
      for (let i = 1; i <= text.length; i++) {
        if (run.current !== id) return
        setTyped(text.slice(0, i))
        await new Promise(r => setTimeout(r, 32))
      }
    }
    setBusy("plan")
    await wait(450)
    if (run.current !== id) return
    setBusy("")
    setAction(COMMANDS[text])
  }
  useEffect(() => { play(COMMAND_CHIPS[0]) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const confirm = async () => {
    setBusy("exec")
    await wait(400)
    setBusy("")
    setAction(a => ({ ...a, status: "done", can_execute: false, can_undo: true, result: a.done, executed_at: new Date().toISOString() }))
  }
  const undo = async () => {
    setBusy("undo")
    await wait(350)
    setBusy("")
    setAction(a => ({ ...a, status: "undone", can_undo: false }))
  }

  return (
    <div className="lp-cmd">
      <div className="lp-cmd-input" aria-live="polite">
        <Search size={17} className="faint" />
        <span className="lp-cmd-text">{typed}</span>
        <span className="lp-caret" aria-hidden="true" />
      </div>
      <div className="lp-cmd-body">
        {(action || busy === "plan") && (
          <CommandResult action={action} busy={busy} onConfirm={confirm} onUndo={undo}
            onRun={s => COMMANDS[s] && play(s)} onCancel={() => setAction(null)} />
        )}
        {done(action) && <p className="lp-cmd-after">{action.status === "done" ? "In the app this is now in the action log, with Undo." : "Put back. Nothing else changed."}</p>}
      </div>
      <div className="lp-cmd-chips">
        <span>Try</span>
        {COMMAND_CHIPS.map(c => <button key={c} className="chip" onClick={() => play(c)}>{c}</button>)}
      </div>
    </div>
  )
}
const done = a => a && (a.status === "done" || a.status === "undone")

/* ---------- Snap-a-Bill ---------- */
function BillDemo() {
  const [step, setStep] = useState("idle") // idle, reading, read, added
  const [lit, setLit] = useState(-1)

  const read = async () => {
    setStep("reading")
    for (let i = 0; i < BILL.length; i++) {
      await wait(380)
      setLit(i)
    }
    await wait(300)
    setStep("read")
  }
  const pieces = BILL.reduce((a, b) => a + b.qty, 0)
  return (
    <div className="lp-bill-demo">
      <div className={`lp-bill ${step === "reading" ? "reading" : ""}`}>
        {step === "reading" && <span className="lp-laser" aria-hidden="true" />}
        <h4>LAXMI ELECTRONICS WHOLESALE</h4>
        <p className="lp-bill-center">Lamington Road, Mumbai</p>
        <div className="lp-bill-meta"><span>Bill no. LEW/2411/087</span><span>Date 24-11-2026</span></div>
        <div className="lp-rule" />
        <div className="lp-bill-row head"><span>Item</span><span>Qty</span><span>Rate</span><span>Amount</span></div>
        {BILL.map((b, i) => (
          <div key={b.text} className={`lp-bill-row ${i <= lit && step !== "idle" ? "lit" : ""}`}>
            <span>{b.text}</span><span>{b.qty}</span><span>{b.rate}</span><span>{b.amount}</span>
          </div>
        ))}
        <div className="lp-rule" />
        <div className="lp-bill-sum"><span>Sub total</span><span>8,59,200</span></div>
        <div className="lp-bill-sum"><span>GST 18%</span><span>1,54,656</span></div>
        <div className="lp-bill-sum total"><span>Total</span><span>10,13,856</span></div>
      </div>

      <div className="lp-match">
        {step === "idle" && (
          <div className="lp-match-empty">
            <p>A supplier bill, photographed on a phone.</p>
            <button className="btn primary lp-btn" onClick={read}>Read this bill</button>
          </div>
        )}
        {step !== "idle" && BILL.map((b, i) => i <= lit && (
          <div key={b.text} className="lp-match-row">
            <div>
              <b>{b.match}</b>
              <small>{b.text}</small>
            </div>
            <span className="lp-match-qty num">+{b.qty}</span>
            <Pill tone={b.tone} dot>{b.status}</Pill>
          </div>
        ))}
        {step === "reading" && <div className="lp-match-wait"><Loader2 size={15} className="spin" />Reading line {Math.min(lit + 2, BILL.length)} of {BILL.length}</div>}
        {step === "read" && (
          <div className="lp-match-foot">
            <span>Samsung's spelling is close, so it asks you to check. The earbuds aren't in your catalogue yet, so it offers to add them.</span>
            <button className="btn primary lp-btn" onClick={() => setStep("added")}>Add {pieces} pieces to stock</button>
          </div>
        )}
        {step === "added" && (
          <div className="lp-match-foot">
            <span><b>Added to stock.</b> The stock ledger has one entry per product, linked to this bill. Next time, this supplier's names match on their own.</span>
            <button className="btn lp-btn" onClick={() => { setStep("idle"); setLit(-1) }}>Read it again</button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- Page ---------- */
export default function Landing() {
  useFont()
  const { login } = useAuth()
  const [demo, setDemo] = useState(null)   // null while loading, [] when the server has no demo
  const [entering, setEntering] = useState("")
  const [err, setErr] = useState("")
  const [scrolled, setScrolled] = useState(false)
  const shelfRef = useRef(null)
  const shelfOn = useInView(shelfRef)

  useEffect(() => { api("/auth/demo-accounts").then(setDemo).catch(() => setDemo([])) }, [])
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8)
    window.addEventListener("scroll", on, { passive: true })
    return () => window.removeEventListener("scroll", on)
  }, [])

  const signIn = () => { window.location.hash = "login" }
  const enter = async role => {
    const acct = (demo || []).find(d => d.role === role)
    if (!acct) return signIn()
    setEntering(role); setErr("")
    try {
      history.replaceState(null, "", "#today")
      await login(acct.email, acct.password)
    } catch (e) {
      history.replaceState(null, "", "#home")
      setErr(`Couldn't open the demo shop: ${e.message}`)
      setEntering("")
    }
  }
  const hasDemo = demo?.length > 0
  const scrollTo = id => document.getElementById(id)?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" })

  return (
    <div className="lp">
      <header className={`lp-nav ${scrolled ? "scrolled" : ""}`}>
        <div className="lp-wrap lp-nav-in">
          <a className="lp-brand" href="#home" aria-label="StockWaves home"><LogoMark size={26} /><Wordmark size={19} /></a>
          <nav className="lp-links" aria-label="Sections">
            <button onClick={() => scrollTo("film")}>Watch the film</button>
            <button onClick={() => scrollTo("money")}>Paisa Radar</button>
            <button onClick={() => scrollTo("commands")}>Commands</button>
            <button onClick={() => scrollTo("bills")}>Bills</button>
          </nav>
          <span className="lp-spacer" />
          <button className="btn ghost lp-signin" onClick={signIn}>Sign in</button>
          {hasDemo && <button className="btn primary" onClick={() => enter("admin")} disabled={!!entering}>
            {entering === "admin" ? <Loader2 size={15} className="spin" /> : null}Open the demo shop
          </button>}
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-grid">
            <div className="lp-hero-copy">
              <h1 className="lp-h1" aria-label={H1}>
                {H1.split(" ").map((w, i) => <span key={i} aria-hidden="true"><span className="lp-w" style={{ "--i": i }}>{w}</span>{" "}</span>)}
              </h1>
              <p className="lp-lead">
                StockWaves counts your stock in rupees, not just pieces. Every morning it sends one WhatsApp: what isn't selling,
                what runs out before the next delivery, and the order to place. Approve it with one tap.
              </p>
              <div className="lp-ctas">
                {hasDemo
                  ? <button className="btn primary lp-btn" onClick={() => enter("admin")} disabled={!!entering}>
                      {entering === "admin" && <Loader2 size={16} className="spin" />}Open the demo shop
                    </button>
                  : <button className="btn primary lp-btn" onClick={signIn}>Sign in</button>}
                <button className="btn lp-btn" onClick={() => scrollTo("film")}><Play size={15} fill="currentColor" strokeWidth={0} />Watch the film</button>
              </div>
              {err && <p className="lp-err" role="alert">{err}</p>}
              {hasDemo && <p className="lp-note">The demo is a sample electronics shop with five months of sales. No sign-up.</p>}
            </div>
            <BriefPhone />
          </div>
        </section>

        <section className="lp-section lp-film" id="film">
          <div className="lp-wrap">
            <h2 className="lp-h2">See it work, start to finish</h2>
            <p className="lp-p">
              One shop's day in about a minute: the money stuck on the shelves, an order typed in plain words, a supplier's bill
              read from a photo, and the next morning's WhatsApp. Turn the sound on.
            </p>
            <FilmPlayer />
          </div>
        </section>

        <section className="lp-section" id="money">
          <div className="lp-wrap">
            <h2 className="lp-h2">Every product, counted in rupees and days</h2>
            <p className="lp-p">
              Pieces don't tell you much. Paisa Radar multiplies what's on the shelf by what you paid for it, then sorts it by
              how long ago it last sold. The further down this list, the longer that money has been sitting still.
            </p>
            <div ref={shelfRef} className={`lp-shelf ${shelfOn ? "on" : ""}`} role="table" aria-label="Demo shop stock value by days since last sale">
              {SHELF.map((r, i) => (
                <div key={r.label} className={`lp-shelf-row ${r.stuck ? "stuck" : ""}`} role="row">
                  <div role="cell">
                    <div className="lp-shelf-age">{r.label}</div>
                    <div className="lp-shelf-amt"><ShelfAmount value={r.value} on={shelfOn} /></div>
                  </div>
                  <div className="lp-shelf-bar" role="cell" aria-label={`${Math.round(r.value / SHELF_TOTAL * 100)}% of stock value`}>
                    <i style={{ width: shelfOn ? `${(r.value / SHELF_TOTAL) * 100}%` : 0, background: r.color, transitionDelay: `${i * 120}ms` }} />
                  </div>
                  <div className="lp-shelf-items" role="cell">{r.items}</div>
                </div>
              ))}
            </div>
            <p className="lp-shelf-total">
              <b>{inr(SHELF[2].value + SHELF[3].value)} hasn't sold in 60 days.</b> That's {Math.round((SHELF[2].value + SHELF[3].value) / SHELF_TOTAL * 100)}% of
              what's on this shop's shelves. Paisa Radar puts it at the top of the Today screen with ways to free it: a bundle, a short discount, or a return to the supplier.
            </p>
          </div>
        </section>

        <section className="lp-section" id="commands">
          <div className="lp-wrap lp-split">
            <div>
              <h2 className="lp-h2">Type it the way you'd tell your staff</h2>
              <p className="lp-p">
                "Reorder iPhones." "20 USB-C Hub aaye." "Kya khatam hone wala hai?" StockWaves shows exactly what will change and waits
                for you to confirm. Press Ctrl K anywhere in the app, or send the same words on WhatsApp.
              </p>
              <p className="lp-p lp-p-small">Everyday commands work without any AI. With an AI key it also understands your own wording and open questions.</p>
            </div>
            <CommandDemo />
          </div>
        </section>

        <section className="lp-section" id="bills">
          <div className="lp-wrap">
            <h2 className="lp-h2">Photograph the supplier's bill. Stock goes in.</h2>
            <p className="lp-p">
              StockWaves reads each line and matches it to your products, even when the supplier spells them their own way. It
              remembers how each supplier writes them, so the next bill matches by itself. You check it, then add it to stock in one go.
            </p>
            <BillDemo />
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-wrap">
            <h2 className="lp-h2">Nothing changes until you say so</h2>
            <dl className="lp-trust">
              {TRUST.map(([dt, dd]) => <div key={dt}><dt>{dt}</dt><dd>{dd}</dd></div>)}
            </dl>
          </div>
        </section>

        <section className="lp-section lp-end">
          <div className="lp-wrap lp-end-grid">
            <div>
              <h2 className="lp-h2">{hasDemo ? "Walk around the demo shop" : "Sign in to your shop"}</h2>
              <p className="lp-p">
                {hasDemo
                  ? "A sample electronics shop with five months of sales, stock that's stuck and items about to run out. Open it as any of the three people who work there. Changes you make are shared with other visitors, and each one can be undone."
                  : "Use the email and password your shop's admin gave you."}
              </p>
            </div>
            <div className="lp-roles">
              {hasDemo && demo.map(d => ROLES[d.role] && (
                <button key={d.email} className="lp-role" onClick={() => enter(d.role)} disabled={!!entering}>
                  <div><b>{ROLES[d.role][0]}</b><span>{ROLES[d.role][1]}</span></div>
                  <span className="lp-role-go">{entering === d.role ? <Loader2 size={16} className="spin" /> : `Open as ${ROLES[d.role][0].toLowerCase()}`}</span>
                </button>
              ))}
              <button className="lp-role quiet" onClick={signIn}>
                <div><b>Your own shop</b><span>Sign in with your work email</span></div>
                <span className="lp-role-go">Sign in</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-wrap lp-foot-in">
          <span className="lp-brand"><LogoMark size={20} /><Wordmark size={15} /></span>
          <span>Inventory for Indian shops, counted in rupees.</span>
          <span className="lp-spacer" />
          <a href={REPO} target="_blank" rel="noreferrer">Source code on GitHub</a>
        </div>
      </footer>
    </div>
  )
}
