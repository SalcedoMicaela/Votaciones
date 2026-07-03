const { MongoClient } = require('mongodb')
const { hashPassword } = require('./auth')

const uri =
  process.env.MONGO ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017'

// La base de datos siempre apunta a votaciones-empremd (se puede sobreescribir con MONGO_DB)
const dbName = process.env.MONGO_DB || 'votaciones-empremd'

const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  heartbeatFrequencyMS: 10000,
  retryWrites: true,
  w: 'majority',
})

let db = null
let connecting = null

async function ensureIndex(collection, keys, options = {}) {
  const indexes = await collection.indexes()
  const exists = indexes.some(i => JSON.stringify(i.key) === JSON.stringify(keys))
  if (!exists) await collection.createIndex(keys, options)
}

async function connect() {
  if (db) return db
  if (connecting) return connecting
  connecting = (async () => {
    await client.connect()
    db = client.db(dbName)

    client.on('connectionPoolReady', () => {
      if (!db) db = client.db(dbName)
    })
    client.on('connectionPoolCleared', () => {
      console.warn('MongoDB pool cleared - intentando reconectar...')
    })

    const voteIdx = (await db.collection('votes').indexes()).map(i => i.name)
    for (const n of ['ip_1', 'email_1', 'deviceId_1']) {
      if (voteIdx.includes(n)) await db.collection('votes').dropIndex(n)
    }

    await ensureIndex(db.collection('votes'), { email: 1, phase: 1 }, { unique: true })
    await ensureIndex(db.collection('votes'), { deviceId: 1, phase: 1 }, { unique: true, sparse: true })
    await ensureIndex(db.collection('votes'), { phase: 1, teamId: 1 })

    await ensureIndex(db.collection('judges'), { username: 1 }, { unique: true })
    await ensureIndex(db.collection('judges'), { token: 1 }, { unique: true, sparse: true })
    await ensureIndex(db.collection('scores'), { judgeId: 1, teamId: 1, phase: 1 }, { unique: true })
    await ensureIndex(db.collection('scores'), { phase: 1, teamId: 1, total: 1 })

    await ensureIndex(db.collection('teams'), { uploadToken: 1 }, { unique: true, sparse: true })
    await ensureIndex(db.collection('teams'), { createdAt: 1, _id: 1 })
    await ensureIndex(db.collection('teams'), { phaseReached: 1 })
    await ensureIndex(db.collection('teams'), { phaseReached: 1, createdAt: 1 })

    await ensureIndex(db.collection('settings'), { key: 1 }, { unique: true })

    await db.collection('settings').updateOne(
      { key: 'current_phase' },
      { $setOnInsert: { key: 'current_phase', value: '1' } },
      { upsert: true }
    )

    await db.collection('settings').updateOne(
      { key: 'voting_active' },
      { $setOnInsert: { key: 'voting_active', value: 'false' } },
      { upsert: true }
    )

    const adminPwExists = await db.collection('settings').findOne({ key: 'admin_password' })
    if (!adminPwExists) {
      const defaultPw = process.env.ADMIN_PASSWORD || 'admin123'
      await db.collection('settings').insertOne({ key: 'admin_password', value: hashPassword(defaultPw) })
    }

    const qCount = await db.collection('questions').countDocuments()
    if (qCount === 0) {
      const defaultQuestions = [
        { text: 'La idea de negocio presentada resuelve de manera clara un problema o necesidad real de un segmento de mercado definido.', type: 'choice', options: [{ label: 'No cumple', points: 0 }, { label: 'Parcialmente', points: 1 }, { label: 'Adecuadamente', points: 2 }, { label: 'Excelentemente', points: 3 }], maxScore: 3, order: 1, createdAt: new Date() },
        { text: 'Existe una descripción explícita de un Modelo de Negocio que resalte el valor agregado del producto o servicio y ofrece un enfoque práctico para su implementación.', type: 'choice', options: [{ label: 'No cumple', points: 0 }, { label: 'Parcialmente', points: 1 }, { label: 'Adecuadamente', points: 2 }, { label: 'Excelentemente', points: 3 }], maxScore: 3, order: 2, createdAt: new Date() },
        { text: 'El proyecto/idea de negocio tiene claro quiénes son y cuántos son sus clientes potenciales?', type: 'choice', options: [{ label: 'No cumple', points: 0 }, { label: 'Parcialmente', points: 1 }, { label: 'Adecuadamente', points: 2 }, { label: 'Excelentemente', points: 3 }], maxScore: 3, order: 3, createdAt: new Date() },
        { text: 'Tiene una definición clara de la inversión, los costos e ingresos que su propuesta de emprendimiento podría generar.', type: 'choice', options: [{ label: 'No cumple', points: 0 }, { label: 'Parcialmente', points: 1 }, { label: 'Adecuadamente', points: 2 }, { label: 'Excelentemente', points: 3 }], maxScore: 3, order: 4, createdAt: new Date() },
        { text: 'Presenta de manera estructurada, dinámica y gráfica la idea de negocio. La presentación del equipo es clara, concisa y dentro del tiempo establecido.', type: 'choice', options: [{ label: 'No cumple', points: 0 }, { label: 'Parcialmente', points: 1 }, { label: 'Adecuadamente', points: 2 }, { label: 'Excelentemente', points: 3 }], maxScore: 3, order: 5, createdAt: new Date() },
        { text: 'Alguna observación o comentario, de ser necesario', type: 'text', options: [], maxScore: 0, order: 6, createdAt: new Date() },
      ]
      await db.collection('questions').insertMany(defaultQuestions)
      console.log('Preguntas de rúbrica por defecto insertadas')
    }

    console.log(`MongoDB conectado: base de datos "${dbName}"`)
    return db
  })()

  return connecting
}

function getDb() {
  if (!db) throw new Error('La base de datos no está inicializada. Llama a connect() primero.')
  return db
}

async function closeDb() {
  if (client) await client.close()
  db = null
  connecting = null
}

module.exports = { connect, getDb, closeDb, client }
