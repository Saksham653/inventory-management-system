import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { CheckCircle2 } from "lucide-react"

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

// Animate a number from its previous value to `target` (ease-out-expo).
export function useCountUp(target, duration = 1100) {
  const [value, setValue] = useState(reduced() ? target : 0)
  const from = useRef(0)
  useEffect(() => {
    if (target == null || isNaN(target)) return
    if (reduced()) { setValue(target); return }
    const start = performance.now()
    const a = from.current
    let raf
    const tick = now => {
      const t = Math.min(1, (now - start) / duration)
      const e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
      setValue(a + (target - a) * e)
      if (t < 1) raf = requestAnimationFrame(tick)
      else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

export function CountUp({ value, format = v => Math.round(v).toString(), duration }) {
  const v = useCountUp(value, duration)
  return <>{format(v)}</>
}

// One document-level listener feeds the cursor spotlight on every .card.
export function useSpotlight() {
  useEffect(() => {
    let raf = 0
    let last
    const onMove = e => {
      last = e
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const card = last.target.closest?.(".card")
        if (!card) return
        const r = card.getBoundingClientRect()
        card.style.setProperty("--mx", `${last.clientX - r.left}px`)
        card.style.setProperty("--my", `${last.clientY - r.top}px`)
      })
    }
    window.addEventListener("pointermove", onMove, { passive: true })
    return () => window.removeEventListener("pointermove", onMove)
  }, [])
}

const ToastContext = createContext(() => {})

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  // push(text) or push(text, { action: { label, onClick } }); toasts with an action stay longer.
  const push = useCallback((text, opts = {}) => {
    const id = Math.random().toString(36).slice(2)
    const ms = opts.action ? 7000 : 3200
    setToasts(t => [...t, { id, text, action: opts.action }])
    setTimeout(() => setToasts(t => t.map(x => (x.id === id ? { ...x, out: true } : x))), ms)
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), ms + 300)
  }, [])
  const dismiss = id => setToasts(t => t.filter(x => x.id !== id))
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.out ? "out" : ""}`}>
            <CheckCircle2 size={18} /><span style={{ flex: 1 }}>{t.text}</span>
            {t.action && <button className="toast-action" onClick={() => { dismiss(t.id); t.action.onClick() }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
