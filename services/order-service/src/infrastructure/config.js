require("dotenv").config();

module.exports = {
  PORT: process.env.PORT || 3004,
  DATABASE_URL_ORDER: process.env.DATABASE_URL_ORDER || "postgresql://order_user:order_pass@localhost:5432/order_db",
  CUSTOMER_GRPC_URL: process.env.CUSTOMER_GRPC_URL || "customer-service:50052",
  PRODUCT_GRPC_URL: process.env.PRODUCT_GRPC_URL || "product-service:50053",
  KAFKA_BROKER: process.env.KAFKA_BROKER || "kafka:9092",
  NODE_ENV: process.env.NODE_ENV || "development"
};
