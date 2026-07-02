import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

import { config } from './config';
import { prisma } from './db';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { createRateLimiter } from './middlewares/rateLimiter';
import { authRoutes } from './routes/auth.routes';
import { eventRoutes } from './routes/event.routes';
import { pollRoutes } from './routes/poll.routes';
import { questionRoutes } from './routes/question.routes';
import { configureSocket } from './sockets';

const app = express();
const server = http.createServer(app);

// Redis client
const redis = new Redis(config.redis.url);

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: config.frontendUrl,
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Configure Redis adapter for Socket.IO
const pubClient = redis;
const subClient = redis.duplicate();
io.adapter(createAdapter(pubClient, subClient));

// Global middleware
app.use(helmet());
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

if (config.env === 'development') {
  app.use(morgan('dev'));
}

// Rate limiting
const globalLimiter = createRateLimiter({ windowMs: 60 * 1000, maxRequests: 100 });
app.use(globalLimiter);

// Health check
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'unhealthy' });
  }
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/events', eventRoutes);
app.use('/api/v1/polls', pollRoutes);
app.use('/api/v1/questions', questionRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Configure Socket.IO
configureSocket(io);

// Start server
server.listen(config.port, () => {
  console.log(`🚀 PollCast server running on port ${config.port}`);
  console.log(`📡 Environment: ${config.env}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(async () => {
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(async () => {
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  });
});

export { app, server, io };
