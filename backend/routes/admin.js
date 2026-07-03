const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const { ObjectId } = require('mongodb')
const { getDb } = require('../db')
const { hashPassword, verifyPassword } = require('../auth')
const { getCurrentPhase, setCurrentPhase, computeRanking, getWeights, setWeights } = require('../phase')

// Valida una contraseña contra la guardada (hasheada) en la BD.
async function isValidAdminPassword(password) {
  const setting = await getDb().collection('settings').findOne({ key: 'admin_password' })
  if (setting?.value) return verifyPassword(password || '', setting.value)
  // Respaldo (BD sin contraseña): comparar con la variable de entorno
  return (password || '') === process.env.ADMIN_PASSWORD
}

async function adminAuth(req, res, next) {
  try {
    const ok = await isValidAdminPassword(req.headers['x-admin-password'])
    if (!ok) return res.status(401).json({ error: 'Unauthorized' })
    next()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Login: valida la contraseña (para que el panel muestre error si es incorrecta)
router.post('/login', async (req, res) => {
  try {
    const ok = await isValidAdminPassword(req.body.password)
    if (!ok) return res.status(401).json({ error: 'Contraseña incorrecta' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Cambiar la contraseña de admin (guardada hasheada en la BD)
router.post('/password', adminAuth, async (req, res) => {
  const { newPassword } = req.body
  if (!newPassword || String(newPassword).length < 4) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 4 caracteres' })
  }
  try {
    await getDb().collection('settings').updateOne(
      { key: 'admin_password' },
      { $set: { value: hashPassword(newPassword) } },
      { upsert: true }
    )
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

function makeToken() {
  return crypto.randomBytes(16).toString('hex')
}

// Mapea un documento de Mongo (_id) al formato que espera el frontend (id como string).
// IMPORTANTE: NO incluye uploadToken (esta lista es pública; el token va por /links protegido).
function mapTeam(doc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description || '',
    eje: doc.eje || '',
    logo: doc.logo || '',
    photo: doc.photo || '',
    whatsapp: doc.whatsapp || '',
    members: doc.members || [],
    phaseReached: doc.phaseReached || 1,
  }
}

// Normaliza el arreglo de integrantes a { nombre, carrera, correo }
function sanitizeMembers(members) {
  if (!Array.isArray(members)) return undefined
  return members
    .map(m => ({
      nombre: (m.nombre || '').trim(),
      carrera: (m.carrera || '').trim(),
      correo: (m.correo || '').trim(),
    }))
    .filter(m => m.nombre || m.carrera || m.correo)
}

router.get('/teams', async (req, res) => {
  try {
    const teams = await getDb()
      .collection('teams')
      .find()
      .sort({ createdAt: 1, _id: 1 })
      .toArray()
    res.json(teams.map(mapTeam))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/teams', adminAuth, async (req, res) => {
  const { name, description, photo, logo, whatsapp, members, eje } = req.body
  try {
    const doc = {
      name,
      description: description || '',
      eje: eje || '',
      logo: logo || '',
      photo: photo || '',
      whatsapp: whatsapp || '',
      uploadToken: makeToken(),
      members: sanitizeMembers(members) || [],
      createdAt: new Date(),
    }
    const result = await getDb().collection('teams').insertOne(doc)
    res.json(mapTeam({ ...doc, _id: result.insertedId }))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Links de subida por equipo (protegido). Genera token si falta.
router.get('/links', adminAuth, async (req, res) => {
  try {
    const teams = await getDb().collection('teams').find().sort({ createdAt: 1, _id: 1 }).toArray()
    const out = []
    for (const t of teams) {
      let token = t.uploadToken
      if (!token) {
        token = makeToken()
        await getDb().collection('teams').updateOne({ _id: t._id }, { $set: { uploadToken: token } })
      }
      out.push({
        id: t._id.toString(),
        name: t.name,
        token,
        whatsapp: t.whatsapp || '',
        hasLogo: !!t.logo,
        hasPhoto: !!t.photo,
      })
    }
    res.json(out)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/teams/:id', adminAuth, async (req, res) => {
  const { name, description, photo, logo, whatsapp, members, eje } = req.body
  const { id } = req.params
  if (!ObjectId.isValid(id)) return res.status(404).json({ error: 'Team not found' })
  try {
    const _id = new ObjectId(id)
    const set = { name, description: description || '' }
    if (eje !== undefined) set.eje = eje
    if (photo !== undefined) set.photo = photo
    if (logo !== undefined) set.logo = logo
    if (whatsapp !== undefined) set.whatsapp = whatsapp
    const cleanMembers = sanitizeMembers(members)
    if (cleanMembers !== undefined) set.members = cleanMembers
    const { matchedCount } = await getDb().collection('teams').updateOne(
      { _id },
      { $set: set }
    )
    if (matchedCount === 0) return res.status(404).json({ error: 'Team not found' })
    const updated = await getDb().collection('teams').findOne({ _id })
    res.json(mapTeam(updated))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/teams/:id', adminAuth, async (req, res) => {
  const { id } = req.params
  if (!ObjectId.isValid(id)) return res.status(404).json({ error: 'Team not found' })
  try {
    const { deletedCount } = await getDb()
      .collection('teams')
      .deleteOne({ _id: new ObjectId(id) })
    if (deletedCount === 0) return res.status(404).json({ error: 'Team not found' })
    // Borrar también los votos asociados (equivale al ON DELETE CASCADE)
    await getDb().collection('votes').deleteMany({ teamId: id })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/toggle', adminAuth, async (req, res) => {
  try {
    const settings = await getDb().collection('settings').findOne({ key: 'voting_active' })
    const current = settings?.value === 'true'
    const newValue = current ? 'false' : 'true'
    await getDb().collection('settings').updateOne(
      { key: 'voting_active' },
      { $set: { value: newValue } },
      { upsert: true }
    )
    req.app.get('io').emit('voting:toggle', newValue === 'true')
    res.json({ votingActive: newValue === 'true' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/status', async (req, res) => {
  try {
    const settings = await getDb().collection('settings').findOne({ key: 'voting_active' })
    res.json({ votingActive: settings?.value === 'true' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Reinicia votación, calificaciones y fases: elimina votos, scores, reinicia equipos a fase 1
router.post('/reset-all', adminAuth, async (req, res) => {
  try {
    const db = getDb()
    const votesDel = await db.collection('votes').deleteMany({})
    const scoresDel = await db.collection('scores').deleteMany({})
    await db.collection('teams').updateMany({}, { $set: { phaseReached: 1 } })
    await db.collection('settings').updateOne(
      { key: 'current_phase' }, { $set: { value: '1' } }, { upsert: true })
    await db.collection('settings').updateOne(
      { key: 'voting_active' }, { $set: { value: 'false' } }, { upsert: true })
    req.app.get('io').emit('vote:update', { results: [], total: 0 })
    req.app.get('io').emit('phase:update', { phase: 1 })
    req.app.get('io').emit('voting:toggle', false)
    res.json({ success: true, deletedVotes: votesDel.deletedCount, deletedScores: scoresDel.deletedCount })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Obtener ponderación actual
router.get('/weights', async (req, res) => {
  try {
    const w = await getWeights(getDb())
    res.json(w)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Guardar ponderación (judgeMax + voteMax = 20)
router.post('/weights', adminAuth, async (req, res) => {
  try {
    await setWeights(getDb(), Number(req.body.judgeMax), Number(req.body.voteMax))
    res.json({ ok: true })
  } catch (err) { res.status(400).json({ error: err.message }) }
})

// ===================== RÚBRICA (preguntas) =====================
function mapQuestion(q) {
  return {
    id: q._id.toString(),
    text: q.text,
    type: q.type || 'open',
    options: q.options || [],
    maxScore: q.maxScore,
    order: q.order || 0,
  }
}

// Construye los campos de una pregunta según su tipo.
// 'choice' -> opciones [{label, points}], maxScore = mayor puntaje de las opciones.
function buildQuestionFields(body) {
  const text = String(body.text || '').trim()
  const type = ['choice', 'text'].includes(body.type) ? body.type : 'choice'
  if (type === 'choice') {
    const options = (Array.isArray(body.options) ? body.options : [])
      .map(o => ({ label: String(o.label ?? '').trim(), points: Number(o.points) || 0 }))
      .filter(o => o.label !== '')
    const maxScore = options.reduce((m, o) => Math.max(m, o.points), 0)
    return { text, type, options, maxScore }
  }
  // Respuesta de texto libre: no suma puntos.
  return { text, type, options: [], maxScore: 0 }
}

function validateQuestion(fields) {
  if (!fields.text) return 'El texto de la pregunta es requerido'
  if (fields.type === 'choice' && fields.options.length < 1) return 'Agrega al menos una opción'
  return null
}

router.get('/questions', async (req, res) => {
  try {
    const qs = await getDb().collection('questions').find().sort({ order: 1, _id: 1 }).toArray()
    res.json(qs.map(mapQuestion))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/questions', adminAuth, async (req, res) => {
  const fields = buildQuestionFields(req.body)
  const err = validateQuestion(fields)
  if (err) return res.status(400).json({ error: err })
  try {
    const doc = { ...fields, order: Number(req.body.order) || 0, createdAt: new Date() }
    const r = await getDb().collection('questions').insertOne(doc)
    res.json(mapQuestion({ ...doc, _id: r.insertedId }))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/questions/:id', adminAuth, async (req, res) => {
  const { id } = req.params
  if (!ObjectId.isValid(id)) return res.status(404).json({ error: 'Pregunta no encontrada' })
  const fields = buildQuestionFields(req.body)
  const err = validateQuestion(fields)
  if (err) return res.status(400).json({ error: err })
  const set = { ...fields }
  if (req.body.order !== undefined) set.order = Number(req.body.order)
  try {
    await getDb().collection('questions').updateOne({ _id: new ObjectId(id) }, { $set: set })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/questions/:id', adminAuth, async (req, res) => {
  const { id } = req.params
  if (!ObjectId.isValid(id)) return res.status(404).json({ error: 'Pregunta no encontrada' })
  try {
    await getDb().collection('questions').deleteOne({ _id: new ObjectId(id) })
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ===================== JURADOS =====================
function mapJudge(j) {
  return { id: j._id.toString(), name: j.name, username: j.username, rawPassword: j.rawPassword || null }
}
function normUser(u) {
  return (u || '').trim().toLowerCase()
}

router.get('/judges', adminAuth, async (req, res) => {
  try {
    const js = await getDb().collection('judges').find().sort({ createdAt: 1, _id: 1 }).toArray()
    res.json(js.map(mapJudge))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/judges', adminAuth, async (req, res) => {
  const name = (req.body.name || '').trim()
  const username = normUser(req.body.username)
  const password = req.body.password || ''
  if (!name || !username || password.length < 4) {
    return res.status(400).json({ error: 'Nombre, usuario y contraseña (mín. 4) requeridos' })
  }
  try {
      const doc = {
        name,
        username,
        passwordHash: hashPassword(password),
        rawPassword: password,
        token: makeToken(),
        createdAt: new Date(),
      }
      const r = await getDb().collection('judges').insertOne(doc)
      res.json(mapJudge({ ...doc, _id: r.insertedId }))
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Ese usuario ya existe' })
    res.status(500).json({ error: err.message })
  }
})

router.put('/judges/:id', adminAuth, async (req, res) => {
  const { id } = req.params
  if (!ObjectId.isValid(id)) return res.status(404).json({ error: 'Jurado no encontrado' })
  const set = {}
  if (req.body.name !== undefined) set.name = String(req.body.name).trim()
  if (req.body.username !== undefined) set.username = normUser(req.body.username)
  if (req.body.password) { set.passwordHash = hashPassword(req.body.password); set.rawPassword = req.body.password }
  try {
    await getDb().collection('judges').updateOne({ _id: new ObjectId(id) }, { $set: set })
    res.json({ ok: true })
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Ese usuario ya existe' })
    res.status(500).json({ error: err.message })
  }
})

router.delete('/judges/:id', adminAuth, async (req, res) => {
  const { id } = req.params
  if (!ObjectId.isValid(id)) return res.status(404).json({ error: 'Jurado no encontrado' })
  try {
    await getDb().collection('judges').deleteOne({ _id: new ObjectId(id) })
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ===================== FASES / RANKING =====================
router.get('/phase', async (req, res) => {
  try {
    res.json({ phase: await getCurrentPhase(getDb()) })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/ranking', async (req, res) => {
  try {
    const db = getDb()
    const phase = req.query.phase ? parseInt(req.query.phase, 10) : await getCurrentPhase(db)
    const ranking = await computeRanking(db, phase)
    res.json({ phase, ranking })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/advance', adminAuth, async (req, res) => {
  const count = parseInt(req.body.count, 10)
  if (!(count >= 1)) return res.status(400).json({ error: 'Indica cuántos equipos pasan (mínimo 1)' })
  try {
    const db = getDb()
    const phase = await getCurrentPhase(db)
    const ranking = await computeRanking(db, phase)
    if (ranking.length === 0) return res.status(400).json({ error: 'No hay equipos activos en esta fase' })

    const topIds = ranking.slice(0, count).map(r => new ObjectId(r.id))
    await db.collection('teams').updateMany(
      { _id: { $in: topIds } },
      { $set: { phaseReached: phase + 1 } }
    )
    await setCurrentPhase(db, phase + 1)
    // Cerrar la votación; el admin la reabre en la nueva fase
    await db.collection('settings').updateOne(
      { key: 'voting_active' }, { $set: { value: 'false' } }, { upsert: true })

    // Limpiar calificaciones de jurados de la fase anterior, mantener votos
    await db.collection('scores').deleteMany({ phase })

    req.app.get('io').emit('phase:update', { phase: phase + 1 })
    req.app.get('io').emit('voting:toggle', false)
    res.json({ phase: phase + 1, passed: topIds.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Volver a la fase anterior: borra datos de la fase actual y decrementa
router.post('/regress', adminAuth, async (req, res) => {
  try {
    const db = getDb()
    const phase = await getCurrentPhase(db)
    if (phase <= 1) return res.status(400).json({ error: 'Ya estás en la fase 1, no se puede retroceder' })

    const prevPhase = phase - 1

    // Borrar solo calificaciones (los votos se conservan entre fases)
    await db.collection('scores').deleteMany({ phase })

    // Equipos que avanzaron en la fase anterior -> los regresa
    await db.collection('teams').updateMany(
      { phaseReached: phase },
      { $set: { phaseReached: prevPhase } }
    )

    await setCurrentPhase(db, prevPhase)
    await db.collection('settings').updateOne(
      { key: 'voting_active' }, { $set: { value: 'false' } }, { upsert: true })

    req.app.get('io').emit('phase:update', { phase: prevPhase })
    req.app.get('io').emit('voting:toggle', false)
    res.json({ phase: prevPhase })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
