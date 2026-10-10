const express = require("express");
const config = require("./infrastructure/config");
const logger = require("./infrastructure/logger");
const prisma = require("./infrastructure/database/prisma.client");
const { seedMemberships } = require("./infrastructure/seed");
const { startCustomerKafkaConsumer, isConsumerConnected } = require("./infrastructure/kafka/kafka.consumer");
const { startGrpcServer } = require("./interfaces/grpc/customer.grpc.server");
const customerRoutes = require("./interfaces/http/customer.routes");

const app = express();
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const reqId = req.headers["x-request-id"] || "req-" + Date.now();
  res.setHeader("x-request-id", reqId);
  logger.info({ reqId, method: req.method, url: req.url }, "Incoming request");
  next();
});

// Internal Health check
app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({
      status: "UP",
      service: "customer-service",
      postgres: "connected",
      kafka: isConsumerConnected() ? "connected" : "connecting"
    });
  } catch (err) {
    return res.status(503).json({ status: "DOWN", service: "customer-service", error: err.message });
  }
});

// Mount routes at /api/customers and /customers
app.use("/api/customers", customerRoutes);
app.use("/customers", customerRoutes);

// Error middleware
app.use((err, req, res, next) => {
  logger.error({ err: err.message, path: req.path }, "Customer error handler");
  return res.status(500).json({ code: "INTERNAL_ERROR", message: err.message || "An unexpected error occurred" });
});

async function startServer() {
  try {
    await seedMemberships();
    startCustomerKafkaConsumer();
    startGrpcServer();

    const server = app.listen(config.PORT, () => {
      logger.info({ port: config.PORT }, `Customer Service listening on HTTP port ${config.PORT}`);
    });
    return server;
  } catch (err) {
    logger.error({ err }, "Failed to start Customer Service");
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
