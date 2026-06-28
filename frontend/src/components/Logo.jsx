import { useState } from 'react'

const SRC = {
  espe: '/espe-logo.png',
  club: '/club-logo.png',
}

const ALT = {
  espe: 'Universidad de las Fuerzas Armadas ESPE',
  club: 'Club de Emprendimiento ESPE',
}

// Logos institucionales (en frontend/public). Si falta el archivo, muestra "ESPE" como respaldo.
export default function Logo({ variant = 'espe', className = 'h-9' }) {
  const [err, setErr] = useState(false)

  if (err) {
    return (
      <div className={`${className} aspect-[2/1] rounded-md bg-espe-600 text-white font-extrabold tracking-widest flex items-center justify-center text-sm select-none`}>
        ESPE
      </div>
    )
  }

  return (
    <img
      src={SRC[variant] || SRC.espe}
      alt={ALT[variant] || ALT.espe}
      className={`${className} w-auto object-contain`}
      onError={() => setErr(true)}
    />
  )
}
