import { useState, useEffect } from 'react'
import axios from 'axios'
import TeamCard from '../components/TeamCard'
import socket from '../socket'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function VotePage() {
  const [teams, setTeams] = useState([])
  const [votingActive, setVotingActive] = useState(false)
  const [hasVoted, setHasVoted] = useState(false)
  const [votedTeamId, setVotedTeamId] = useState(null)
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
    socket.on('voting:toggle', active => setVotingActive(active))
    return () => socket.off('voting:toggle')
  }, [])

  async function loadData() {
    try {
      const [teamsRes, statusRes, checkRes] = await Promise.all([
        axios.get(`${API}/api/admin/teams`),
        axios.get(`${API}/api/admin/status`),
        axios.get(`${API}/api/vote/check`),
      ])
      setTeams(teamsRes.data)
      setVotingActive(statusRes.data.votingActive)
      setHasVoted(checkRes.data.hasVoted)
      setVotedTeamId(checkRes.data.teamId)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleVote(teamId) {
    try {
      const res = await axios.post(`${API}/api/vote`, { teamId })
      setHasVoted(true)
      setVotedTeamId(teamId)
      setMessage({ type: 'success', text: 'Voto registrado con éxito' })
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Error al votar' })
    }
    setTimeout(() => setMessage(null), 4000)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center mt-20">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mb-4" />
        <p className="text-gray-400">Cargando...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold text-gray-800 mb-2">
          Sistema de Votaciones
        </h1>
        <p className="text-gray-500 text-lg mb-1">
          {hasVoted
            ? 'Ya has emitido tu voto'
            : votingActive
              ? 'Selecciona tu equipo favorito'
              : 'La votación no está activa en este momento'}
        </p>
        <p className="text-sm text-gray-400">
          {teams.length} equipo{teams.length !== 1 ? 's' : ''} participando
        </p>
      </div>

      {message && (
        <div
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg text-sm font-semibold transition-all duration-300 animate-bounce ${
            message.type === 'success'
              ? 'bg-green-500 text-white'
              : 'bg-red-500 text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            {message.type === 'success' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {message.text}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team, i) => (
          <div
            key={team.id}
            className="animate-fadeIn"
            style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
          >
            <TeamCard
              team={team}
              onVote={handleVote}
              disabled={!votingActive || hasVoted}
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

      {!votingActive && !hasVoted && teams.length > 0 && (
        <div className="text-center mt-8 py-4 bg-yellow-50 rounded-xl border border-yellow-200">
          <p className="text-yellow-700 text-sm font-medium">
            La votación será habilitada por el administrador
          </p>
        </div>
      )}
    </div>
  )
}
