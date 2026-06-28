// Franja institucional con los 3 logos: Universidad (ESPE) · Departamento (DCEA) · Club
export default function LogoBar({ className = '', size = 'md' }) {
  const espe = size === 'sm' ? 'h-8 sm:h-9' : 'h-9 sm:h-12'
  const sq = size === 'sm' ? 'h-10 sm:h-12' : 'h-12 sm:h-16'
  const divider = 'w-px h-8 sm:h-10 bg-gray-200'

  return (
    <div className={`inline-flex items-center gap-3 sm:gap-5 bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 px-4 sm:px-6 py-3 ${className}`}>
      <img src="/espe-logo.png" alt="Universidad de las Fuerzas Armadas ESPE" className={`${espe} w-auto object-contain`} />
      <span className={divider} />
      <img src="/departamento-logo.jpg" alt="Departamento de Ciencias Económicas, Administrativas y de Comercio (DCEA)" className={`${sq} w-auto object-contain`} />
      <span className={divider} />
      <img src="/club-logo.png" alt="Club de Emprendimiento ESPE" className={`${sq} w-auto object-contain`} />
    </div>
  )
}
