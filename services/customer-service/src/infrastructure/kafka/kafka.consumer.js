const { Kafka, logLevel } = require("kafkajs");
const config = require("../config");
const logger = require("../logger");
const prisma = require("../database/prisma.client");

const kafka = new Kafka({
  clientId: "customer-service",
  brokers: [config.KAFKA_BROKER],
  retry: { initialRetryTime: 300, retries: 10 },
  logLevel: logLevel.NOTHING
});

const consumer = kafka.consumer({ groupId: "customer-service-group" });
let isConsumerConnected = false;

async function startCustomerKafkaConsumer() {
  try {
    await consumer.connect();
    isConsumerConnected = true;
    logger.info("Kafka consumer connected to broker");

    await consumer.subscribe({ topic: "user-registered", fromBeginning: true });
    logger.info("Subscribed to topic: user-registered");

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const raw = message.value.toString();
          const event = JSON.parse(raw);
          logger.info({ eventType: event.eventType, uid: event.data?.uid }, "Event received from Kafka");

          if (event.eventType === "UserRegistered" && event.data?.uid) {
            const uid = Number(event.data.uid);
            const fullname = event.data.username || `User_${uid}`;

            // Idempotent upsert
            await prisma.customer.upsert({
              where: { uid },
              update: {},
              create: {
                uid,
                fullname,
                mid: 1 // default: normal (score 10)
              }
            });
            logger.info({ uid, fullname }, "Customer record ensured in customer_db");
          }
        } catch (msgErr) {
          logger.error({ error: msgErr.message }, "Error processing Kafka message");
        }
      }
    });
  } catch (err) {
    logger.warn({ error: err.message }, "Kafka consumer connection delayed, retrying in 5s...");
    setTimeout(startCustomerKafkaConsumer, 5000);
  }
}

module.exports = { startCustomerKafkaConsumer, isConsumerConnected: () => isConsumerConnected };
