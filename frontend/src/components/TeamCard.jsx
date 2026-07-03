import { useState } from 'react'
import { ejeInfo } from '../utils/eje'

export default function TeamCard({ team, onVote, disabled, voted }) {
  const [showFullDesc, setShowFullDesc] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const isLong = team.description && team.description.length > 80
  const members = team.members || []
  const eje = ejeInfo(team.eje)

  return (
    <div
      className={`bg-white rounded-2xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 flex flex-col h-full ${
        voted ? 'ring-2 ring-espe-400 shadow-lg shadow-espe-100' : ''
      } ${disabled && !voted ? 'opacity-90' : ''}`}
    >
      <div className="aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden group relative">
        {team.photo ? (
          <img
            src={team.photo}
            alt={team.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-200 text-7xl font-bold select-none">
            {team.name.charAt(0).toUpperCase()}
          </div>
        )}
        {team.logo && (
          <div className="absolute top-3 left-3 h-12 w-12 rounded-full bg-white shadow-md ring-2 ring-white overflow-hidden flex items-center justify-center">
            <img src={team.logo} alt={`Logo ${team.name}`} loading="lazy" className="w-full h-full object-contain p-0.5" />
          </div>
        )}
        {voted && (
          <div className="absolute top-3 right-3 bg-espe-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
            Tu voto
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        {eje.num > 0 && (
          <span className={`self-start inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full mb-2 ${eje.badge}`}>
            {eje.Icon && <eje.Icon className="w-3.5 h-3.5" />} {eje.label}
          </span>
        )}
        <h3 className="text-xl font-bold mb-1 leading-tight">{team.name}</h3>

        <div className="mb-3">
          <div
            className="overflow-hidden transition-all duration-500 ease-in-out"
            style={{ maxHeight: showFullDesc ? '600px' : '2.5em' }}
          >
            <p className="text-gray-500 text-sm leading-relaxed whitespace-pre-line">
              {team.description || 'Sin descripción'}
            </p>
          </div>
          {isLong && (
            <button
              onClick={() => setShowFullDesc(!showFullDesc)}
              className="mt-1.5 w-full py-2 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 rounded-lg text-xs font-semibold text-gray-500 hover:text-gray-700 transition-all flex items-center justify-center gap-1.5"
            >
              <svg
                className={`w-4 h-4 transition-transform duration-300 ${showFullDesc ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              {showFullDesc ? 'Ocultar' : 'Ver más'}
            </button>
          )}
        </div>

        {members.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowMembers(!showMembers)}
              className="w-full py-2 bg-espe-50 hover:bg-espe-100 active:bg-espe-200 rounded-lg text-xs font-semibold text-espe-700 transition-all flex items-center justify-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 00-3-3.87" />
              </svg>
              Integrantes ({members.length})
              <svg
                className={`w-4 h-4 transition-transform duration-300 ${showMembers ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showMembers && (
              <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-100 overflow-hidden animate-fadeIn">
                {members.map((m, i) => (
                  <li key={i} className="px-3 py-2 hover:bg-gray-50">
                    <p className="text-sm font-medium text-gray-700 leading-tight">{m.nombre}</p>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-[11px] uppercase tracking-wide text-gray-400 truncate">{m.carrera}</span>
                      {m.correo && (
                        <span className="text-[11px] text-espe-600 truncate" title={m.correo}>{m.correo}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <button
          onClick={() => onVote(team.id)}
          disabled={disabled && !voted}
          className={`mt-auto w-full py-3 rounded-xl font-semibold text-base transition-all duration-200 ${
            voted
              ? 'bg-espe-50 text-espe-700 ring-1 ring-espe-300 cursor-default'
              : disabled
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-espe-600 text-white hover:bg-espe-700 active:scale-[0.97] shadow-md hover:shadow-lg'
          }`}
        >
          {voted ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Voto Registrado
            </span>
          ) : (
            'Votar'
          )}
        </button>
      </div>
    </div>
  )
}
