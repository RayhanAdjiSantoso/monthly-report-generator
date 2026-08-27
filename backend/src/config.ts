import 'dotenv/config';

// Vite picks the next free port (5174, 5175, ...) whenever 5173 is already
// taken by another running dev server — a real, recurring situation during
// development, not an edge case — so several localhost ports are allowed by
// default instead of just one. Override with a comma-separated CORS_ORIGIN
// to replace this list entirely.
const DEFAULT_CORS_ORIGINS = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176'];

export const config = {
  port: process.env.PORT ? Number(process.env.PORT) : 3001,
  databaseUrl: process.env.DATABASE_URL || `postgresql://${process.env.USER}@localhost:5432/atlas_FIN`,
  corsOrigins: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()) : DEFAULT_CORS_ORIGINS,
};
