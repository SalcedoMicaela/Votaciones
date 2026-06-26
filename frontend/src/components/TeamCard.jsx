import { useState } from 'react'

export default function TeamCard({ team, onVote, disabled, voted }) {
  const [showFullDesc, setShowFullDesc] = useState(false)
  const isLong = team.description && team.description.length > 80

  return (
    <div
      className={`bg-white rounded-2xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-xl ${
        voted ? 'ring-2 ring-green-400 shadow-lg shadow-green-100' : ''
      } ${disabled && !voted ? 'opacity-80' : ''}`}
    >
      <div className="aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden group relative">
        {team.photo ? (
          <img
            src={team.photo}
            alt={team.name}
            className="w-full h-full object-contain p-2 transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-200 text-7xl font-bold select-none">
            {team.name.charAt(0).toUpperCase()}
          </div>
        )}
        {voted && (
          <div className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
            Votado
          </div>
        )}
      </div>

      <div className="p-5">
        <h3 className="text-xl font-bold mb-1 truncate">{team.name}</h3>

        <div className="mb-4">
          <div
            className="overflow-hidden transition-all duration-500 ease-in-out"
            style={{ maxHeight: showFullDesc ? '600px' : '2.5em' }}
          >
            <p className="text-gray-500 text-sm leading-relaxed">
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
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              {showFullDesc ? 'Ocultar' : 'Ver más'}
            </button>
          )}
        </div>

        <button
          onClick={() => onVote(team.id)}
          disabled={disabled && !voted}
          className={`w-full py-3 rounded-xl font-semibold text-base transition-all duration-200 ${
            voted
              ? 'bg-green-50 text-green-600 ring-1 ring-green-300 cursor-default'
              : disabled
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 active:scale-[0.97] shadow-md hover:shadow-lg'
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
