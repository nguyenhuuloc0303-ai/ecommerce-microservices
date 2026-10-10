const prisma = require("../../infrastructure/database/prisma.client");
const placeOrderUseCase = require("../../application/usecases/place-order.usecase");
const { z } = require("zod");

const placeOrderSchema = z.object({
  items: z.array(z.object({
    pid: z.number().int().positive({ message: "pid must be a positive integer" }),
    qty: z.number().int().positive({ message: "qty must be a positive integer" })
  })).min(1, { message: "items array cannot be empty" })
});

class OrderController {
  // API-ORD-01: POST /api/orders
  async create(req, res, next) {
    try {
      const callerId = Number(req.headers["x-user-id"]);
      if (!callerId) {
        return res.status(401).json({ code: "UNAUTHORIZED", message: "Missing user identity" });
      }

      // Validate request body
      const validated = placeOrderSchema.parse(req.body);

      const result = await placeOrderUseCase.execute({
        uid: callerId,
        items: validated.items
      });

      return res.status(201).json(result);
    } catch (err) {
      if (err.name === "ZodError") {
        return res.status(400).json({
          code: "VALIDATION_ERROR",
          message: err.errors.map(e => e.message).join("; ")
        });
      }
      const status = err.status || 500;
      return res.status(status).json({
        code: err.code || "INTERNAL_ERROR",
        message: err.message
      });
    }
  }

  // API-ORD-02: GET /api/orders
  async getAll(req, res, next) {
    try {
      const callerId = Number(req.headers["x-user-id"]);
      const callerRole = (req.headers["x-user-role"] || "").toLowerCase();

      const where = callerRole === "admin" ? {} : { uid: callerId };

      const orders = await prisma.order.findMany({
        where,
        include: { orderDetails: true },
        orderBy: { createdAt: "desc" }
      });

      const mapped = orders.map(o => ({
        oid: o.oid,
        uid: o.uid,
        discount: Number(o.discount),
        total_amount: Number(o.total_amount),
        shipid: o.shipid,
        createdAt: o.createdAt,
        items: o.orderDetails.map(d => ({
          pid: d.pid,
          qty: d.qty,
          unit_price: Number(d.unit_price)
        }))
      }));

      return res.status(200).json(mapped);
    } catch (err) {
      next(err);
    }
  }

  // API-ORD-03: GET /api/orders/:oid
  async getOne(req, res, next) {
    try {
      const targetOid = Number(req.params.oid);
      const callerId = Number(req.headers["x-user-id"]);
      const callerRole = (req.headers["x-user-role"] || "").toLowerCase();

      const order = await prisma.order.findUnique({
        where: { oid: targetOid },
        include: { orderDetails: true }
      });

      if (!order) {
        return res.status(404).json({ code: "NOT_FOUND", message: `Order ${targetOid} not found` });
      }

      // Ownership check
      if (callerRole !== "admin" && order.uid !== callerId) {
        return res.status(403).json({ code: "FORBIDDEN", message: "Forbidden: you cannot view orders belonging to another user" });
      }

      return res.status(200).json({
        oid: order.oid,
        uid: order.uid,
        discount: Number(order.discount),
        total_amount: Number(order.total_amount),
        shipid: order.shipid,
        createdAt: order.createdAt,
        items: order.orderDetails.map(d => ({
          pid: d.pid,
          qty: d.qty,
          unit_price: Number(d.unit_price)
        }))
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new OrderController();
