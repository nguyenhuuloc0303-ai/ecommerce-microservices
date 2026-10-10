const mongoose = require("mongoose");
const config = require("../config");
const logger = require("../logger");

async function connectMongo() {
  try {
    await mongoose.connect(config.MONGO_URI);
    logger.info({ uri: config.MONGO_URI.replace(/\/\/[^@]+@/, "//***@") }, "Connected to MongoDB shipment_db");
  } catch (err) {
    logger.error({ err }, "Failed to connect to MongoDB shipment_db");
    throw err;
  }
}

module.exports = { connectMongo };
