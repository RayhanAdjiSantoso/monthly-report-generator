// Vercel-only entry point — the whole adapter. Wraps the existing Express
// app unchanged (backend/src/index.ts still owns every route, still keeps
// its own app.listen() for local dev/Docker). To leave Vercel later: delete
// this file and vercel.json. Nothing in backend/ depends on either.
import { app } from '../backend/src/index.js';

export default app;
