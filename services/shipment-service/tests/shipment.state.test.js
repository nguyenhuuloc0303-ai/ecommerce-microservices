const { describe, it } = require("node:test");
const assert = require("node:assert");
const { ShipmentStatus, canTransition } = require("../src/domain/shipment.state");

describe("Shipment State Transitions (Rule A8)", () => {
  it("PENDING can transition to SHIPPING or CANCELLED", () => {
    assert.strictEqual(canTransition(ShipmentStatus.PENDING, ShipmentStatus.SHIPPING), true);
    assert.strictEqual(canTransition(ShipmentStatus.PENDING, ShipmentStatus.CANCELLED), true);
  });

  it("PENDING cannot transition directly to DELIVERED", () => {
    assert.strictEqual(canTransition(ShipmentStatus.PENDING, ShipmentStatus.DELIVERED), false);
  });

  it("SHIPPING can transition to DELIVERED or CANCELLED", () => {
    assert.strictEqual(canTransition(ShipmentStatus.SHIPPING, ShipmentStatus.DELIVERED), true);
    assert.strictEqual(canTransition(ShipmentStatus.SHIPPING, ShipmentStatus.CANCELLED), true);
  });

  it("SHIPPING cannot transition back to PENDING", () => {
    assert.strictEqual(canTransition(ShipmentStatus.SHIPPING, ShipmentStatus.PENDING), false);
  });

  it("DELIVERED is terminal and cannot transition to any state", () => {
    assert.strictEqual(canTransition(ShipmentStatus.DELIVERED, ShipmentStatus.PENDING), false);
    assert.strictEqual(canTransition(ShipmentStatus.DELIVERED, ShipmentStatus.SHIPPING), false);
    assert.strictEqual(canTransition(ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED), false);
  });

  it("CANCELLED is terminal and cannot transition to any state", () => {
    assert.strictEqual(canTransition(ShipmentStatus.CANCELLED, ShipmentStatus.PENDING), false);
    assert.strictEqual(canTransition(ShipmentStatus.CANCELLED, ShipmentStatus.SHIPPING), false);
    assert.strictEqual(canTransition(ShipmentStatus.CANCELLED, ShipmentStatus.DELIVERED), false);
  });
});
