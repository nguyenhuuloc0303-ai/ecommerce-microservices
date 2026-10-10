const { redis, isRedisHealthy } = require("./redis");
const logger = require("./logger");

function rateLimiter({ windowSeconds = 60, maxRequests = 100, keyPrefix = "rl" } = {}) {
  return async (req, res, next) => {
    if (!isRedisHealthy()) {
      // Fail-open: proceed with request if Redis is down
      return next();
    }

    try {
      const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown-ip";
      const key = `${keyPrefix}:${ip}`.replace(/:/g, "_");
      
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }

      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - count));

      if (count > maxRequests) {
        const ttl = await redis.ttl(key);
        res.setHeader("Retry-After", ttl > 0 ? ttl : windowSeconds);
        logger.warn({ ip, key, count, maxRequests }, "Rate limit exceeded");
        return res.status(429).json({
          code: "TOO_MANY_REQUESTS",
          message: "Too many requests. Please try again later.",
          retryAfter: ttl > 0 ? ttl : windowSeconds
        });
      }

      next();
    } catch (err) {
      logger.warn({ error: err.message }, "Rate limiter Redis failure -> fail-open");
      next();
    }
  };
}

module.exports = { rateLimiter };
