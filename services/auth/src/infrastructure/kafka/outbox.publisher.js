const prisma = require("../database/prisma.client");
const { producer, connectKafka } = require("./kafka.client");
const logger = require("../logger");

async function publishOutboxEvents() {
  try {
    await connectKafka();
    const pendingEvents = await prisma.outboxEvent.findMany({
      where: { status: "PENDING" },
      take: 10,
      orderBy: { createdAt: "asc" }
    });

    for (const event of pendingEvents) {
      try {
        await producer.send({
          topic: event.topic,
          messages: [{
            key: String(event.payload.data?.uid || event.id),
            value: JSON.stringify(event.payload)
          }]
        });

        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: "SENT", sentAt: new Date() }
        });
        logger.info({ eventId: event.id, topic: event.topic }, "Outbox event published successfully");
      } catch (sendErr) {
        logger.error({ eventId: event.id, error: sendErr.message }, "Failed to send outbox event to Kafka");
      }
    }
  } catch (err) {
    // Kafka might still be initializing
  }
}

function startOutboxWorker(intervalMs = 2000) {
  setInterval(publishOutboxEvents, intervalMs);
}

module.exports = { publishOutboxEvents, startOutboxWorker };
