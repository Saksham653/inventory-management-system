// Indian number formatting: ₹4,12,600 in full, ₹4.1L / ₹1.2Cr when short.

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 })

export function rupees(n) {
  return "₹" + inr.format(Math.round(Number(n) || 0))
}

export function rupeesShort(n) {
  const v = Number(n) || 0
  const a = Math.abs(v)
  if (a >= 1e7) return `₹${(v / 1e7).toFixed(a >= 1e8 ? 0 : 1)}Cr`
  if (a >= 1e5) return `₹${(v / 1e5).toFixed(a >= 1e6 ? 0 : 1)}L`
  if (a >= 1e3) return `₹${(v / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`
  return rupees(v)
}

export function number(n) {
  return inr.format(Number(n) || 0)
}

export function date(d) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

export function dateTime(d) {
  if (!d) return "—"
  return new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
}

export function pctChange(now, before) {
  if (!before) return null
  return Math.round(((now - before) / before) * 100)
}

export function initials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("") || "?"
}
