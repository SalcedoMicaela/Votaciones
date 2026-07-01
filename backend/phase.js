// Helpers de fase y ranking combinado (nota jurados 80% + votos 20% relativo al más votado)

async function getCurrentPhase(db) {
  const s = await db.collection('settings').findOne({ key: 'current_phase' })
  return parseInt(s?.value || '1', 10) || 1
}

async function setCurrentPhase(db, n) {
  await db.collection('settings').updateOne(
    { key: 'current_phase' },
    { $set: { value: String(n) } },
    { upsert: true }
  )
}

// Equipos activos en una fase: phaseReached >= phase (default 1)
function isActive(team, phase) {
  return (team.phaseReached || 1) >= phase
}

// Ranking combinado de una fase, solo equipos activos.
async function computeRanking(db, phase) {
  const teams = (await db.collection('teams').find().sort({ createdAt: 1, _id: 1 }).toArray())
    .filter(t => isActive(t, phase))
  const ids = teams.map(t => t._id.toString())

  // votos por equipo en la fase
  const voteAgg = await db.collection('votes')
    .aggregate([{ $match: { phase } }, { $group: { _id: '$teamId', n: { $sum: 1 } } }])
    .toArray()
  const votos = {}
  voteAgg.forEach(v => { votos[v._id] = v.n })
  const maxVotos = ids.length ? Math.max(0, ...ids.map(id => votos[id] || 0)) : 0

  // promedio de notas de jurados por equipo en la fase
  const scoreAgg = await db.collection('scores')
    .aggregate([
      { $match: { phase } },
      { $group: { _id: '$teamId', avg: { $avg: '$total' }, n: { $sum: 1 } } },
    ])
    .toArray()
  const notas = {}
  scoreAgg.forEach(s => { notas[s._id] = { avg: s.avg, n: s.n } })

  const round2 = x => Math.round(x * 100) / 100

  const rows = teams.map(t => {
    const id = t._id.toString()
    const nota = notas[id]?.avg || 0
    const v = votos[id] || 0
    const puntosNota = nota * 0.8
    const puntosVotos = maxVotos > 0 ? (v / maxVotos) * 4 : 0
    return {
      id,
      name: t.name,
      logo: t.logo || '',
      eje: t.eje || '',
      notaJurados: round2(nota),
      numJurados: notas[id]?.n || 0,
      votos: v,
      puntosNota: round2(puntosNota),
      puntosVotos: round2(puntosVotos),
      final: round2(puntosNota + puntosVotos),
    }
  })

  rows.sort((a, b) => b.final - a.final || b.notaJurados - a.notaJurados || b.votos - a.votos)
  return rows
}

module.exports = { getCurrentPhase, setCurrentPhase, computeRanking, isActive }
