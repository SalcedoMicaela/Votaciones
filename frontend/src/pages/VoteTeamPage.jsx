import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import socket from '../socket'
import LogoBar from '../components/LogoBar'
import { ejeInfo } from '../utils/eje'
import { SearchX } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const EMAIL_RE = /^[^\s@]+@espe\.edu\.ec$/i

export default function VoteTeamPage() {
  const { teamId } = useParams()
  const [team, setTeam] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [votingActive, setVotingActive] = useState(false)
  const [hasVoted, setHasVoted] = useState(false)
  const [votedTeamId, setVotedTeamId] = useState(null)
  const [email, setEmail] = useState(() => localStorage.getItem('voterEmail') || '')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)

  const emailValid = EMAIL_RE.test(email.trim())

  useEffect(() => {
    load()
    socket.on('voting:toggle', setVotingActive)
    return () => socket.off('voting:toggle')
  }, [teamId])

  async function load() {
    try {
      const [teamsRes, statusRes] = await Promise.all([
        axios.get(`${API}/api/admin/teams`),
        axios.get(`${API}/api/admin/status`),
      ])
      const t = teamsRes.data.find(x => x.id === teamId)
      if (!t) setNotFound(true)
      else setTeam(t)
      setVotingActive(statusRes.data.votingActive)
      const saved = localStorage.getItem('voterEmail') || ''
      if (EMAIL_RE.test(saved)) {
        const c = await axios.get(`${API}/api/vote/check`, { params: { email: saved.toLowerCase() } })
        setHasVoted(c.data.hasVoted)
        setVotedTeamId(c.data.teamId)
      }
    } catch (err) {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  async function vote() {
    const e = email.trim().toLowerCase()
    if (!EMAIL_RE.test(e)) {
      setMessage({ type: 'error', text: 'Ingresa tu correo institucional (@espe.edu.ec)' })
      return
    }
    setSubmitting(true)
    setMessage(null)
    try {
      await axios.post(`${API}/api/vote`, { teamId, email: e })
      localStorage.setItem('voterEmail', e)
      setHasVoted(true)
      setVotedTeamId(teamId)
      setMessage({ type: 'success', text: '¡Voto registrado! Gracias por participar.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Error al votar' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center mt-20">
        <div className="w-12 h-12 border-4 border-espe-200 border-t-espe-600 rounded-full animate-spin mb-4" />
        <p className="text-gray-400">Cargando...</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center bg-white p-8 rounded-2xl shadow-md">
        <SearchX className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Equipo no encontrado</h1>
        <p className="text-gray-500 mb-4">Este enlace no corresponde a ningún equipo.</p>
        <Link to="/" className="text-espe-700 font-semibold hover:underline">Ver todos los equipos</Link>
      </div>
    )
  }

  const eje = ejeInfo(team.eje)
  const votedThis = hasVoted && votedTeamId === team.id
  const votedOther = hasVoted && votedTeamId !== team.id

  return (
    <div className="max-w-md mx-auto mt-4">
      <div className="flex justify-center mb-4">
        <LogoBar size="sm" />
      </div>

      <div className="bg-white rounded-2xl shadow-md overflow-hidden">
        <div className="aspect-[16/9] bg-gradient-to-br from-gray-50 to-gray-100 relative">
          {team.photo ? (
            <img src={team.photo} alt={team.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-200 text-7xl font-bold">
              {team.name.charAt(0).toUpperCase()}
            </div>
          )}
          {team.logo && (
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 h-20 w-20 rounded-full bg-white shadow-lg ring-4 ring-white overflow-hidden flex items-center justify-center">
              <img src={team.logo} alt="" className="w-full h-full object-contain p-1" />
            </div>
          )}
        </div>

        <div className={`px-6 pb-6 text-center ${team.logo ? 'pt-10' : 'pt-6'}`}>
          {eje.num > 0 && (
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full mb-2 ${eje.badge}`}>
              {eje.Icon && <eje.Icon className="w-3.5 h-3.5" />} {eje.label}
            </span>
          )}
          <h1 className="text-2xl font-extrabold text-gray-800 mb-1">{team.name}</h1>
          {team.description && (
            <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-line mb-4">{team.description}</p>
          )}

          {message && (
            <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-medium ${
              message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
            }`}>
              {message.text}
            </div>
          )}

          {votedThis ? (
            <div className="py-3 rounded-xl bg-emerald-50 text-emerald-600 font-semibold ring-1 ring-emerald-300 flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Votaste por este equipo
            </div>
          ) : votedOther ? (
            <div className="py-3 rounded-xl bg-yellow-50 text-yellow-700 text-sm font-medium ring-1 ring-yellow-200">
              Ya votaste por otro equipo con este correo.
            </div>
          ) : !votingActive ? (
            <div className="py-3 rounded-xl bg-yellow-50 text-yellow-700 text-sm font-medium ring-1 ring-yellow-200">
              La votación no está activa en este momento.
            </div>
          ) : (
            <>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="nombre@espe.edu.ec"
                className={`w-full border rounded-xl px-4 py-2.5 mb-3 focus:outline-none focus:ring-2 transition ${
                  email && !emailValid ? 'border-red-300 focus:ring-red-300' : 'border-gray-200 focus:ring-espe-400'
                }`}
              />
              <button
                onClick={vote}
                disabled={submitting}
                className="w-full py-3 rounded-xl font-semibold text-white bg-espe-600 hover:bg-espe-700 active:scale-[0.98] transition shadow-md disabled:opacity-60"
              >
                {submitting ? 'Enviando...' : `Votar por ${team.name}`}
              </button>
              <p className="mt-2 text-xs text-gray-400">Tu correo @espe.edu.ec · 1 voto por persona</p>
            </>
          )}

          <Link to="/" className="inline-block mt-4 text-sm text-espe-700 hover:underline">
            Ver todos los equipos
          </Link>
        </div>
      </div>
    </div>
  )
}
