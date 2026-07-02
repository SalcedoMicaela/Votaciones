import { useState, useEffect } from 'react'
import axios from 'axios'
import socket from '../socket'
import LogoBar from '../components/LogoBar'
import { Crown, Medal, Award } from 'lucide-react'

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
  const second = ranking[1] || null
  const third = ranking[2] || null
  const rest = ranking.slice(3, 10)

  if (!top) {
    return (
      <div className="max-w-4xl mx-auto text-center">
        <div className="mb-8">
          <LogoBar size="sm" className="mx-auto mb-3" />
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800">Clasificación</h1>
          <p className="text-sm text-gray-400 mt-1">Fase actual: {phase}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <p className="text-gray-400">No hay equipos en esta fase.</p>
        </div>
      </div>
    )
  }

  function HeroCard({ team, place, icon: Icon, color, size }) {
    const isBig = size === 'lg'
    const hasPhoto = !!team.photo
    return (
      <div className={`relative overflow-hidden rounded-3xl shadow-lg ${isBig ? 'w-full aspect-[4/3] sm:aspect-[16/7]' : 'aspect-[4/3]'} group`}>
        {/* Foto de fondo */}
        {hasPhoto ? (
          <img src={team.photo} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-900 to-black" />
        )}

        {/* Gradiente oscuro de abajo hacia arriba */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {/* Contenido */}
        <div className="relative z-10 flex flex-col justify-between h-full p-4 sm:p-6">
          {/* Superior: puesto + logo */}
          <div className="flex items-start justify-between">
            <div className={`flex items-center gap-1.5 ${isBig ? 'bg-white/20 backdrop-blur-md' : 'bg-black/30 backdrop-blur-sm'} rounded-full px-3 py-1`}>
              <Icon className={`${color} ${isBig ? 'w-5 h-5' : 'w-4 h-4'}`} />
              <span className={`font-bold text-white ${isBig ? 'text-sm' : 'text-xs'}`}>#{place}</span>
            </div>
            {team.logo ? (
              <img src={team.logo} alt="" className={`${isBig ? 'w-10 h-10 sm:w-12 sm:h-12' : 'w-8 h-8'} rounded-full object-contain bg-white/90 p-0.5 shadow-md ring-2 ring-white/50`} />
            ) : (
              <div className={`${isBig ? 'w-10 h-10 sm:w-12 sm:h-12' : 'w-8 h-8'} rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center font-bold text-white text-sm ring-2 ring-white/30`}>
                {(team.name || '?').charAt(0)}
              </div>
            )}
          </div>

          {/* Inferior: nombre + puntaje */}
          <div>
            <h3 className={`font-bold text-white drop-shadow-lg leading-tight ${isBig ? 'text-xl sm:text-3xl' : 'text-sm sm:text-base'}`}>{team.name}</h3>
            <div className={`mt-1 inline-flex items-center gap-1 bg-white/20 backdrop-blur-md rounded-full ${isBig ? 'px-4 py-1.5' : 'px-2.5 py-0.5'}`}>
              <span className={`font-extrabold text-white drop-shadow ${isBig ? 'text-xl sm:text-2xl' : 'text-sm'}`}>{team.final}</span>
              <span className={`text-white/80 ${isBig ? 'text-xs' : 'text-[10px]'}`}>/20</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <LogoBar size="sm" className="mx-auto mb-3" />
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800">Clasificación</h1>
        <p className="text-sm text-gray-400 mt-1">Fase actual: {phase}</p>
      </div>

      {/* #1 - Hero */}
      <div className="mb-6">
        <HeroCard team={top} place={1} icon={Crown} color="text-yellow-300" size="lg" />
      </div>

      {/* #2 y #3 - lado a lado */}
      {(second || third) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {second && <HeroCard team={second} place={2} icon={Medal} color="text-gray-300" size="sm" />}
          {third && <HeroCard team={third} place={3} icon={Award} color="text-amber-500" size="sm" />}
        </div>
      )}

      {/* Siguientes puestos */}
      {rest.length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-5 rounded-full bg-espe-500" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Siguientes puestos</p>
          </div>
          <div className="space-y-2">
            {rest.map((team, idx) => {
              const pos = idx + 4
              return (
                <div key={team.id} className="flex items-center gap-3 p-3 rounded-xl bg-white hover:bg-gray-50 transition-colors border border-gray-50">
                  <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0 ring-1 ring-gray-200">{pos}</span>
                  {team.photo ? (
                    <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-gray-200">
                      <img src={team.photo} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : team.logo ? (
                    <img src={team.logo} alt="" className="w-9 h-9 rounded-lg object-contain bg-white ring-1 ring-gray-200 flex-shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center font-bold text-gray-400 text-sm flex-shrink-0">{(team.name || '?').charAt(0)}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-700 truncate">{team.name}</p>
                  </div>
                  <span className="text-sm font-bold text-gray-600 bg-gray-50 px-2.5 py-1 rounded-lg">{team.final}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {ranking.length > 10 && (
        <p className="text-center text-xs text-gray-400 mt-4">+{ranking.length - 10} equipos más</p>
      )}
    </div>
  )
}
