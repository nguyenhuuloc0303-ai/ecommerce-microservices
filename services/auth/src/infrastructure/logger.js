const pino = require("pino");
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: { service: "auth-service" },
  redact: {
    paths: ["req.headers.authorization", "password", "body.password"],
    censor: "[PROTECTED]"
  }
});
module.exports = logger;
