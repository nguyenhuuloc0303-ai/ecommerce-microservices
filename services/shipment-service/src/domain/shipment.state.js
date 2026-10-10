const ShipmentStatus = {
  PENDING: "PENDING",
  SHIPPING: "SHIPPING",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED"
};

const AllowedTransitions = {
  [ShipmentStatus.PENDING]: [ShipmentStatus.SHIPPING, ShipmentStatus.CANCELLED],
  [ShipmentStatus.SHIPPING]: [ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED],
  [ShipmentStatus.DELIVERED]: [],
  [ShipmentStatus.CANCELLED]: []
};

function canTransition(currentStatus, nextStatus) {
  if (!currentStatus || !nextStatus) return false;
  const allowed = AllowedTransitions[currentStatus];
  return Array.isArray(allowed) && allowed.includes(nextStatus);
}

module.exports = { ShipmentStatus, canTransition };
