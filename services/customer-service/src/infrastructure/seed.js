const prisma = require("./database/prisma.client");
const logger = require("./logger");

async function seedMemberships() {
  const tiers = [
    { mid: 1, mname: "normal", score: 10 },
    { mid: 2, mname: "silver", score: 50 },
    { mid: 3, mname: "gold", score: 100 }
  ];

  for (const tier of tiers) {
    await prisma.memberShip.upsert({
      where: { mid: tier.mid },
      update: { mname: tier.mname, score: tier.score },
      create: tier
    });
  }
  logger.info("Memberships seeded (1 normal/10, 2 silver/50, 3 gold/100)");
}

module.exports = { seedMemberships };
