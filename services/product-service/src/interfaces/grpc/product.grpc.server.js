const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");
const { Product } = require("../../infrastructure/database/product.model");
const logger = require("../../infrastructure/logger");
const config = require("../../infrastructure/config");

const protoPath = path.resolve(__dirname, "../../../proto/product.proto");
const packageDefinition = protoLoader.loadSync(protoPath, {
  keepCase: true,
  longs: Number,
  enums: String,
  defaults: true,
  oneofs: true
});

const productProto = grpc.loadPackageDefinition(packageDefinition).product;

// ReserveStock: All-or-nothing atomic inventory reservation with automatic compensation
async function reserveStock(call, callback) {
  const { items } = call.request;
  logger.info({ items }, "gRPC ReserveStock requested");

  if (!items || items.length === 0) {
    return callback({
      code: grpc.status.INVALID_ARGUMENT,
      message: "Items list cannot be empty"
    });
  }

  // Step 1: Aggregate duplicate pid entries
  const aggregated = new Map();
  for (const item of items) {
    const pid = Number(item.pid);
    const qty = Number(item.qty);
    if (!pid || qty <= 0) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: `Invalid pid ${pid} or qty ${qty}`
      });
    }
    aggregated.set(pid, (aggregated.get(pid) || 0) + qty);
  }

  const reservedList = [];
  const successfullyDeducted = [];

  try {
    // Step 2: Sequentially process each aggregated item with atomic decrement
    for (const [pid, qty] of aggregated.entries()) {
      // Atomic find and decrement if quantity >= qty
      const updated = await Product.findOneAndUpdate(
        { pid, quantity: { $gte: qty } },
        { $inc: { quantity: -qty } },
        { new: false } // returns document BEFORE update to obtain unit_price
      );

      if (!updated) {
        // Either product does not exist, or quantity is insufficient
        const existing = await Product.findOne({ pid });
        if (!existing) {
          logger.warn({ pid }, "ReserveStock failed: product not found");
          await rollback(successfullyDeducted);
          return callback({
            code: grpc.status.NOT_FOUND,
            message: `Product with pid ${pid} not found`
          });
        } else {
          logger.warn({ pid, available: existing.quantity, requested: qty }, "ReserveStock failed: insufficient stock");
          await rollback(successfullyDeducted);
          return callback({
            code: grpc.status.FAILED_PRECONDITION,
            message: `Insufficient stock for product pid ${pid}: available ${existing.quantity}, requested ${qty}`
          });
        }
      }

      // Successfully deducted item
      successfullyDeducted.push({ pid, qty });
      reservedList.push({
        pid,
        qty,
        unit_price: Number(updated.price)
      });
    }

    logger.info({ reservedList }, "ReserveStock successful");
    return callback(null, { items: reservedList });
  } catch (err) {
    logger.error({ err }, "ReserveStock unexpected error, rolling back");
    await rollback(successfullyDeducted);
    return callback({
      code: grpc.status.INTERNAL,
      message: err.message
    });
  }
}

// Internal rollback compensation helper
async function rollback(deductedList) {
  for (const item of deductedList) {
    try {
      await Product.findOneAndUpdate(
        { pid: item.pid },
        { $inc: { quantity: item.qty } }
      );
      logger.info({ pid: item.pid, qty: item.qty }, "Compensated/rolled back stock");
    } catch (rbErr) {
      logger.error({ rbErr, item }, "Failed to compensate stock for item");
    }
  }
}

// ReleaseStock: Compensating transaction called by Order Service when order creation fails
async function releaseStock(call, callback) {
  const { items } = call.request;
  logger.info({ items }, "gRPC ReleaseStock requested");

  if (!items || items.length === 0) {
    return callback(null, { ok: true });
  }

  try {
    for (const item of items) {
      const pid = Number(item.pid);
      const qty = Number(item.qty);
      if (pid && qty > 0) {
        await Product.findOneAndUpdate(
          { pid },
          { $inc: { quantity: qty } }
        );
        logger.info({ pid, qty }, "Released/restored stock for product");
      }
    }
    return callback(null, { ok: true });
  } catch (err) {
    logger.error({ err }, "ReleaseStock error");
    return callback({
      code: grpc.status.INTERNAL,
      message: err.message
    });
  }
}

function startGrpcServer() {
  const server = new grpc.Server();
  server.addService(productProto.ProductService.service, {
    ReserveStock: reserveStock,
    ReleaseStock: releaseStock
  });

  const address = `0.0.0.0:${config.GRPC_PORT}`;
  server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
      logger.error({ err }, "Failed to bind Product gRPC server");
      return;
    }
    logger.info({ port }, `Product gRPC Server running on port ${port}`);
  });
  return server;
}

module.exports = { startGrpcServer };
