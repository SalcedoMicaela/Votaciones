import { ShieldCheck, Leaf, Lightbulb, Cog, Globe, Heart, Star, Zap, Cpu, TreePine, BookOpen, Palmtree, Droplets, Sun, Shield, Sparkles } from 'lucide-react'

export const ICON_MAP = {
  ShieldCheck, Leaf, Lightbulb, Cog, Globe, Heart, Star, Zap,
  Cpu, TreePine, BookOpen, Palmtree, Droplets, Sun, Shield, Sparkles,
}

export const ICON_NAMES = Object.keys(ICON_MAP)

export const COLOR_MAP = {
  sky:    { badge: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200', accent: 'from-sky-500 to-sky-700' },
  emerald:{ badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', accent: 'from-emerald-500 to-teal-600' },
  purple: { badge: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200', accent: 'from-purple-500 to-purple-700' },
  amber:  { badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200', accent: 'from-amber-500 to-amber-700' },
  rose:   { badge: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200', accent: 'from-rose-500 to-rose-700' },
  indigo: { badge: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200', accent: 'from-indigo-500 to-indigo-700' },
  cyan:   { badge: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200', accent: 'from-cyan-500 to-cyan-700' },
  orange: { badge: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200', accent: 'from-orange-500 to-orange-700' },
  teal:   { badge: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200', accent: 'from-teal-500 to-teal-700' },
  pink:   { badge: 'bg-pink-50 text-pink-700 ring-1 ring-pink-200', accent: 'from-pink-500 to-pink-700' },
}

const DEFAULT = { num: 0, label: '', Icon: null, badge: '', accent: 'from-gray-500 to-gray-700' }

export function ejeInfo(eje, ejes = []) {
  if (!eje) return DEFAULT
  const match = ejes.find(e => e.name === eje)
  if (match) return fromDoc(match)
  return fallback(eje)
}

export function fromDoc(doc) {
  if (!doc) return DEFAULT
  return {
    num: doc.order || 0,
    label: doc.shortName || doc.name,
    Icon: ICON_MAP[doc.icon] || ShieldCheck,
    badge: COLOR_MAP[doc.color]?.badge || COLOR_MAP.sky.badge,
    accent: COLOR_MAP[doc.color]?.accent || COLOR_MAP.sky.accent,
  }
}

function fallback(eje) {
  if (/eje\s*1/i.test(eje || '')) {
    return { num: 1, label: 'Seguridad y Defensa', Icon: ShieldCheck, badge: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200', accent: 'from-sky-500 to-sky-700' }
  }
  if (/eje\s*2/i.test(eje || '')) {
    return { num: 2, label: 'Sostenibilidad', Icon: Leaf, badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', accent: 'from-emerald-500 to-teal-600' }
  }
  return DEFAULT
}
