require("dotenv").config();

module.exports = {
  PORT: process.env.PORT || 3003,
  GRPC_PORT: process.env.GRPC_PORT || 50053,
  MONGO_URI: process.env.MONGO_URI || "mongodb://product_user:product_pass@localhost:27017/product_db?authSource=product_db",
  NODE_ENV: process.env.NODE_ENV || "development"
};
