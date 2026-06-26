import { useState, useEffect } from 'react'
import axios from 'axios'
import AdminLogin from '../components/AdminLogin'
import { QRCode } from 'react-qr-code'
import socket from '../socket'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || window.location.origin

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [teams, setTeams] = useState([])
  const [votingActive, setVotingActive] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', photo: '' })
  const [editingId, setEditingId] = useState(null)
  const [showQR, setShowQR] = useState(false)
  const [photoPreview, setPhotoPreview] = useState('')

  useEffect(() => {
    if (authenticated) {
      loadTeams()
      loadStatus()
    }
  }, [authenticated])

  async function loadTeams() {
    try {
      const res = await axios.get(`${API}/api/admin/teams`)
      setTeams(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  async function loadStatus() {
    try {
      const res = await axios.get(`${API}/api/admin/status`)
      setVotingActive(res.data.votingActive)
    } catch (err) {
      console.error(err)
    }
  }

  const authHeaders = () => ({ headers: { 'x-admin-password': password } })

  function handlePhoto(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setForm(prev => ({ ...prev, photo: reader.result }))
      setPhotoPreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      if (editingId) {
        await axios.put(`${API}/api/admin/teams/${editingId}`, form, authHeaders())
      } else {
        await axios.post(`${API}/api/admin/teams`, form, authHeaders())
      }
      setForm({ name: '', description: '', photo: '' })
      setPhotoPreview('')
      setEditingId(null)
      loadTeams()
    } catch (err) {
      console.error(err)
    }
  }

  function editTeam(team) {
    setForm({ name: team.name, description: team.description, photo: team.photo })
    setPhotoPreview(team.photo)
    setEditingId(team.id)
  }

  async function deleteTeam(id) {
    if (!confirm('Eliminar este equipo?')) return
    try {
      await axios.delete(`${API}/api/admin/teams/${id}`, authHeaders())
      loadTeams()
    } catch (err) {
      console.error(err)
    }
  }

  async function toggleVoting() {
    try {
      const res = await axios.post(`${API}/api/admin/toggle`, {}, authHeaders())
      setVotingActive(res.data.votingActive)
    } catch (err) {
      console.error(err)
    }
  }

  if (!authenticated) {
    return <AdminLogin onLogin={(pwd) => { setPassword(pwd); setAuthenticated(true) }} />
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Panel de Administracion</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Control de Votacion</h2>
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={toggleVoting}
                className={`px-6 py-3 rounded-lg font-bold text-white transition-colors ${
                  votingActive ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                {votingActive ? 'Desactivar Votacion' : 'Activar Votacion'}
              </button>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                votingActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {votingActive ? 'Activa' : 'Inactiva'}
              </span>
            </div>
            <div className="mt-4">
              <button
                onClick={() => setShowQR(!showQR)}
                className="text-indigo-600 hover:underline text-sm"
              >
                {showQR ? 'Ocultar QR' : 'Mostrar QR de votacion'}
              </button>
              {showQR && (
                <div className="mt-4 flex flex-col items-center p-4 bg-gray-50 rounded-lg">
                  <QRCode value={FRONTEND_URL} size={200} />
                  <p className="mt-2 text-sm text-gray-500">Escanea para votar</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">
              {editingId ? 'Editar Equipo' : 'Agregar Equipo'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Descripcion</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows="3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Foto</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhoto}
                  className="w-full text-sm"
                />
                {photoPreview && (
                  <img src={photoPreview} alt="Preview" className="mt-2 h-32 w-32 object-cover rounded-lg" />
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
                >
                  {editingId ? 'Guardar Cambios' : 'Agregar'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm({ name: '', description: '', photo: '' })
                      setPhotoPreview('')
                      setEditingId(null)
                    }}
                    className="bg-gray-300 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Equipos ({teams.length})</h2>
          <div className="space-y-4">
            {teams.map(team => (
              <div key={team.id} className="bg-white p-4 rounded-lg shadow-md flex gap-4 items-start">
                {team.photo && (
                  <img src={team.photo} alt={team.name} className="h-20 w-20 object-contain bg-gray-50 rounded-lg flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg truncate">{team.name}</h3>
                  <p className="text-gray-600 text-sm line-clamp-2">{team.description}</p>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => editTeam(team)}
                    className="text-indigo-600 hover:underline text-sm"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => deleteTeam(team.id)}
                    className="text-red-600 hover:underline text-sm"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
            {teams.length === 0 && (
              <p className="text-gray-400 text-center py-8">No hay equipos registrados</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
