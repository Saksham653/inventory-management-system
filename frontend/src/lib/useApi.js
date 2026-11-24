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

  return { data, loading, error, reload, setData }
}
