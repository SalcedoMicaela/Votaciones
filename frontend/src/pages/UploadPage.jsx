import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { resizeImage } from '../utils/image'
import { Image as ImageIcon, Camera, Lock } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function UploadPage() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [logo, setLogo] = useState('')
  const [photo, setPhoto] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    loadTeam()
  }, [token])

  async function loadTeam() {
    try {
      const res = await axios.get(`${API}/api/upload/${token}`)
      setTeamName(res.data.name)
      setLogo(res.data.logo || '')
      setPhoto(res.data.photo || '')
    } catch (err) {
      setInvalid(true)
    } finally {
      setLoading(false)
    }
  }

  async function handleFile(e, setter, opts) {
    const file = e.target.files[0]
    if (!file) return
    try {
      const dataUrl = await resizeImage(file, opts)
      setter(dataUrl)
    } catch (err) {
      setMessage({ type: 'error', text: 'No se pudo procesar la imagen' })
    }
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      await axios.post(`${API}/api/upload/${token}`, { logo, photo })
      setMessage({ type: 'success', text: '¡Imágenes guardadas con éxito!' })
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Error al guardar' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 4000)
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

  if (invalid) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center bg-white p-8 rounded-2xl shadow-md">
        <Lock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Link inválido</h1>
        <p className="text-gray-500">Este enlace de subida no es válido o ha expirado. Pide al organizador un enlace nuevo.</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto mt-6">
      {message && (
        <div
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg text-sm font-semibold animate-bounce ${
            message.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="text-center mb-6">
        <p className="text-sm uppercase tracking-wide text-espe-700 font-semibold">Subir imágenes</p>
        <h1 className="text-3xl font-extrabold text-gray-800">{teamName}</h1>
        <p className="text-gray-500 mt-1">Sube el logo y una foto de tu equipo</p>
      </div>

      <div className="bg-white rounded-2xl shadow-md p-6 space-y-8">
        {/* LOGO */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Logo del equipo</label>
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 rounded-full bg-gray-50 ring-2 ring-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0">
              {logo ? (
                <img src={logo} alt="Logo" className="w-full h-full object-contain p-1" />
              ) : (
                <ImageIcon className="w-8 h-8 text-gray-300" />
              )}
            </div>
            <div className="flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={e => handleFile(e, setLogo, { maxSize: 512, quality: 0.9 })}
                className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-espe-50 file:text-espe-700 hover:file:bg-espe-100 cursor-pointer"
              />
              {logo && (
                <button onClick={() => setLogo('')} className="mt-2 text-xs text-red-500 hover:underline">
                  Quitar logo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* FOTO DEL EQUIPO */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Foto del equipo</label>
          <div className="aspect-[4/3] w-full rounded-xl bg-gray-50 ring-2 ring-gray-100 overflow-hidden flex items-center justify-center mb-3">
            {photo ? (
              <img src={photo} alt="Foto del equipo" className="w-full h-full object-contain" />
            ) : (
              <Camera className="w-12 h-12 text-gray-300" />
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={e => handleFile(e, setPhoto, { maxSize: 1280, quality: 0.82 })}
            className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-espe-50 file:text-espe-700 hover:file:bg-espe-100 cursor-pointer"
          />
          {photo && (
            <button onClick={() => setPhoto('')} className="mt-2 text-xs text-red-500 hover:underline">
              Quitar foto
            </button>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-xl font-semibold text-white bg-espe-600 hover:bg-espe-700 active:scale-[0.98] transition-all shadow-md disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Guardar imágenes'}
        </button>
        <p className="text-center text-xs text-gray-400">
          Las imágenes se comprimen automáticamente. Puedes volver a este enlace para cambiarlas cuando quieras.
        </p>
      </div>
    </div>
  )
}
