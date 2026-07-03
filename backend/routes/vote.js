const express = require('express')
const router = express.Router()
const { ObjectId } = require('mongodb')
const { getDb } = require('../db')
const { getCurrentPhase } = require('../phase')

// Solo se acepta el correo institucional de la ESPE (1 voto por correo y por fase)
const EMAIL_RE = /^[^\s@]+@espe\.edu\.ec$/i

function normEmail(e) {
  return (e || '').trim().toLowerCase()
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    const ips = forwarded.split(',').map(s => s.trim()).filter(Boolean)
    if (ips.length > 0) return ips[0]
  }
  return req.socket?.remoteAddress || req.ip || ''
}

function isActive(team, phase) {
  return (team.phaseReached || 1) >= phase
}

function mapPublicTeam(t) {
  return {
    id: t._id.toString(),
    name: t.name,
    description: t.description || '',
    eje: t.eje || '',
    logo: t.logo || '',
    photo: t.photo || '',
    members: t.members || [],
  }
}

// Resultados de la fase actual (solo equipos activos, votos de esa fase)
async function computeResults(db) {
  const phase = await getCurrentPhase(db)
  const teams = (await db.collection('teams').find().sort({ createdAt: 1, _id: 1 }).toArray())
    .filter(t => isActive(t, phase))
  const counts = await db
    .collection('votes')
    .aggregate([{ $match: { phase: { $lte: phase } } }, { $group: { _id: '$teamId', count: { $sum: 1 } } }])
    .toArray()

  const countMap = {}
  counts.forEach(c => { countMap[c._id] = c.count })

  const results = teams.map(t => ({
    id: t._id.toString(),
    name: t.name,
    logo: t.logo || '',
    photo: t.photo || '',
    description: t.description || '',
    eje: t.eje || '',
    members: t.members || [],
    votes: countMap[t._id.toString()] || 0,
  }))
  const total = results.reduce((sum, r) => sum + r.votes, 0)
  return { results, total, phase }
}

// Equipos activos de la fase actual (para la página pública de votación)
router.get('/teams', async (req, res) => {
  try {
    const db = getDb()
    const phase = await getCurrentPhase(db)
    const teams = (await db.collection('teams').find().sort({ createdAt: 1, _id: 1 }).toArray())
      .filter(t => isActive(t, phase))
    res.json({ phase, teams: teams.map(mapPublicTeam) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  const { teamId, deviceId } = req.body
  const email = normEmail(req.body.email)
  const ip = getClientIp(req)

  try {
    const db = getDb()
    const phase = await getCurrentPhase(db)

    const settings = await db.collection('settings').findOne({ key: 'voting_active' })
    if (settings?.value !== 'true') {
      return res.status(403).json({ error: 'La votación no está activa' })
    }

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Debes usar tu correo institucional (@espe.edu.ec)' })
    }

    if (!deviceId || deviceId.length < 8) {
      return res.status(400).json({ error: 'Identificador de dispositivo inválido' })
    }

    if (await db.collection('votes').findOne({ email, phase })) {
      return res.status(409).json({ error: 'Este correo ya emitió su voto en esta fase' })
    }
    if (await db.collection('votes').findOne({ deviceId, phase })) {
      return res.status(409).json({ error: 'Ya votaste desde este dispositivo en esta fase' })
    }

    // El equipo debe existir y estar activo en la fase actual
    if (!teamId || !ObjectId.isValid(teamId)) {
      return res.status(400).json({ error: 'Equipo inválido' })
    }
    const team = await db.collection('teams').findOne({ _id: new ObjectId(teamId) })
    if (!team || !isActive(team, phase)) {
      return res.status(400).json({ error: 'Equipo inválido para esta fase' })
    }

    try {
      await db.collection('votes').insertOne({ teamId, email, deviceId, ip, phase, votedAt: new Date() })
    } catch (e) {
      if (e.code === 11000) {
        return res.status(409).json({ error: 'Ya se emitió un voto desde este correo o dispositivo en esta fase' })
      }
      throw e
    }

    const data = await computeResults(db)
    req.app.get('io').emit('vote:update', data)

    res.json({ success: true, ...data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

router.get('/results', async (req, res) => {
  try {
    const data = await computeResults(getDb())
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Verifica si un correo ya votó en la fase actual
router.get('/check', async (req, res) => {
  const email = normEmail(req.query.email)
  if (!EMAIL_RE.test(email)) {
    return res.json({ hasVoted: false, teamId: null })
  }
  try {
    const db = getDb()
    const phase = await getCurrentPhase(db)
    const vote = await db.collection('votes').findOne({ email, phase })
    res.json({ hasVoted: !!vote, teamId: vote?.teamId || null })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Verifica si el dispositivo ya votó en la fase actual
router.get('/check-device', async (req, res) => {
  const { deviceId } = req.query
  if (!deviceId || deviceId.length < 8) {
    return res.json({ hasVoted: false, teamId: null })
  }
  try {
    const db = getDb()
    const phase = await getCurrentPhase(db)
    const vote = await db.collection('votes').findOne({ deviceId, phase })
    res.json({ hasVoted: !!vote, teamId: vote?.teamId || null })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
