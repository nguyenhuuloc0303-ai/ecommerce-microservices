const express = require("express");
const helmet = require("helmet");
const { createProxyMiddleware, responseInterceptor } = require("http-proxy-middleware");
const config = require("./config");
const logger = require("./middleware/logger");
const { rateLimiter } = require("./middleware/rateLimiter");
const { authenticateAndAuthorize } = require("./middleware/auth");
const { getCachedProducts, invalidateProductCache, CACHE_PREFIX, TTL } = require("./middleware/cache");
const { redis, isRedisHealthy } = require("./middleware/redis");
const healthRoutes = require("./routes/health");

const app = express();

// 1. Request ID & Logging Middleware
app.use((req, res, next) => {
  const reqId = req.headers["x-request-id"] || "req-" + Date.now();
  req.headers["x-request-id"] = reqId;
  res.setHeader("X-Request-Id", reqId);
  logger.info({ reqId, method: req.method, path: req.path }, "Gateway request received");
  next();
});

// 2. Helmet Security Headers
app.use(helmet());

// 3. Mount Gateway Health and Ping routes directly (NO express.json() needed)
app.use(healthRoutes);
app.get("/health", (req, res) => res.redirect("/api/health"));

// 4. Rate Limiting Middleware (Global: 100/min, Auth: 10/min)
const globalLimiter = rateLimiter({ windowSeconds: 60, maxRequests: 100, keyPrefix: "rl:global" });
const authLimiter = rateLimiter({ windowSeconds: 60, maxRequests: 10, keyPrefix: "rl:auth" });

app.use("/api/auth", authLimiter);
app.use("/api", globalLimiter);

// 5. Authentication & RBAC Check
app.use(authenticateAndAuthorize);

// 6. Redis Product Cache Middleware (GET /api/products)
app.use(getCachedProducts);

// Helper to create proxy options (Piping untouched stream)
function buildProxy(targetUrl, isProductService = false) {
  return createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    selfHandleResponse: isProductService,
    onProxyReq(proxyReq, req) {
      if (req.headers["x-request-id"]) proxyReq.setHeader("x-request-id", req.headers["x-request-id"]);
      if (req.headers["x-user-id"]) proxyReq.setHeader("x-user-id", req.headers["x-user-id"]);
      if (req.headers["x-user-role"]) proxyReq.setHeader("x-user-role", req.headers["x-user-role"]);
    },
    onProxyRes: isProductService ? responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
      const responseBody = responseBuffer.toString("utf8");
      const status = proxyRes.statusCode;
      const method = req.method.toUpperCase();

      // Cache GET products on 200
      if (method === "GET" && status === 200 && isRedisHealthy()) {
        const cacheKey = `${CACHE_PREFIX}:${req.originalUrl}`;
        await redis.set(cacheKey, responseBody, "EX", TTL).catch(() => {});
      }

      // Invalidate cache on mutations (POST, PUT, DELETE)
      if (["POST", "PUT", "DELETE"].includes(method) && status >= 200 && status < 300) {
        await invalidateProductCache();
      }

      return responseBuffer;
    }) : undefined
  });
}

// 7. Route Proxies to Services (Path maintained)
app.use("/api/auth", buildProxy(config.AUTH_SERVICE_URL));
app.use("/api/products", buildProxy(config.PRODUCT_SERVICE_URL, true));
app.use("/api/customers", buildProxy(config.CUSTOMER_SERVICE_URL));
app.use("/api/orders", buildProxy(config.ORDER_SERVICE_URL));
app.use("/api/shipments", buildProxy(config.SHIPMENT_SERVICE_URL));

// 8. 404 Handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ code: "NOT_FOUND", message: "Resource not found on gateway" });
});

// 9. Error Handler
app.use((err, req, res, next) => {
  logger.error({ err: err.message, path: req.path }, "Gateway unhandled error");
  res.status(502).json({ code: "BAD_GATEWAY", message: "Downstream service unavailable" });
});

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, `API Gateway listening on HTTP port ${config.PORT}`);
});

module.exports = { app, server };
