const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

async function testConnection() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT DEFAULT '',
        photo TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS votes (
        id SERIAL PRIMARY KEY,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        ip VARCHAR(45) NOT NULL,
        voted_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(ip)
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)
    await client.query(`
      INSERT INTO settings (key, value) VALUES ('voting_active', 'false')
      ON CONFLICT (key) DO NOTHING
    `)
    console.log('Database connected and schema ready')
  } finally {
    client.release()
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  testConnection,
}
