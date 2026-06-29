import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import AdminLogin from '../components/AdminLogin'
import { QRCode } from 'react-qr-code'
import socket from '../socket'
import { resizeImage } from '../utils/image'
import { whatsappLink, downloadQr, safeFilename } from '../utils/qr'
import { ejeInfo } from '../utils/eje'
import { LayoutDashboard, Users, Vote, QrCode, Settings, Camera, Check, Search, AlertTriangle, RotateCcw } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || window.location.origin

const emptyForm = { name: '', description: '', photo: '', logo: '', whatsapp: '', eje: '', members: [] }

const SECTIONS = [
  { key: 'resumen', label: 'Resumen', Icon: LayoutDashboard },
  { key: 'equipos', label: 'Equipos', Icon: Users },
  { key: 'votacion', label: 'Votación', Icon: Vote },
  { key: 'qr', label: 'QR y enlaces', Icon: QrCode },
  { key: 'config', label: 'Configuración', Icon: Settings },
]

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [section, setSection] = useState('resumen')
  const [teams, setTeams] = useState([])
  const [links, setLinks] = useState({})
  const [results, setResults] = useState({ results: [], total: 0 })
  const [votingActive, setVotingActive] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [showQR, setShowQR] = useState(false)
  const [photoPreview, setPhotoPreview] = useState('')
  const [logoPreview, setLogoPreview] = useState('')
  const [linkOpenId, setLinkOpenId] = useState(null)
  const [voteLinkOpenId, setVoteLinkOpenId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [toast, setToast] = useState(null)
  const [pwForm, setPwForm] = useState({ nueva: '', confirmar: '' })
  const [printMode, setPrintMode] = useState('vote')
  const [query, setQuery] = useState('')
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [ejeFilter, setEjeFilter] = useState('all')

  useEffect(() => {
    if (!authenticated) return
    loadTeams()
    loadStatus()
    loadLinks()
    loadResults()
    const onVote = d => setResults(d)
    const onToggle = a => setVotingActive(a)
    socket.on('vote:update', onVote)
    socket.on('voting:toggle', onToggle)
    return () => {
      socket.off('vote:update', onVote)
      socket.off('voting:toggle', onToggle)
    }
  }, [authenticated])

  function showToast(text) {
    setToast(text)
    setTimeout(() => setToast(null), 2500)
  }

  const authHeaders = () => ({ headers: { 'x-admin-password': password } })

  async function loadTeams() {
    try { setTeams((await axios.get(`${API}/api/admin/teams`)).data) } catch (err) { console.error(err) }
  }
  async function loadResults() {
    try { setResults((await axios.get(`${API}/api/vote/results`)).data) } catch (err) { console.error(err) }
  }
  async function loadLinks() {
    try {
      const res = await axios.get(`${API}/api/admin/links`, authHeaders())
      const map = {}
      res.data.forEach(l => { map[l.id] = l })
      setLinks(map)
    } catch (err) { console.error(err) }
  }
  async function loadStatus() {
    try { setVotingActive((await axios.get(`${API}/api/admin/status`)).data.votingActive) } catch (err) { console.error(err) }
  }

  function uploadUrl(id) {
    const token = links[id]?.token
    return token ? `${FRONTEND_URL}/subir/${token}` : ''
  }
  function voteUrl(id) {
    return `${FRONTEND_URL}/votar/${id}`
  }
  function printAll(mode) {
    setPrintMode(mode)
    setTimeout(() => window.print(), 80)
  }

  async function copyText(text, key) {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(key)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      window.prompt('Copia el link:', text)
    }
  }

  function shareWhatsApp(team) {
    const url = uploadUrl(team.id)
    const number = links[team.id]?.whatsapp || team.whatsapp
    const text = `Hola equipo ${team.name}, suban el logo y la foto de su equipo en este enlace: ${url}`
    window.open(whatsappLink(number, text), '_blank')
  }

  async function handlePhoto(e) {
    const file = e.target.files[0]
    if (!file) return
    try {
      const dataUrl = await resizeImage(file, { maxSize: 1280, quality: 0.82 })
      setForm(prev => ({ ...prev, photo: dataUrl }))
      setPhotoPreview(dataUrl)
    } catch (err) { console.error(err) }
  }
  async function handleLogo(e) {
    const file = e.target.files[0]
    if (!file) return
    try {
      const dataUrl = await resizeImage(file, { maxSize: 512, quality: 0.9 })
      setForm(prev => ({ ...prev, logo: dataUrl }))
      setLogoPreview(dataUrl)
    } catch (err) { console.error(err) }
  }

  function addMember() {
    setForm(prev => ({ ...prev, members: [...prev.members, { nombre: '', carrera: '', correo: '' }] }))
  }
  function updateMember(i, field, value) {
    setForm(prev => {
      const members = prev.members.slice()
      members[i] = { ...members[i], [field]: value }
      return { ...prev, members }
    })
  }
  function removeMember(i) {
    setForm(prev => ({ ...prev, members: prev.members.filter((_, idx) => idx !== i) }))
  }

  function resetForm() {
    setForm(emptyForm)
    setPhotoPreview('')
    setLogoPreview('')
    setEditingId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      if (editingId) {
        await axios.put(`${API}/api/admin/teams/${editingId}`, form, authHeaders())
        showToast('Equipo actualizado')
      } else {
        await axios.post(`${API}/api/admin/teams`, form, authHeaders())
        showToast('Equipo agregado')
      }
      resetForm()
      loadTeams()
      loadLinks()
    } catch (err) {
      console.error(err)
      showToast('Error al guardar')
    }
  }

  function editTeam(team) {
    setForm({
      name: team.name,
      description: team.description,
      photo: team.photo,
      logo: team.logo || '',
      whatsapp: team.whatsapp || '',
      eje: team.eje || '',
      members: (team.members || []).map(m => ({ nombre: m.nombre || '', carrera: m.carrera || '', correo: m.correo || '' })),
    })
    setPhotoPreview(team.photo)
    setLogoPreview(team.logo || '')
    setEditingId(team.id)
    setSection('equipos')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteTeam(id) {
    if (!confirm('¿Eliminar este equipo?')) return
    try {
      await axios.delete(`${API}/api/admin/teams/${id}`, authHeaders())
      loadTeams(); loadLinks(); loadResults()
    } catch (err) { console.error(err) }
  }

  async function toggleVoting() {
    try {
      const res = await axios.post(`${API}/api/admin/toggle`, {}, authHeaders())
      setVotingActive(res.data.votingActive)
    } catch (err) { console.error(err) }
  }

  async function resetVotes() {
    try {
      await axios.post(`${API}/api/admin/reset-votes`, {}, authHeaders())
      setShowResetConfirm(false)
      loadResults()
      showToast('Votos eliminados correctamente')
    } catch (err) {
      showToast(err.response?.data?.error || 'Error al reiniciar votación')
    }
  }

  async function changePassword(e) {
    e.preventDefault()
    if (pwForm.nueva.length < 4) return showToast('Mínimo 4 caracteres')
    if (pwForm.nueva !== pwForm.confirmar) return showToast('Las contraseñas no coinciden')
    try {
      await axios.post(`${API}/api/admin/password`, { newPassword: pwForm.nueva }, authHeaders())
      setPassword(pwForm.nueva)
      setPwForm({ nueva: '', confirmar: '' })
      showToast('Contraseña actualizada')
    } catch (err) {
      showToast(err.response?.data?.error || 'Error al cambiar la contraseña')
    }
  }

  const votos = results.total || 0
  const sortedResults = useMemo(() => [...(results.results || [])].sort((a, b) => b.votes - a.votes), [results])
  const conImagenes = teams.filter(t => t.logo || t.photo).length

  const filteredTeams = useMemo(() => {
    const q = query.trim().toLowerCase()
    return teams.filter(t => {
      const ejeOk = ejeFilter === 'all' || String(ejeInfo(t.eje).num) === ejeFilter
      const nameOk = !q || t.name.toLowerCase().includes(q)
      return ejeOk && nameOk
    })
  }, [teams, query, ejeFilter])

  if (!authenticated) {
    return <AdminLogin onLogin={(pwd) => { setPassword(pwd); setAuthenticated(true) }} />
  }

  const inputClass = 'w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-espe-500'

  return (
    <>
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl shadow-lg text-sm font-semibold bg-gray-800 text-white print:hidden">
          {toast}
        </div>
      )}

      <div className="print:hidden flex flex-col md:flex-row gap-6">
        {/* SIDEBAR */}
        <aside className="md:w-56 flex-shrink-0">
          <div className="md:sticky md:top-24 bg-white rounded-2xl shadow-sm p-2 flex md:flex-col gap-1 overflow-x-auto">
            {SECTIONS.map(s => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors text-left ${
                  section === s.key ? 'bg-espe-600 text-white shadow-sm' : 'text-gray-600 hover:bg-espe-50 hover:text-espe-700'
                }`}
              >
                <s.Icon className="w-5 h-5" />
                {s.label}
              </button>
            ))}
          </div>
        </aside>

        {/* CONTENIDO */}
        <div className="flex-1 min-w-0">
          {/* ===== RESUMEN ===== */}
          {section === 'resumen' && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold text-gray-800">Resumen</h1>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Equipos" value={teams.length} />
                <StatCard label="Votos totales" value={votos} accent />
                <StatCard label="Con imágenes" value={`${conImagenes}/${teams.length}`} />
                <div className="bg-white rounded-2xl shadow-sm p-4">
                  <p className="text-xs text-gray-400 mb-1">Estado</p>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold ${
                    votingActive ? 'bg-espe-50 text-espe-700' : 'bg-red-50 text-red-600'
                  }`}>
                    <span className={`h-2 w-2 rounded-full ${votingActive ? 'bg-espe-500' : 'bg-red-500'}`} />
                    {votingActive ? 'Abierta' : 'Cerrada'}
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h2 className="font-semibold text-gray-700 mb-3">Ranking en vivo</h2>
                {sortedResults.length === 0 ? (
                  <p className="text-sm text-gray-400">Aún no hay equipos.</p>
                ) : (
                  <ul className="space-y-2">
                    {sortedResults.slice(0, 8).map((t, i) => {
                      const pct = votos > 0 ? Math.round((t.votes / votos) * 100) : 0
                      return (
                        <li key={t.id} className="flex items-center gap-3">
                          <span className="w-6 text-center text-sm font-bold text-gray-400">{i + 1}</span>
                          <span className="flex-1 min-w-0 truncate text-sm font-medium text-gray-700">{t.name}</span>
                          <div className="hidden sm:block w-32 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                            <div className="h-full bg-espe-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-sm font-semibold text-espe-700 w-16 text-right">{t.votes} ({pct}%)</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* ===== EQUIPOS ===== */}
          {section === 'equipos' && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold text-gray-800">Equipos ({teams.length})</h1>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Formulario */}
                <div className="bg-white p-6 rounded-2xl shadow-sm">
                  <h2 className="text-lg font-semibold mb-4">{editingId ? 'Editar equipo' : 'Agregar equipo'}</h2>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Nombre</label>
                      <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Eje temático</label>
                      <select value={form.eje} onChange={e => setForm({ ...form, eje: e.target.value })} className={inputClass}>
                        <option value="">Sin eje</option>
                        <option value="Eje 1: Seguridad y Defensa Tecnológica">Eje 1: Seguridad y Defensa Tecnológica</option>
                        <option value="Eje 2: Sostenibilidad y Green University">Eje 2: Sostenibilidad y Green University</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Descripción</label>
                      <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputClass} rows="3" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">WhatsApp del equipo</label>
                      <input type="tel" value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} placeholder="0991234567" className={inputClass} />
                    </div>
                    <div className="flex gap-6">
                      <div>
                        <label className="block text-sm font-medium mb-1">Logo</label>
                        <input type="file" accept="image/*" onChange={handleLogo} className="w-full text-sm" />
                        {logoPreview && <img src={logoPreview} alt="Logo" className="mt-2 h-20 w-20 object-contain rounded-full bg-gray-50 ring-1 ring-gray-200" />}
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Foto del equipo</label>
                        <input type="file" accept="image/*" onChange={handlePhoto} className="w-full text-sm" />
                        {photoPreview && <img src={photoPreview} alt="Foto" className="mt-2 h-20 w-28 object-cover rounded-lg bg-gray-50" />}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium">Integrantes ({form.members.length})</label>
                        <button type="button" onClick={addMember} className="text-xs font-semibold text-espe-700 hover:underline">+ Agregar integrante</button>
                      </div>
                      <div className="space-y-2">
                        {form.members.map((m, i) => (
                          <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 sm:gap-2 items-center">
                            <input value={m.nombre} onChange={e => updateMember(i, 'nombre', e.target.value)} placeholder="Nombre" className="sm:col-span-4 border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-espe-400" />
                            <input value={m.carrera} onChange={e => updateMember(i, 'carrera', e.target.value)} placeholder="Carrera" className="sm:col-span-3 border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-espe-400" />
                            <input value={m.correo} onChange={e => updateMember(i, 'correo', e.target.value)} placeholder="Correo" className="sm:col-span-4 border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-espe-400" />
                            <button type="button" onClick={() => removeMember(i)} className="sm:col-span-1 text-red-500 hover:text-red-700 text-lg leading-none text-center py-1.5 sm:py-0" title="Quitar">×</button>
                          </div>
                        ))}
                        {form.members.length === 0 && <p className="text-xs text-gray-400">Sin integrantes. Usa "Agregar integrante".</p>}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button type="submit" className="bg-espe-600 text-white px-6 py-2 rounded-lg hover:bg-espe-700 transition-colors font-semibold">
                        {editingId ? 'Guardar cambios' : 'Agregar'}
                      </button>
                      {editingId && <button type="button" onClick={resetForm} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors">Cancelar</button>}
                    </div>
                  </form>
                </div>

                {/* Lista */}
                <div>
                  <TeamFilterBar query={query} setQuery={setQuery} ejeFilter={ejeFilter} setEjeFilter={setEjeFilter} count={filteredTeams.length} total={teams.length} />
                  <div className="space-y-3">
                  {filteredTeams.map(team => (
                    <div key={team.id} className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm flex gap-3 sm:gap-4 items-start">
                      {(team.logo || team.photo) && (
                        <img src={team.logo || team.photo} alt={team.name} className="h-12 w-12 sm:h-16 sm:w-16 object-contain bg-gray-50 rounded-lg flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm sm:text-base truncate">{team.name}</h3>
                        <p className="text-gray-500 text-[11px] sm:text-xs">{(team.members || []).length} integrantes · WhatsApp: {team.whatsapp || '—'}</p>
                        <div className="flex gap-2 mt-1">
                          <span className={`inline-flex items-center gap-1 text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full ${team.logo ? 'bg-espe-50 text-espe-700' : 'bg-gray-100 text-gray-400'}`}>
                            {team.logo && <Check className="w-3 h-3" />}{team.logo ? 'logo' : 'sin logo'}
                          </span>
                          <span className={`inline-flex items-center gap-1 text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full ${team.photo ? 'bg-espe-50 text-espe-700' : 'bg-gray-100 text-gray-400'}`}>
                            {team.photo && <Check className="w-3 h-3" />}{team.photo ? 'foto' : 'sin foto'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-row sm:flex-col gap-2 flex-shrink-0 items-start">
                        <button onClick={() => editTeam(team)} className="text-espe-700 hover:underline text-xs sm:text-sm font-medium">Editar</button>
                        <button onClick={() => deleteTeam(team.id)} className="text-red-600 hover:underline text-xs sm:text-sm font-medium">Eliminar</button>
                      </div>
                    </div>
                  ))}
                  {teams.length === 0 && <p className="text-gray-400 text-center py-8 bg-white rounded-2xl">No hay equipos registrados</p>}
                  {teams.length > 0 && filteredTeams.length === 0 && <p className="text-gray-400 text-center py-8 bg-white rounded-2xl">No se encontraron equipos.</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== VOTACIÓN ===== */}
          {section === 'votacion' && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold text-gray-800">Control de votación</h1>
              <div className="bg-white p-6 rounded-2xl shadow-sm">
                <p className="text-sm text-gray-500 mb-4">
                  Activa la votación para que las personas puedan votar. Mientras esté cerrada, nadie puede emitir su voto.
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    onClick={toggleVoting}
                    className={`px-6 py-3 rounded-xl font-bold text-white transition-colors ${
                      votingActive ? 'bg-red-500 hover:bg-red-600' : 'bg-espe-600 hover:bg-espe-700'
                    }`}
                  >
                    {votingActive ? 'Desactivar votación' : 'Activar votación'}
                  </button>
                  <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
                    votingActive ? 'bg-espe-50 text-espe-700' : 'bg-red-50 text-red-600'
                  }`}>
                    <span className={`h-2 w-2 rounded-full ${votingActive ? 'bg-espe-500' : 'bg-red-500'}`} />
                    {votingActive ? 'Votación abierta' : 'Votación cerrada'}
                  </span>
                </div>
                <p className="mt-4 text-sm text-gray-500">Votos registrados hasta ahora: <span className="font-bold text-espe-700">{votos}</span></p>
              </div>

              {votos > 0 && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100">
                  <h2 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    Zona de peligro
                  </h2>
                  <p className="text-sm text-gray-500 mb-4">
                    Al reiniciar la votación se eliminarán <strong>todos los {votos} votos</strong> registrados. Esta acción no se puede deshacer.
                  </p>
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reiniciar votación
                  </button>
                </div>
              )}
            </div>
          )}

          {/* MODAL CONFIRMAR REINICIO */}
          {showResetConfirm && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn"
              onClick={() => setShowResetConfirm(false)}
            >
              <div
                className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Reiniciar votación</h3>
                <p className="text-sm text-gray-500 mb-6">
                  ¿Estás seguro? Se eliminarán <strong>todos los {votos} votos</strong> de forma permanente. No podrás recuperarlos.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={resetVotes}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition"
                  >
                    Sí, reiniciar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ===== QR Y ENLACES ===== */}
          {section === 'qr' && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold text-gray-800">QR y enlaces</h1>

              {/* QR GENERAL */}
              <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm">
                <div className="flex items-start gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg bg-espe-50 flex items-center justify-center flex-shrink-0">
                    <Vote className="w-5 h-5 text-espe-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-gray-800">QR general de votación</h2>
                    <p className="text-xs sm:text-sm text-gray-500">Lleva a la página principal para elegir y votar por cualquier equipo.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-4 mb-3">
                  <button onClick={() => setShowQR(!showQR)} className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-lg bg-espe-50 text-espe-700 hover:bg-espe-100 transition-colors">
                    {showQR ? 'Ocultar QR general' : 'Mostrar QR general'}
                  </button>
                  <button onClick={() => printAll('vote')} className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">Imprimir QR votación</button>
                  <button onClick={() => printAll('upload')} className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">Imprimir QR subida</button>
                </div>
                {showQR && (
                  <div className="mt-4 flex flex-col items-center p-5 sm:p-6 bg-gradient-to-br from-espe-50 to-white rounded-xl border border-espe-100">
                    <div id="general-qr" className="bg-white p-3 rounded-xl shadow-sm"><QRCode value={FRONTEND_URL} size={180} /></div>
                    <p className="mt-3 text-xs text-gray-500 text-center max-w-xs">Escanea para ir a la página principal de votación</p>
                    <button onClick={() => downloadQr('general-qr', 'qr_votacion_general.png')} className="mt-3 text-xs font-semibold px-4 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-900 transition-colors">
                      Descargar QR (PNG)
                    </button>
                  </div>
                )}
              </div>

              <TeamFilterBar query={query} setQuery={setQuery} ejeFilter={ejeFilter} setEjeFilter={setEjeFilter} count={filteredTeams.length} total={teams.length} />

              <div className="space-y-4">
                {filteredTeams.map(team => {
                  const link = links[team.id]
                  const isOpen = linkOpenId === team.id
                  const isVoteOpen = voteLinkOpenId === team.id
                  return (
                    <div key={team.id} className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm">
                      <div className="flex items-center gap-3 mb-3">
                        {(team.logo || team.photo) && <img src={team.logo || team.photo} alt={team.name} className="h-9 w-9 sm:h-10 sm:w-10 object-contain bg-gray-50 rounded-lg flex-shrink-0" />}
                        <h3 className="font-bold text-sm sm:text-base truncate flex-1">{team.name}</h3>
                      </div>

                      {/* Votación directa */}
                      <div className="rounded-xl border border-espe-100 overflow-hidden">
                        <button
                          onClick={() => setVoteLinkOpenId(isVoteOpen ? null : team.id)}
                          className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                            isVoteOpen ? 'bg-espe-600 text-white' : 'bg-espe-50 text-espe-700 hover:bg-espe-100'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Vote className="w-4 h-4" />
                            QR para votar
                          </span>
                          <svg
                            className={`w-4 h-4 transition-transform duration-200 ${isVoteOpen ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {isVoteOpen && (
                          <div className="p-4 bg-white">
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input readOnly value={voteUrl(team.id)} onFocus={e => e.target.select()} className="flex-1 min-w-0 text-xs border rounded-lg px-3 py-2 bg-gray-50 text-gray-600" />
                              <button onClick={() => copyText(voteUrl(team.id), `vote-${team.id}`)} className="text-xs font-semibold px-4 py-2 rounded-lg bg-espe-600 text-white hover:bg-espe-700 whitespace-nowrap transition-colors">
                                {copiedId === `vote-${team.id}` ? '¡Copiado!' : 'Copiar'}
                              </button>
                            </div>
                            <div className="mt-4 flex flex-col items-center p-4 bg-gradient-to-br from-espe-50/50 to-white rounded-xl">
                              <div id={`voteqr-${team.id}`} className="bg-white p-2 rounded-lg shadow-sm"><QRCode value={voteUrl(team.id)} size={150} /></div>
                              <p className="mt-3 text-xs text-gray-500 text-center">Escanea para votar directamente por <span className="font-semibold text-espe-700">{team.name}</span></p>
                              <button onClick={() => downloadQr(`voteqr-${team.id}`, `votar_${safeFilename(team.name)}.png`)} className="mt-3 text-xs font-semibold px-4 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-900 transition-colors">
                                Descargar QR (PNG)
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Subida de imágenes */}
                      <div className="mt-2 rounded-xl border border-gray-200 overflow-hidden">
                        <button
                          onClick={() => setLinkOpenId(isOpen ? null : team.id)}
                          className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                            isOpen ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Camera className="w-4 h-4" />
                            Link de subida de imágenes
                          </span>
                          <svg
                            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {isOpen && (
                          <div className="p-4 bg-white">
                            {link ? (
                              <>
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <input readOnly value={uploadUrl(team.id)} onFocus={e => e.target.select()} className="flex-1 min-w-0 text-xs border rounded-lg px-3 py-2 bg-gray-50 text-gray-600" />
                                  <button onClick={() => copyText(uploadUrl(team.id), `up-${team.id}`)} className="text-xs font-semibold px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-800 whitespace-nowrap transition-colors">
                                    {copiedId === `up-${team.id}` ? '¡Copiado!' : 'Copiar'}
                                  </button>
                                </div>
                                <div className="mt-4 flex flex-col items-center p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl">
                                  <div id={`qr-${team.id}`} className="bg-white p-2 rounded-lg shadow-sm"><QRCode value={uploadUrl(team.id)} size={150} /></div>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <button onClick={() => shareWhatsApp(team)} className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                                    Enviar por WhatsApp
                                  </button>
                                  <button onClick={() => downloadQr(`qr-${team.id}`, `subir_${safeFilename(team.name)}.png`)} className="text-xs font-semibold px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-800 transition-colors">
                                    Descargar QR (PNG)
                                  </button>
                                </div>
                              </>
                            ) : <p className="text-xs text-gray-400 py-2 text-center">Cargando link...</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ===== CONFIGURACIÓN ===== */}
          {section === 'config' && (
            <div className="space-y-6 max-w-lg">
              <h1 className="text-2xl font-bold text-gray-800">Configuración</h1>
              <div className="bg-white p-6 rounded-2xl shadow-sm">
                <h2 className="text-lg font-semibold mb-1">Contraseña de administrador</h2>
                <p className="text-xs text-gray-400 mb-4">Se guarda cifrada en la base de datos.</p>
                <form onSubmit={changePassword} className="space-y-3">
                  <input type="password" value={pwForm.nueva} onChange={e => setPwForm({ ...pwForm, nueva: e.target.value })} placeholder="Nueva contraseña" className={inputClass} />
                  <input type="password" value={pwForm.confirmar} onChange={e => setPwForm({ ...pwForm, confirmar: e.target.value })} placeholder="Confirmar nueva contraseña" className={inputClass} />
                  <button type="submit" className="bg-espe-600 text-white px-5 py-2 rounded-lg hover:bg-espe-700 transition-colors font-semibold text-sm">Cambiar contraseña</button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hoja imprimible (solo al imprimir) */}
      <div className="hidden print:block">
        <h2 className="text-center text-2xl font-bold mb-1">
          {printMode === 'vote' ? 'QR de votación por equipo' : 'QR de subida de imágenes'}
        </h2>
        <p className="text-center text-sm text-gray-500 mb-6">
          {printMode === 'vote'
            ? 'Cada persona escanea el QR de un equipo para votar directo por él'
            : 'Cada equipo escanea su QR para subir su logo y foto'}
        </p>
        <div className="grid grid-cols-3 gap-6">
          {teams.map(team => (
            <div key={team.id} className="text-center border border-gray-300 rounded-lg p-3 break-inside-avoid">
              <p className="font-semibold text-sm mb-2 truncate">{team.name}</p>
              {printMode === 'vote' ? (
                <QRCode value={voteUrl(team.id)} size={150} className="mx-auto" />
              ) : links[team.id]?.token ? (
                <QRCode value={uploadUrl(team.id)} size={150} className="mx-auto" />
              ) : (
                <p className="text-xs text-gray-400">sin link</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-extrabold ${accent ? 'text-espe-700' : 'text-gray-800'}`}>{value}</p>
    </div>
  )
}

function TeamFilterBar({ query, setQuery, ejeFilter, setEjeFilter, count, total }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar equipo por nombre..."
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-espe-400"
        />
      </div>
      <select
        value={ejeFilter}
        onChange={e => setEjeFilter(e.target.value)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-espe-400"
      >
        <option value="all">Todos los ejes</option>
        <option value="1">Seguridad y Defensa</option>
        <option value="2">Sostenibilidad</option>
      </select>
      <span className="hidden sm:flex items-center text-xs text-gray-400 whitespace-nowrap">{count} de {total}</span>
    </div>
  )
}
