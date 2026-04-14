const amqp = require('amqplib');

let channel = null;
let connection = null;

async function connect(retries = 5, delay = 1000) {
  const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  
  for (let i = 0; i < retries; i++) {
    try {
      connection = await amqp.connect(rabbitmqUrl);
      channel = await connection.createChannel();
      
      // Ensure exchange exists
      await channel.assertExchange('orion', 'direct', { durable: true });
      
      // Ensure queues exist (standard queues)
      const queues = [
        'task.created',
        'plan.completed',
        'code.drafted',
        'code.rejected',
        'task.completed',
        'task.failed',
        'agent.progress'
      ];
      
      for (const queue of queues) {
        await channel.assertQueue(queue, { durable: true });
        // In a real scenario, we'd bind them to the exchange with routing keys
        // For simplicity, we use queue names as routing keys on the 'orion' exchange
        await channel.bindQueue(queue, 'orion', queue);
      }
      
      console.log('Connected to RabbitMQ');
      
      connection.on('error', (err) => {
        console.error('RabbitMQ connection error', err);
        setTimeout(connect, 5000);
      });
      
      connection.on('close', () => {
        console.warn('RabbitMQ connection closed. Reconnecting...');
        setTimeout(connect, 5000);
      });
      
      return { connection, channel };
    } catch (error) {
      console.error(`Failed to connect to RabbitMQ (attempt ${i + 1}/${retries}):`, error.message);
      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, delay));
        delay *= 2; // Exponential backoff
      } else {
        throw error;
      }
    }
  }
}

async function publishMessage(routingKey, payload) {
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized');
  }
  
  const envelope = {
    job_id: payload.job_id || payload.id,
    event: routingKey,
    timestamp: new Date().toISOString(),
    payload: payload
  };
  
  return channel.publish(
    'orion',
    routingKey,
    Buffer.from(JSON.stringify(envelope)),
    { persistent: true }
  );
}

module.exports = {
  connect,
  publishMessage,
  getChannel: () => channel
};
