const express = require("express");
const mongoose = require("mongoose");
const config = require("./infrastructure/config");
const logger = require("./infrastructure/logger");
const { connectMongo } = require("./infrastructure/database/mongoose.connection");
const { startShipmentKafkaConsumer, isConsumerConnected } = require("./infrastructure/kafka/shipment.consumer");
const shipmentRoutes = require("./interfaces/http/shipment.routes");

const app = express();
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const reqId = req.headers["x-request-id"] || "req-" + Date.now();
  res.setHeader("x-request-id", reqId);
  logger.info({ reqId, method: req.method, url: req.url }, "Incoming request");
  next();
});

// Internal Healthcheck (checks Mongo and Kafka consumer)
app.get("/health", (req, res) => {
  const isMongoReady = mongoose.connection.readyState === 1;
  const isKafkaReady = isConsumerConnected();
  const healthy = isMongoReady && isKafkaReady;
  return res.status(healthy ? 200 : 503).json({
    status: healthy ? "UP" : "DOWN",
    service: "shipment-service",
    mongo: isMongoReady ? "connected" : "disconnected",
    kafka: isKafkaReady ? "connected" : "disconnected"
  });
});

// Mount routes at /api/shipments and /shipments
app.use("/api/shipments", shipmentRoutes);
app.use("/shipments", shipmentRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error({ err, path: req.path }, "Unhandled error in Shipment Service");
  return res.status(err.status || 500).json({
    code: err.code || "INTERNAL_ERROR",
    message: err.message || "Internal server error"
  });
});

async function startServer() {
  try {
    await connectMongo();
    startShipmentKafkaConsumer();

    app.listen(config.PORT, () => {
      logger.info({ port: config.PORT }, `Shipment Service listening on HTTP port ${config.PORT}`);
    });
  } catch (err) {
    logger.error({ err }, "Failed to start Shipment Service");
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
