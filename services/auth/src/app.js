const express = require("express");
const config = require("./infrastructure/config");
const logger = require("./infrastructure/logger");
const prisma = require("./infrastructure/database/prisma.client");
const { isConnected } = require("./infrastructure/kafka/kafka.client");
const { startOutboxWorker } = require("./infrastructure/kafka/outbox.publisher");
const { seedRolesAndAccounts } = require("./infrastructure/seed");
const authRoutes = require("./interfaces/http/auth.routes");

const app = express();
app.use(express.json());

// Request logging (sanitizing passwords)
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
      service: "auth-service",
      postgres: "connected",
      kafka: isConnected() ? "connected" : "connecting"
    });
  } catch (err) {
    return res.status(503).json({
      status: "DOWN",
      service: "auth-service",
      error: err.message
    });
  }
});

// Mount routes at /api/auth and /auth
app.use("/api/auth", authRoutes);
app.use("/auth", authRoutes);

// Error middleware
app.use((err, req, res, next) => {
  logger.error({ err: err.message, path: req.path }, "Auth error handler");
  if (err.name === "ZodError") {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: err.errors.map(e => `${e.path.join(".")}: ${e.message}`).join("; "),
      details: err.errors
    });
  }
  return res.status(500).json({ code: "INTERNAL_ERROR", message: err.message || "An unexpected error occurred" });
});

async function startServer() {
  try {
    await seedRolesAndAccounts();
    startOutboxWorker(2000);
    const server = app.listen(config.PORT, () => {
      logger.info({ port: config.PORT }, `Auth Service listening on HTTP port ${config.PORT}`);
    });
    return server;
  } catch (err) {
    logger.error({ err }, "Failed to start Auth Service");
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
