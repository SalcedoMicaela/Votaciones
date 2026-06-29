const express = require('express')
const router = express.Router()
const { ObjectId } = require('mongodb')
const { getDb } = require('../db')

// Solo se acepta el correo institucional de la ESPE (1 voto por correo)
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

// Calcula los resultados (equipos + votos por equipo + total)
async function computeResults(db) {
  const teams = await db.collection('teams').find().sort({ createdAt: 1, _id: 1 }).toArray()
  const counts = await db
    .collection('votes')
    .aggregate([{ $group: { _id: '$teamId', count: { $sum: 1 } } }])
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
  return { results, total }
}

router.post('/', async (req, res) => {
  const { teamId } = req.body
  const email = normEmail(req.body.email)
  const ip = getClientIp(req)

  try {
    const db = getDb()

    const settings = await db.collection('settings').findOne({ key: 'voting_active' })
    if (settings?.value !== 'true') {
      return res.status(403).json({ error: 'La votación no está activa' })
    }

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Debes usar tu correo institucional (@espe.edu.ec)' })
    }

    if (!ip) {
      return res.status(400).json({ error: 'No se pudo determinar tu dirección IP' })
    }

    const existingEmail = await db.collection('votes').findOne({ email })
    if (existingEmail) {
      return res.status(409).json({ error: 'Este correo ya emitió su voto' })
    }

    const existingIp = await db.collection('votes').findOne({ ip })
    if (existingIp) {
      return res.status(409).json({ error: 'Desde este dispositivo ya se emitió un voto' })
    }

    // Validar que el equipo exista
    if (!teamId || !ObjectId.isValid(teamId)) {
      return res.status(400).json({ error: 'Equipo inválido' })
    }
    const team = await db.collection('teams').findOne({ _id: new ObjectId(teamId) })
    if (!team) {
      return res.status(400).json({ error: 'Equipo inválido' })
    }

    try {
      await db.collection('votes').insertOne({ teamId, email, ip, votedAt: new Date() })
    } catch (e) {
      // Índices únicos en email e ip -> ya votó (condición de carrera)
      if (e.code === 11000) {
        return res.status(409).json({ error: 'Ya se emitió un voto desde este correo o dispositivo' })
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

// Verifica si un correo ya votó
router.get('/check', async (req, res) => {
  const email = normEmail(req.query.email)
  if (!EMAIL_RE.test(email)) {
    return res.json({ hasVoted: false, teamId: null })
  }
  try {
    const vote = await getDb().collection('votes').findOne({ email })
    res.json({ hasVoted: !!vote, teamId: vote?.teamId || null })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Verifica si la IP ya votó (se llama al cargar la página)
router.get('/check-ip', async (req, res) => {
  const ip = getClientIp(req)
  try {
    const vote = await getDb().collection('votes').findOne({ ip })
    res.json({ hasVoted: !!vote, teamId: vote?.teamId || null })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
