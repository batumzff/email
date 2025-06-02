const { setTimeout } = require('timers/promises');

class RetryError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'RetryError';
    this.originalError = originalError;
  }
}

/**
 * Retry mekanizması
 * @param {Function} fn - Tekrar denenmesi gereken fonksiyon
 * @param {Object} options - Retry seçenekleri
 * @param {number} options.maxAttempts - Maksimum deneme sayısı
 * @param {number} options.initialDelay - İlk denemeden sonraki bekleme süresi (ms)
 * @param {number} options.maxDelay - Maksimum bekleme süresi (ms)
 * @param {number} options.factor - Her denemede bekleme süresinin artış faktörü
 * @param {Function} options.onRetry - Her retry'da çalışacak callback
 * @returns {Promise<any>} - Fonksiyonun sonucu
 */
async function retry(fn, options = {}) {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    factor = 2,
    onRetry = null
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts) {
        throw new RetryError(
          `Maksimum deneme sayısına ulaşıldı (${maxAttempts}). Son hata: ${error.message}`,
          error
        );
      }

      if (onRetry) {
        onRetry(error, attempt, delay);
      }

      await setTimeout(delay);
      delay = Math.min(delay * factor, maxDelay);
    }
  }
}

/**
 * RabbitMQ bağlantısı için retry mekanizması
 * @param {Function} connectFn - RabbitMQ bağlantı fonksiyonu
 * @param {Object} options - Retry seçenekleri
 * @returns {Promise<Object>} - RabbitMQ bağlantısı
 */
async function retryRabbitMQConnection(connectFn, options = {}) {
  return retry(connectFn, {
    maxAttempts: 5,
    initialDelay: 2000,
    maxDelay: 30000,
    factor: 2,
    onRetry: (error, attempt, delay) => {
      console.log(`RabbitMQ bağlantı hatası (Deneme ${attempt}/${options.maxAttempts || 5}). ${delay}ms sonra tekrar denenecek. Hata: ${error.message}`);
    }
  });
}

/**
 * MongoDB işlemleri için retry mekanizması
 * @param {Function} operationFn - MongoDB işlem fonksiyonu
 * @param {Object} options - Retry seçenekleri
 * @returns {Promise<any>} - MongoDB işleminin sonucu
 */
async function retryMongoDBOperation(operationFn, options = {}) {
  return retry(operationFn, {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 5000,
    factor: 2,
    onRetry: (error, attempt, delay) => {
      console.log(`MongoDB işlem hatası (Deneme ${attempt}/${options.maxAttempts || 3}). ${delay}ms sonra tekrar denenecek. Hata: ${error.message}`);
    }
  });
}

module.exports = {
  retry,
  retryRabbitMQConnection,
  retryMongoDBOperation,
  RetryError
};
