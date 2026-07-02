import request from 'supertest';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler, notFoundHandler } from '../middlewares/errorHandler';
import { authRoutes } from '../routes/auth.routes';
import { eventRoutes } from '../routes/event.routes';
import { pollRoutes } from '../routes/poll.routes';
import { questionRoutes } from '../routes/question.routes';
import '../middlewares/auth'; // load type augmentation

// Build a minimal test app
function createTestApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/events', eventRoutes);
  app.use('/api/v1/polls', pollRoutes);
  app.use('/api/v1/questions', questionRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

const app = createTestApp();

describe('Auth API Integration', () => {
  describe('POST /api/v1/auth/signup', () => {
    it('should create a new user', async () => {
      const email = `test-${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({ email, password: 'password123', name: 'Test User' });

      expect([201, 200]).toContain(res.status);
    });

    it('should reject duplicate email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({ email: 'host@pollcast.app', password: 'password123', name: 'Test' });

      expect(res.status).toBe(409);
    });

    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({ email: 'invalid', password: 'password123', name: 'Test' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should return 200 and tokens for valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'host@pollcast.app', password: 'admin123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe('host@pollcast.app');
    });

    it('should return 400 for missing password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'host@pollcast.app' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });
  });
});
