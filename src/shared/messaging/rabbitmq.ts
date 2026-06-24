import amqplib from 'amqplib';

export async function createRabbitMQChannel(url: string, exchange: string) {
  const connection = await amqplib.connect(url);
  const channel = await connection.createChannel();
  await channel.assertExchange(exchange, 'topic', { durable: true });
  return { connection, channel };
}
