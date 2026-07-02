import { useState, useEffect } from 'react'
import axios from 'axios'
import socket from '../socket'
import LogoBar from '../components/LogoBar'
import { Crown } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function LeaderboardPage() {
  const [ranking, setRanking] = useState([])
  const [phase, setPhase] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
    socket.on('score:update', load)
    socket.on('vote:update', load)
    socket.on('phase:update', load)
    return () => {
      socket.off('score:update', load)
      socket.off('vote:update', load)
      socket.off('phase:update', load)
    }
  }, [])

  async function load() {
    try {
      const res = await axios.get(`${API}/api/judges/ranking/public`)
      setRanking(res.data.ranking)
      setPhase(res.data.phase)
    } catch (err) {
      // noop
    } finally {
      setLoading(false)
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

  const top = ranking[0] || null
  const rest = ranking.slice(1, 5)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <LogoBar size="sm" className="mx-auto mb-3" />
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800">Clasificación</h1>
        <p className="text-sm text-gray-400 mt-1">Fase actual: {phase}</p>
      </div>

      {!top ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <p className="text-gray-400">No hay equipos en esta fase.</p>
        </div>
      ) : (
        <>
          {/* PODIO - Primer lugar */}
          <div className="bg-gradient-to-br from-yellow-50 via-white to-yellow-50 rounded-3xl shadow-lg border-2 border-yellow-200 p-6 sm:p-8 text-center mb-8">
            <Crown className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
            <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wider mb-1">Líder</p>

            {top.photo && (
              <img src={top.photo} alt={top.name} className="w-28 h-28 sm:w-36 sm:h-36 object-cover rounded-2xl mx-auto mb-4 shadow-md border-2 border-yellow-200" />
            )}
            <div className="flex items-center justify-center gap-3 mb-2">
              {top.logo ? (
                <img src={top.logo} alt="" className="h-8 w-8 sm:h-10 sm:w-10 rounded-full object-contain bg-white ring-2 ring-yellow-200" />
              ) : (
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-yellow-100 flex items-center justify-center font-bold text-yellow-700 text-sm">{(top.name || '?').charAt(0)}</div>
              )}
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{top.name}</h2>
            </div>

            <div className="mt-3 inline-block bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-yellow-700">{top.final}</span>
              <span className="text-sm text-gray-500 ml-1">/ 20</span>
            </div>
          </div>

          {/* Siguientes puestos */}
          {rest.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Siguientes puestos</p>
              <div className="space-y-3">
                {rest.map((team, idx) => {
                  const pos = idx + 2
                  return (
                    <div key={team.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                      <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">{pos}</span>
                      {team.logo ? (
                        <img src={team.logo} alt="" className="h-8 w-8 rounded-full object-contain bg-white ring-1 ring-gray-200 flex-shrink-0" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-400 text-sm flex-shrink-0">{(team.name || '?').charAt(0)}</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-700 truncate">{team.name}</p>
                      </div>
                      <span className="text-sm font-bold text-gray-600">{team.final}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {ranking.length > 5 && (
            <p className="text-center text-xs text-gray-400 mt-4">+{ranking.length - 5} equipos más</p>
          )}
        </>
      )}
    </div>
  )
}
