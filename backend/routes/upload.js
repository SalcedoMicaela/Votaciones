const express = require('express')
const router = express.Router()
const { getDb } = require('../db')
const { clearRankingCache } = require('../rankingCache')
const { uploadToCloudinary } = require('../services/uploadToCloudinary')
const { getImageUrl } = require('../imageUrl')

// Límite por imagen: ~3.5M caracteres base64 ≈ 2.5 MB ya decodificado
const MAX_IMAGE_CHARS = 3_500_000

function isValidImage(value) {
  if (typeof value !== 'string') return false
  if (value === '') return true // permite limpiar la imagen
  return value.startsWith('data:image/')
}

// Datos públicos del equipo para la página de subida (solo lo necesario)
router.get('/:token', async (req, res) => {
  try {
    const team = await getDb().collection('teams').findOne({ uploadToken: req.params.token })
    if (!team) return res.status(404).json({ error: 'Link de subida inválido' })
    res.json({
      name: team.name,
      logo: getImageUrl(team.logoUpdatedAt, '', team._id.toString(), 'logo'),
      photo: getImageUrl(team.photoUpdatedAt, '', team._id.toString(), 'photo'),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Subida de logo y/o foto del equipo (autenticado por el token del link)
router.post('/:token', async (req, res) => {
  const { logo, photo } = req.body
  try {
    const team = await getDb().collection('teams').findOne({ uploadToken: req.params.token })
    if (!team) return res.status(404).json({ error: 'Link de subida inválido' })

    const update = {}
    const teamId = team._id.toString()

    if (logo !== undefined) {
      if (!isValidImage(logo)) return res.status(400).json({ error: 'El logo debe ser una imagen válida' })
      if (logo.length > MAX_IMAGE_CHARS) return res.status(413).json({ error: 'El logo es demasiado grande (máx. ~2.5 MB)' })
      if (logo === '') {
        update.logoUpdatedAt = null
      } else {
        await uploadToCloudinary(logo, `teams/${teamId}/logo`)
        update.logoUpdatedAt = new Date()
      }
    }
    if (photo !== undefined) {
      if (!isValidImage(photo)) return res.status(400).json({ error: 'La foto debe ser una imagen válida' })
      if (photo.length > MAX_IMAGE_CHARS) return res.status(413).json({ error: 'La foto es demasiado grande (máx. ~2.5 MB)' })
      if (photo === '') {
        update.photoUpdatedAt = null
      } else {
        await uploadToCloudinary(photo, `teams/${teamId}/photo`)
        update.photoUpdatedAt = new Date()
      }
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No se envió ninguna imagen' })
    }

    await getDb().collection('teams').updateOne({ _id: team._id }, { $set: update })

    clearRankingCache()
    req.app.get('io').emit('team:update', { id: team._id.toString() })

    res.json({ success: true, logo: !!update.logoUpdatedAt, photo: !!update.photoUpdatedAt })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

module.exports = router
