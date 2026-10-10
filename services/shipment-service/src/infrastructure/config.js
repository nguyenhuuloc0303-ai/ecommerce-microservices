require("dotenv").config();

module.exports = {
  PORT: process.env.PORT || 3005,
  MONGO_URI: process.env.MONGO_URI || "mongodb://shipment_user:shipment_pass@localhost:27017/shipment_db?authSource=shipment_db",
  KAFKA_BROKER: process.env.KAFKA_BROKER || "kafka:9092",
  NODE_ENV: process.env.NODE_ENV || "development"
};
