// Small fetch wrapper: adds the access token, refreshes it once on 401,
// and turns API errors into Error objects with the server's message.

const KEY = "sw-session"
const BASE = "/api/v1"

let session = load()
let onLogout = () => {}
let refreshing = null

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null } catch { return null }
}

export function getSession() { return session }

export function setSession(s) {
  session = s
  try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY) } catch { /* private mode */ }
}

export function onSessionEnd(fn) { onLogout = fn }

async function refresh() {
  if (!session?.refresh_token) return false
  refreshing ??= fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  })
    .then(async r => {
      if (!r.ok) return false
      setSession(await r.json())
      return true
    })
    .catch(() => false)
    .finally(() => { refreshing = null })
  return refreshing
}

function errorMessage(data, status) {
  if (!data) return `Request failed (${status})`
  if (typeof data.detail === "string") return data.detail
  if (Array.isArray(data.detail)) {
    // FastAPI validation errors
    return data.detail.map(d => `${d.loc?.slice(1).join(".") || "field"}: ${d.msg}`).join("; ")
  }
  return `Request failed (${status})`
}

export async function api(path, { method = "GET", body, form, retry = true } = {}) {
  const headers = {}
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
  let payload
  if (form) payload = form
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json"
    payload = JSON.stringify(body)
  }

  const res = await fetch(BASE + path, { method, headers, body: payload })

  if (res.status === 401 && retry && session?.refresh_token && !path.startsWith("/auth/")) {
    if (await refresh()) return api(path, { method, body, form, retry: false })
    setSession(null)
    onLogout()
    throw new Error("Your session expired. Please sign in again.")
  }

  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(errorMessage(data, res.status))
  return data
}
