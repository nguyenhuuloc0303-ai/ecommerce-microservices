const logger = require("../../../infrastructure/logger");

function errorHandler(err, req, res, next) {
  logger.error({ err, path: req.path, method: req.method }, "Request error");

  if (err.name === "ZodError") {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: err.errors.map(e => `${e.path.join(".")}: ${e.message}`).join("; "),
      details: err.errors
    });
  }

  const statusCode = err.status || err.statusCode || 500;
  return res.status(statusCode).json({
    code: err.code || "INTERNAL_ERROR",
    message: err.message || "An unexpected error occurred"
  });
}

module.exports = { errorHandler };
