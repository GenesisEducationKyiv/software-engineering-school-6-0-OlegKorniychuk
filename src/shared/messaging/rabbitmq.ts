import amqplib from 'amqplib';
import { RELEASES_EXCHANGE } from './release-detected.event.js';

export async function createRabbitMQChannel(url: string) {
  const connection = await amqplib.connect(url);
  const channel = await connection.createChannel();
  await channel.assertExchange(RELEASES_EXCHANGE, 'topic', { durable: true });
  return { connection, channel };
}
