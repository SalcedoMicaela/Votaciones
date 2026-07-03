const express = require('express')
const { ObjectId } = require('mongodb')
const { getDb } = require('../db')

const router = express.Router()

function sendDataImage(req, res, value) {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(value || '')
  if (!match) return res.status(404).end()

  const contentType = match[1]
  const isBase64 = !!match[2]
  const body = match[3]
  const version = String(req.query.v || '')

  res.set('Content-Type', contentType)
  if (version) {
    res.set('Cache-Control', 'public, max-age=31536000, immutable')
    res.set('ETag', `"${version}"`)
    if (req.headers['if-none-match'] === `"${version}"`) return res.status(304).end()
  } else {
    res.set('Cache-Control', 'public, max-age=0, must-revalidate')
  }
  res.send(isBase64 ? Buffer.from(body, 'base64') : decodeURIComponent(body))
}

router.get('/teams/:id/:field', async (req, res) => {
  const { id, field } = req.params
  if (!ObjectId.isValid(id) || !['logo', 'photo'].includes(field)) {
    return res.status(404).end()
  }

  try {
    const team = await getDb()
      .collection('teams')
      .findOne({ _id: new ObjectId(id) }, { projection: { [field]: 1 } })

    const image = team?.[field]
    if (!image) return res.status(404).end()
    sendDataImage(req, res, image)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
