const amqp = require('amqplib');

async function addEmailJob(job, queueName) {
  const connection = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue(queueName, { durable: true });
  channel.sendToQueue(queueName, Buffer.from(JSON.stringify(job)), { persistent: true });
  setTimeout(() => {
    channel.close();
    connection.close();
  }, 500);
}

module.exports = { addEmailJob };
