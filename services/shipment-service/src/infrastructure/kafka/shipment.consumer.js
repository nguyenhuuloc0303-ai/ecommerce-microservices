const { Kafka } = require("kafkajs");
const { z } = require("zod");
const { Shipment, FailedEvent } = require("../database/shipment.model");
const logger = require("../logger");
const config = require("../config");

const orderCreatedSchema = z.object({
  eventType: z.literal("OrderCreated"),
  data: z.object({
    oid: z.number().int().positive(),
    uid: z.number().int().positive(),
    shipid: z.number().int().positive()
  })
});

const kafka = new Kafka({
  clientId: "shipment-service",
  brokers: [config.KAFKA_BROKER]
});

const consumer = kafka.consumer({ groupId: "shipment-service-group" });
let isConsumerConnected = false;

async function startShipmentKafkaConsumer() {
  try {
    await consumer.connect();
    isConsumerConnected = true;
    logger.info("Shipment Kafka consumer connected to broker");

    await consumer.subscribe({ topic: "order-created", fromBeginning: true });
    logger.info("Subscribed to topic: order-created");

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const raw = message.value ? message.value.toString() : "";
        try {
          const parsed = JSON.parse(raw);
          const validation = orderCreatedSchema.safeParse(parsed);

          if (!validation.success) {
            logger.warn({ raw, errors: validation.error.errors }, "Invalid order-created event format, recording to failed_events");
            await FailedEvent.create({
              raw,
              reason: validation.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join("; "),
              topic
            });
            return;
          }

          const { oid, uid, shipid } = validation.data.data;
          logger.info({ oid, uid, shipid }, "Processing valid order-created event");

          // Idempotent insertion: catch duplicate key (E11000) on oid or shipid
          try {
            await Shipment.create({
              shipid,
              oid,
              uid,
              status: "PENDING",
              history: [{ status: "PENDING", at: new Date() }]
            });
            logger.info({ shipid, oid }, "Shipment created successfully from Kafka event");
          } catch (dbErr) {
            if (dbErr.code === 11000) {
              logger.info({ oid, shipid }, "Shipment already exists for oid/shipid, skipping idempotent");
            } else {
              throw dbErr;
            }
          }
        } catch (msgErr) {
          logger.error({ error: msgErr.message, raw }, "Error handling Kafka message");
          try {
            await FailedEvent.create({
              raw,
              reason: msgErr.message,
              topic
            });
          } catch (feErr) {
            logger.error({ feErr }, "Could not record failed event");
          }
        }
      }
    });
  } catch (err) {
    logger.warn({ error: err.message }, "Shipment Kafka consumer connection delayed, retrying in 5s...");
    setTimeout(startShipmentKafkaConsumer, 5000);
  }
}

module.exports = { startShipmentKafkaConsumer, isConsumerConnected: () => isConsumerConnected };
