const jwt = require("jsonwebtoken")
const LiveInterviewSession = require("../services/liveInterview.service")
const interviewReportModel = require("../models/interviewReport.model")

function setupInterviewSocket(io) {
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token

        if (!token) {
            return next(new Error("Authentication token required."))
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET)
            socket.user = decoded
            return next()
        } catch (error) {
            return next(new Error("Invalid or expired auth token."))
        }
    })

    io.on("connection", (socket) => {
        console.log("Client connected for Live Interview:", socket.id)
        let activeSession = null

        // 1. Start Session
        socket.on("start-interview", async ({ interviewReportId }) => {
            try {
                const report = await interviewReportModel.findById(interviewReportId)
                if (!report) {
                    return socket.emit("error", { message: "Interview report not found." })
                }
                
                activeSession = new LiveInterviewSession(socket, report)
                activeSession.init()
                socket.emit("interview-started", { status: "ready" })
            } catch (err) {
                console.error("Error starting interview:", err)
                if (activeSession) {
                    activeSession.close()
                    activeSession = null
                }
                socket.emit("error", { message: err.message || "Failed to initialize interview session." })
            }
        })

        // Text answer support for the text-only mock interview.
        socket.on("text-message", async (data) => {
            if (activeSession && data.text) {
                try {
                    activeSession.sendTextMessage(data.text)
                } catch (err) {
                    socket.emit("error", { message: "Unable to process your answer." })
                }
            }
        })

        socket.on("retry-question", async () => {
            if (activeSession) {
                await activeSession.generateAndAskNextQuestion()
            }
        })

        // End interview and generate the feedback report.
        socket.on("end-interview", async () => {
            const session = activeSession
            if (session) {
                socket.emit("generating-feedback", { message: "Generating evaluation report..." })

                try {
                    const feedbackReport = await session.generateFinalFeedback()
                    activeSession = null
                    socket.emit("interview-ended", { feedback: feedbackReport })
                } catch (err) {
                    console.error("Error generating interview feedback:", err)
                    socket.emit("error", {
                        message: err.message || "Unable to generate interview feedback. Please try again."
                    })
                }
            }
        })

        socket.on("disconnect", () => {
            console.log("Client disconnected:", socket.id)
        })
    })
}

module.exports = setupInterviewSocket