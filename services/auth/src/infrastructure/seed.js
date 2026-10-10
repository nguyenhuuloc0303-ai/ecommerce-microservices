const bcrypt = require("bcryptjs");
const prisma = require("./database/prisma.client");
const config = require("./config");
const logger = require("./logger");

async function seedRolesAndAccounts() {
  // 1. Seed Roles: normal (1), admin (2), shipment_staff (3)
  const roles = [
    { roleid: 1, rolename: "normal" },
    { roleid: 2, rolename: "admin" },
    { roleid: 3, rolename: "shipment_staff" }
  ];

  for (const r of roles) {
    await prisma.role.upsert({
      where: { roleid: r.roleid },
      update: { rolename: r.rolename },
      create: r
    });
  }
  logger.info("Roles seeded (normal, admin, shipment_staff)");

  // 2. Seed Admin user
  const adminHash = await bcrypt.hash(config.ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { username: config.ADMIN_USERNAME.toLowerCase() },
    update: { password: adminHash, roleid: 2 },
    create: {
      username: config.ADMIN_USERNAME.toLowerCase(),
      password: adminHash,
      roleid: 2
    }
  });
  logger.info({ admin: config.ADMIN_USERNAME }, "Admin user verified/seeded");

  // 3. Seed Shipment Staff user
  const staffHash = await bcrypt.hash(config.SHIPMENT_STAFF_PASSWORD, 10);
  await prisma.user.upsert({
    where: { username: config.SHIPMENT_STAFF_USERNAME.toLowerCase() },
    update: { password: staffHash, roleid: 3 },
    create: {
      username: config.SHIPMENT_STAFF_USERNAME.toLowerCase(),
      password: staffHash,
      roleid: 3
    }
  });
  logger.info({ staff: config.SHIPMENT_STAFF_USERNAME }, "Shipment staff user verified/seeded");
}

module.exports = { seedRolesAndAccounts };
