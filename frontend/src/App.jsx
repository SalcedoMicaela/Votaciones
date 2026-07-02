import { Routes, Route, NavLink } from 'react-router-dom'
import VotePage from './pages/VotePage'
import AdminPage from './pages/AdminPage'
import ResultsPage from './pages/ResultsPage'
import UploadPage from './pages/UploadPage'
import VoteTeamPage from './pages/VoteTeamPage'
import JudgePage from './pages/JudgePage'
import LeaderboardPage from './pages/LeaderboardPage'
import Logo from './components/Logo'

const navItem = [
  { to: '/', end: true, label: 'Votar', desc: 'Vota por tu equipo favorito' },
  { to: '/clasificacion', end: false, label: 'Clasificación', desc: 'Equipos mejores puntuados por el jurado y estudiantes' },
  { to: '/results', end: false, label: 'Resultados', desc: 'Ranking de los votos que tienen los equipos' },
  { to: '/admin', end: false, label: 'Admin', desc: 'Panel de administración' },
]

const navClass = ({ isActive }) =>
  `group px-2.5 py-1.5 rounded-lg text-left transition-colors ${
    isActive ? 'bg-espe-50 text-espe-700' : 'text-gray-600 hover:bg-gray-50'
  }`

export default function App() {
  const year = new Date().getFullYear()
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-40 print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-auto min-h-[4.5rem] py-2 flex items-center justify-between gap-3">
          <NavLink to="/" className="flex items-center gap-3 min-w-0">
            <Logo variant="espe" className="h-9" />
            <span className="hidden sm:block w-px h-8 bg-gray-200" />
            <span className="hidden sm:block font-bold text-gray-800 truncate">Sistema de Votaciones</span>
          </NavLink>
          <nav className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
            {navItem.map(item => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                <p className="text-xs sm:text-sm font-semibold leading-tight opacity-90">
                  {item.label}
                </p>
                <p className="text-[10px] sm:text-[11px] leading-tight hidden sm:block opacity-60">
                  {item.desc}
                </p>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6">
        <Routes>
          <Route path="/" element={<VotePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/subir/:token" element={<UploadPage />} />
          <Route path="/votar/:teamId" element={<VoteTeamPage />} />
          <Route path="/jurado" element={<JudgePage />} />
          <Route path="/jurado/:teamId" element={<JudgePage />} />
          <Route path="/clasificacion" element={<LeaderboardPage />} />
        </Routes>
      </main>

      <footer className="border-t border-gray-100 bg-white mt-8 print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center gap-6 sm:gap-10 mb-3">
            <img src="/espe-logo.png" alt="ESPE" className="h-7 sm:h-8 w-auto object-contain" />
            <img src="/departamento-logo.jpg" alt="DCEA" className="h-9 sm:h-11 w-auto object-contain" />
            <img src="/club-logo.png" alt="Club de Emprendimiento" className="h-9 sm:h-11 w-auto object-contain" />
          </div>
          <p className="text-center text-xs text-gray-400">
            Universidad de las Fuerzas Armadas ESPE · DCEA · Club de Emprendimiento · © {year}
          </p>
        </div>
      </footer>
    </div>
  )
}
