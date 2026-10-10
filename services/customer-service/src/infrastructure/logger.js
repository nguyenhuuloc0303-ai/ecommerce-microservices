const pino = require("pino");
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: { service: "customer-service" }
});
module.exports = logger;
