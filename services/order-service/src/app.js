const express = require("express");
const config = require("./infrastructure/config");
const logger = require("./infrastructure/logger");
const prisma = require("./infrastructure/database/prisma.client");
const { startOutboxPublisher, isProducerConnected } = require("./infrastructure/kafka/outbox.publisher");
const orderRoutes = require("./interfaces/http/order.routes");

const app = express();
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const reqId = req.headers["x-request-id"] || "req-" + Date.now();
  res.setHeader("x-request-id", reqId);
  logger.info({ reqId, method: req.method, url: req.url }, "Incoming request");
  next();
});

// Internal Healthcheck (checks DB and Kafka)
app.get("/health", async (req, res) => {
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (err) {
    logger.error({ err }, "Database healthcheck failed");
  }

  const kafkaOk = isProducerConnected();
  const healthy = dbOk && kafkaOk;
  return res.status(healthy ? 200 : 503).json({
    status: healthy ? "UP" : "DOWN",
    service: "order-service",
    database: dbOk ? "connected" : "disconnected",
    kafka: kafkaOk ? "connected" : "disconnected"
  });
});

// Mount routes at /api/orders and /orders
app.use("/api/orders", orderRoutes);
app.use("/orders", orderRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error({ err, path: req.path }, "Unhandled error in Order Service");
  return res.status(err.status || 500).json({
    code: err.code || "INTERNAL_ERROR",
    message: err.message || "Internal server error"
  });
});

async function startServer() {
  try {
    await prisma.$connect();
    logger.info("Connected to PostgreSQL order_db");

    startOutboxPublisher();

    app.listen(config.PORT, () => {
      logger.info({ port: config.PORT }, `Order Service listening on HTTP port ${config.PORT}`);
    });
  } catch (err) {
    logger.error({ err }, "Failed to start Order Service");
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
