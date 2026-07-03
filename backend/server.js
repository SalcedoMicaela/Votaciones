const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
require('dotenv').config()
const { connect } = require('./db')

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
})

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.set('io', io)
app.set('trust proxy', true)

app.use('/api/admin', require('./routes/admin'))
app.use('/api/vote', require('./routes/vote'))
app.use('/api/upload', require('./routes/upload'))
app.use('/api/judges', require('./routes/judges'))
app.use('/api/images', require('./routes/images'))

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

const PORT = process.env.PORT || 3000

connect().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}).catch(err => {
  console.error('Failed to connect to database:', err)
  process.exit(1)
})
