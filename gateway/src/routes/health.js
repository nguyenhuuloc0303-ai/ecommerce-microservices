const express = require("express");
const config = require("../config");
const { isRedisHealthy } = require("../middleware/redis");

const router = express.Router();

// Lightweight ping for container healthcheck
router.get("/ping", (req, res) => res.status(200).send("OK"));
router.get("/api/ping", (req, res) => res.status(200).send("OK"));

async function checkDownstream(url, name) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${url}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return { name, status: res.ok ? "UP" : "DOWN", httpStatus: res.status };
  } catch (err) {
    return { name, status: "DOWN", error: err.message };
  }
}

router.get("/api/health", async (req, res) => {
  const redisStatus = isRedisHealthy() ? "UP" : "DOWN";

  // Check dependencies
  const downstream = await Promise.all([
    checkDownstream(config.AUTH_SERVICE_URL, "auth-service"),
    checkDownstream(config.PRODUCT_SERVICE_URL, "product-service"),
    checkDownstream(config.CUSTOMER_SERVICE_URL, "customer-service")
  ]);

  const allDownstreamUp = downstream.every(d => d.status === "UP");
  const isSystemUp = isRedisHealthy() && allDownstreamUp;

  const responsePayload = {
    status: isSystemUp ? "UP" : "DOWN",
    message: "E-commerce API Gateway is running",
    dependencies: {
      redis: redisStatus,
      services: downstream.reduce((acc, curr) => { acc[curr.name] = curr.status; return acc; }, {})
    }
  };

  return res.status(isSystemUp ? 200 : 503).json(responsePayload);
});

module.exports = router;
