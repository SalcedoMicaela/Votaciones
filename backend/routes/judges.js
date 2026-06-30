const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const { ObjectId } = require('mongodb')
const { getDb } = require('../db')
const { verifyPassword } = require('../auth')
const { getCurrentPhase, isActive } = require('../phase')

function makeToken() {
  return crypto.randomBytes(16).toString('hex')
}

// Autenticación del jurado por token de sesión (header x-judge-token)
async function judgeAuth(req, res, next) {
  try {
    const token = req.headers['x-judge-token']
    if (!token) return res.status(401).json({ error: 'No autorizado' })
    const judge = await getDb().collection('judges').findOne({ token })
    if (!judge) return res.status(401).json({ error: 'Sesión inválida' })
    req.judge = judge
    next()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Login del jurado
router.post('/login', async (req, res) => {
  const username = (req.body.username || '').trim().toLowerCase()
  const password = req.body.password || ''
  try {
    const judge = await getDb().collection('judges').findOne({ username })
    if (!judge || !verifyPassword(password, judge.passwordHash)) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' })
    }
    let token = judge.token
    if (!token) {
      token = makeToken()
      await getDb().collection('judges').updateOne({ _id: judge._id }, { $set: { token } })
    }
    res.json({ id: judge._id.toString(), name: judge.name, token })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Datos del jurado autenticado
router.get('/me', judgeAuth, async (req, res) => {
  res.json({ id: req.judge._id.toString(), name: req.judge.name })
})

// Equipos activos de la fase actual + rúbrica + la nota que ya puso este jurado
router.get('/teams', judgeAuth, async (req, res) => {
  try {
    const db = getDb()
    const phase = await getCurrentPhase(db)
    const judgeId = req.judge._id.toString()

    const questions = (await db.collection('questions').find().sort({ order: 1, _id: 1 }).toArray())
      .map(q => ({
        id: q._id.toString(),
        text: q.text,
        type: q.type || 'open',
        options: q.options || [],
        maxScore: q.maxScore,
      }))

    const teams = (await db.collection('teams').find().sort({ createdAt: 1, _id: 1 }).toArray())
      .filter(t => isActive(t, phase))

    const myScores = await db.collection('scores').find({ judgeId, phase }).toArray()
    const scoreMap = {}
    myScores.forEach(s => { scoreMap[s.teamId] = s })

    const teamsOut = teams.map(t => {
      const id = t._id.toString()
      const sc = scoreMap[id]
      return {
        id,
        name: t.name,
        logo: t.logo || '',
        eje: t.eje || '',
        members: t.members || [],
        myScore: sc ? { answers: sc.answers, total: sc.total } : null,
      }
    })

    res.json({ phase, questions, teams: teamsOut })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Guardar/actualizar la calificación de un equipo en la fase actual
router.post('/score', judgeAuth, async (req, res) => {
  const { teamId, answers } = req.body
  if (!teamId || !ObjectId.isValid(teamId) || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'Datos de calificación inválidos' })
  }
  try {
    const db = getDb()
    const phase = await getCurrentPhase(db)
    const judgeId = req.judge._id.toString()

    const team = await db.collection('teams').findOne({ _id: new ObjectId(teamId) })
    if (!team || !isActive(team, phase)) {
      return res.status(400).json({ error: 'Equipo no disponible para esta fase' })
    }

    // Acotar cada puntaje a [0, maxScore] de su pregunta
    const questions = await db.collection('questions').find().toArray()
    const maxById = {}
    questions.forEach(q => { maxById[q._id.toString()] = q.maxScore })

    const clean = []
    let total = 0
    for (const a of answers) {
      const qid = String(a.questionId)
      if (!(qid in maxById)) continue
      let p = Number(a.points) || 0
      p = Math.max(0, Math.min(maxById[qid], p))
      clean.push({ questionId: qid, points: p })
      total += p
    }
    total = Math.round(total * 100) / 100

    await db.collection('scores').updateOne(
      { judgeId, teamId, phase },
      { $set: { judgeId, teamId, phase, answers: clean, total, updatedAt: new Date() } },
      { upsert: true }
    )

    req.app.get('io').emit('score:update', { teamId, phase })
    res.json({ ok: true, total })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
