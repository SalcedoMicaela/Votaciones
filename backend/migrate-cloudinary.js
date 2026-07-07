require('dotenv').config()
const { connect, getDb, closeDb } = require('./db')
const { uploadToCloudinary } = require('./services/uploadToCloudinary')
const { isCloudinaryUrl } = require('./imageUrl')

async function migrate() {
  await connect()
  const db = getDb()
  const teams = await db.collection('teams').find({}).toArray()

  let migrated = 0
  let errors = 0

  for (const team of teams) {
    const id = team._id.toString()
    const updates = {}

    for (const field of ['logo', 'photo']) {
      const value = team[field]
      if (!value || isCloudinaryUrl(value)) continue

      try {
        console.log(`Migrando ${field} del equipo "${team.name}" (${id})...`)
        const url = await uploadToCloudinary(value, `teams/${id}/${field}`)
        if (url) {
          updates[field] = url
          updates[`${field}UpdatedAt`] = new Date()
          migrated++
        }
      } catch (err) {
        console.error(`Error migrando ${field} del equipo "${team.name}":`, err.message)
        errors++
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.collection('teams').updateOne({ _id: team._id }, { $set: updates })
      console.log(`  -> Equipo "${team.name}" actualizado`)
    }
  }

  console.log(`\nMigración completada: ${migrated} imágenes migradas, ${errors} errores`)
  await closeDb()
  process.exit(errors > 0 ? 1 : 0)
}

migrate()
