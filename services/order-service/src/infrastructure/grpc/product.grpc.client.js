const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");
const config = require("../config");
const logger = require("../logger");

const protoPath = path.resolve(__dirname, "../../../proto/product.proto");
const packageDef = protoLoader.loadSync(protoPath, {
  keepCase: true, longs: Number, enums: String, defaults: true, oneofs: true
});
const productProto = grpc.loadPackageDefinition(packageDef).product;
const client = new productProto.ProductService(config.PRODUCT_GRPC_URL, grpc.credentials.createInsecure());

function reserveStock(items) {
  return new Promise((resolve, reject) => {
    const deadline = new Date(Date.now() + 3000); // 3s deadline
    client.ReserveStock({ items }, { deadline }, (err, response) => {
      if (err) {
        logger.error({ err, items }, "gRPC ReserveStock failed");
        return reject(err);
      }
      resolve(response.items);
    });
  });
}

function releaseStock(items) {
  return new Promise((resolve, reject) => {
    const deadline = new Date(Date.now() + 3000); // 3s deadline
    client.ReleaseStock({ items }, { deadline }, (err, response) => {
      if (err) {
        logger.error({ err, items }, "gRPC ReleaseStock failed");
        return reject(err);
      }
      resolve(response);
    });
  });
}

module.exports = { reserveStock, releaseStock };
