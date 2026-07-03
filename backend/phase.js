// Helpers de fase y ranking combinado (ponderación configurable desde settings)
// Valores por defecto: judgeMax=18, voteMax=2 (total 20)

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

async function getWeights(db) {
  const j = await db.collection('settings').findOne({ key: 'judgeMax' })
  const v = await db.collection('settings').findOne({ key: 'voteMax' })
  return {
    judgeMax: Math.max(0, Math.min(20, parseFloat(j?.value || '18') || 18)),
    voteMax: Math.max(0, Math.min(20, parseFloat(v?.value || '2') || 2)),
  }
}

async function setWeights(db, judgeMax, voteMax) {
  const total = (judgeMax || 0) + (voteMax || 0)
  if (total !== 20) throw new Error(`La suma debe ser 20 (actual: ${total})`)
  await db.collection('settings').updateOne(
    { key: 'judgeMax' }, { $set: { value: String(judgeMax) } }, { upsert: true }
  )
  await db.collection('settings').updateOne(
    { key: 'voteMax' }, { $set: { value: String(voteMax) } }, { upsert: true }
  )
}

async function getRubricMax(db) {
  const questions = await db.collection('questions').find().toArray()
  return questions.reduce((s, q) => s + (Number(q.maxScore) || 0), 0)
}

function imageVersion(value) {
  return value instanceof Date ? value.getTime() : ''
}

function imageUrl(base, id, field, hasImage, version) {
  if (!base || !hasImage) return ''
  const v = imageVersion(version) || id
  return `${base}/api/images/teams/${id}/${field}${v ? `?v=${v}` : ''}`
}

// Equipos activos en una fase: phaseReached >= phase (default 1)
function isActive(team, phase) {
  return (team.phaseReached || 1) >= phase
}

// Ranking combinado de una fase, solo equipos activos.
async function computeRanking(db, phase, imageBase = '') {
  const teams = await db.collection('teams').aggregate([
    { $sort: { createdAt: 1, _id: 1 } },
    { $match: { $expr: { $gte: [{ $ifNull: ['$phaseReached', 1] }, phase] } } },
    {
      $project: {
        name: 1,
        eje: 1,
        logoUpdatedAt: 1,
        photoUpdatedAt: 1,
        hasLogo: { $gt: [{ $strLenCP: { $ifNull: ['$logo', ''] } }, 0] },
        hasPhoto: { $gt: [{ $strLenCP: { $ifNull: ['$photo', ''] } }, 0] },
      }
    }
  ]).toArray()
  const ids = teams.map(t => t._id.toString())

  const { judgeMax, voteMax } = await getWeights(db)
  const rubricMax = await getRubricMax(db) || 20

  // votos acumulados de todas las fases (persisten al avanzar)
  const voteAgg = await db.collection('votes')
    .aggregate([{ $match: { phase: { $lte: phase } } }, { $group: { _id: '$teamId', n: { $sum: 1 } } }])
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
    const puntosNota = rubricMax > 0 ? (nota / rubricMax) * judgeMax : 0
    const puntosVotos = maxVotos > 0 ? (v / maxVotos) * voteMax : 0
    return {
      id,
      name: t.name,
      logo: imageUrl(imageBase, id, 'logo', t.hasLogo, t.logoUpdatedAt),
      photo: imageUrl(imageBase, id, 'photo', t.hasPhoto, t.photoUpdatedAt),
      eje: t.eje || '',
      notaJurados: round2(nota),
      rubricMax,
      numJurados: notas[id]?.n || 0,
      votos: v,
      judgeMax,
      voteMax,
      puntosNota: round2(puntosNota),
      puntosVotos: round2(puntosVotos),
      final: round2(puntosNota + puntosVotos),
    }
  })

  rows.sort((a, b) => b.final - a.final || b.notaJurados - a.notaJurados || b.votos - a.votos)
  return rows
}

module.exports = { getCurrentPhase, setCurrentPhase, computeRanking, isActive, getWeights, setWeights, getRubricMax }
