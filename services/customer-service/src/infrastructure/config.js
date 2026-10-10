const { z } = require("zod");
require("dotenv").config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3002),
  GRPC_PORT: z.coerce.number().default(50052),
  DATABASE_URL_CUSTOMER: z.string().default("postgresql://customer_user:customer_pass@postgres:5432/customer_db"),
  KAFKA_BROKER: z.string().default("kafka:9092"),
  NODE_ENV: z.string().default("development")
});

const config = envSchema.parse({
  PORT: process.env.PORT || 3002,
  GRPC_PORT: process.env.GRPC_PORT || 50052,
  DATABASE_URL_CUSTOMER: process.env.DATABASE_URL_CUSTOMER,
  KAFKA_BROKER: process.env.KAFKA_BROKER,
  NODE_ENV: process.env.NODE_ENV
});

module.exports = config;
