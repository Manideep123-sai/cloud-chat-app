require('dotenv').config()
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')

const PORT = process.env.PORT || 5000
const MAX_ROOM_CAPACITY = parseInt(process.env.MAX_ROOM_CAPACITY || '10', 10)
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000'

const app = express()
app.use(express.json())
app.use(cors({ origin: CORS_ORIGIN }))

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: CORS_ORIGIN, methods: ['GET','POST'] } })

const rooms = new Map()

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, { sockets: new Map(), messages: [] })
  return rooms.get(roomId)
}

app.get('/room/:roomId', (req, res) => {
  const roomId = parseInt(req.params.roomId)
  if (isNaN(roomId) || roomId < 1 || roomId > 10000) return res.json({ ok: false, error: 'Room number must be 1-10000' })
  const room = rooms.get(String(roomId))
  return res.json({ ok: true, exists: !!room, members: room ? room.sockets.size : 0 })
})

io.on('connection', (socket) => {
  socket.on('join_room', (payload, cb) => {
    const { roomId, displayName } = payload || {}
    const num = parseInt(roomId)
    if (isNaN(num) || num < 1 || num > 10000) return cb({ ok: false, error: 'Room number must be 1-10000' })
    const id = String(num)
    const room = getOrCreateRoom(id)
    if (room.sockets.size >= MAX_ROOM_CAPACITY) return cb({ ok: false, error: 'Room is full' })
    const name = displayName?.trim() || `Guest-${socket.id.slice(0,4)}`
    const nameTaken = Array.from(room.sockets.values()).some(n => n.toLowerCase() === name.toLowerCase())
    if (nameTaken) return cb({ ok: false, error: 'Username already taken in this room' })
    socket.join(id)
    socket.data.roomId = id
    socket.data.displayName = name
    room.sockets.set(socket.id, name)
    cb({ ok: true, history: room.messages.slice(-200), members: room.sockets.size, displayName: name })
    io.in(id).emit('room_info', { roomId: id, members: room.sockets.size })
  })

  socket.on('send_message', (payload, cb) => {
    const roomId = socket.data.roomId
    if (!roomId) return cb({ ok: false })
    const content = String(payload.content || '').trim()
    if (!content) return cb({ ok: false })
    const msg = { messageId: `${socket.id}_${Date.now()}`, senderId: socket.id, displayName: socket.data.displayName, content, timestamp: Date.now() }
    const room = getOrCreateRoom(roomId)
    room.messages.push(msg)
    io.in(roomId).emit('new_message', msg)
    cb({ ok: true })
  })

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId
    if (!roomId) return
    const room = rooms.get(roomId)
    if (!room) return
    room.sockets.delete(socket.id)
    io.in(roomId).emit('room_info', { roomId, members: room.sockets.size })
    if (room.sockets.size === 0) rooms.delete(roomId)
  })
})

server.listen(PORT, () => console.log(`Chat backend running on port ${PORT}`))
