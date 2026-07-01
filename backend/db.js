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

  // Votación por fase: 1 voto por correo y por dispositivo EN CADA fase -> índices compuestos.
  // Se migran los índices simples viejos (email_1, deviceId_1, ip_1) si existen.
  const voteIdx = (await db.collection('votes').indexes()).map(i => i.name)
  for (const n of ['ip_1', 'email_1', 'deviceId_1']) {
    if (voteIdx.includes(n)) await db.collection('votes').dropIndex(n)
  }
  await db.collection('votes').createIndex({ email: 1, phase: 1 }, { unique: true })
  await db.collection('votes').createIndex({ deviceId: 1, phase: 1 }, { unique: true, sparse: true })

  // Jurados, rúbrica y calificaciones
  await db.collection('judges').createIndex({ username: 1 }, { unique: true })
  await db.collection('judges').createIndex({ token: 1 }, { unique: true, sparse: true })
  await db.collection('scores').createIndex({ judgeId: 1, teamId: 1, phase: 1 }, { unique: true })

  // Token de subida único por equipo (para los links de carga de imágenes)
  await db.collection('teams').createIndex({ uploadToken: 1 }, { unique: true, sparse: true })

  // Fase actual del evento (por defecto 1)
  await db.collection('settings').updateOne(
    { key: 'current_phase' },
    { $setOnInsert: { key: 'current_phase', value: '1' } },
    { upsert: true }
  )

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

  // Sembrar preguntas de rúbrica por defecto (solo si está vacío)
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
}

function getDb() {
  if (!db) throw new Error('La base de datos no está inicializada. Llama a connect() primero.')
  return db
}

module.exports = { connect, getDb, client }
