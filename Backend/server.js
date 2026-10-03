require("dotenv").config()
const http = require("http")
const { Server } = require("socket.io")
const app = require("./src/app")
const connectToDB = require("./src/config/database")
const setupInterviewSocket = require("./src/sockets/interview.socket")
const dns = require('dns')

// Google ke public DNS servers set karein
dns.setServers(['8.8.8.8', '8.8.4.4']);

connectToDB()

// Create HTTP server wrapping Express app
const server = http.createServer(app)

// Attach Socket.IO
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => callback(null, true),
        credentials: true
    }
})

// Initialize Mock Interview Socket handlers
setupInterviewSocket(io)

// ✅ BADLAV HERE: app.listen ki jagah server.listen use karein!
const PORT = process.env.PORT;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})