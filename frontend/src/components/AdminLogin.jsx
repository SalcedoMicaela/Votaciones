import { useState } from 'react'
import axios from 'axios'
import LogoBar from './LogoBar'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function AdminLogin({ onLogin }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await axios.post(`${API}/api/admin/login`, { password })
      onLogin(password)
    } catch (err) {
      setError(err.response?.status === 401 ? 'Contraseña incorrecta' : 'No se pudo conectar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-16 bg-white p-8 rounded-2xl shadow-md">
      <div className="flex flex-col items-center mb-6">
        <LogoBar size="sm" className="mb-4" />
        <h1 className="text-2xl font-bold text-gray-800">Acceso Administrador</h1>
        <p className="text-sm text-gray-400">Panel del Club de Emprendimiento</p>
      </div>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError('') }}
          placeholder="Contraseña de administrador"
          className={`w-full border rounded-lg px-4 py-3 mb-2 focus:outline-none focus:ring-2 ${
            error ? 'border-red-300 focus:ring-red-300' : 'focus:ring-espe-500'
          }`}
          required
          autoFocus
        />
        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-espe-600 text-white py-3 rounded-lg hover:bg-espe-700 transition-colors font-semibold disabled:opacity-60 mt-2"
        >
          {loading ? 'Verificando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}
