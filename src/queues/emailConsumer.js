const amqp = require('amqplib');
const { sendDynamicEmail } = require('../services/mailService');

async function startEmailConsumer(queueName) {
  const connection = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue(queueName, { durable: true });
  channel.consume(queueName, async (msg) => {
    if (msg !== null) {
      const job = JSON.parse(msg.content.toString());
      try {
        await sendDynamicEmail(job);
        channel.ack(msg);
      } catch (err) {
        console.error(`E-posta gönderim hatası [${queueName}]:`, err);
      }
    }
  });
  console.log(`Email consumer started for queue: ${queueName}`);
}

module.exports = { startEmailConsumer };
