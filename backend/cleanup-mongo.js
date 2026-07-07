require('dotenv').config()
const { connect, getDb, closeDb } = require('./db')

async function cleanup() {
  await connect()
  const db = getDb()

  const result = await db.collection('teams').updateMany(
    {},
    { $unset: { logo: '', photo: '' } }
  )

  console.log(`Campos logo/photo eliminados de ${result.modifiedCount} equipos`)
  await closeDb()
  process.exit(0)
}

cleanup()
