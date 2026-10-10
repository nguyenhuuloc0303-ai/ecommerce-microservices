const { Kafka, logLevel } = require("kafkajs");
const config = require("../config");
const logger = require("../logger");

const kafka = new Kafka({
  clientId: "auth-service",
  brokers: [config.KAFKA_BROKER],
  retry: { initialRetryTime: 300, retries: 10 },
  logLevel: logLevel.NOTHING
});

const producer = kafka.producer();
let isConnected = false;

async function connectKafka() {
  if (!isConnected) {
    try {
      await producer.connect();
      isConnected = true;
      logger.info({ broker: config.KAFKA_BROKER }, "Kafka Producer connected");
    } catch (err) {
      logger.warn({ error: err.message }, "Kafka producer initial connection delayed");
    }
  }
  return producer;
}

module.exports = { kafka, producer, connectKafka, isConnected: () => isConnected };
