import { ShieldCheck, Leaf } from 'lucide-react'

// Metadatos visuales del eje temático (a partir del texto guardado del equipo)
export function ejeInfo(eje) {
  if (/eje\s*1/i.test(eje || '')) {
    return {
      num: 1,
      label: 'Seguridad y Defensa',
      Icon: ShieldCheck,
      badge: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
      accent: 'from-sky-500 to-sky-700',
    }
  }
  if (/eje\s*2/i.test(eje || '')) {
    return {
      num: 2,
      label: 'Sostenibilidad',
      Icon: Leaf,
      badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
      accent: 'from-emerald-500 to-teal-600',
    }
  }
  return { num: 0, label: '', Icon: null, badge: '', accent: 'from-espe-500 to-espe-700' }
}
