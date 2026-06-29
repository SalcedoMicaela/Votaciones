const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const { ObjectId } = require('mongodb')
const { getDb } = require('../db')
const { hashPassword, verifyPassword } = require('../auth')

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

// Reinicia la votación: elimina todos los votos registrados
router.post('/reset-votes', adminAuth, async (req, res) => {
  try {
    const db = getDb()
    const result = await db.collection('votes').deleteMany({})
    req.app.get('io').emit('vote:update', { results: [], total: 0 })
    res.json({ success: true, deletedCount: result.deletedCount })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
