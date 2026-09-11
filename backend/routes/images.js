const express = require('express')
const { ObjectId } = require('mongodb')
const { getDb } = require('../db')
const { getImageUrl } = require('../imageUrl')

const router = express.Router()

router.get('/teams/:id/:field', async (req, res) => {
  const { id, field } = req.params
  if (!ObjectId.isValid(id) || !['logo', 'photo'].includes(field)) {
    return res.status(404).end()
  }

  try {
    const team = await getDb()
      .collection('teams')
      .findOne({ _id: new ObjectId(id) }, { projection: { [`${field}UpdatedAt`]: 1 } })

    const updatedAt = team?.[`${field}UpdatedAt`]
    if (!updatedAt) return res.status(404).end()

    const url = getImageUrl(updatedAt, '', id, field)
    // Evita loop infinito si CLOUDINARY_URL no está configurado (url apuntaría a sí mismo)
    if (!url || url.includes(`/api/images/teams/${id}/${field}`)) {
      return res.status(500).json({ error: 'CLOUDINARY_URL no configurado en el servidor' })
    }
    return res.redirect(302, url)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
