import { useState } from 'react'

export default function AdminLogin({ onLogin }) {
  const [password, setPassword] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    onLogin(password)
  }

  return (
    <div className="max-w-md mx-auto mt-20 bg-white p-8 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6 text-center">Acceso Admin</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Contraseña de administrador"
          className="w-full border rounded-lg px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
        <button
          type="submit"
          className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
        >
          Ingresar
        </button>
      </form>
    </div>
  )
}
