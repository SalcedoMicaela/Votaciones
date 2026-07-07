import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import LogoBar from '../components/LogoBar'
import socket from '../socket'
import { ejeInfo } from '../utils/eje'
import { LogOut, Check, ClipboardList, Eye, EyeOff, Menu, X } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function JudgePage() {
  const { teamId } = useParams()
  const [token, setToken] = useState(() => localStorage.getItem('judgeToken') || '')
  const [name, setName] = useState(() => localStorage.getItem('judgeName') || '')

  function onLogin(tok, nombre) {
    localStorage.setItem('judgeToken', tok)
    localStorage.setItem('judgeName', nombre)
    setToken(tok)
    setName(nombre)
  }
  function logout() {
    localStorage.removeItem('judgeToken')
    localStorage.removeItem('judgeName')
    setToken('')
    setName('')
  }

  if (!token) return <JudgeLogin onLogin={onLogin} teamId={teamId} />
  return <JudgeScore token={token} name={name} onLogout={logout} teamId={teamId} />
}

function JudgeLogin({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await axios.post(`${API}/api/judges/login`, { username, password })
      onLogin(res.data.token, res.data.name)
    } catch (err) {
      setError(err.response?.status === 401 ? 'Usuario o contraseña incorrectos' : 'No se pudo conectar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-16 bg-white p-8 rounded-2xl shadow-md">
      <div className="flex flex-col items-center mb-6">
        <LogoBar size="sm" className="mb-4" />
        <h1 className="text-2xl font-bold text-gray-800">Acceso Jurado</h1>
        <p className="text-sm text-gray-400">Calificación de proyectos</p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input
          value={username}
          onChange={e => { setUsername(e.target.value); setError('') }}
          placeholder="Usuario"
          className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-espe-500"
          required autoFocus
        />
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            placeholder="Contraseña"
            className={`w-full border rounded-lg px-4 py-3 pr-10 focus:outline-none focus:ring-2 ${error ? 'border-red-300 focus:ring-red-300' : 'focus:ring-espe-500'}`}
            required
          />
          <button type="button" onClick={() => setShowPw(!showPw)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={loading} className="w-full bg-espe-600 text-white py-3 rounded-lg hover:bg-espe-700 transition-colors font-semibold disabled:opacity-60">
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}

function JudgeScore({ token, name, onLogout, teamId }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [phase, setPhase] = useState(1)
  const [questions, setQuestions] = useState([])
  const [teams, setTeams] = useState([])
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [answers, setAnswers] = useState({}) // { teamId: { questionId: points } }
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(false)
  const [judgeMax, setJudgeMax] = useState(18)

  const headers = { headers: { 'x-judge-token': token } }

  useEffect(() => {
    load()
    socket.on('phase:update', load)
    return () => socket.off('phase:update', load)
  }, [])

  useEffect(() => {
    if (selectedTeamId && !answers[selectedTeamId]) {
      setAnswers(prev => ({ ...prev, [selectedTeamId]: {} }))
    }
  }, [selectedTeamId])

  async function load() {
    try {
      const res = await axios.get(`${API}/api/judges/teams`, headers)
      setPhase(res.data.phase)
      setQuestions(res.data.questions)
      setTeams(res.data.teams)
      if (res.data.judgeMax) setJudgeMax(res.data.judgeMax)
      const init = {}
      res.data.teams.forEach(t => {
        init[t.id] = {}
        if (t.myScore) t.myScore.answers.forEach(a => { init[t.id][a.questionId] = a.text !== undefined ? a.text : a.points })
      })
      setAnswers(init)
      // Si viene por QR directo, auto-seleccionar ese equipo
      if (teamId && res.data.teams.some(t => t.id === teamId)) {
        setSelectedTeamId(teamId)
      }
    } catch (err) {
      if (err.response?.status === 401) setAuthError(true)
    } finally {
      setLoading(false)
    }
  }

  function setPoints(questionId, value, max) {
    let v = value === '' ? '' : Number(value)
    if (v !== '' && !Number.isNaN(v)) v = Math.max(0, Math.min(max, v))
    setAnswers(prev => ({ ...prev, [selectedTeamId]: { ...prev[selectedTeamId], [questionId]: v } }))
  }

  function setText(questionId, value) {
    setAnswers(prev => ({ ...prev, [selectedTeamId]: { ...prev[selectedTeamId], [questionId]: value } }))
  }

  function teamTotal() {
    return questions.reduce((s, q) => q.type === 'text' ? s : s + (Number(answers[selectedTeamId]?.[q.id]) || 0), 0)
  }

  function hasAllRequired() {
    return questions.every(q => {
      if (q.type === 'text') return true
      const val = answers[selectedTeamId]?.[q.id]
      return val !== undefined && val !== '' && Number(val) >= 0
    })
  }

  async function save() {
    if (!hasAllRequired()) return
    setSaving(true)
    try {
      const payload = questions.map(q => q.type === 'text'
        ? { questionId: q.id, text: String(answers[selectedTeamId]?.[q.id] ?? '') }
        : { questionId: q.id, points: Number(answers[selectedTeamId]?.[q.id]) || 0 })
      await axios.post(`${API}/api/judges/score`, { teamId: selectedTeamId, answers: payload }, headers)
      setTeams(prev => prev.map(t => t.id === selectedTeamId ? { ...t, myScore: { total: teamTotal() } } : t))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      // noop
    } finally {
      setSaving(false)
    }
  }

  function selectTeam(e) {
    const id = e.target.value
    setSelectedTeamId(id)
    setSaved(false)
  }

  if (authError) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center bg-white p-8 rounded-2xl shadow-md">
        <p className="text-gray-600 mb-4">Tu sesión expiró.</p>
        <button onClick={onLogout} className="bg-espe-600 text-white px-5 py-2 rounded-lg font-semibold">Volver a ingresar</button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center mt-20">
        <div className="w-12 h-12 border-4 border-espe-200 border-t-espe-600 rounded-full animate-spin mb-4" />
        <p className="text-gray-400">Cargando...</p>
      </div>
    )
  }

  const calificados = teams.filter(t => t.myScore).length
  const selectedTeam = teams.find(t => t.id === selectedTeamId)
  const total = teamTotal()
  const eje = selectedTeam ? ejeInfo(selectedTeam.eje) : { num: 0, label: '' }

  return (
    <div>
      {menuOpen && <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-800">Calificación de proyectos</h1>
          <p className="text-sm text-gray-500">
            Jurado: <span className="font-semibold">{name}</span> · Fase {phase} · {calificados}/{teams.length} calificados
          </p>
        </div>
        <div className="relative flex-shrink-0">
          <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
              <div className="px-4 py-2 text-xs text-gray-400 border-b border-gray-100">Conectado como <span className="font-semibold text-gray-600">{name}</span></div>
              <button onClick={() => { onLogout(); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 font-medium">
                <LogOut className="w-4 h-4" /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>

      {questions.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-yellow-700 text-sm flex items-center gap-2">
          <ClipboardList className="w-5 h-5" /> Aún no hay preguntas en la rúbrica. El administrador debe configurarlas.
        </div>
      )}

      {/* Selector de equipo (solo si no viene por QR directo) */}
      {!teamId && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Seleccionar equipo a calificar</label>
          <select
            value={selectedTeamId}
            onChange={selectTeam}
            className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-espe-500 appearance-none bg-white"
          >
            <option value="">-- Selecciona un equipo --</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} {t.myScore ? `(✓ ${t.myScore.total}/${judgeMax})` : '(pendiente)'}
              </option>
            ))}
          </select>

          {selectedTeamId && teams.length > 0 && (
            <div className="flex items-center gap-3 mt-3 p-3 bg-espe-50 rounded-xl">
              {selectedTeam.logo
                ? <img src={selectedTeam.logo} alt="" loading="lazy" className="h-10 w-10 rounded-full object-contain bg-white ring-1 ring-gray-200" />
                : <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-500">{selectedTeam.name.charAt(0)}</div>}
              <div>
                <p className="font-semibold text-gray-800">{selectedTeam.name}</p>
                {eje.num > 0 && <span className="text-xs text-gray-500">{eje.label}</span>}
                {selectedTeam.myScore && <span className="text-xs text-espe-700 font-semibold ml-2">✓ {selectedTeam.myScore.total}/{judgeMax}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Banner del equipo cuando viene por QR directo */}
      {teamId && selectedTeamId && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6 border border-espe-200">
          <div className="flex items-center gap-3">
            {selectedTeam.logo
              ? <img src={selectedTeam.logo} alt="" loading="lazy" className="h-14 w-14 rounded-full object-contain bg-white ring-2 ring-espe-200" />
              : <div className="h-14 w-14 rounded-full bg-espe-100 flex items-center justify-center font-bold text-espe-600 text-lg">{selectedTeam.name.charAt(0)}</div>}
            <div>
              <p className="font-semibold text-gray-800 text-lg">{selectedTeam.name}</p>
              {eje.num > 0 && <span className="text-xs text-gray-500">{eje.label}</span>}
              {selectedTeam.myScore && <span className="text-xs text-espe-700 font-semibold ml-2">✓ Calificado ({selectedTeam.myScore.total}/{judgeMax})</span>}
            </div>
          </div>
        </div>
      )}

      {/* Rúbrica para el equipo seleccionado */}
      {selectedTeamId && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="space-y-5">
            {questions.map(q => (
              <div key={q.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                <p className="text-sm font-medium text-gray-700 mb-2">{q.text}</p>
                {q.type === 'choice' ? (
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((o, idx) => {
                      const selected = answers[selectedTeamId]?.[q.id] === o.points
                      return (
                        <button
                          type="button" key={idx}
                          onClick={() => setPoints(q.id, o.points, q.maxScore)}
                          className={`px-5 py-3 rounded-xl text-sm font-medium border-2 transition-all ${
                            selected
                              ? 'bg-espe-600 text-white border-espe-600 shadow-md scale-105'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-espe-300 hover:shadow-sm'
                          }`}
                        >
                          {o.label}
                        </button>
                      )
                    })}
                  </div>
                ) : q.type === 'text' ? (
                  <textarea
                    ref={el => el && setTimeout(() => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' })}
                    rows="3"
                    value={answers[selectedTeamId]?.[q.id] ?? ''}
                    onChange={e => { setText(q.id, e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                    placeholder="Escribe tu observación..."
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-espe-400 resize-none overflow-hidden leading-relaxed"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="0" max={q.maxScore} step="0.5"
                      value={answers[selectedTeamId]?.[q.id] ?? ''}
                      onChange={e => setPoints(q.id, e.target.value, q.maxScore)}
                      className="w-24 border rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-espe-400"
                    />
                    <span className="text-xs text-gray-400">/ {q.maxScore} pts</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
            <span />
            <button
              onClick={save}
              disabled={saving || questions.length === 0 || !hasAllRequired()}
              className="bg-espe-600 text-white px-6 py-2.5 rounded-xl hover:bg-espe-700 transition-colors font-semibold text-sm disabled:opacity-60"
            >
              {saving ? 'Guardando...' : saved ? '¡Guardado!' : selectedTeam?.myScore ? 'Actualizar calificación' : 'Guardar calificación'}
            </button>
          </div>
        </div>
      )}

      {!selectedTeamId && teams.length > 0 && questions.length > 0 && (
        <p className="text-center text-gray-400 py-10">Selecciona un equipo para comenzar a calificar.</p>
      )}

      {teams.length === 0 && questions.length > 0 && (
        <p className="text-center text-gray-400 py-10">No hay equipos activos en esta fase.</p>
      )}
    </div>
  )
}
