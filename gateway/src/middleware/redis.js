const Redis = require("ioredis");
const config = require("../config");
const logger = require("./logger");

const redis = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    return Math.min(times * 500, 2000);
  },
  enableOfflineQueue: false
});

let isRedisHealthy = false;

redis.on("connect", () => {
  isRedisHealthy = true;
  logger.info({ host: config.REDIS_HOST }, "Connected to Redis");
});

redis.on("error", (err) => {
  isRedisHealthy = false;
  logger.warn({ error: err.message }, "Redis connection error (fail-open mode active)");
});

module.exports = {
  redis,
  isRedisHealthy: () => isRedisHealthy
};
