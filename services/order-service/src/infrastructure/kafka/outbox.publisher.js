const { Kafka } = require("kafkajs");
const prisma = require("../database/prisma.client");
const logger = require("../logger");
const config = require("../config");

const kafka = new Kafka({
  clientId: "order-outbox-publisher",
  brokers: [config.KAFKA_BROKER]
});
const producer = kafka.producer();
let isProducerConnected = false;

async function startOutboxPublisher() {
  try {
    await producer.connect();
    isProducerConnected = true;
    logger.info("Kafka producer connected to broker");
  } catch (err) {
    logger.warn({ error: err.message }, "Kafka producer connection failed, retrying in 5s...");
    setTimeout(startOutboxPublisher, 5000);
    return;
  }

  // Periodic polling interval ~1s
  setInterval(async () => {
    if (!isProducerConnected) return;
    try {
      // Fetch pending events
      const pending = await prisma.outboxEvent.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: 10
      });

      for (const event of pending) {
        try {
          await producer.send({
            topic: event.topic,
            messages: [{
              key: String(event.key),
              value: JSON.stringify(event.payload)
            }]
          });

          await prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: "SENT",
              sentAt: new Date()
            }
          });
          logger.info({ eventId: event.id, topic: event.topic, key: event.key }, "Outbox event published to Kafka");
        } catch (pubErr) {
          logger.error({ eventId: event.id, error: pubErr.message }, "Failed to publish outbox event");
          await prisma.outboxEvent.update({
            where: { id: event.id },
            data: { attempts: { increment: 1 } }
          });
        }
      }
    } catch (pollErr) {
      logger.error({ error: pollErr.message }, "Error polling outbox events");
    }
  }, 1000);
}

module.exports = { startOutboxPublisher, isProducerConnected: () => isProducerConnected };
