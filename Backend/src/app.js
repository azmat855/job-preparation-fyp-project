const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")

const app = express()

const isAllowedOrigin = (origin) => {
    if (!origin) return true

    return /^(http|https):\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
}

app.use(express.json())
app.use(cookieParser())
app.use(cors({
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
            callback(null, true)
            return
        }

        callback(new Error("Not allowed by CORS"))
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}))

/* require all the routes here */
const authRouter = require("./routes/auth.routes")
const interviewRouter = require("./routes/interview.routes")


/* using all the routes here */
app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)



module.exports = app