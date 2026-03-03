/**
 * SAIOMS — Node.js + Express Backend v2
 * Production-hardened with Helmet, rate limiting, Swagger docs, and social profile routes.
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const { connectDB } = require('./db/mongo');
const { apiLimiter } = require('./middleware/rateLimiter');
const { setupSwagger } = require('./swagger');

const animalsRouter = require('./routes/animals');
const breedRouter = require('./routes/breed');
const authRouter = require('./routes/auth');
const nearbyRouter = require('./routes/nearby');
const statsRouter = require('./routes/stats');
const geminiRouter = require('./routes/gemini');
const chatRouter = require('./routes/chat');
const usersRouter = require('./routes/users');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },  // allow static images cross-origin
  contentSecurityPolicy: false,  // keep flexible for frontend during dev
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000,http://localhost:80')
  .split(',').map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Request logging ───────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// ── Static files ──────────────────────────────────────────────────────────────
app.use('/static', express.static(path.join(__dirname, '..', 'static'), {
  maxAge: '7d',
  etag: true,
}));

// ── Global rate limit ─────────────────────────────────────────────────────────
app.use('/api/', apiLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/animals', animalsRouter);
app.use('/api/breed', breedRouter);
app.use('/api/nearby', nearbyRouter);
app.use('/api/stats', statsRouter);
app.use('/api/gemini', geminiRouter);
app.use('/api/chat', chatRouter);

// ── Swagger API docs ──────────────────────────────────────────────────────────
setupSwagger(app);

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SAIOMS Backend v2.0',
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'SAIOMS Backend API v2',
    docs: '/api/docs',
    health: '/health',
  });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, detail: 'Route not found' });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Boot ──────────────────────────────────────────────────────────────────────
async function start() {
  if (!process.env.JWT_SECRET) {
    console.error('❌  JWT_SECRET env var is not set. Refusing to start.');
    process.exit(1);
  }
  await connectDB();
  app.listen(PORT, () => {
    console.log(`✅  SAIOMS Backend v2 running on http://localhost:${PORT}`);
    console.log(`📚  API Docs → http://localhost:${PORT}/api/docs`);
    console.log(`    ML Service → ${process.env.ML_SERVICE_URL || 'http://localhost:8001'}`);
  });
}

start().catch(err => {
  console.error('Failed to start backend:', err);
  process.exit(1);
});
