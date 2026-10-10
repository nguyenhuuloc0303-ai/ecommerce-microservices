const { Shipment } = require("../../infrastructure/database/shipment.model");
const { canTransition } = require("../../domain/shipment.state");

class ShipmentController {
  // API-SHP-01: GET /api/shipments/:shipid
  async getOne(req, res, next) {
    try {
      const targetShipId = Number(req.params.shipid);
      const callerId = Number(req.headers["x-user-id"]);
      const callerRole = (req.headers["x-user-role"] || "").toLowerCase();

      const shipment = await Shipment.findOne({ shipid: targetShipId });
      if (!shipment) {
        return res.status(404).json({ code: "NOT_FOUND", message: `Shipment ${targetShipId} not found` });
      }

      // Ownership check: CUSTOMER (normal) can only view shipments with their own uid
      if (callerRole === "normal" && shipment.uid !== callerId) {
        return res.status(403).json({ code: "FORBIDDEN", message: "Forbidden: you can only view your own shipments" });
      }

      return res.status(200).json({
        shipid: shipment.shipid,
        oid: shipment.oid,
        uid: shipment.uid,
        status: shipment.status,
        history: shipment.history,
        createdAt: shipment.createdAt,
        updatedAt: shipment.updatedAt
      });
    } catch (err) {
      next(err);
    }
  }

  // API-SHP-02: PATCH /api/shipments/:shipid/status
  async updateStatus(req, res, next) {
    try {
      const targetShipId = Number(req.params.shipid);
      const callerRole = (req.headers["x-user-role"] || "").toLowerCase();
      const { status } = req.body;

      // Role check: Only ADMIN or SHIPMENT_STAFF can update status
      if (!["admin", "shipment_staff"].includes(callerRole)) {
        return res.status(403).json({ code: "FORBIDDEN", message: "Forbidden: only ADMIN or SHIPMENT_STAFF can update shipment status" });
      }

      if (!status || typeof status !== "string") {
        return res.status(400).json({ code: "VALIDATION_ERROR", message: "Status string is required" });
      }

      const normalizedNext = status.toUpperCase();
      const shipment = await Shipment.findOne({ shipid: targetShipId });
      if (!shipment) {
        return res.status(404).json({ code: "NOT_FOUND", message: `Shipment ${targetShipId} not found` });
      }

      // Check state transition machine (Rule A8)
      if (!canTransition(shipment.status, normalizedNext)) {
        return res.status(400).json({
          code: "INVALID_STATE_TRANSITION",
          message: `Cannot transition shipment status from ${shipment.status} to ${normalizedNext}`
        });
      }

      // Apply state update & append tracking history
      shipment.status = normalizedNext;
      shipment.history.push({ status: normalizedNext, at: new Date() });
      await shipment.save();

      return res.status(200).json({
        shipid: shipment.shipid,
        oid: shipment.oid,
        uid: shipment.uid,
        status: shipment.status,
        history: shipment.history,
        updatedAt: shipment.updatedAt
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ShipmentController();
