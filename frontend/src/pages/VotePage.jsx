import { useState, useEffect, useMemo, useRef } from 'react'
import axios from 'axios'
import TeamCard from '../components/TeamCard'
import LogoBar from '../components/LogoBar'
import socket from '../socket'
import { ejeInfo } from '../utils/eje'
import { Search } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const EMAIL_RE = /^[^\s@]+@espe\.edu\.ec$/i

function getDeviceId() {
  let id = localStorage.getItem('deviceId')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('deviceId', id)
  }
  return id
}

export default function VotePage() {
  const [teams, setTeams] = useState([])
  const [votingActive, setVotingActive] = useState(false)
  const [hasVoted, setHasVoted] = useState(false)
  const [votedTeamId, setVotedTeamId] = useState(null)
  const [email, setEmail] = useState(() => localStorage.getItem('voterEmail') || '')
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [pendingTeam, setPendingTeam] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const emailRef = useRef(null)

  const emailValid = EMAIL_RE.test(email.trim())

  useEffect(() => {
    loadData()
    socket.on('voting:toggle', active => setVotingActive(active))
    socket.on('team:update', loadTeams)
    return () => {
      socket.off('voting:toggle')
      socket.off('team:update', loadTeams)
    }
  }, [])

  async function loadTeams() {
    try {
      const res = await axios.get(`${API}/api/admin/teams`)
      setTeams(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  async function loadData() {
    try {
      const saved = localStorage.getItem('voterEmail') || ''
      const [teamsRes, statusRes] = await Promise.all([
        axios.get(`${API}/api/admin/teams`),
        axios.get(`${API}/api/admin/status`),
      ])
      setTeams(teamsRes.data)
      setVotingActive(statusRes.data.votingActive)
      if (EMAIL_RE.test(saved)) await checkEmail(saved)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function checkEmail(value) {
    const e = value.trim().toLowerCase()
    if (!EMAIL_RE.test(e)) {
      setHasVoted(false)
      setVotedTeamId(null)
      return
    }
    try {
      const res = await axios.get(`${API}/api/vote/check`, { params: { email: e } })
      setHasVoted(res.data.hasVoted)
      setVotedTeamId(res.data.teamId)
    } catch (err) {
      console.error(err)
    }
  }

  function handleEmailChange(value) {
    setEmail(value)
    const e = value.trim().toLowerCase()
    if (EMAIL_RE.test(e)) localStorage.setItem('voterEmail', e)
    setHasVoted(false)
    setVotedTeamId(null)
  }

  function requestVote(teamId) {
    if (!votingActive || hasVoted) return
    if (!emailValid) {
      setMessage({ type: 'error', text: 'Ingresa tu correo institucional (@espe.edu.ec) para votar' })
      setTimeout(() => setMessage(null), 4000)
      emailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      emailRef.current?.focus()
      return
    }
    const team = teams.find(t => t.id === teamId)
    if (team) setPendingTeam(team)
  }

  async function confirmVote() {
    if (!pendingTeam) return
    const e = email.trim().toLowerCase()
    setSubmitting(true)
    try {
      await axios.post(`${API}/api/vote`, { teamId: pendingTeam.id, email: e, deviceId: getDeviceId() })
      localStorage.setItem('voterEmail', e)
      setHasVoted(true)
      setVotedTeamId(pendingTeam.id)
      setMessage({ type: 'success', text: `¡Voto registrado para ${pendingTeam.name}!` })
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Error al votar' })
    } finally {
      setSubmitting(false)
      setPendingTeam(null)
      setTimeout(() => setMessage(null), 4000)
    }
  }

  // Filtros de eje generados a partir de los datos (no fijos en el código)
  const ejeFilters = useMemo(() => {
    const map = new Map()
    teams.forEach(t => {
      const info = ejeInfo(t.eje)
      if (info.num > 0) {
        const cur = map.get(info.num) || { num: info.num, label: info.label, Icon: info.Icon, count: 0 }
        cur.count++
        map.set(info.num, cur)
      }
    })
    return [...map.values()].sort((a, b) => a.num - b.num)
  }, [teams])

  const filters = [
    { key: 'all', label: 'Todos', Icon: null, count: teams.length },
    ...ejeFilters.map(e => ({ key: String(e.num), label: e.label, Icon: e.Icon, count: e.count })),
  ]

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return teams.filter(t => {
      const ejeOk = filter === 'all' || String(ejeInfo(t.eje).num) === filter
      const nameOk = !q || t.name.toLowerCase().includes(q)
      return ejeOk && nameOk
    })
  }, [teams, filter, search])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center mt-20">
        <div className="w-12 h-12 border-4 border-espe-200 border-t-espe-600 rounded-full animate-spin mb-4" />
        <p className="text-gray-400">Cargando...</p>
      </div>
    )
  }

  const canVote = votingActive && !hasVoted

  return (
    <div>
      {/* HERO */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-5">
          <LogoBar />
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-800 mb-3">
          Vota por el mejor proyecto
        </h1>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border border-gray-200 bg-white shadow-sm">
          <span className="relative flex h-2.5 w-2.5">
            {votingActive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${votingActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
          </span>
          <span className={votingActive ? 'text-emerald-700' : 'text-gray-500'}>
            {votingActive ? 'Votación abierta' : 'Votación cerrada'}
          </span>
        </div>
        <p className="text-sm text-gray-400 mt-2">
          {teams.length} proyecto{teams.length !== 1 ? 's' : ''} participando
        </p>
      </div>

      {/* CORREO */}
      <div className="max-w-md mx-auto mb-8">
        <div className="bg-white rounded-2xl shadow-md p-5">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Tu correo institucional
          </label>
          <input
            ref={emailRef}
            type="email"
            value={email}
            onChange={e => handleEmailChange(e.target.value)}
            onBlur={e => checkEmail(e.target.value)}
            placeholder="nombre@espe.edu.ec"
            className={`w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 transition ${
              email && !emailValid ? 'border-red-300 focus:ring-red-300' : 'border-gray-200 focus:ring-espe-400'
            }`}
          />
          {email && !emailValid && (
            <p className="mt-1.5 text-xs text-red-500">Debe terminar en @espe.edu.ec</p>
          )}
          {emailValid && hasVoted && (
            <p className="mt-1.5 text-xs text-emerald-600 font-medium">Con este correo ya votaste. ¡Gracias!</p>
          )}
          {emailValid && !hasVoted && votingActive && (
            <p className="mt-1.5 text-xs text-espe-600 font-medium">Listo. Elige tu equipo favorito.</p>
          )}
          {!emailValid && (
            <p className="mt-1.5 text-xs text-gray-400">Necesitas tu correo @espe.edu.ec para votar (1 voto por persona).</p>
          )}
        </div>
      </div>

      {/* BUSCADOR */}
      {teams.length > 0 && (
        <div className="max-w-md mx-auto mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar equipo por nombre..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-espe-400"
          />
        </div>
      )}

      {/* FILTRO POR EJE */}
      {teams.length > 0 && filters.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                filter === f.key
                  ? 'bg-espe-600 text-white shadow'
                  : 'bg-white text-gray-600 hover:bg-gray-100 ring-1 ring-gray-200'
              }`}
            >
              {f.Icon && <f.Icon className="w-4 h-4" />}
              {f.label} <span className="opacity-60">({f.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* TOAST */}
      {message && (
        <div
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg text-sm font-semibold transition-all duration-300 animate-bounce ${
            message.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((team, i) => (
          <div
            key={team.id}
            className="animate-fadeIn"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}
          >
            <TeamCard
              team={team}
              onVote={requestVote}
              disabled={!canVote}
              voted={votedTeamId === team.id}
            />
          </div>
        ))}
      </div>

      {teams.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-300 text-lg">No hay equipos registrados aún</p>
        </div>
      )}

      {teams.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16">
          <Search className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-400">No se encontraron equipos para tu búsqueda.</p>
        </div>
      )}

      {!votingActive && !hasVoted && teams.length > 0 && (
        <div className="text-center mt-8 py-4 bg-yellow-50 rounded-xl border border-yellow-200">
          <p className="text-yellow-700 text-sm font-medium">
            La votación será habilitada por el administrador
          </p>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN */}
      {pendingTeam && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn"
          onClick={() => !submitting && setPendingTeam(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="h-20 w-20 mx-auto rounded-full overflow-hidden ring-4 ring-gray-100 bg-gray-50 flex items-center justify-center mb-3">
              {pendingTeam.logo || pendingTeam.photo ? (
                <img src={pendingTeam.logo || pendingTeam.photo} alt={pendingTeam.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-gray-300">{pendingTeam.name.charAt(0)}</span>
              )}
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-1">{pendingTeam.name}</h3>
            <p className="text-sm text-gray-500 mb-5">
              ¿Confirmas tu voto por este equipo? Solo puedes votar <span className="font-semibold">una vez</span> y no podrás cambiarlo.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingTeam(null)}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={confirmVote}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-espe-600 hover:bg-espe-700 active:scale-[0.98] transition disabled:opacity-60"
              >
                {submitting ? 'Enviando...' : 'Confirmar voto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
