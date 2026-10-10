const { redis, isRedisHealthy } = require("./redis");
const logger = require("./logger");

const CACHE_PREFIX = "cache:products";
const TTL = 30; // 30 seconds per specification

async function getCachedProducts(req, res, next) {
  // Only cache GET /api/products
  if (req.method !== "GET" || !req.path.startsWith("/api/products") || !isRedisHealthy()) {
    return next();
  }

  const cacheKey = `${CACHE_PREFIX}:${req.originalUrl}`;
  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      res.setHeader("X-Cache", "HIT");
      res.setHeader("Content-Type", "application/json");
      return res.status(200).send(cachedData);
    }
    res.setHeader("X-Cache", "MISS");
  } catch (err) {
    logger.warn({ error: err.message }, "Cache read error -> fail-open");
  }
  next();
}

async function invalidateProductCache() {
  if (!isRedisHealthy()) return;
  try {
    const keys = await redis.keys(`${CACHE_PREFIX}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info({ count: keys.length }, "Product cache invalidated");
    }
  } catch (err) {
    logger.warn({ error: err.message }, "Product cache invalidation error");
  }
}

module.exports = {
  getCachedProducts,
  invalidateProductCache,
  CACHE_PREFIX,
  TTL
};
