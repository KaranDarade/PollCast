# PollCast Backend Architecture

## Overview

The backend is an Express.js server written in TypeScript. It follows clean architecture with clear separation of concerns: Controllers → Services → Repositories.

## Why Express over Next.js API Routes

| Requirement | Express | Next.js API Routes |
|------------|---------|-------------------|
| WebSocket (Socket.IO) | ✅ Fully supported | ❌ Serverless timeout |
| Long-running processes | ✅ Persistent server | ❌ 10s-30s max |
| Stateful middleware | ✅ Session, rate limiting | ❌ Each request is cold |
| Custom middleware stack | ✅ Full control | ✅ Limited |
| Horizontal scaling | ✅ Redis + load balancer | ✅ Auto-scaling |
| Docker deployment | ✅ Simple | ❌ Needs serverless adapter |

The **killer feature** is Socket.IO — it requires a persistent TCP connection. Next.js serverless functions terminate after each request, making WebSocket impossible.

## Folder Structure

```
apps/server/src/
├── config/           # Environment config, database connection, redis
├── controllers/      # Request handlers — parse input, call services, send response
├── routes/           # Route definitions — maps URLs to controllers
├── services/         # Business logic — validation, authorization, orchestration
├── repositories/     # Data access — Prisma queries, never exposed outside
├── middlewares/       # Express middleware — auth, rate limit, error handler
├── validators/       # Zod schemas — request body validation
├── sockets/          # Socket.IO — event handlers, room management
├── events/           # Event emitters — internal event bus
├── db/               # Prisma client singleton
├── utils/            # Helpers — JWT, hashing, random codes
└── types/            # TypeScript types (extended)
```

## Layer Responsibilities

### Controller Layer
**File**: `controllers/*.ts`

- Receives `req`, `res` from Express
- Extracts parameters (body, params, query)
- Calls **validator** to validate input
- Calls **service** to execute business logic
- Sends response with consistent structure

```typescript
// Pattern:
async createEvent(req: AuthRequest, res: Response) {
  const data = createEventSchema.parse(req.body);
  const event = await eventService.createEvent(req.user.id, data);
  res.status(201).json({
    success: true,
    message: 'Event created successfully',
    data: event
  });
}
```

### Service Layer
**File**: `services/*.ts`

- Contains all business logic
- Performs authorization checks
- Orchestrates multiple repository calls
- Throws custom errors (caught by error handler)

**Rules**:
- Never access `req` or `res` directly
- Never make direct database calls (use repositories)
- Always throw typed errors (`AppError` class)
- All methods are async

### Repository Layer
**File**: `repositories/*.ts`

- Only layer that touches Prisma/PostgreSQL
- Methods named after what they do: `findById`, `create`, `updateVote`
- Returns plain objects (never Prisma models directly)
- Never throws HTTP errors — returns `null` for not found

### Validation Layer
**File**: `validators/*.ts`

- Zod schemas for every request body
- Shared with frontend via `@pollcast/shared` package
- Defined per resource: `createEventSchema`, `updatePollSchema`

### Middleware Layer
**File**: `middlewares/*.ts`

- **auth**: Extracts JWT, verifies, attaches `req.user`
- **requireRole**: Checks user role (admin, host)
- **rateLimit**: Sliding window via Redis
- **validate**: Runs Zod schema on `req.body`
- **errorHandler**: Global error handler (last in chain)
- **notFound**: 404 handler

## Response Structure

Every response follows this format:

```typescript
// Success
{
  success: true,
  message: "Event created successfully",
  data: { ... }
}

// Error
{
  success: false,
  message: "Event not found",
  error: {
    code: "EVENT_NOT_FOUND",
    details: { ... }
  }
}
```

## HTTP Status Codes

| Code | When |
|------|------|
| 200 | Success (GET, PUT, PATCH) |
| 201 | Created (POST) |
| 204 | No Content (DELETE) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid/missing token) |
| 403 | Forbidden (insufficient role) |
| 404 | Not Found |
| 409 | Conflict (duplicate) |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |

## Error Handling

All errors go through the central error handler:

```typescript
class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
  }
}

// Usage
throw new AppError(404, 'EVENT_NOT_FOUND', 'Event does not exist');
throw new AppError(403, 'INSUFFICIENT_PERMISSIONS', 'Only hosts can create polls');
```

## Middleware Order

```typescript
app.use(cors(corsConfig));
app.use(helmet());
app.use(rateLimiter);
app.use(express.json({ limit: '10kb' }));
app.use(requestLogger);

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/events', authMiddleware, eventRoutes);
app.use('/api/v1/polls', authMiddleware, pollRoutes);
// ...

// Error handling (MUST be last)
app.use(errorHandler);
app.use(notFoundHandler);
```

## Authentication Flow

### Login
1. Validate email + password via Zod
2. Find user by email in DB
3. Compare password with bcrypt
4. Generate access token (15min) + refresh token (7 days)
5. Set refresh token in HTTP-only cookie
6. Return access token + user data

### Token Refresh
1. Read refresh token from cookie
2. Verify JWT signature
3. Check if token is in database (revocation check)
4. Issue new access token + new refresh token (rotation)
5. Revoke old refresh token

### Socket Authentication
1. Client connects with `auth: { token }` in handshake
2. Server's socket middleware verifies JWT
3. On success → socket joins authenticated space
4. On failure → connection rejected

## API Versioning

All routes are prefixed with `/api/v1/`. Versioning ensures backward compatibility:
- `/api/v1/events`
- `/api/v1/polls`

When breaking changes are needed, a new version (`/api/v2/`) is created. Old versions are deprecated with a warning header.

## Rate Limiting

- **Global**: 100 requests/minute per IP
- **Auth endpoints**: 10 requests/minute per IP (login, signup)
- **Socket events**: 30 events/minute per socket
- **Poll creation**: 20/hour per user
- **Question posting**: 10/minute per user

Redis stores counters using sliding window algorithm.

## Performance Considerations

- **Connection pooling**: Prisma with PgBouncer for serverless/connection-limited environments
- **Query optimization**: Always use `select` to fetch only needed fields
- **N+1 prevention**: Use Prisma `include` or batch queries
- **Caching**: Redis cache for frequently accessed data (poll results, event details)
- **Compression**: `compression` middleware for response gzip
