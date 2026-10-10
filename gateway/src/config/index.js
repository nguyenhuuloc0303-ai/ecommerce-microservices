const { z } = require("zod");
require("dotenv").config();

const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  JWT_SECRET: z.string().default("super-secret-jwt-key-for-microservices-2026"),
  REDIS_HOST: z.string().default("redis"),
  REDIS_PORT: z.coerce.number().default(6379),
  AUTH_SERVICE_URL: z.string().default("http://auth-service:3001"),
  CUSTOMER_SERVICE_URL: z.string().default("http://customer-service:3002"),
  PRODUCT_SERVICE_URL: z.string().default("http://product-service:3003"),
  ORDER_SERVICE_URL: z.string().default("http://order-service:3004"),
  SHIPMENT_SERVICE_URL: z.string().default("http://shipment-service:3005"),
  NODE_ENV: z.string().default("development")
});

const config = envSchema.parse({
  PORT: process.env.PORT || 8080,
  JWT_SECRET: process.env.JWT_SECRET,
  REDIS_HOST: process.env.REDIS_HOST || "redis",
  REDIS_PORT: process.env.REDIS_PORT || 6379,
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || "http://auth-service:3001",
  CUSTOMER_SERVICE_URL: process.env.CUSTOMER_SERVICE_URL || "http://customer-service:3002",
  PRODUCT_SERVICE_URL: process.env.PRODUCT_SERVICE_URL || "http://product-service:3003",
  ORDER_SERVICE_URL: process.env.ORDER_SERVICE_URL || "http://order-service:3004",
  SHIPMENT_SERVICE_URL: process.env.SHIPMENT_SERVICE_URL || "http://shipment-service:3005",
  NODE_ENV: process.env.NODE_ENV
});

module.exports = config;
