const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");
const prisma = require("../../infrastructure/database/prisma.client");
const logger = require("../../infrastructure/logger");
const config = require("../../infrastructure/config");

const protoPath = path.resolve(__dirname, "../../../proto/customer.proto");
const packageDefinition = protoLoader.loadSync(protoPath, {
  keepCase: true,
  longs: Number,
  enums: String,
  defaults: true,
  oneofs: true
});

const customerProto = grpc.loadPackageDefinition(packageDefinition).customer;

async function getCustomerMembership(call, callback) {
  try {
    const uid = call.request.uid;
    logger.info({ uid }, "gRPC GetCustomerMembership called");

    const customer = await prisma.customer.findUnique({
      where: { uid: Number(uid) },
      include: { membership: true }
    });

    if (!customer) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: `Customer with uid ${uid} not found`
      });
    }

    return callback(null, {
      uid: customer.uid,
      fullname: customer.fullname,
      mid: customer.mid,
      mname: customer.membership.mname,
      score: customer.membership.score
    });
  } catch (err) {
    logger.error({ err }, "gRPC GetCustomerMembership error");
    return callback({
      code: grpc.status.INTERNAL,
      message: err.message
    });
  }
}

function startGrpcServer() {
  const server = new grpc.Server();
  server.addService(customerProto.CustomerService.service, {
    GetCustomerMembership: getCustomerMembership
  });

  const address = `0.0.0.0:${config.GRPC_PORT}`;
  server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
      logger.error({ err }, "Failed to bind gRPC server");
      return;
    }
    logger.info({ port }, `Customer gRPC Server running on port ${port}`);
  });
  return server;
}

module.exports = { startGrpcServer };
