import { createContext, useContext, useEffect, useState } from "react"
import { api, getSession, onSessionEnd, setSession } from "./api"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getSession()?.user ?? null)
  const [checking, setChecking] = useState(() => !!getSession())

  useEffect(() => {
    onSessionEnd(() => setUser(null))
    if (!getSession()) return
    // Confirm the saved session is still valid (refreshes the token if needed).
    api("/auth/me")
      .then(u => setUser(u))
      .catch(() => { setSession(null); setUser(null) })
      .finally(() => setChecking(false))
  }, [])

  const login = async (email, password) => {
    const s = await api("/auth/login", { method: "POST", body: { email, password } })
    setSession(s)
    setUser(s.user)
    try { localStorage.setItem("sw:returning", "1") } catch { /* storage blocked */ }
  }

  const logout = () => {
    setSession(null)
    setUser(null)
  }

  const can = {
    manage: user?.role === "admin" || user?.role === "manager",
    admin: user?.role === "admin",
  }

  return <AuthContext.Provider value={{ user, checking, login, logout, can }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
