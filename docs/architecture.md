# PollCast Architecture

## High-Level System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Client Browser                         │
│  ┌──────────────────────┐  ┌──────────────────────────────┐  │
│  │   Next.js Frontend   │  │   Socket.IO Client           │  │
│  │   (SSR + RSC)        │  │   (Realtime Connection)      │  │
│  └──────────┬───────────┘  └──────────────┬───────────────┘  │
└─────────────┼──────────────────────────────┼──────────────────┘
              │ HTTP/REST                    │ WebSocket (WSS)
              ▼                              ▼
┌──────────────────────────────────────────────────────────────┐
│                         CDN / Load Balancer                   │
└──────────────────────────────────────────────────────────────┘
              │                              │
              ▼                              ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│    Express API Server    │  │    Socket.IO Server          │
│    Port: 4000            │  │    Port: 4000 (same server)  │
│                          │  │                              │
│  ┌────────────────────┐  │  │  ┌────────────────────────┐  │
│  │  Middleware Stack   │  │  │  │  Socket Middleware     │  │
│  │  - CORS             │  │  │  │  - Auth               │  │
│  │  - Rate Limiter     │  │  │  │  - Rate Limit         │  │
│  │  - Auth             │  │  │  │  - Room Auth          │  │
│  │  - Validator        │  │  │  └─────────┬──────────────┘  │
│  └─────────┬───────────┘  │  │            │                 │
│            │               │  │            ▼                 │
│            ▼               │  │  ┌────────────────────────┐  │
│  ┌────────────────────┐   │  │  │  Event Handlers        │  │
│  │  Controller Layer  │   │  │  │  - join_event_room     │  │
│  └─────────┬───────────┘   │  │  │  - cast_vote          │  │
│            │               │  │  │  - ask_question       │  │
│            ▼               │  │  │  - upvote_question    │  │
│  ┌────────────────────┐   │  │  └─────────┬──────────────┘  │
│  │   Service Layer    │   │  │            │                 │
│  └─────────┬───────────┘   │  │            ▼                 │
│            │               │  │  ┌────────────────────────┐  │
│            ▼               │  │  │  Redis Pub/Sub         │  │
│  ┌────────────────────┐   │  │  │  (Cross-server sync)   │  │
│  │  Repository Layer  │   │  │  └─────────┬──────────────┘  │
│  └─────────┬───────────┘   │  │            │                 │
└────────────┼───────────────┘  └────────────┼─────────────────┘
             │                               │
             ▼                               ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│       PostgreSQL         │  │         Redis                │
│  - Primary data store    │  │  - Cache                    │
│  - Relational integrity  │  │  - Rate limiter             │
│  - Prisma ORM            │  │  - Session store            │
│                          │  │  - Socket pub/sub           │
└──────────────────────────┘  └──────────────────────────────┘
```

## Architecture Decisions

### 1. Monorepo Structure

We use a monorepo (Turborepo) because:

- **Shared types**: `packages/shared` contains TypeScript types used by both frontend and backend
- **Shared config**: ESLint, Prettier, TypeScript configs live in `packages/config`
- **Atomic commits**: Changes across frontend/backend in a single PR
- **Consistent tooling**: Single `npm install`, unified build pipeline

### 2. Separate Backend (not Next.js API routes)

**Decision**: Express.js running as a standalone server.

**Rationale**:

| Factor | Next.js API Routes | Express Server |
|--------|-------------------|----------------|
| WebSocket support | ❌ Not persistent | ✅ Full support |
| Long-running processes | ❌ Serverless timeout | ✅ Persistent |
| Stateful connections | ❌ Stateless | ✅ Full control |
| Horizontal scaling | ✅ Built-in | ✅ Via Redis |
| Deployment | ✅ Vercel | Railway/Render |
| Code sharing | ✅ Same repo | ✅ Monorepo |

Socket.IO is the primary driver — it requires a persistent server process that Next.js serverless functions cannot provide.

### 3. Authentication Strategy

**Decision**: JWT with access + refresh tokens.

**Flow**:
1. User logs in → server returns `accessToken` (15min) + `refreshToken` (7 days)
2. `accessToken` is stored in memory (JS variable) + HTTP-only cookie
3. `refreshToken` is stored in HTTP-only cookie only
4. Every API request includes `Authorization: Bearer <accessToken>`
5. When access token expires → client calls `/api/auth/refresh`
6. On Socket.IO connection → client sends token in `auth` handshake
7. On logout → both tokens invalidated server-side

**Why JWT over sessions**:
- Stateless — no DB lookup on every request
- Works natively with Socket.IO handshake
- Frontend and mobile clients can both use the same auth
- Easy to validate across multiple backend instances

### 4. Realtime Architecture

**Decision**: Socket.IO with Redis adapter.

**Flow**:
1. Client connects to Socket.IO server → server authenticates via JWT
2. Client emits `join_event_room { eventId }` → server validates → joins room
3. Server subscribes to Redis channel for that event
4. When another server instance publishes an update → Redis broadcasts → server emits to room
5. All clients in the room receive the update

**Scaling**: Multiple Socket.IO servers sync via Redis pub/sub. Each server holds WebSocket connections for its clients. Redis acts as the message bus.

### 5. Database Choice

**Decision**: PostgreSQL + Prisma ORM.

**Rationale**:
- Relational data with clear relationships (User → Event → Poll → Vote)
- Prisma provides type-safe queries, migrations, and excellent DX
- PostgreSQL supports JSON fields for analytics data
- ACID compliance ensures vote integrity

### 6. Redis Usage

Redis serves multiple critical roles:
- **Socket.IO adapter**: Cross-server pub/sub for realtime events
- **Rate limiter**: Sliding window rate limiting per IP/user
- **Cache**: Poll results, leaderboard data, session cache
- **Job queue**: Email sending, analytics aggregation (optional)

## API Request Lifecycle

```
Client Request
    │
    ▼
1. CORS Middleware  ───→ Validates origin, sets headers
    │
    ▼
2. Rate Limiter     ───→ Checks Redis for request count (429 if exceeded)
    │
    ▼
3. Auth Middleware  ───→ Validates JWT, attaches user to req
    │
    ▼
4. Body Parser      ───→ Parses JSON/URL-encoded body
    │
    ▼
5. Validation       ───→ Zod schema validation (400 if invalid)
    │
    ▼
6. Controller       ───→ Extracts params, calls service
    │
    ▼
7. Service          ───→ Business logic, authorization checks
    │
    ▼
8. Repository       ───→ Prisma queries to PostgreSQL
    │
    ▼
9. Response         ───→ { success, message, data }
```

## Data Flow: Vote Casting with Realtime

```
1. Client emits: socket.emit("cast_vote", { pollId, optionId })

2. Server receives event
   ├── Validates JWT from socket handshake
   ├── Validates user is in the event room
   ├── Checks if poll is active
   ├── Checks if user already voted (prevents duplicates)
   └── If valid:
       ├── Writes vote to PostgreSQL
       ├── Invalidates poll result cache in Redis
       ├── Publishes to Redis channel: "poll:{pollId}:vote"
       └── Emits to all clients in room: "vote_updated" with new counts

3. All connected clients receive "vote_updated" in realtime
   ├── Update poll results chart (Framer Motion animates the transition)
   └── Show "option X just got a vote" toast animation

4. Disconnected clients:
   └── When reconnected, server sends latest state on "join_event_room"
```

## Security Layers

```
Layer 1: Transport
├── HTTPS/TLS (production)
├── WSS (secure WebSocket)
└── HSTS headers

Layer 2: Network
├── CORS (frontend origin only)
├── Rate limiting (per IP + per user)
└── Request size limits

Layer 3: Authentication
├── JWT validation on every request
├── Refresh token rotation
├── Socket.IO handshake auth
└── Password hashing (bcrypt, 12 rounds)

Layer 4: Authorization
├── Role-based access (Admin, Host, Participant)
├── Resource ownership checks
├── Event password protection
└── Invite link signatures

Layer 5: Input
├── Zod schema validation
├── Prisma parameterized queries (SQL injection prevention)
├── XSS sanitization (DOMPurify on client)
└── CSRF token on state-changing requests

Layer 6: Abuse Prevention
├── Duplicate vote detection (per poll, per user)
├── Anti-spam (rate limit questions per user)
├── Poll timer enforcement (server-side)
└── Suspicious activity logging
```

## Scalability Strategy

### Horizontal Scaling

1. **Frontend**: Statically generated pages served via CDN. Dynamic pages cached at edge.
2. **Backend**: Multiple Express instances behind load balancer. Stateless (JWT) allows any instance to handle any request.
3. **Socket.IO**: Multiple instances behind load balancer with sticky sessions (or use Redis adapter for true scaling).
4. **Database**: Read replicas for analytics queries. Connection pooling via PgBouncer.
5. **Redis**: Redis Cluster for high availability.

### Caching Strategy

| Data | Cache Strategy | TTL |
|------|---------------|-----|
| Poll results | Redis SET with TTL | 10s |
| Event details | Redis SET with TTL | 60s |
| User sessions | Redis SET with TTL | 7 days |
| Rate limit counters | Redis sorted set | Sliding window |
| Analytics aggregates | Redis sorted sets | Until updated |

### Performance Optimizations

- **Database indexes**: Cover all foreign keys and frequently queried columns
- **Prisma**: Use `select` to fetch only needed fields, `include` for relations
- **Socket.IO**: Compress messages, batch emits
- **Frontend**: Next.js ISR for public pages, React Server Components for data fetching
- **Images**: Next.js Image optimization, CDN delivery

## Monitoring & Observability

1. **Sentry**: Error tracking for both frontend and backend
2. **Structured Logging**: JSON logs with correlation IDs (using `pino`)
3. **Metrics**: Request rate, error rate, latency p50/p95/p99
4. **Health Checks**: `/api/health` endpoint returns DB + Redis status
5. **Alerts**: Slack/Discord webhook on error threshold breach
