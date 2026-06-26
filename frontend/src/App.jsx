import { Routes, Route, Link } from 'react-router-dom'
import VotePage from './pages/VotePage'
import AdminPage from './pages/AdminPage'
import ResultsPage from './pages/ResultsPage'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-md py-3 px-6 flex justify-between items-center">
        <Link to="/" className="text-xl font-bold text-indigo-600">Votaciones</Link>
        <div className="flex gap-4">
          <Link to="/" className="text-gray-600 hover:text-indigo-600">Votar</Link>
          <Link to="/results" className="text-gray-600 hover:text-indigo-600">Resultados</Link>
          <Link to="/admin" className="text-gray-600 hover:text-indigo-600">Admin</Link>
        </div>
      </nav>
      <div className="max-w-6xl mx-auto p-4">
        <Routes>
          <Route path="/" element={<VotePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/results" element={<ResultsPage />} />
        </Routes>
      </div>
    </div>
  )
}
