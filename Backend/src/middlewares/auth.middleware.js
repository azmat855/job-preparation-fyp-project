const jwt = require("jsonwebtoken")
const tokenBlacklistModel = require("../models/blacklist.model")



async function authUser(req, res, next) {

    const authorization = req.get("Authorization")
    const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
    const token = bearerToken || req.cookies?.token

    if (!token) {
        return res.status(401).json({
            message: "Token not provided."
        })
    }

    let decoded
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET)
    } catch (err) {

        return res.status(401).json({
            message: "Invalid token."
        })
    }

    const isTokenBlacklisted = await tokenBlacklistModel.findOne({ token })
    if (isTokenBlacklisted) {
        return res.status(401).json({
            message: "token is invalid"
        })
    }

    req.user = decoded
    next()

}


module.exports = { authUser }