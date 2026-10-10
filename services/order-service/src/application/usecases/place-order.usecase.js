const prisma = require("../../infrastructure/database/prisma.client");
const DiscountPolicy = require("../../domain/discount.policy");
const { getCustomerMembership } = require("../../infrastructure/grpc/customer.grpc.client");
const { reserveStock, releaseStock } = require("../../infrastructure/grpc/product.grpc.client");
const logger = require("../../infrastructure/logger");

class PlaceOrderUseCase {
  async execute({ uid, items }) {
    // Step 1: Query Customer membership via gRPC
    let customer;
    try {
      customer = await getCustomerMembership(uid);
    } catch (cusErr) {
      if (cusErr.code === 5) { // NOT_FOUND
        const err = new Error(`Customer with uid ${uid} not found`);
        err.status = 404;
        err.code = "NOT_FOUND";
        throw err;
      }
      const err = new Error("Customer service unavailable");
      err.status = 503;
      err.code = "SERVICE_UNAVAILABLE";
      throw err;
    }

    // Step 2: Determine discount from score
    const discount = DiscountPolicy.fromScore(customer.score);

    // Step 3: Reserve stock via gRPC (all-or-nothing)
    let reservedItems;
    try {
      reservedItems = await reserveStock(items);
    } catch (prodErr) {
      if (prodErr.code === 5) { // NOT_FOUND
        const err = new Error(prodErr.details || "One or more products not found");
        err.status = 404;
        err.code = "NOT_FOUND";
        throw err;
      } else if (prodErr.code === 9) { // FAILED_PRECONDITION (insufficient stock)
        const err = new Error(prodErr.details || "Insufficient stock for requested items");
        err.status = 409;
        err.code = "INSUFFICIENT_STOCK";
        throw err;
      } else if (prodErr.code === 3) { // INVALID_ARGUMENT
        const err = new Error(prodErr.details || "Invalid items requested");
        err.status = 400;
        err.code = "VALIDATION_ERROR";
        throw err;
      } else {
        const err = new Error("Product service unavailable");
        err.status = 503;
        err.code = "SERVICE_UNAVAILABLE";
        throw err;
      }
    }

    // Step 4: Calculate total amount
    const total_amount = DiscountPolicy.calculateTotal(reservedItems, discount);

    // Step 5: Allocate shipment id from PostgreSQL sequence shipment_id_seq
    let shipid;
    try {
      const seqResult = await prisma.$queryRaw`SELECT nextval('shipment_id_seq')::int as shipid`;
      shipid = seqResult[0].shipid;
    } catch (seqErr) {
      logger.error({ seqErr }, "Failed to allocate shipment id sequence");
      // Compensate reserved stock
      await releaseStock(items);
      const err = new Error("Failed to allocate shipment ID");
      err.status = 500;
      throw err;
    }

    // Step 6: Atomic PostgreSQL transaction (Order + OrderDetail + OutboxEvent)
    try {
      const order = await prisma.$transaction(async (tx) => {
        const createdOrder = await tx.order.create({
          data: {
            uid: Number(uid),
            discount,
            total_amount,
            shipid,
            orderDetails: {
              create: reservedItems.map(item => ({
                pid: item.pid,
                qty: item.qty,
                unit_price: item.unit_price
              }))
            }
          },
          include: { orderDetails: true }
        });

        // Create OutboxEvent for Kafka topic order-created
        await tx.outboxEvent.create({
          data: {
            topic: "order-created",
            key: String(createdOrder.oid),
            payload: {
              eventType: "OrderCreated",
              version: "1.0",
              timestamp: new Date().toISOString(),
              data: {
                oid: createdOrder.oid,
                uid: createdOrder.uid,
                shipid: createdOrder.shipid,
                discount: Number(createdOrder.discount),
                total_amount: Number(createdOrder.total_amount),
                items: reservedItems,
                createdAt: createdOrder.createdAt.toISOString()
              }
            }
          }
        });

        return createdOrder;
      });

      // Return response adhering strictly to Section 5.1 & TC-ORD-01
      return {
        oid: order.oid,
        uid: order.uid,
        discount: Number(order.discount),
        total_amount: Number(order.total_amount),
        items: reservedItems,
        shipment: {
          shipid: order.shipid,
          status: "PENDING"
        }
      };
    } catch (txErr) {
      logger.error({ txErr }, "Database transaction failed, compensating stock!");
      // Compensation: Release previously reserved stock!
      try {
        await releaseStock(items);
      } catch (relErr) {
        logger.error({ relErr }, "CRITICAL: Stock compensation failed!");
      }
      const err = new Error("Order creation transaction failed: " + txErr.message);
      err.status = 500;
      throw err;
    }
  }
}

module.exports = new PlaceOrderUseCase();
