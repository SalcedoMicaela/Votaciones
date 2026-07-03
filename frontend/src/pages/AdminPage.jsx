import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import AdminLogin from '../components/AdminLogin'
import { QRCode } from 'react-qr-code'
import socket from '../socket'
import { resizeImage } from '../utils/image'
import { whatsappLink, downloadQr, safeFilename } from '../utils/qr'
import { ejeInfo } from '../utils/eje'
import { LayoutDashboard, Users, Vote, QrCode, Settings, Camera, Check, Search, AlertTriangle, RotateCcw, UserCog, ClipboardList, Layers, Trophy, Eye, EyeOff } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || window.location.origin

const emptyForm = { name: '', description: '', photo: '', logo: '', whatsapp: '', eje: '', members: [] }

const SECTIONS = [
  { key: 'resumen', label: 'Resumen', Icon: LayoutDashboard },
  { key: 'equipos', label: 'Equipos', Icon: Users },
  { key: 'votacion', label: 'Votación', Icon: Vote },
  { key: 'fases', label: 'Fases', Icon: Layers },
  { key: 'jurados', label: 'Jurados', Icon: UserCog },
  { key: 'rubrica', label: 'Rúbrica', Icon: ClipboardList },
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
  const [showJudgeQR, setShowJudgeQR] = useState(false)
  const [photoPreview, setPhotoPreview] = useState('')
  const [logoPreview, setLogoPreview] = useState('')
  const [linkOpenId, setLinkOpenId] = useState(null)
  const [voteLinkOpenId, setVoteLinkOpenId] = useState(null)
  const [judgeLinkOpenId, setJudgeLinkOpenId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [toast, setToast] = useState(null)
  const [pwForm, setPwForm] = useState({ nueva: '', confirmar: '' })
  const [printMode, setPrintMode] = useState('vote')
  const [query, setQuery] = useState('')
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [ejeFilter, setEjeFilter] = useState('all')
  // Fases / jurados / rúbrica
  const [judges, setJudges] = useState([])
  const [questions, setQuestions] = useState([])
  const [phaseNum, setPhaseNum] = useState(1)
  const [ranking, setRanking] = useState([])
  const [rankingPhase, setRankingPhase] = useState(1)
  const [judgeForm, setJudgeForm] = useState({ name: '', username: '', password: '' })
  const emptyQForm = { text: '', type: 'choice', maxScore: 5, options: [{ label: '0', points: 0 }, { label: '1', points: 1 }, { label: '2', points: 2 }, { label: '3', points: 3 }] }
  const [qForm, setQForm] = useState(emptyQForm)
  const [editingQuestionId, setEditingQuestionId] = useState(null)
  const [advanceCount, setAdvanceCount] = useState(10)
  const [showAdvanceConfirm, setShowAdvanceConfirm] = useState(false)
  const [showRegressConfirm, setShowRegressConfirm] = useState(false)
  const [showJudgePw, setShowJudgePw] = useState(false)
  const [judgePasswords, setJudgePasswords] = useState({})
  const [weights, setWeights] = useState({ judgeMax: 18, voteMax: 2 })
  const [weightForm, setWeightForm] = useState({ judgeMax: 18, voteMax: 2 })

  useEffect(() => {
    if (!authenticated) return
    loadTeams()
    loadStatus()
    loadLinks()
    loadResults()
    loadJudges()
    loadQuestions()
    loadPhaseAndRanking()
    loadWeights()
    const onVote = d => { setResults(d); loadRanking() }
    const onToggle = a => setVotingActive(a)
    const onScore = () => loadRanking()
    socket.on('vote:update', onVote)
    socket.on('voting:toggle', onToggle)
    socket.on('score:update', onScore)
    socket.on('phase:update', loadPhaseAndRanking)
    return () => {
      socket.off('vote:update', onVote)
      socket.off('voting:toggle', onToggle)
      socket.off('score:update', onScore)
      socket.off('phase:update', loadPhaseAndRanking)
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

  async function editTeam(team) {
    try {
      const full = (await axios.get(`${API}/api/admin/teams/${team.id}`, authHeaders())).data
      setForm({
        name: full.name,
        description: full.description,
        photo: full.photo,
        logo: full.logo || '',
        whatsapp: full.whatsapp || '',
        eje: full.eje || '',
        members: (full.members || []).map(m => ({ nombre: m.nombre || '', carrera: m.carrera || '', correo: m.correo || '' })),
      })
      setPhotoPreview(full.photo)
      setLogoPreview(full.logo || '')
      setEditingId(full.id)
      setSection('equipos')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      console.error(err)
      showToast('Error al cargar equipo')
    }
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

  async function resetAll() {
    try {
      await axios.post(`${API}/api/admin/reset-all`, {}, authHeaders())
      setShowResetConfirm(false)
      loadResults()
      loadPhaseAndRanking()
      showToast('Votos y calificaciones eliminados correctamente')
    } catch (err) {
      showToast(err.response?.data?.error || 'Error al reiniciar')
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

  // --- Fases / jurados / rúbrica ---
  async function loadJudges() {
    try {
      const res = await axios.get(`${API}/api/admin/judges`, authHeaders())
      setJudges(res.data)
      const pwMap = {}
      res.data.forEach(j => { if (j.rawPassword) pwMap[j.id] = j.rawPassword })
      setJudgePasswords(prev => ({ ...prev, ...pwMap }))
    } catch (e) {}
  }
  async function loadQuestions() {
    try { setQuestions((await axios.get(`${API}/api/admin/questions`)).data) } catch (e) {}
  }
  async function loadRanking(ph) {
    try {
      const phaseQ = ph ?? rankingPhase
      const res = await axios.get(`${API}/api/admin/ranking`, { params: { phase: phaseQ } })
      setRanking(res.data.ranking)
    } catch (e) {}
  }
  async function loadPhaseAndRanking() {
    try {
      const res = await axios.get(`${API}/api/admin/phase`)
      setPhaseNum(res.data.phase)
      setRankingPhase(res.data.phase)
      const r = await axios.get(`${API}/api/admin/ranking`, { params: { phase: res.data.phase } })
      setRanking(r.data.ranking)
    } catch (e) {}
  }
  async function createJudge(e) {
    e.preventDefault()
    try {
      await axios.post(`${API}/api/admin/judges`, judgeForm, authHeaders())
      setJudgeForm({ name: '', username: '', password: '' })
      loadJudges()
      showToast('Jurado creado')
    } catch (err) { showToast(err.response?.data?.error || 'Error al crear jurado') }
  }
  async function deleteJudge(id) {
    if (!confirm('¿Eliminar este jurado?')) return
    try { await axios.delete(`${API}/api/admin/judges/${id}`, authHeaders()); loadJudges() } catch (e) {}
  }
  function resetQForm() {
    setQForm(emptyQForm)
    setEditingQuestionId(null)
  }
  function addOption() {
    setQForm(prev => ({ ...prev, options: [...prev.options, { label: '', points: 0 }] }))
  }
  function updateOption(i, field, value) {
    setQForm(prev => {
      const options = prev.options.slice()
      options[i] = { ...options[i], [field]: value }
      return { ...prev, options }
    })
  }
  function removeOption(i) {
    setQForm(prev => ({ ...prev, options: prev.options.filter((_, idx) => idx !== i) }))
  }
  function editQuestion(q) {
    setQForm({
      text: q.text,
      type: q.type || 'open',
      maxScore: q.maxScore,
      options: (q.options && q.options.length) ? q.options.map(o => ({ label: o.label, points: o.points })) : [{ label: '', points: 0 }],
    })
    setEditingQuestionId(q.id)
  }
  async function saveQuestion(e) {
    e.preventDefault()
    const payload = {
      text: qForm.text,
      type: qForm.type,
      maxScore: Number(qForm.maxScore) || 0,
      options: qForm.options.map(o => ({ label: o.label, points: Number(o.points) || 0 })),
    }
    try {
      if (editingQuestionId) {
        await axios.put(`${API}/api/admin/questions/${editingQuestionId}`, payload, authHeaders())
        showToast('Pregunta actualizada')
      } else {
        await axios.post(`${API}/api/admin/questions`, payload, authHeaders())
        showToast('Pregunta agregada')
      }
      resetQForm()
      loadQuestions()
    } catch (err) { showToast(err.response?.data?.error || 'Error al guardar la pregunta') }
  }
  async function deleteQuestion(id) {
    if (!confirm('¿Eliminar esta pregunta?')) return
    try { await axios.delete(`${API}/api/admin/questions/${id}`, authHeaders()); loadQuestions() } catch (e) {}
  }
  async function loadWeights() {
    try {
      const res = await axios.get(`${API}/api/admin/weights`)
      setWeights(res.data)
      setWeightForm({ judgeMax: res.data.judgeMax, voteMax: res.data.voteMax })
    } catch (e) {}
  }
  async function saveWeights(e) {
    e.preventDefault()
    const jm = Number(weightForm.judgeMax), vm = Number(weightForm.voteMax)
    if (jm + vm !== 20) return showToast('La suma debe ser 20')
    try {
      await axios.post(`${API}/api/admin/weights`, weightForm, authHeaders())
      setWeights({ judgeMax: jm, voteMax: vm })
      showToast('Ponderación actualizada')
    } catch (err) { showToast(err.response?.data?.error || 'Error al guardar') }
  }

  async function regressPhase() {
    try {
      await axios.post(`${API}/api/admin/regress`, {}, authHeaders())
      setShowRegressConfirm(false)
      showToast('Fase anterior restaurada')
      loadPhaseAndRanking(); loadTeams(); loadStatus(); loadResults()
    } catch (err) { showToast(err.response?.data?.error || 'Error al volver') }
  }

  async function advancePhase() {
    try {
      const res = await axios.post(`${API}/api/admin/advance`, { count: Number(advanceCount) }, authHeaders())
      setShowAdvanceConfirm(false)
      showToast(`Fase ${res.data.phase}: pasaron ${res.data.passed} equipos`)
      loadPhaseAndRanking(); loadTeams(); loadStatus(); loadResults()
    } catch (err) { showToast(err.response?.data?.error || 'Error al avanzar de fase') }
  }

  const votos = results.total || 0
  const sortedResults = useMemo(() => [...(results.results || [])].sort((a, b) => b.votes - a.votes), [results])
  const conImagenes = teams.filter(t => t.logo || t.photo).length
  const questionsTotal = questions.reduce((s, q) => s + (Number(q.maxScore) || 0), 0)

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
          <p className="text-sm text-gray-500 mb-4">Panel de administración</p>
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

              {/* Formulario compacto horizontal */}
              <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <h2 className="text-lg font-semibold">{editingId ? 'Editar equipo' : 'Agregar equipo'}</h2>
                  {editingId && (
                    <button type="button" onClick={resetForm} className="text-xs font-semibold text-gray-500 hover:text-gray-700 underline">Cancelar edición</button>
                  )}
                </div>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Nombre</label>
                      <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} required />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Eje temático</label>
                      <select value={form.eje} onChange={e => setForm({ ...form, eje: e.target.value })} className={inputClass}>
                        <option value="">Sin eje</option>
                        <option value="Eje 1: Seguridad y Defensa Tecnológica">Eje 1: Seguridad y Defensa Tecnológica</option>
                        <option value="Eje 2: Sostenibilidad y Green University">Eje 2: Sostenibilidad y Green University</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">WhatsApp</label>
                      <input type="tel" value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} placeholder="0991234567" className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Descripción</label>
                    <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputClass} rows="4" />
                  </div>

                  <div className="flex flex-wrap gap-4 items-end">
                    <div>
                      <label className="block text-xs font-medium mb-1">Logo</label>
                      <input type="file" accept="image/*" onChange={handleLogo} className="w-full text-xs" />
                      {logoPreview && <img src={logoPreview} alt="Logo" loading="lazy" className="mt-1 h-12 w-12 object-contain rounded-full bg-gray-50 ring-1 ring-gray-200" />}
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Foto del equipo</label>
                      <input type="file" accept="image/*" onChange={handlePhoto} className="w-full text-xs" />
                      {photoPreview && <img src={photoPreview} alt="Foto" loading="lazy" className="mt-1 h-12 w-20 object-cover rounded-lg bg-gray-50" />}
                    </div>
                    <button type="submit" className="bg-espe-600 text-white px-5 py-2 rounded-lg hover:bg-espe-700 transition-colors font-semibold text-sm">
                      {editingId ? 'Guardar cambios' : 'Agregar'}
                    </button>
                  </div>

                  <details className="text-xs text-gray-500">
                    <summary className="cursor-pointer font-medium text-espe-700 hover:underline">
                      Integrantes ({form.members.length})
                    </summary>
                    <div className="mt-2 space-y-1.5">
                      {form.members.map((m, i) => (
                        <div key={i} className="flex flex-wrap gap-1.5 items-center">
                          <input value={m.nombre} onChange={e => updateMember(i, 'nombre', e.target.value)} placeholder="Nombre" className="flex-1 min-w-[100px] border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-espe-400" />
                          <input value={m.carrera} onChange={e => updateMember(i, 'carrera', e.target.value)} placeholder="Carrera" className="flex-1 min-w-[100px] border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-espe-400" />
                          <input value={m.correo} onChange={e => updateMember(i, 'correo', e.target.value)} placeholder="Correo" className="flex-1 min-w-[100px] border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-espe-400" />
                          <button type="button" onClick={() => removeMember(i)} className="text-red-500 hover:text-red-700 text-base leading-none px-1" title="Quitar">×</button>
                        </div>
                      ))}
                      <button type="button" onClick={addMember} className="text-xs font-semibold text-espe-700 hover:underline">+ Agregar integrante</button>
                    </div>
                  </details>
                </form>
              </div>

              {/* Lista en grid responsive */}
              <TeamFilterBar query={query} setQuery={setQuery} ejeFilter={ejeFilter} setEjeFilter={setEjeFilter} count={filteredTeams.length} total={teams.length} />
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredTeams.map(team => (
                  <div key={team.id} className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm flex gap-3 items-start">
                    {(team.logo || team.photo) && (
                      <img src={team.logo || team.photo} alt={team.name} loading="lazy" className="h-12 w-12 sm:h-14 sm:w-14 object-contain bg-gray-50 rounded-lg flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm truncate">{team.name}</h3>
                      <p className="text-gray-500 text-[11px]">{(team.members || []).length} integrantes · WhatsApp: {team.whatsapp || '—'}</p>
                      <div className="flex gap-2 mt-1">
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${team.logo ? 'bg-espe-50 text-espe-700' : 'bg-gray-100 text-gray-400'}`}>
                          {team.logo && <Check className="w-3 h-3" />}{team.logo ? 'logo' : 'sin logo'}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${team.photo ? 'bg-espe-50 text-espe-700' : 'bg-gray-100 text-gray-400'}`}>
                          {team.photo && <Check className="w-3 h-3" />}{team.photo ? 'foto' : 'sin foto'}
                        </span>
                      </div>
                      <div className="flex gap-3 mt-2">
                        <button onClick={() => editTeam(team)} className="text-espe-700 hover:underline text-xs font-medium">Editar</button>
                        <button onClick={() => deleteTeam(team.id)} className="text-red-600 hover:underline text-xs font-medium">Eliminar</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {teams.length === 0 && <p className="text-gray-400 text-center py-8 bg-white rounded-2xl">No hay equipos registrados</p>}
              {teams.length > 0 && filteredTeams.length === 0 && <p className="text-gray-400 text-center py-8 bg-white rounded-2xl">No se encontraron equipos.</p>}
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

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100">
                <h2 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Zona de peligro
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  Al reiniciar se eliminarán <strong>todos los {votos > 0 ? `${votos} votos` : 'votos'}</strong> y <strong>todas las calificaciones</strong> de los jurados. También se reiniciarán las fases (todos los equipos vuelven a fase 1).
                </p>
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reiniciar todo (votos, calificaciones y fases)
                </button>
              </div>
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
                <h3 className="text-xl font-bold text-gray-800 mb-2">Reiniciar todo</h3>
                <p className="text-sm text-gray-500 mb-6">
                  ¿Estás seguro? Se eliminarán votos, calificaciones y se reiniciarán las fases. <strong>Todos los equipos volverán a fase 1</strong>. Los equipos, jurados y preguntas se mantienen.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={resetAll}
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

              {/* DESCRIPCIÓN Y LISTA DE IMPRIMIBLES */}
              <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm">
                <h2 className="font-semibold text-gray-800 mb-3">Imprimir lotes de QR</h2>
                <p className="text-xs text-gray-400 mb-4">Cada opción imprime una hoja con 2 QR por página.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button onClick={() => printAll('general')} className="flex items-start gap-3 text-left p-4 rounded-xl border border-gray-200 hover:border-espe-300 hover:bg-espe-50 transition-colors">
                    <div className="h-10 w-10 rounded-lg bg-espe-50 flex items-center justify-center flex-shrink-0"><Vote className="w-5 h-5 text-espe-700" /></div>
                    <div><p className="font-semibold text-sm text-gray-800">QR general de votación</p><p className="text-xs text-gray-400 mt-0.5">Lleva a la página principal para que los estudiantes elijan y voten por cualquier equipo.</p></div>
                  </button>
                  <button onClick={() => printAll('judge')} className="flex items-start gap-3 text-left p-4 rounded-xl border border-purple-200 hover:border-purple-300 hover:bg-purple-50 transition-colors">
                    <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0"><UserCog className="w-5 h-5 text-purple-700" /></div>
                    <div><p className="font-semibold text-sm text-gray-800">QR acceso jurados</p><p className="text-xs text-gray-400 mt-0.5">Lleva a la página de inicio de sesión para que los jurados califiquen desde su celular.</p></div>
                  </button>
                  <button onClick={() => printAll('judge-team')} className="flex items-start gap-3 text-left p-4 rounded-xl border border-purple-200 hover:border-purple-300 hover:bg-purple-50 transition-colors">
                    <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0"><UserCog className="w-5 h-5 text-purple-700" /></div>
                    <div><p className="font-semibold text-sm text-gray-800">QR calificación por equipo (jurado)</p><p className="text-xs text-gray-400 mt-0.5">Cada jurado escanea el QR del equipo que debe calificar. Se loguea y ve el formulario de ese equipo directamente.</p></div>
                  </button>
                  <button onClick={() => printAll('vote')} className="flex items-start gap-3 text-left p-4 rounded-xl border border-gray-200 hover:border-espe-300 hover:bg-espe-50 transition-colors">
                    <div className="h-10 w-10 rounded-lg bg-espe-50 flex items-center justify-center flex-shrink-0"><Vote className="w-5 h-5 text-espe-700" /></div>
                    <div><p className="font-semibold text-sm text-gray-800">QR voto directo por equipo</p><p className="text-xs text-gray-400 mt-0.5">Cada persona escanea el QR de un equipo específico para votar directamente por él, sin pasar por la página principal.</p></div>
                  </button>
                  <button onClick={() => printAll('upload')} className="flex items-start gap-3 text-left p-4 rounded-xl border border-gray-200 hover:border-espe-300 hover:bg-espe-50 transition-colors">
                    <div className="h-10 w-10 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0"><Camera className="w-5 h-5 text-gray-600" /></div>
                    <div><p className="font-semibold text-sm text-gray-800">QR subida de imágenes</p><p className="text-xs text-gray-400 mt-0.5">Cada equipo escanea su QR para subir su logo y foto del proyecto.</p></div>
                  </button>
                </div>
              </div>

              {/* QR ACCESO JURADO */}
              <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm">
                <div className="flex items-start gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                    <UserCog className="w-5 h-5 text-purple-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-gray-800">QR acceso jurado</h2>
                    <p className="text-xs sm:text-sm text-gray-500">Lleva a la página de inicio de sesión para que los jurados califiquen.</p>
                  </div>
                </div>
                <div className="mb-3">
                  <button onClick={() => setShowJudgeQR(!showJudgeQR)} className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors">
                    {showJudgeQR ? 'Ocultar QR jurado' : 'Mostrar QR jurado'}
                  </button>
                </div>
                {showJudgeQR && (
                  <div className="mt-4 flex flex-col items-center p-5 sm:p-6 bg-gradient-to-br from-purple-50 to-white rounded-xl border border-purple-100">
                    <div id="judge-qr" className="bg-white p-3 rounded-xl shadow-sm"><QRCode value={`${FRONTEND_URL}/jurado`} size={180} /></div>
                    <p className="mt-3 text-xs text-gray-500 text-center max-w-xs">Escanea para ir al inicio de sesión de jurados</p>
                    <button onClick={() => downloadQr('judge-qr', 'qr_acceso_jurado.png')} className="mt-3 text-xs font-semibold px-4 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-900 transition-colors">
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
                  const isJudgeOpen = judgeLinkOpenId === team.id
                  return (
                    <div key={team.id} className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm">
                      <div className="flex items-center gap-3 mb-3">
                        {(team.logo || team.photo) && <img src={team.logo || team.photo} alt={team.name} loading="lazy" className="h-9 w-9 sm:h-10 sm:w-10 object-contain bg-gray-50 rounded-lg flex-shrink-0" />}
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

                      {/* Calificación directa jurado */}
                      <div className="mt-2 rounded-xl border border-purple-200 overflow-hidden">
                        <button
                          onClick={() => setJudgeLinkOpenId(isJudgeOpen ? null : team.id)}
                          className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                            isJudgeOpen ? 'bg-purple-700 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <UserCog className="w-4 h-4" />
                            QR calificación directa (jurado)
                          </span>
                          <svg
                            className={`w-4 h-4 transition-transform duration-200 ${isJudgeOpen ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {isJudgeOpen && (
                          <div className="p-4 bg-white">
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input readOnly value={`${FRONTEND_URL}/jurado/${team.id}`} onFocus={e => e.target.select()} className="flex-1 min-w-0 text-xs border rounded-lg px-3 py-2 bg-gray-50 text-gray-600" />
                              <button onClick={() => copyText(`${FRONTEND_URL}/jurado/${team.id}`, `judge-${team.id}`)} className="text-xs font-semibold px-4 py-2 rounded-lg bg-purple-700 text-white hover:bg-purple-800 whitespace-nowrap transition-colors">
                                {copiedId === `judge-${team.id}` ? '¡Copiado!' : 'Copiar'}
                              </button>
                            </div>
                            <div className="mt-4 flex flex-col items-center p-4 bg-gradient-to-br from-purple-50/50 to-white rounded-xl">
                              <div id={`judgeqr-${team.id}`} className="bg-white p-2 rounded-lg shadow-sm"><QRCode value={`${FRONTEND_URL}/jurado/${team.id}`} size={150} /></div>
                              <p className="mt-3 text-xs text-gray-500 text-center">El jurado escanea y se loguea para calificar directamente a <span className="font-semibold text-purple-700">{team.name}</span></p>
                              <button onClick={() => downloadQr(`judgeqr-${team.id}`, `calificar_${safeFilename(team.name)}.png`)} className="mt-3 text-xs font-semibold px-4 py-2 rounded-lg bg-purple-700 text-white hover:bg-purple-800 transition-colors">
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

          {/* ===== FASES / RANKING ===== */}
          {section === 'fases' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h1 className="text-2xl font-bold text-gray-800">Fases y ranking</h1>
                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-espe-50 text-espe-700 ring-1 ring-espe-200">Fase actual: {phaseNum}</span>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">¿Cuántos equipos pasan?</label>
                  <input type="number" min="1" value={advanceCount} onChange={e => setAdvanceCount(e.target.value)}
                    className="w-28 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-espe-500" />
                </div>
                <button onClick={() => setShowAdvanceConfirm(true)} className="bg-espe-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-espe-700">
                  Cerrar fase y avanzar
                </button>
                <p className="text-xs text-gray-400 flex-1 min-w-[220px]">
                  Al avanzar, los mejores {advanceCount} pasan a la fase {phaseNum + 1}, se cierra la votación, y los votos y notas de esta fase quedan guardados.
                </p>
              </div>

              {phaseNum > 1 && (
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-red-100 flex flex-wrap items-center gap-4">
                  <div>
                    <p className="text-sm font-semibold text-red-700">Volver a fase anterior</p>
                    <p className="text-xs text-gray-500">Se borrarán los votos y calificaciones de la fase {phaseNum} y los equipos avanzados vuelven a la fase {phaseNum - 1}.</p>
                  </div>
                  <button onClick={() => setShowRegressConfirm(true)} className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-red-700 whitespace-nowrap">
                    Volver a fase {phaseNum - 1}
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-500">Ver ranking de la fase:</span>
                {Array.from({ length: phaseNum }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => { setRankingPhase(p); loadRanking(p) }}
                    className={`px-3 py-1 rounded-full text-sm font-medium ${rankingPhase === p ? 'bg-gray-800 text-white' : 'bg-white ring-1 ring-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                    Fase {p}
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Equipo</th>
                      <th className="px-3 py-2 text-right">Nota /{ranking[0]?.rubricMax || '—'}</th>
                      <th className="px-3 py-2 text-right">Jur.</th>
                      <th className="px-3 py-2 text-right">Votos</th>
                      <th className="px-3 py-2 text-right">Pts /{ranking[0]?.judgeMax || weights.judgeMax}</th>
                      <th className="px-3 py-2 text-right">Pts /{ranking[0]?.voteMax || weights.voteMax}</th>
                      <th className="px-3 py-2 text-right">Final /20</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ranking.map((r, i) => (
                      <tr key={r.id} className={i < Number(advanceCount) && rankingPhase === phaseNum ? 'bg-espe-50/40' : ''}>
                        <td className="px-3 py-2 font-bold text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2 font-medium text-gray-700">
                          {i < 3 && <Trophy className="inline w-4 h-4 text-yellow-500 mr-1" />}{r.name}
                        </td>
                        <td className="px-3 py-2 text-right">{r.notaJurados}</td>
                        <td className="px-3 py-2 text-right text-gray-400">{r.numJurados}</td>
                        <td className="px-3 py-2 text-right">{r.votos}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{r.puntosNota}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{r.puntosVotos}</td>
                        <td className="px-3 py-2 text-right font-bold text-espe-700">{r.final}</td>
                      </tr>
                    ))}
                    {ranking.length === 0 && (
                      <tr><td colSpan="8" className="px-3 py-8 text-center text-gray-400">Sin datos en esta fase aún.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== JURADOS ===== */}
          {section === 'jurados' && (
            <div className="space-y-6 max-w-2xl">
              <h1 className="text-2xl font-bold text-gray-800">Jurados ({judges.length})</h1>
              <div className="bg-white p-5 rounded-2xl shadow-sm">
                <h2 className="font-semibold mb-3">Agregar jurado</h2>
                <form onSubmit={createJudge} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input value={judgeForm.name} onChange={e => setJudgeForm({ ...judgeForm, name: e.target.value })} placeholder="Nombre" className={inputClass} required />
                  <input value={judgeForm.username} onChange={e => setJudgeForm({ ...judgeForm, username: e.target.value })} placeholder="Usuario" className={inputClass} required />
                  <div className="relative">
                    <input type={showJudgePw ? 'text' : 'password'} value={judgeForm.password} onChange={e => setJudgeForm({ ...judgeForm, password: e.target.value })} placeholder="Contraseña" className={`${inputClass} pr-10`} required />
                    <button type="button" onClick={() => setShowJudgePw(!showJudgePw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showJudgePw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <button className="sm:col-span-3 justify-self-start bg-espe-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-espe-700">Agregar jurado</button>
                </form>
                <p className="text-xs text-gray-400 mt-2">Los jurados ingresan en <span className="font-mono text-espe-700">/jurado</span> con su usuario y contraseña.</p>
              </div>
              <div className="space-y-2">
                {judges.map(j => (
                  <JudgeCard key={j.id} judge={j} rawPassword={judgePasswords[j.id] || null} onDelete={() => deleteJudge(j.id)} />
                ))}
                {judges.length === 0 && <p className="text-gray-400 text-center py-6 bg-white rounded-xl">No hay jurados registrados.</p>}
              </div>
            </div>
          )}

          {/* ===== RÚBRICA ===== */}
          {section === 'rubrica' && (
            <div className="space-y-6 max-w-2xl">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h1 className="text-2xl font-bold text-gray-800">Rúbrica de calificación</h1>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${questionsTotal === 20 ? 'bg-espe-50 text-espe-700' : 'bg-yellow-50 text-yellow-700'}`}>Total máximo: {questionsTotal} / 20</span>
              </div>
              {questions.length > 0 && questionsTotal !== 20 && (
                <p className="text-sm text-yellow-600">La suma de los puntajes máximos debería dar 20 (actualmente {questionsTotal}).</p>
              )}

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-espe-100">
                <h2 className="font-semibold text-sm mb-2">Ponderación (total 20)</h2>
                <form onSubmit={saveWeights} className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Jurado (máx pts)</label>
                    <input type="number" min="0" max="20" value={weightForm.judgeMax}
                      onChange={e => setWeightForm({ ...weightForm, judgeMax: e.target.value, voteMax: 20 - (Number(e.target.value) || 0) })}
                      className="w-24 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-espe-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Votos (máx pts)</label>
                    <input type="number" min="0" max="20" value={weightForm.voteMax}
                      onChange={e => setWeightForm({ ...weightForm, voteMax: e.target.value, judgeMax: 20 - (Number(e.target.value) || 0) })}
                      className="w-24 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-espe-500" />
                  </div>
                  <button type="submit" className="bg-espe-600 text-white px-4 py-2 rounded-lg hover:bg-espe-700 transition-colors font-semibold text-sm">Guardar</button>
                  <span className="text-xs text-gray-400">Actual: Jurado <strong>{weights.judgeMax}</strong> / Votos <strong>{weights.voteMax}</strong></span>
                </form>
              </div>

              {/* Constructor de pregunta */}
              <div className="bg-white p-5 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">{editingQuestionId ? 'Editar pregunta' : 'Agregar pregunta'}</h2>
                  {editingQuestionId && <button type="button" onClick={resetQForm} className="text-xs text-gray-500 hover:underline">Cancelar</button>}
                </div>
                <form onSubmit={saveQuestion} className="space-y-3">
                  <input value={qForm.text} onChange={e => setQForm({ ...qForm, text: e.target.value })} placeholder="Texto de la pregunta / criterio" className={inputClass} required />

                  <div className="flex flex-wrap gap-2">
                    {[['choice', 'Opción múltiple'], ['text', 'Texto libre']].map(([val, label]) => (
                      <button type="button" key={val} onClick={() => setQForm({ ...qForm, type: val })}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${qForm.type === val ? 'bg-espe-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {label}
                      </button>
                    ))}
                  </div>

                  {qForm.type === 'choice' && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-400">Opciones (el jurado elige una con un clic). Etiqueta + puntos.</p>
                      {qForm.options.map((o, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input value={o.label} onChange={e => updateOption(i, 'label', e.target.value)} placeholder="Etiqueta (ej. Excelente)" className="flex-1 border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-espe-400" />
                          <input type="number" value={o.points} onChange={e => updateOption(i, 'points', e.target.value)} placeholder="pts" className="w-20 border rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-espe-400" />
                          <button type="button" onClick={() => removeOption(i)} className="text-red-500 hover:text-red-700 text-lg leading-none">×</button>
                        </div>
                      ))}
                      <button type="button" onClick={addOption} className="text-xs font-semibold text-espe-700 hover:underline">+ Agregar opción</button>
                    </div>
                  )}

                  {qForm.type === 'text' && (
                    <p className="text-xs text-gray-400">Respuesta de texto libre (observaciones). No suma puntos al /20.</p>
                  )}

                  <button className="bg-espe-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-espe-700">{editingQuestionId ? 'Guardar cambios' : 'Agregar pregunta'}</button>
                </form>
              </div>

              {/* Lista de preguntas */}
              <div className="space-y-2">
                {questions.map(q => (
                  <div key={q.id} className="bg-white p-4 rounded-xl shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-700">{q.text}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {q.type === 'choice'
                            ? `Opción múltiple · ${q.options.map(o => `${o.label} (${o.points})`).join(' · ')}`
                            : q.type === 'text'
                              ? 'Texto libre · no puntuado'
                              : `Abierta numérica · máx ${q.maxScore}`}
                        </p>
                      </div>
                      <div className="flex gap-3 flex-shrink-0">
                        <button onClick={() => editQuestion(q)} className="text-espe-700 hover:underline text-sm">Editar</button>
                        <button onClick={() => deleteQuestion(q.id)} className="text-red-600 hover:underline text-sm">Eliminar</button>
                      </div>
                    </div>
                  </div>
                ))}
                {questions.length === 0 && <p className="text-gray-400 text-center py-6 bg-white rounded-xl">Sin preguntas. Agrega las preguntas de la rúbrica (la suma de máximos debe dar 20).</p>}
              </div>
            </div>
          )}

          {/* MODAL CONFIRMAR AVANCE DE FASE */}
          {showAdvanceConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn" onClick={() => setShowAdvanceConfirm(false)}>
              <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-espe-100 flex items-center justify-center">
                  <Layers className="w-8 h-8 text-espe-700" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Cerrar fase {phaseNum}</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Pasarán los <strong>{advanceCount} mejores</strong> equipos a la <strong>fase {phaseNum + 1}</strong>. Se cerrará la votación. Los votos y notas de esta fase se conservan.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setShowAdvanceConfirm(false)} className="flex-1 py-2.5 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition">Cancelar</button>
                  <button onClick={advancePhase} className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-espe-600 hover:bg-espe-700 transition">Sí, avanzar</button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL CONFIRMAR REGRESAR FASE */}
          {showRegressConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn" onClick={() => setShowRegressConfirm(false)}>
              <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Volver a fase {phaseNum - 1}</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Se borrarán <strong>votos y calificaciones de la fase {phaseNum}</strong> y los equipos que avanzaron volverán a la fase {phaseNum - 1}. Esta acción no se puede deshacer.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setShowRegressConfirm(false)} className="flex-1 py-2.5 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition">Cancelar</button>
                  <button onClick={regressPhase} className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition">Sí, volver</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hoja imprimible (solo al imprimir) */}
      <style>{`@media print{.print-grid-2>*:nth-child(2n){page-break-after:always}}`}</style>
      <div className="hidden print:block">
        {printMode === 'judge' ? (
          <div className="flex flex-col items-center justify-center min-h-screen -mt-20">
            <h2 className="text-center text-3xl font-bold mb-2">QR acceso jurados</h2>
            <p className="text-center text-sm text-gray-500 mb-8">Cada jurado escanea para acceder al panel de calificación</p>
            <div className="border-2 border-gray-300 rounded-xl p-8 bg-white shadow-lg">
              <QRCode value={`${FRONTEND_URL}/jurado`} size={280} className="mx-auto" />
            </div>
            <p className="mt-6 text-sm text-gray-400">{FRONTEND_URL}/jurado</p>
          </div>
        ) : printMode === 'general' ? (
          <div className="flex flex-col items-center justify-center min-h-screen -mt-20">
            <h2 className="text-center text-3xl font-bold mb-2">QR votación general</h2>
            <p className="text-center text-sm text-gray-500 mb-8">Escanea para ir a la página principal de votación</p>
            <div className="border-2 border-gray-300 rounded-xl p-8 bg-white shadow-lg">
              <QRCode value={FRONTEND_URL} size={280} className="mx-auto" />
            </div>
            <p className="mt-6 text-sm text-gray-400">{FRONTEND_URL}</p>
          </div>
        ) : printMode === 'judge-team' ? (
          <div className="py-8">
            <h2 className="text-center text-3xl font-bold mb-2">QR calificación por equipo (jurado)</h2>
            <p className="text-center text-sm text-gray-500 mb-8">Cada jurado escanea el QR del equipo que debe calificar</p>
            <div className="grid grid-cols-2 gap-6 print-grid-2">
              {teams.map(team => (
                <div key={team.id} className="text-center border-2 border-purple-200 rounded-xl p-4 bg-white shadow-sm">
                  {(team.logo || team.photo) && (
                    <img src={team.logo || team.photo} alt={team.name} loading="lazy" className="h-10 w-10 object-contain mx-auto mb-2 rounded-full bg-gray-50" />
                  )}
                  <p className="font-semibold text-sm mb-3 truncate">{team.name}</p>
                  <QRCode value={`${FRONTEND_URL}/jurado/${team.id}`} size={140} className="mx-auto" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-8">
            <h2 className="text-center text-3xl font-bold mb-2">
              {printMode === 'vote' ? 'QR de votación por equipo' : 'QR de subida de imágenes'}
            </h2>
            <p className="text-center text-sm text-gray-500 mb-8">
              {printMode === 'vote'
                ? 'Cada persona escanea el QR de un equipo para votar directo por él'
                : 'Cada equipo escanea su QR para subir su logo y foto'}
            </p>
            <div className="grid grid-cols-2 gap-6 print-grid-2">
              {teams.map(team => (
                <div key={team.id} className="text-center border border-gray-300 rounded-xl p-4 bg-white shadow-sm">
                  {(team.logo || team.photo) && (
                    <img src={team.logo || team.photo} alt={team.name} loading="lazy" className="h-10 w-10 object-contain mx-auto mb-2 rounded-full bg-gray-50" />
                  )}
                  <p className="font-semibold text-sm mb-3 truncate">{team.name}</p>
                  {printMode === 'vote' ? (
                    <QRCode value={voteUrl(team.id)} size={140} className="mx-auto" />
                  ) : links[team.id]?.token ? (
                    <QRCode value={uploadUrl(team.id)} size={140} className="mx-auto" />
                  ) : (
                    <p className="text-xs text-gray-400 py-4">sin link</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
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

function JudgeCard({ judge, rawPassword, onDelete }) {
  const [showPw, setShowPw] = useState(false)
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm flex items-center justify-between">
      <div>
        <p className="font-semibold text-gray-700">{judge.name}</p>
        <p className="text-xs text-gray-400">usuario: {judge.username}</p>
        {rawPassword && (
          <p className="text-xs text-espe-700 font-mono mt-1">
            contraseña: {showPw ? rawPassword : '••••••••'}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {rawPassword && (
          <button type="button" onClick={() => setShowPw(!showPw)} className="text-gray-400 hover:text-gray-600" title={showPw ? 'Ocultar' : 'Mostrar'}>
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
        <button onClick={onDelete} className="text-red-600 hover:underline text-sm">Eliminar</button>
      </div>
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
