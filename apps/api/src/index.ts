import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

const PORT = Number(process.env.PORT ?? 4000);
const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';

const app = Fastify({ logger: { level: LOG_LEVEL } });

await app.register(helmet);
await app.register(cors, { origin: true });

app.get('/health', async () => ({ status: 'ok', service: 'keepra-api' }));

try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`Keepra API listening on :${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
