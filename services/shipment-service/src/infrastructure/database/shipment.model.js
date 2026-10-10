const mongoose = require("mongoose");

const historySchema = new mongoose.Schema({
  status: { type: String, required: true },
  at: { type: Date, default: Date.now }
}, { _id: false });

const shipmentSchema = new mongoose.Schema({
  shipid: { type: Number, required: true, unique: true, index: true },
  oid: { type: Number, required: true, unique: true, index: true },
  uid: { type: Number, required: true, index: true },
  status: {
    type: String,
    enum: ["PENDING", "SHIPPING", "DELIVERED", "CANCELLED"],
    default: "PENDING",
    required: true
  },
  history: { type: [historySchema], default: [] }
}, {
  timestamps: true,
  collection: "shipments"
});

const failedEventSchema = new mongoose.Schema({
  raw: { type: String, required: true },
  reason: { type: String, required: true },
  topic: { type: String, required: true },
  receivedAt: { type: Date, default: Date.now }
}, {
  collection: "failed_events"
});

const Shipment = mongoose.model("Shipment", shipmentSchema);
const FailedEvent = mongoose.model("FailedEvent", failedEventSchema);

module.exports = { Shipment, FailedEvent };
