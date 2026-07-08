import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const EjeContext = createContext(null)

export function EjeProvider({ children }) {
  const [ejes, setEjes] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const res = await axios.get(`${API}/api/admin/ejes`)
      setEjes(res.data)
    } catch {
      setEjes([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return <EjeContext.Provider value={{ ejes, loading, refresh }}>{children}</EjeContext.Provider>
}

export function useEjes() {
  const ctx = useContext(EjeContext)
  if (!ctx) throw new Error('useEjes must be used within EjeProvider')
  return ctx
}
