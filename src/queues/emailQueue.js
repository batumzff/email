const amqp = require('amqplib');
const { retryRabbitMQConnection } = require('../utils/retry');

async function sendToQueue(queueName, data) {
  const connectWithRetry = async () => {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();
    return { connection, channel };
  };

  const { connection, channel } = await retryRabbitMQConnection(connectWithRetry);
  
  try {
    // Ana kuyruğu oluştur
    await channel.assertQueue(queueName, { 
      durable: true,
      arguments: {
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': `${queueName}.retry`
      }
    });

    const message = {
      ...data,
      timestamp: new Date().toISOString()
    };

    // Mesajı kuyruğa ekle
    channel.sendToQueue(
      queueName,
      Buffer.from(JSON.stringify(message)),
      {
        persistent: true,
        headers: {
          retryCount: 0
        }
      }
    );
    
    console.log(`Mesaj kuyruğa eklendi: ${queueName}`);
  } catch (error) {
    console.error(`Kuyruğa ekleme hatası [${queueName}]:`, error);
    throw error;
  } finally {
    await channel.close();
    await connection.close();
  }
}

module.exports = { sendToQueue };
