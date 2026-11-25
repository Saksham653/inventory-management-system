import { useCallback, useEffect, useState } from "react"
import { api } from "./api"

// Load a GET endpoint; returns { data, loading, error, reload }.
export function useApi(path, fallback = null) {
  const [data, setData] = useState(fallback)
  const [loading, setLoading] = useState(!!path)
  const [error, setError] = useState("")

  const reload = useCallback(async () => {
    if (!path) return
    setLoading(true)
    setError("")
    try {
      setData(await api(path))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [path])

  useEffect(() => { reload() }, [reload])

  // Refresh when a command-bar action changes data elsewhere on the page.
  useEffect(() => {
    if (!path) return
    const onChange = () => reload()
    window.addEventListener("sw:data-changed", onChange)
    return () => window.removeEventListener("sw:data-changed", onChange)
  }, [path, reload])

  return { data, loading, error, reload, setData }
}
