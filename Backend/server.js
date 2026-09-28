require("dotenv").config()
const app = require("./src/app")
const connectToDB = require("./src/config/database")
const dns = require('dns');

// Google ke public DNS servers set karein
dns.setServers(['8.8.8.8', '8.8.4.4']);

connectToDB()


app.listen(3000, () => {
    console.log("Server is running on port 3000")
})