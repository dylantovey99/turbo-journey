import express from 'express';
import { config } from './src/config';
import { logger } from './src/utils/logger';

console.log('Starting minimal server...');

const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Minimal server working' });
});

const port = config.server.port;

app.listen(port, () => {
  logger.info(`Minimal server running on port ${port}`);
  console.log(`🚀 Minimal server ready at http://localhost:${port}`);
});

console.log('Server setup complete');