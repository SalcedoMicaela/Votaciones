import { useState, useEffect } from 'react'
import axios from 'axios'
import LogoBar from '../components/LogoBar'
import socket from '../socket'
import { ejeInfo } from '../utils/eje'
import { LogOut, Check, ClipboardList } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function JudgePage() {
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

  if (!token) return <JudgeLogin onLogin={onLogin} />
  return <JudgeScore token={token} name={name} onLogout={logout} />
}

function JudgeLogin({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
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
        <input
          type="password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError('') }}
          placeholder="Contraseña"
          className={`w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 ${error ? 'border-red-300 focus:ring-red-300' : 'focus:ring-espe-500'}`}
          required
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={loading} className="w-full bg-espe-600 text-white py-3 rounded-lg hover:bg-espe-700 transition-colors font-semibold disabled:opacity-60">
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}

function JudgeScore({ token, name, onLogout }) {
  const [phase, setPhase] = useState(1)
  const [questions, setQuestions] = useState([])
  const [teams, setTeams] = useState([])
  const [answers, setAnswers] = useState({}) // { teamId: { questionId: points } }
  const [saving, setSaving] = useState(null)
  const [savedId, setSavedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(false)

  const headers = { headers: { 'x-judge-token': token } }

  useEffect(() => {
    load()
    socket.on('phase:update', load)
    return () => socket.off('phase:update', load)
  }, [])

  async function load() {
    try {
      const res = await axios.get(`${API}/api/judges/teams`, headers)
      setPhase(res.data.phase)
      setQuestions(res.data.questions)
      setTeams(res.data.teams)
      const init = {}
      res.data.teams.forEach(t => {
        init[t.id] = {}
        if (t.myScore) t.myScore.answers.forEach(a => { init[t.id][a.questionId] = a.points })
      })
      setAnswers(init)
    } catch (err) {
      if (err.response?.status === 401) setAuthError(true)
    } finally {
      setLoading(false)
    }
  }

  function setPoints(teamId, questionId, value, max) {
    let v = value === '' ? '' : Number(value)
    if (v !== '' && !Number.isNaN(v)) v = Math.max(0, Math.min(max, v))
    setAnswers(prev => ({ ...prev, [teamId]: { ...prev[teamId], [questionId]: v } }))
  }

  function teamTotal(teamId) {
    return questions.reduce((s, q) => s + (Number(answers[teamId]?.[q.id]) || 0), 0)
  }

  async function save(teamId) {
    setSaving(teamId)
    try {
      const payload = questions.map(q => ({ questionId: q.id, points: Number(answers[teamId]?.[q.id]) || 0 }))
      await axios.post(`${API}/api/judges/score`, { teamId, answers: payload }, headers)
      setTeams(prev => prev.map(t => t.id === teamId ? { ...t, myScore: { total: teamTotal(teamId) } } : t))
      setSavedId(teamId)
      setTimeout(() => setSavedId(null), 2500)
    } catch (err) {
      // noop
    } finally {
      setSaving(null)
    }
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

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Calificación de proyectos</h1>
          <p className="text-sm text-gray-500">
            Jurado: <span className="font-semibold">{name}</span> · Fase {phase} · {calificados}/{teams.length} calificados
          </p>
        </div>
        <button onClick={onLogout} className="self-start inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-red-600">
          <LogOut className="w-4 h-4" /> Salir
        </button>
      </div>

      {questions.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-yellow-700 text-sm flex items-center gap-2">
          <ClipboardList className="w-5 h-5" /> Aún no hay preguntas en la rúbrica. El administrador debe configurarlas.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {teams.map(team => {
          const eje = ejeInfo(team.eje)
          const total = teamTotal(team.id)
          return (
            <div key={team.id} className={`bg-white rounded-2xl shadow-sm p-5 ${team.myScore ? 'ring-1 ring-espe-200' : ''}`}>
              <div className="flex items-center gap-3 mb-4">
                {team.logo
                  ? <img src={team.logo} alt="" className="h-12 w-12 rounded-full object-contain bg-gray-50 ring-1 ring-gray-100" />
                  : <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-400">{team.name.charAt(0)}</div>}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold truncate">{team.name}</h3>
                  {eje.num > 0 && <span className="text-[11px] text-gray-400">{eje.label}</span>}
                </div>
                {team.myScore && <span className="inline-flex items-center gap-1 text-xs font-semibold text-espe-700"><Check className="w-4 h-4" /> {team.myScore.total}/20</span>}
              </div>

              <div className="space-y-4">
                {questions.map(q => (
                  <div key={q.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <p className="text-sm font-medium text-gray-700 mb-2">{q.text}</p>
                    {q.type === 'choice' ? (
                      <div className="flex flex-wrap gap-2">
                        {q.options.map((o, idx) => {
                          const selected = answers[team.id]?.[q.id] === o.points
                          return (
                            <button
                              type="button" key={idx}
                              onClick={() => setPoints(team.id, q.id, o.points, q.maxScore)}
                              className={`px-3 py-2 rounded-lg text-sm border transition ${
                                selected ? 'bg-espe-600 text-white border-espe-600' : 'bg-white text-gray-600 border-gray-200 hover:border-espe-300'
                              }`}
                            >
                              {o.label} <span className="opacity-70">({o.points})</span>
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="number" min="0" max={q.maxScore} step="0.5"
                          value={answers[team.id]?.[q.id] ?? ''}
                          onChange={e => setPoints(team.id, q.id, e.target.value, q.maxScore)}
                          className="w-24 border rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-espe-400"
                        />
                        <span className="text-xs text-gray-400">/ {q.maxScore} pts</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                <span className="text-sm font-semibold">Total: <span className="text-espe-700">{total}</span> / 20</span>
                <button
                  onClick={() => save(team.id)}
                  disabled={saving === team.id || questions.length === 0}
                  className="bg-espe-600 text-white px-4 py-2 rounded-lg hover:bg-espe-700 transition-colors font-semibold text-sm disabled:opacity-60"
                >
                  {saving === team.id ? 'Guardando...' : savedId === team.id ? '¡Guardado!' : team.myScore ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {teams.length === 0 && questions.length > 0 && (
        <p className="text-center text-gray-400 py-10">No hay equipos activos en esta fase.</p>
      )}
    </div>
  )
}
