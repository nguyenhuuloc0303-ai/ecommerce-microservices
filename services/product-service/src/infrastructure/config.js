const { z } = require("zod");
require("dotenv").config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3003),
  GRPC_PORT: z.coerce.number().default(50053),
  MONGO_URI: z.string().default("mongodb://product_user:product_pass@mongo:27017/product_db?authSource=product_db"),
  NODE_ENV: z.string().default("development")
});

const config = envSchema.parse({
  PORT: process.env.PORT || 3003,
  GRPC_PORT: process.env.GRPC_PORT || 50053,
  MONGO_URI: process.env.MONGO_URI_PRODUCT || process.env.MONGO_URI,
  NODE_ENV: process.env.NODE_ENV
});

module.exports = config;
