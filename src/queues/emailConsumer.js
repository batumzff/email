const amqp = require('amqplib');
const { sendDynamicEmail } = require('../services/mailService');
const { retryRabbitMQConnection, retry } = require('../utils/retry');

// Queue isimlerini oluşturan yardımcı fonksiyon
function getQueueNames(baseQueueName) {
  return {
    main: baseQueueName,
    retry: `${baseQueueName}.retry`,
    dlq: `${baseQueueName}.dlq`
  };
}

async function startEmailConsumer(queueName) {
  const connectWithRetry = async () => {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();
    return { connection, channel };
  };

  const { connection, channel } = await retryRabbitMQConnection(connectWithRetry);
  
  const queues = getQueueNames(queueName);
  
  // Ana kuyruk - başarısız mesajlar retry kuyruğuna gidecek
  await channel.assertQueue(queues.main, { 
    durable: true,
    arguments: {
      'x-dead-letter-exchange': '', // Default exchange
      'x-dead-letter-routing-key': queues.retry
    }
  });

  // Retry kuyruğu - 1 dakika sonra tekrar ana kuyruğa dönecek
  await channel.assertQueue(queues.retry, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': '',
      'x-dead-letter-routing-key': queues.main,
      'x-message-ttl': 60000 // 1 dakika
    }
  });

  // Dead Letter Queue - son çare kuyruğu
  await channel.assertQueue(queues.dlq, { 
    durable: true 
  });

  // Ana kuyruk consumer'ı
  channel.consume(queues.main, async (msg) => {
    if (msg !== null) {
      const job = JSON.parse(msg.content.toString());
      const retryCount = msg.properties.headers?.retryCount || 0;
      
      try {
        await retry(async () => {
          await sendDynamicEmail(job);
        }, {
          maxAttempts: 3,
          initialDelay: 1000,
          onRetry: (error, attempt) => {
            console.log(`Mail gönderme hatası [${queueName}] (Deneme ${attempt}/3): ${error.message}`);
          }
        });

        channel.ack(msg);
        console.log(`E-posta başarıyla gönderildi [${queueName}]`);
      } catch (err) {
        console.error(`E-posta gönderim hatası [${queueName}]:`, err);
        
        if (retryCount < 3) { // Maksimum 3 deneme
          // Retry sayısını artır ve retry kuyruğuna gönder
          channel.nack(msg, false, false);
        } else {
          // Maksimum deneme sayısına ulaşıldı, DLQ'ya gönder
          const dlqMessage = {
            originalJob: job,
            error: err.message,
            lastAttempt: new Date().toISOString(),
            retryCount: retryCount
          };
          
          channel.sendToQueue(
            queues.dlq, 
            Buffer.from(JSON.stringify(dlqMessage))
          );
          channel.ack(msg);
          console.log(`Mesaj DLQ'ya gönderildi [${queueName}]`);
        }
      }
    }
  });

  // DLQ consumer'ı - başarısız mesajları logla
  channel.consume(queues.dlq, async (msg) => {
    if (msg !== null) {
      const failedJob = JSON.parse(msg.content.toString());
      console.log('DLQ\'da başarısız mesaj:', {
        queue: queueName,
        job: failedJob.originalJob,
        error: failedJob.error,
        lastAttempt: failedJob.lastAttempt,
        retryCount: failedJob.retryCount
      });
      channel.ack(msg);
    }
  });

  console.log(`Email consumer başlatıldı: ${Object.values(queues).join(', ')}`);
}

module.exports = { startEmailConsumer };
