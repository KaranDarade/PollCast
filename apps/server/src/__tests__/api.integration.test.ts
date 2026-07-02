import request from 'supertest';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler, notFoundHandler } from '../middlewares/errorHandler';
import { authRoutes } from '../routes/auth.routes';
import { eventRoutes } from '../routes/event.routes';
import { pollRoutes } from '../routes/poll.routes';
import { questionRoutes } from '../routes/question.routes';
import '../middlewares/auth';

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

// ---------------------------------------------------------------------------
// Auth Integration
// ---------------------------------------------------------------------------
describe('Auth API', () => {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'StrongPass1';
  const testName = 'Test User';
  let accessToken = '';
  let refreshTokenCookie = '';

  describe('POST /auth/signup', () => {
    it('creates a new user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({ email: testEmail, password: testPassword, name: testName });
      expect([201, 200]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });

    it('returns 409 for duplicate email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({ email: testEmail, password: testPassword, name: testName });
      expect(res.status).toBe(409);
    });

    it('returns 400 for invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({ email: 'bad', password: testPassword, name: testName });
      expect(res.status).toBe(400);
    });

    it('returns 400 for short password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({ email: 'new@test.com', password: '123', name: testName });
      expect(res.status).toBe(400);
    });

    it('returns 400 for short name', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({ email: 'new@test.com', password: testPassword, name: 'A' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    it('logs in with valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: testPassword });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe(testEmail);
      expect(res.body.data.user.name).toBe(testName);
      accessToken = res.body.data.accessToken;
    });

    it('returns 401 for wrong password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: 'wrongpass1' });
      expect(res.status).toBe(401);
    });

    it('returns 401 for non-existent user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'noone@test.com', password: testPassword });
      expect(res.status).toBe(401);
    });

    it('returns 400 for missing password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail });
      expect(res.status).toBe(400);
    });

    it('returns 400 for missing email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ password: testPassword });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /auth/me', () => {
    it('returns user profile when authenticated', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(testEmail);
      expect(res.body.data.name).toBe(testName);
    });

    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /auth/me', () => {
    it('updates profile name', async () => {
      const res = await request(app)
        .patch('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Name' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Name');
    });

    it('updates profile phone', async () => {
      const res = await request(app)
        .patch('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ phone: '+1234567890' });
      expect(res.status).toBe(200);
      expect(res.body.data.phone).toBe('+1234567890');
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .patch('/api/v1/auth/me')
        .send({ name: 'Test' });
      expect(res.status).toBe(401);
    });

    it('rejects short name', async () => {
      const res = await request(app)
        .patch('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'A' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/logout', () => {
    it('logs out successfully', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /auth/refresh', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).post('/api/v1/auth/refresh');
      expect(res.status).toBe(401);
    });
  });
});

// ---------------------------------------------------------------------------
// Events Integration
// ---------------------------------------------------------------------------
describe('Events API', () => {
  let hostToken = '';
  let participantToken = '';
  let eventId = '';
  let eventCode = '';

  beforeAll(async () => {
    // Login as seeded host
    const hostRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'host@pollcast.app', password: 'admin123' });
    hostToken = hostRes.body.data.accessToken;

    // Register + login as participant
    const pEmail = `participant-${Date.now()}@test.com`;
    await request(app)
      .post('/api/v1/auth/signup')
      .send({ email: pEmail, password: 'password123', name: 'Participant' });
    const pRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: pEmail, password: 'password123' });
    participantToken = pRes.body.data.accessToken;
  });

  describe('POST /events', () => {
    it('creates a new event', async () => {
      const res = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ title: 'Integration Test Event', description: 'Testing all features' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Integration Test Event');
      expect(res.body.data.code).toBeDefined();
      eventId = res.body.data.id;
      eventCode = res.body.data.code;
    });

    it('returns 400 for short title', async () => {
      const res = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ title: 'AB' });
      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/v1/events')
        .send({ title: 'Test Event' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /events/code/:code', () => {
    it('finds event by code', async () => {
      const res = await request(app)
        .get(`/api/v1/events/code/${eventCode}`)
        .set('Authorization', `Bearer ${hostToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(eventId);
    });

    it('returns 404 for invalid code', async () => {
      const res = await request(app)
        .get('/api/v1/events/code/NONEXIST')
        .set('Authorization', `Bearer ${hostToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /events/my', () => {
    it('returns host events', async () => {
      const res = await request(app)
        .get('/api/v1/events/my')
        .set('Authorization', `Bearer ${hostToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /events/:id', () => {
    it('gets event by id', async () => {
      const res = await request(app)
        .get(`/api/v1/events/${eventId}`)
        .set('Authorization', `Bearer ${hostToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(eventId);
    });

    it('returns 404 for invalid id', async () => {
      const res = await request(app)
        .get('/api/v1/events/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${hostToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /events/:id', () => {
    it('updates event', async () => {
      const res = await request(app)
        .patch(`/api/v1/events/${eventId}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ title: 'Updated Event Title' });
      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated Event Title');
    });
  });

  describe('POST /events/join', () => {
    it('joins an event with code', async () => {
      const res = await request(app)
        .post('/api/v1/events/join')
        .set('Authorization', `Bearer ${participantToken}`)
        .send({ code: eventCode });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 for invalid code', async () => {
      const res = await request(app)
        .post('/api/v1/events/join')
        .set('Authorization', `Bearer ${participantToken}`)
        .send({ code: 'INVALID' });
      expect(res.status).toBe(404);
    });

    it('returns 400 for empty code', async () => {
      const res = await request(app)
        .post('/api/v1/events/join')
        .set('Authorization', `Bearer ${participantToken}`)
        .send({ code: '' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /events/:id/participants', () => {
    it('lists participants', async () => {
      const res = await request(app)
        .get(`/api/v1/events/${eventId}/participants`)
        .set('Authorization', `Bearer ${hostToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /events/:id/invite', () => {
    it('sends invite (or logs it if SMTP unconfigured)', async () => {
      const res = await request(app)
        .post(`/api/v1/events/${eventId}/invite`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ email: 'friend@example.com' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 400 for invalid email', async () => {
      const res = await request(app)
        .post(`/api/v1/events/${eventId}/invite`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ email: 'bad' });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /events/:id', () => {
    it('deletes the event', async () => {
      const res = await request(app)
        .delete(`/api/v1/events/${eventId}`)
        .set('Authorization', `Bearer ${hostToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Polls Integration
// ---------------------------------------------------------------------------
describe('Polls API', () => {
  let hostToken = '';
  let eventId = '';
  let pollId = '';
  let optionIds: string[] = [];

  beforeAll(async () => {
    const hostRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'host@pollcast.app', password: 'admin123' });
    hostToken = hostRes.body.data.accessToken;

    const eventRes = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ title: 'Poll Test Event' });
    eventId = eventRes.body.data.id;
  });

  describe('POST /polls', () => {
    it('creates a new poll', async () => {
      const res = await request(app)
        .post('/api/v1/polls')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          eventId,
          title: 'Test Poll',
          isMultipleChoice: false,
          timerSeconds: 60,
          options: ['Option A', 'Option B', 'Option C'],
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.options.length).toBe(3);
      pollId = res.body.data.id;
      optionIds = res.body.data.options.map((o: any) => o.id);
    });

    it('returns 400 for single option', async () => {
      const res = await request(app)
        .post('/api/v1/polls')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ eventId, title: 'Bad Poll', options: ['Only One'] });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /polls/:id/start', () => {
    it('starts the poll', async () => {
      const res = await request(app)
        .post(`/api/v1/polls/${pollId}/start`)
        .set('Authorization', `Bearer ${hostToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ACTIVE');
    });
  });

  describe('GET /polls/event/:eventId', () => {
    it('lists polls for event', async () => {
      const res = await request(app)
        .get(`/api/v1/polls/event/${eventId}`)
        .set('Authorization', `Bearer ${hostToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /polls/vote', () => {
    it('casts a vote', async () => {
      const res = await request(app)
        .post('/api/v1/polls/vote')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ pollId, optionIds: [optionIds[0]] });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects duplicate vote', async () => {
      const res = await request(app)
        .post('/api/v1/polls/vote')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ pollId, optionIds: [optionIds[0]] });
      expect(res.status).toBe(409);
    });

    it('returns 400 for empty optionIds', async () => {
      const res = await request(app)
        .post('/api/v1/polls/vote')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ pollId, optionIds: [] });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /polls/:id/results', () => {
    it('returns poll results', async () => {
      const res = await request(app)
        .get(`/api/v1/polls/${pollId}/results`)
        .set('Authorization', `Bearer ${hostToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.options[0].voteCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /polls/:id/close', () => {
    it('closes the poll', async () => {
      const res = await request(app)
        .post(`/api/v1/polls/${pollId}/close`)
        .set('Authorization', `Bearer ${hostToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CLOSED');
    });
  });
});

// ---------------------------------------------------------------------------
// Questions Integration
// ---------------------------------------------------------------------------
describe('Questions API', () => {
  let hostToken = '';
  let eventId = '';
  let questionId = '';

  beforeAll(async () => {
    const hostRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'host@pollcast.app', password: 'admin123' });
    hostToken = hostRes.body.data.accessToken;

    const eventRes = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ title: 'Q&A Test Event' });
    eventId = eventRes.body.data.id;
  });

  describe('POST /questions', () => {
    it('creates a question', async () => {
      const res = await request(app)
        .post('/api/v1/questions')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ eventId, content: 'This is a great question for testing purposes?' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      questionId = res.body.data.id;
    });

    it('creates anonymous question', async () => {
      const res = await request(app)
        .post('/api/v1/questions')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ eventId, content: 'Another anonymous question to test things out?', isAnonymous: true });
      expect(res.status).toBe(201);
    });

    it('returns 400 for short content', async () => {
      const res = await request(app)
        .post('/api/v1/questions')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ eventId, content: 'Short' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /questions/event/:eventId', () => {
    it('gets event questions', async () => {
      const res = await request(app)
        .get(`/api/v1/questions/event/${eventId}`)
        .set('Authorization', `Bearer ${hostToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /questions/:id/upvote', () => {
    it('upvotes a question', async () => {
      const res = await request(app)
        .post(`/api/v1/questions/${questionId}/upvote`)
        .set('Authorization', `Bearer ${hostToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.upvoted).toBe(true);
    });

    it('toggles upvote on second click', async () => {
      const res = await request(app)
        .post(`/api/v1/questions/${questionId}/upvote`)
        .set('Authorization', `Bearer ${hostToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.upvoted).toBe(false);
    });
  });

  describe('POST /questions/moderate', () => {
    it('approves a question', async () => {
      const res = await request(app)
        .post('/api/v1/questions/moderate')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ questionId, action: 'approve' });
      expect(res.status).toBe(200);
    });

    it('pins a question', async () => {
      const res = await request(app)
        .post('/api/v1/questions/moderate')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ questionId, action: 'pin' });
      expect(res.status).toBe(200);
    });

    it('returns 400 for invalid action', async () => {
      const res = await request(app)
        .post('/api/v1/questions/moderate')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ questionId, action: 'invalid' });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /questions/:id', () => {
    it('deletes the question', async () => {
      const res = await request(app)
        .delete(`/api/v1/questions/${questionId}`)
        .set('Authorization', `Bearer ${hostToken}`);
      expect(res.status).toBe(200);
    });
  });
});

// ---------------------------------------------------------------------------
// Error Handling
// ---------------------------------------------------------------------------
describe('Error Handling', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nonexistent');
    expect(res.status).toBe(404);
  });

  it('returns 404 for unknown nested routes', async () => {
    const res = await request(app).get('/api/v1/auth/nonexistent');
    expect(res.status).toBe(404);
  });

  it('handles malformed JSON gracefully', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('not-json');
    expect([400, 500]).toContain(res.status);
  });
});
