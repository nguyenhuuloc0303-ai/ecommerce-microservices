const { z } = require("zod");
require("dotenv").config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  DATABASE_URL_AUTH: z.string().default("postgresql://auth_user:auth_pass@postgres:5432/auth_db"),
  JWT_SECRET: z.string().default("super-secret-jwt-key-for-microservices-2026"),
  KAFKA_BROKER: z.string().default("kafka:9092"),
  ADMIN_USERNAME: z.string().default("admin"),
  ADMIN_PASSWORD: z.string().default("Admin@123"),
  SHIPMENT_STAFF_USERNAME: z.string().default("shipment_staff"),
  SHIPMENT_STAFF_PASSWORD: z.string().default("Staff@123"),
  NODE_ENV: z.string().default("development")
});

const config = envSchema.parse({
  PORT: process.env.PORT || 3001,
  DATABASE_URL_AUTH: process.env.DATABASE_URL_AUTH,
  JWT_SECRET: process.env.JWT_SECRET,
  KAFKA_BROKER: process.env.KAFKA_BROKER,
  ADMIN_USERNAME: process.env.ADMIN_USERNAME,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  SHIPMENT_STAFF_USERNAME: process.env.SHIPMENT_STAFF_USERNAME,
  SHIPMENT_STAFF_PASSWORD: process.env.SHIPMENT_STAFF_PASSWORD,
  NODE_ENV: process.env.NODE_ENV
});

module.exports = config;
