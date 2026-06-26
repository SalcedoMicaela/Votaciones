import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import socket from '../socket'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const MEDALS = {
  0: { emoji: '\uD83E\uDD47', bg: 'bg-yellow-50 border-yellow-300', bar: 'bg-gradient-to-r from-yellow-400 to-yellow-500', glow: 'shadow-[0_0_20px_rgba(234,179,8,0.25)]' },
  1: { emoji: '\uD83E\uDD48', bg: 'bg-slate-50 border-slate-300', bar: 'bg-gradient-to-r from-slate-400 to-slate-500', glow: '' },
  2: { emoji: '\uD83E\uDD49', bg: 'bg-amber-50 border-amber-300', bar: 'bg-gradient-to-r from-amber-500 to-amber-600', glow: '' },
}

function PodiumCard({ team, medal, size, totalVotes, maxV }) {
  const barW = size === 'lg' ? 'h-8' : 'h-6'
  const imgSize = size === 'lg' ? 'h-20 w-20' : 'h-14 w-14'
  const textSize = size === 'lg' ? 'text-2xl' : 'text-lg'
  const pct = totalVotes > 0 ? ((team.votes / totalVotes) * 100).toFixed(1) : 0
  const barWid = totalVotes > 0 ? (team.votes / maxV) * 100 : 0
  return (
    <div className={`rounded-2xl border-2 p-4 sm:p-6 text-center transition-all duration-700 ${medal.bg} ${medal.glow} ${size === 'lg' ? 'scale-100' : 'scale-90 sm:scale-95'}`}>
      <div className={`text-4xl mb-2 ${size === 'lg' ? 'sm:text-5xl' : 'sm:text-4xl'}`}>{medal.emoji}</div>
      {team.photo ? (
        <img src={team.photo} alt={team.name} className={`${imgSize} mx-auto object-cover rounded-full ring-4 ring-white shadow-lg mb-3`} />
      ) : (
        <div className={`${imgSize} mx-auto rounded-full ring-4 ring-white shadow-lg mb-3 bg-gray-200 flex items-center justify-center text-gray-400 font-bold text-3xl`}>
          {team.name.charAt(0).toUpperCase()}
        </div>
      )}
      <h3 className={`font-extrabold ${textSize} mb-1 truncate px-2`}>{team.name}</h3>
      <div className="flex items-center justify-center gap-2 text-sm mb-3">
        <span className="font-bold text-indigo-600">{team.votes}</span>
        <span className="text-gray-400">votos</span>
        <span className="text-gray-500">({pct}%)</span>
      </div>
      <div className="w-full bg-gray-200/70 rounded-full overflow-hidden shadow-inner">
        <div
          className={`${barW} rounded-full transition-all duration-1000 ease-out flex items-center justify-center text-white text-xs font-bold ${medal.bar}`}
          style={{ width: `${Math.max(barWid, totalVotes > 0 ? 5 : 0)}%` }}
        />
      </div>
    </div>
  )
}

export default function ResultsPage() {
  const [results, setResults] = useState([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    loadResults()
    socket.on('vote:update', (data) => {
      setResults(data.results)
      setTotal(data.total)
    })
    return () => socket.off('vote:update')
  }, [])

  async function loadResults() {
    try {
      const res = await axios.get(`${API}/api/vote/results`)
      setResults(res.data.results)
      setTotal(res.data.total)
    } catch (err) {
      console.error(err)
    }
  }

  const sorted = useMemo(() => [...results].sort((a, b) => b.votes - a.votes), [results])
  const maxV = sorted.length > 0 ? Math.max(...sorted.map(t => t.votes)) : 0
  const top3 = sorted.slice(0, 3)
  const rest = sorted.slice(3)

  return (
    <div>
      <h1 className="text-3xl font-bold text-center mb-1">Resultados en Vivo</h1>
      <p className="text-center text-gray-500 mb-6">
        Total de votos: <span className="font-bold text-indigo-600">{total}</span>
      </p>

      {sorted.length === 0 && (
        <p className="text-center text-gray-400 mt-10">No hay resultados disponibles</p>
      )}

      {/* PODIO - Kahoot style */}
      {top3.length === 3 && (
        <div className="flex items-end justify-center gap-2 sm:gap-4 mb-10">
          <div className="flex-1 max-w-[200px]">
            <PodiumCard team={top3[2]} medal={MEDALS[2]} size="sm" totalVotes={total} maxV={maxV} />
          </div>
          <div className="flex-1 max-w-[240px] z-10 relative -top-3">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-3xl select-none">&#x1F451;</div>
            <PodiumCard team={top3[0]} medal={MEDALS[0]} size="lg" totalVotes={total} maxV={maxV} />
          </div>
          <div className="flex-1 max-w-[200px]">
            <PodiumCard team={top3[1]} medal={MEDALS[1]} size="sm" totalVotes={total} maxV={maxV} />
          </div>
        </div>
      )}

      {top3.length > 0 && top3.length < 3 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {top3.map((team, i) => (
            <PodiumCard key={team.id} team={team} medal={MEDALS[i]} size="md" totalVotes={total} maxV={maxV} />
          ))}
        </div>
      )}

      {/* RESTO - lista */}
      {rest.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-500 mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-indigo-500 rounded-full inline-block"></span>
            Demás participantes
          </h2>
          <div className="space-y-3">
            {rest.map((team, index) => {
              const position = index + 4
              const percentage = total > 0 ? ((team.votes / total) * 100).toFixed(1) : 0
              const barWidth = total > 0 ? (team.votes / maxV) * 100 : 0
              return (
                <div key={team.id} className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-gray-300 p-4 flex items-center gap-4 transition-all hover:shadow-md">
                  <span className="text-lg font-bold text-gray-400 w-8 text-center">#{position}</span>
                  {team.photo && (
                    <img src={team.photo} alt={team.name} className="h-11 w-11 object-cover rounded-full ring-2 ring-white shadow-sm" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 truncate">{team.name}</h3>
                    <span className="text-xs text-gray-400">{team.votes} votos</span>
                  </div>
                  <div className="hidden sm:block w-32 md:w-48 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-indigo-400 to-indigo-500"
                      style={{ width: `${Math.max(barWidth, 2)}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-indigo-600 min-w-[3rem] text-right">{percentage}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
