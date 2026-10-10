const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");
const config = require("../config");
const logger = require("../logger");

const protoPath = path.resolve(__dirname, "../../../proto/customer.proto");
const packageDef = protoLoader.loadSync(protoPath, {
  keepCase: true, longs: Number, enums: String, defaults: true, oneofs: true
});
const customerProto = grpc.loadPackageDefinition(packageDef).customer;
const client = new customerProto.CustomerService(config.CUSTOMER_GRPC_URL, grpc.credentials.createInsecure());

function getCustomerMembership(uid) {
  return new Promise((resolve, reject) => {
    const deadline = new Date(Date.now() + 3000); // 3s deadline
    client.GetCustomerMembership({ uid: Number(uid) }, { deadline }, (err, response) => {
      if (err) {
        logger.error({ err, uid }, "gRPC GetCustomerMembership failed");
        return reject(err);
      }
      resolve(response);
    });
  });
}

module.exports = { getCustomerMembership };
