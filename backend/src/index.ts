import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { config } from './config.js';
import { clientsRouter } from './routes/clients.js';
import { productMasterRouter } from './routes/productMaster.js';
import { reportsRouter } from './routes/reports.js';

const app = express();

app.use(cors({ origin: config.corsOrigins }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/clients', clientsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/product-master', productMasterRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`);
});
