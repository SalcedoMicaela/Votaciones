import { useState, useEffect } from 'react'
import axios from 'axios'
import socket from '../socket'
import { Trophy, Medal, Award, Crown, ChevronLeft, ChevronRight } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const MEDALS = {
  0: { Icon: Trophy, label: '1°', color: 'text-yellow-500', bg: 'bg-yellow-50 border-yellow-300', bar: 'bg-gradient-to-r from-yellow-400 to-yellow-500' },
  1: { Icon: Medal, label: '2°', color: 'text-slate-400', bg: 'bg-slate-50 border-slate-300', bar: 'bg-gradient-to-r from-slate-400 to-slate-500' },
  2: { Icon: Award, label: '3°', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-300', bar: 'bg-gradient-to-r from-amber-500 to-amber-600' },
}

export default function ResultsPage() {
  const [phases, setPhases] = useState([])
  const [selectedPhase, setSelectedPhase] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
    socket.on('vote:update', loadHistory)
    socket.on('score:update', loadHistory)
    socket.on('phase:update', loadHistory)
    return () => {
      socket.off('vote:update', loadHistory)
      socket.off('score:update', loadHistory)
      socket.off('phase:update', loadHistory)
    }
  }, [])

  async function loadHistory() {
    try {
      const res = await axios.get(`${API}/api/admin/ranking/history`)
      setPhases(res.data.phases)
      if (!selectedPhase && res.data.phases.length > 0) {
        setSelectedPhase(res.data.phases[res.data.phases.length - 1].phase)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const current = phases.find(p => p.phase === selectedPhase)
  const sorted = current ? [...current.ranking].sort((a, b) => b.final - a.final) : []
  const maxFinal = sorted.length > 0 ? sorted[0].final : 0

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center mt-20">
        <div className="w-12 h-12 border-4 border-espe-200 border-t-espe-600 rounded-full animate-spin mb-4" />
        <p className="text-gray-400">Cargando...</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-center mb-1">Resultados</h1>
      <p className="text-sm text-gray-500 text-center mb-1">Ranking de los votos que tienen los equipos</p>

      {/* Selector de fase */}
      {phases.length > 1 && (
        <div className="flex items-center justify-center gap-3 mb-6">
          <button
            onClick={() => setSelectedPhase(Math.max(1, selectedPhase - 1))}
            disabled={selectedPhase <= 1}
            className="p-2 rounded-lg disabled:opacity-30 text-gray-500 hover:bg-gray-100 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold bg-espe-50 text-espe-700 px-4 py-1.5 rounded-full">
            Fase {selectedPhase}
          </span>
          <button
            onClick={() => setSelectedPhase(Math.min(phases.length, selectedPhase + 1))}
            disabled={selectedPhase >= phases.length}
            className="p-2 rounded-lg disabled:opacity-30 text-gray-500 hover:bg-gray-100 transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {phases.length > 1 && (
        <div className="flex justify-center gap-1.5 mb-6">
          {phases.map(p => (
            <button
              key={p.phase}
              onClick={() => setSelectedPhase(p.phase)}
              className={`w-8 h-8 rounded-full text-xs font-bold transition-colors ${
                selectedPhase === p.phase
                  ? 'bg-espe-600 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {p.phase}
            </button>
          ))}
        </div>
      )}

      {!current || sorted.length === 0 ? (
        <p className="text-center text-gray-400 mt-10">No hay resultados disponibles</p>
      ) : (
        <>
          {/* Podio top 3 */}
          {sorted.length >= 3 && (
            <div className="flex flex-col sm:flex-row items-center sm:items-end justify-center gap-4 mb-10 pt-6 sm:pt-2">
              <div className="w-full sm:flex-1 sm:max-w-[200px] order-2 sm:order-1">
                <PodiumCard team={sorted[1]} medal={MEDALS[1]} size="sm" maxFinal={maxFinal} />
              </div>
              <div className="w-full sm:flex-1 sm:max-w-[240px] z-10 relative order-1 sm:order-2">
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 select-none"><Crown className="w-7 h-7 text-yellow-500 fill-yellow-400" /></div>
                <PodiumCard team={sorted[0]} medal={MEDALS[0]} size="lg" maxFinal={maxFinal} />
              </div>
              <div className="w-full sm:flex-1 sm:max-w-[200px] order-3">
                <PodiumCard team={sorted[2]} medal={MEDALS[2]} size="sm" maxFinal={maxFinal} />
              </div>
            </div>
          )}

          {sorted.length > 0 && sorted.length < 3 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
              {sorted.map((team, i) => (
                <PodiumCard key={team.id} team={team} medal={MEDALS[i]} size="md" maxFinal={maxFinal} />
              ))}
            </div>
          )}

          {/* Tabla de todos los equipos */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Equipo</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Nota jurado</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Votos</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Puntaje final</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sorted.map((team, idx) => (
                    <tr key={team.id} className={`hover:bg-gray-50 transition-colors ${idx < 3 ? 'bg-espe-50/30' : ''}`}>
                      <td className="px-4 py-3 font-bold text-gray-400">#{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {team.logo ? (
                            <img src={team.logo} alt="" loading="lazy" className="w-7 h-7 rounded-full object-contain bg-white ring-1 ring-gray-200" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-400 text-xs">{(team.name || '?').charAt(0)}</div>
                          )}
                          <span className="font-medium text-gray-700 truncate">{team.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{team.notaJurados} / {team.rubricMax}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{team.votos}</td>
                      <td className="px-4 py-3 text-right font-bold text-espe-700">{team.final}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Indicador de ponderacion */}
          {current.ranking.length > 0 && (
            <p className="text-center text-xs text-gray-400 mt-4">
              Ponderación: jurado <strong>{current.ranking[0].judgeMax}</strong> · votos <strong>{current.ranking[0].voteMax}</strong>
            </p>
          )}
        </>
      )}
    </div>
  )
}

function PodiumCard({ team, medal, size, maxFinal }) {
  const imgSize = size === 'lg' ? 'h-20 w-20' : 'h-14 w-14'
  const pct = maxFinal > 0 ? ((team.final / maxFinal) * 100) : 0
  return (
    <div className={`rounded-2xl border-2 p-4 sm:p-6 text-center transition-all duration-700 ${medal.bg} ${size === 'lg' ? 'scale-100' : 'scale-90 sm:scale-95'}`}>
      <div className="mb-1 flex justify-center">
        <medal.Icon className={`${size === 'lg' ? 'w-10 h-10' : 'w-8 h-8'} ${medal.color}`} strokeWidth={2} />
      </div>
      <p className={`text-xs font-bold uppercase tracking-wider ${medal.color} mb-2`}>{medal.label}</p>
      {(team.logo || team.photo) ? (
        <img src={team.logo || team.photo} alt={team.name} loading="lazy" className={`${imgSize} mx-auto object-cover rounded-full ring-4 ring-white shadow-lg mb-3`} />
      ) : (
        <div className={`${imgSize} mx-auto rounded-full ring-4 ring-white shadow-lg mb-3 bg-gray-200 flex items-center justify-center text-gray-400 font-bold text-3xl`}>
          {team.name.charAt(0).toUpperCase()}
        </div>
      )}
      <h3 className={`font-extrabold ${size === 'lg' ? 'text-2xl' : 'text-lg'} mb-1 truncate px-2`}>{team.name}</h3>
      <div className="flex items-center justify-center gap-2 text-sm mb-3">
        <span className="font-bold text-espe-700">{team.final}</span>
        <span className="text-gray-400">pts</span>
      </div>
      <div className="w-full bg-gray-200/70 rounded-full overflow-hidden shadow-inner">
        <div
          className={`h-3 rounded-full transition-all duration-1000 ease-out ${medal.bar}`}
          style={{ width: `${Math.max(pct, 3)}%` }}
        />
      </div>
    </div>
  )
}
