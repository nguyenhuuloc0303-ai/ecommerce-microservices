const mongoose = require("mongoose");
const logger = require("../logger");
const config = require("../config");

async function connectMongo(retries = 5, delay = 3000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await mongoose.connect(config.MONGO_URI, {
        serverSelectionTimeoutMS: 5000
      });
      logger.info({ uri: config.MONGO_URI.split("@")[1] || "mongo" }, "Connected to MongoDB product_db");
      return mongoose.connection;
    } catch (err) {
      logger.warn({ attempt: i, retries, error: err.message }, "MongoDB connection failed, retrying...");
      if (i === retries) throw err;
      await new Promise(res => setTimeout(res, delay));
    }
  }
}

module.exports = { connectMongo };
