const express = require('express')
const router = express.Router()
const db = require('../db')

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.ip || req.socket.remoteAddress
}

router.post('/', async (req, res) => {
  const { teamId } = req.body
  const ip = getClientIp(req)

  try {
    const { rows: settings } = await db.query("SELECT value FROM settings WHERE key = 'voting_active'")
    if (settings[0]?.value !== 'true') {
      return res.status(403).json({ error: 'La votación no está activa' })
    }

    const { rows: existing } = await db.query('SELECT id FROM votes WHERE ip = $1', [ip])
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Ya has votado anteriormente' })
    }

    await db.query('INSERT INTO votes (team_id, ip) VALUES ($1, $2)', [teamId, ip])

    const { rows: results } = await db.query(`
      SELECT t.id, t.name, t.photo, t.description, COUNT(v.id)::int as votes
      FROM teams t LEFT JOIN votes v ON t.id = v.team_id
      GROUP BY t.id ORDER BY t.id
    `)

    const total = results.reduce((sum, r) => sum + r.votes, 0)
    const data = { results, total }

    req.app.get('io').emit('vote:update', data)

    res.json({ success: true, ...data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

router.get('/results', async (req, res) => {
  try {
    const { rows: results } = await db.query(`
      SELECT t.id, t.name, t.photo, t.description, COUNT(v.id)::int as votes
      FROM teams t LEFT JOIN votes v ON t.id = v.team_id
      GROUP BY t.id ORDER BY t.id
    `)
    const total = results.reduce((sum, r) => sum + r.votes, 0)
    res.json({ results, total })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/check', async (req, res) => {
  const ip = getClientIp(req)
  try {
    const { rows } = await db.query('SELECT id, team_id FROM votes WHERE ip = $1', [ip])
    res.json({ hasVoted: rows.length > 0, teamId: rows[0]?.team_id || null })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
