const express = require('express')
const router = express.Router()
const db = require('../db')

function adminAuth(req, res, next) {
  const password = req.headers['x-admin-password']
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

router.get('/teams', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM teams ORDER BY id')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/teams', adminAuth, async (req, res) => {
  const { name, description, photo } = req.body
  try {
    const { rows } = await db.query(
      'INSERT INTO teams (name, description, photo) VALUES ($1, $2, $3) RETURNING *',
      [name, description || '', photo || '']
    )
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/teams/:id', adminAuth, async (req, res) => {
  const { name, description, photo } = req.body
  const { id } = req.params
  try {
    const { rows } = await db.query(
      'UPDATE teams SET name = $1, description = $2, photo = $3 WHERE id = $4 RETURNING *',
      [name, description || '', photo || '', id]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Team not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/teams/:id', adminAuth, async (req, res) => {
  const { id } = req.params
  try {
    const { rowCount } = await db.query('DELETE FROM teams WHERE id = $1', [id])
    if (rowCount === 0) return res.status(404).json({ error: 'Team not found' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/toggle', adminAuth, async (req, res) => {
  try {
    const { rows } = await db.query("SELECT value FROM settings WHERE key = 'voting_active'")
    const current = rows[0]?.value === 'true'
    const newValue = current ? 'false' : 'true'
    await db.query("UPDATE settings SET value = $1 WHERE key = 'voting_active'", [newValue])
    req.app.get('io').emit('voting:toggle', newValue === 'true')
    res.json({ votingActive: newValue === 'true' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/status', async (req, res) => {
  try {
    const { rows } = await db.query("SELECT value FROM settings WHERE key = 'voting_active'")
    res.json({ votingActive: rows[0]?.value === 'true' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
