import express from 'express';
import cors from 'cors';
import { connectDb } from './db.js';
import endpointsRouter from './routes/endpoints.js';
import recordsRouter from './routes/records.js';
import logsRouter from './routes/logs.js';
import dashboardRouter from './routes/dashboard.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Mount routes
app.use('/api/endpoints', endpointsRouter);
app.use('/api/records', recordsRouter);
app.use('/api/logs', logsRouter);
app.use('/api/dashboard', dashboardRouter);

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Start server after connecting to DB
connectDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`ThiruXDB API server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });
