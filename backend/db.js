const { MongoClient } = require('mongodb')
const { hashPassword } = require('./auth')

const uri =
  process.env.MONGO ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017'

// La base de datos siempre apunta a votaciones-empremd (se puede sobreescribir con MONGO_DB)
const dbName = process.env.MONGO_DB || 'votaciones-empremd'

const client = new MongoClient(uri)
let db = null

async function connect() {
  if (db) return db
  await client.connect()
  db = client.db(dbName)

  // Un voto por correo institucional + un voto por IP (evita votos desde distintos navegadores/dispositivos)
  const existingIndexes = await db.collection('votes').indexes()
  const indexNames = existingIndexes.map(i => i.name)
  if (indexNames.includes('ip_1')) {
    await db.collection('votes').dropIndex('ip_1')
  }
  if (indexNames.includes('deviceId_1')) {
    await db.collection('votes').dropIndex('deviceId_1')
  }
  await db.collection('votes').createIndex({ email: 1 }, { unique: true })
  await db.collection('votes').createIndex({ ip: 1 }, { unique: true, sparse: true })

  // Token de subida único por equipo (para los links de carga de imágenes)
  await db.collection('teams').createIndex({ uploadToken: 1 }, { unique: true, sparse: true })

  // Estado de la votación por defecto (no sobreescribe si ya existe)
  await db.collection('settings').updateOne(
    { key: 'voting_active' },
    { $setOnInsert: { key: 'voting_active', value: 'false' } },
    { upsert: true }
  )

  // Contraseña de admin guardada (hasheada) en la base de datos.
  // Se siembra desde ADMIN_PASSWORD la primera vez; luego se gestiona desde el panel.
  const adminPwExists = await db.collection('settings').findOne({ key: 'admin_password' })
  if (!adminPwExists) {
    const defaultPw = process.env.ADMIN_PASSWORD || 'admin123'
    await db.collection('settings').insertOne({ key: 'admin_password', value: hashPassword(defaultPw) })
  }

  console.log(`MongoDB conectado: base de datos "${dbName}"`)
  return db
}

function getDb() {
  if (!db) throw new Error('La base de datos no está inicializada. Llama a connect() primero.')
  return db
}

module.exports = { connect, getDb, client }
