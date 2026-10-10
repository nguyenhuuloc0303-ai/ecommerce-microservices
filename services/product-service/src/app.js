const express = require("express");
const mongoose = require("mongoose");
const config = require("./infrastructure/config");
const logger = require("./infrastructure/logger");
const { connectMongo } = require("./infrastructure/database/mongoose.connection");
const { startGrpcServer } = require("./interfaces/grpc/product.grpc.server");
const productRoutes = require("./interfaces/http/product.routes");
const { errorHandler } = require("./interfaces/http/middlewares/error.middleware");

const app = express();
app.use(express.json());

// Request logging middleware with x-request-id
app.use((req, res, next) => {
  const reqId = req.headers["x-request-id"] || "req-" + Date.now();
  res.setHeader("x-request-id", reqId);
  logger.info({ reqId, method: req.method, url: req.url }, "Incoming request");
  next();
});

// Internal Healthcheck
app.get("/health", (req, res) => {
  const isMongoReady = mongoose.connection.readyState === 1;
  const status = isMongoReady ? 200 : 503;
  return res.status(status).json({
    status: isMongoReady ? "UP" : "DOWN",
    service: "product-service",
    mongo: isMongoReady ? "connected" : "disconnected"
  });
});

// Mount routes at /api/products and /products
app.use("/api/products", productRoutes);
app.use("/products", productRoutes);

// Error middleware
app.use(errorHandler);

async function startServer() {
  try {
    await connectMongo();
    const grpcServer = startGrpcServer();
    const httpServer = app.listen(config.PORT, () => {
      logger.info({ port: config.PORT }, `Product Service listening on HTTP port ${config.PORT}`);
    });
    return { httpServer, grpcServer };
  } catch (err) {
    logger.error({ err }, "Failed to start Product Service");
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
