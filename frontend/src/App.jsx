import { Routes, Route, NavLink } from 'react-router-dom'
import VotePage from './pages/VotePage'
import AdminPage from './pages/AdminPage'
import ResultsPage from './pages/ResultsPage'
import UploadPage from './pages/UploadPage'
import VoteTeamPage from './pages/VoteTeamPage'
import Logo from './components/Logo'

const navClass = ({ isActive }) =>
  `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive ? 'text-espe-700 bg-espe-50' : 'text-gray-500 hover:text-espe-700 hover:bg-gray-50'
  }`

export default function App() {
  const year = new Date().getFullYear()
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <NavLink to="/" className="flex items-center gap-3 min-w-0">
            <Logo variant="espe" className="h-9" />
            <span className="hidden sm:block w-px h-8 bg-gray-200" />
            <span className="hidden sm:block font-bold text-gray-800 truncate">Sistema de Votaciones</span>
          </NavLink>
          <nav className="flex items-center gap-1 flex-shrink-0">
            <NavLink to="/" end className={navClass}>Votar</NavLink>
            <NavLink to="/results" className={navClass}>Resultados</NavLink>
            <NavLink to="/admin" className={navClass}>Admin</NavLink>
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
        </Routes>
      </main>

      <footer className="border-t border-gray-100 bg-white mt-8">
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
