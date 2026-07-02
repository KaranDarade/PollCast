# PollCast Testing Strategy

## Overview

Multi-layer testing: unit tests for business logic, integration tests for API endpoints, E2E tests for critical user flows, and load tests for realtime performance.

## Test Pyramid

```
        ╱╲
       ╱  ╲
      ╱ E2E╲
     ╱──────╲
    ╱ Integration╲
   ╱──────────────╲
  ╱   Unit Tests    ╲
 ╱────────────────────╲
╱   Static Analysis    ╲
────────────────────────
```

## Technology Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Unit | Jest | Fast, isolated tests |
| Integration | Jest + Supertest | HTTP endpoint testing |
| E2E | Playwright | Browser automation |
| Socket | Jest + Socket.IO Client | Realtime event testing |
| Load | k6 / Artillery | Stress testing |
| Coverage | c8 / Istanbul | Code coverage reports |

## Unit Tests

### What to Test

- **Validators**: Zod schemas — valid input passes, invalid input fails with correct error
- **Services**: Business logic — auth, event creation, poll management, vote validation
- **Utilities**: Helper functions — token generation, code generation, date formatting
- **Repositories**: Database queries (mocked Prisma)

### Example Validator Test

```typescript
describe('createEventSchema', () => {
  it('should accept valid event data', () => {
    const data = { title: 'My Event', description: 'A great event' };
    expect(() => createEventSchema.parse(data)).not.toThrow();
  });

  it('should reject empty title', () => {
    const data = { title: '' };
    expect(() => createEventSchema.parse(data)).toThrow('Title is required');
  });

  it('should reject title longer than 200 chars', () => {
    const data = { title: 'x'.repeat(201) };
    expect(() => createEventSchema.parse(data)).toThrow();
  });
});
```

### Example Service Test (mocked)

```typescript
describe('EventService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create an event and generate a unique code', async () => {
    const userId = 'user-1';
    const data = { title: 'Test Event' };
    
    (prisma.event.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.event.create as jest.Mock).mockResolvedValue({
      id: 'event-1',
      code: 'ABC123',
      title: 'Test Event',
      hostId: userId,
    });

    const event = await eventService.createEvent(userId, data);
    
    expect(event.code).toBeDefined();
    expect(event.code.length).toBe(8);
    expect(prisma.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ hostId: userId, title: 'Test Event' })
    });
  });
});
```

### Mocking Prisma

```typescript
// __mocks__/prisma.ts
const prisma = {
  user: { findUnique: jest.fn(), create: jest.fn() },
  event: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  poll: { findUnique: jest.fn(), create: jest.fn() },
  vote: { findUnique: jest.fn(), create: jest.fn() },
  $transaction: jest.fn((fn) => fn(prisma)),
};

export default prisma;
```

## Integration Tests

### What to Test

- **Auth endpoints**: Signup, login, logout, refresh, password reset
- **Event endpoints**: CRUD operations, authorization, password protection
- **Poll endpoints**: Creation, voting, results, timer enforcement
- **Error handling**: 400, 401, 403, 404, 429 responses

### Example Integration Test

```typescript
import request from 'supertest';
import app from '../src/app';

describe('POST /api/v1/auth/login', () => {
  it('should return 200 and tokens for valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'host@test.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('should return 401 for invalid password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'host@test.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
```

### Test Database

- Use a separate test PostgreSQL database
- Run migrations before test suite
- Truncate all tables between test runs
- Seed minimal test data (roles, test users)

```bash
# Setup
DATABASE_URL=postgresql://.../pollcast_test npx prisma migrate deploy
# Run
DATABASE_URL=postgresql://.../pollcast_test npm run test:integration
```

## Socket.IO Tests

### What to Test

- **Connection**: Successful auth, rejected auth
- **Room management**: Join, leave, duplicate join
- **Vote casting**: Valid vote, duplicate vote, closed poll
- **Q&A**: Submit question, upvote, anonymous mode
- **Broadcasts**: Events emitted to correct rooms

### Example Socket Test

```typescript
import { createServer } from 'http';
import { Server } from 'socket.io';
import Client from 'socket.io-client';

describe('Socket Poll Events', () => {
  let io: Server, server: http.Server, clientSocket: any;

  beforeAll((done) => {
    server = createServer();
    io = new Server(server);
    server.listen(() => {
      const port = (server.address() as any).port;
      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token: testToken }
      });
      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    io.close();
    clientSocket.close();
    server.close();
  });

  it('should emit vote_updated after receiving cast_vote', (done) => {
    clientSocket.emit('cast_vote', { pollId: 'poll-1', optionIds: ['opt-1'] });
    
    clientSocket.on('poll:vote_updated', (data) => {
      expect(data.pollId).toBe('poll-1');
      expect(data.results).toBeDefined();
      done();
    });
  });

  it('should reject duplicate votes', (done) => {
    clientSocket.emit('cast_vote', { pollId: 'poll-1', optionIds: ['opt-2'] });
    
    clientSocket.on('error', (error) => {
      expect(error.code).toBe('DUPLICATE_VOTE');
      done();
    });
  });
});
```

## E2E Tests (Playwright)

### Critical User Flows

```
1. Authentication
   ├── User signs up
   ├── User logs in
   └── User logs out

2. Event Management (Host)
   ├── Creates event
   ├── Shares invite link
   └── Ends event

3. Participant Flow
   ├── Joins event via code
   ├── Votes in poll
   └── Asks question

4. Live Interaction
   ├── Vote results update in realtime
   ├── New questions appear
   └── Upvote count changes

5. Edge Cases
   ├── Expired event
   ├── Password-protected event
   ├── Full event (max participants)
   └── Poll timer expiration
```

### Example Playwright Test

```typescript
import { test, expect } from '@playwright/test';

test('host creates poll and participants vote', async ({ browser }) => {
  const hostPage = await browser.newPage();
  const participantPage = await browser.newPage();

  // Host signs in
  await hostPage.goto('/login');
  await hostPage.fill('[name="email"]', 'host@test.com');
  await hostPage.fill('[name="password"]', 'password123');
  await hostPage.click('button[type="submit"]');

  // Host creates event
  await hostPage.goto('/events/create');
  await hostPage.fill('[name="title"]', 'Test Event');
  await hostPage.click('button[type="submit"]');
  await expect(hostPage.locator('text=Event created')).toBeVisible();

  // Get join code
  const joinCode = await hostPage.locator('[data-testid="join-code"]').textContent();

  // Participant joins
  await participantPage.goto('/events/join');
  await participantPage.fill('[name="code"]', joinCode);
  await participantPage.click('button[type="submit"]');
  await expect(participantPage.locator('text=Test Event')).toBeVisible();

  // Host creates poll
  await hostPage.click('text=Create Poll');
  await hostPage.fill('[name="title"]', 'Favorite color?');
  await hostPage.fill('[name="option1"]', 'Red');
  await hostPage.fill('[name="option2"]', 'Blue');
  await hostPage.click('text=Launch Poll');

  // Participant sees and votes
  await expect(participantPage.locator('text=Favorite color?')).toBeVisible();
  await participantPage.click('text=Red');
  await participantPage.click('text=Vote');

  // Host sees live results
  await expect(hostPage.locator('text=1 vote')).toBeVisible();
});
```

## Performance & Load Testing

### WebSocket Stress Testing

```javascript
// k6 script for Socket.IO load test
import { Socket } from 'k6/x/socket.io';

const POLL_ID = __ENV.POLL_ID;

export default function () {
  const socket = new Socket('ws://localhost:4000', {
    auth: { token: `test-token-${__VU}` }
  });

  socket.on('connect', () => {
    socket.emit('join_event_room', { eventId: __ENV.EVENT_ID });
    
    // Vote every 2 seconds
    setInterval(() => {
      socket.emit('cast_vote', {
        pollId: POLL_ID,
        optionIds: [`opt-${Math.floor(Math.random() * 4) + 1}`]
      });
    }, 2000);
  });

  socket.on('poll:vote_updated', (data) => {
    // Just receive — no action needed
  });
}
```

### Load Test Targets

| Test | Concurrent Users | Acceptable Latency | Error Rate |
|------|-----------------|-------------------|------------|
| Auth API | 500 | <500ms | <1% |
| Event CRUD | 200 | <300ms | <1% |
| Vote casting | 1000 | <100ms | <0.5% |
| Socket connections | 2000 | <1s connect | <1% |
| Q&A submission | 500 | <200ms | <1% |

### Performance Benchmarks

Run benchmarks in CI:

```bash
# API benchmarks
npx autocannon -c 100 -d 30 http://localhost:4000/api/v1/polls/:id/results

# Socket.IO benchmarks
k6 run tests/load/socket-test.js --vus 1000 --duration 60s
```

## CI Integration

All tests run in CI pipeline:

1. **Lint + TypeCheck** (parallel)
2. **Unit tests** (fast, ~2min)
3. **Integration tests** (with test DB, ~5min)
4. **Socket tests** (with test server, ~3min)
5. **E2E tests** (with Playwright, ~10min)
6. **Build** (verify TypeScript compilation)

## Coverage Targets

| Category | Target |
|----------|--------|
| Lines | 80% |
| Branches | 75% |
| Functions | 80% |
| Statements | 80% |

Focus on:
- **Critical business logic**: 100% (vote casting, auth, permissions)
- **API endpoints**: 90%
- **UI components**: 70% (complex components only)
- **Validators**: 100%
