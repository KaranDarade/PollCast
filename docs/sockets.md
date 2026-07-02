# PollCast Realtime Architecture

## Overview

Socket.IO powers all realtime features: live poll results, instant Q&A updates, participant notifications, and event state changes.

## Why Socket.IO over Native WebSocket

| Feature | Socket.IO | Native WebSocket |
|---------|-----------|-----------------|
| Auto-reconnection | ✅ Built-in | ❌ Manual |
| Room support | ✅ Native | ❌ Manual |
| Fallback transports | ✅ HTTP long-polling | ❌ |
| Heartbeat/ping | ✅ Built-in | ❌ Manual |
| Ack/nack | ✅ Built-in | ❌ Manual |
| Middleware | ✅ Socket middleware | ❌ |
| Redis adapter | ✅ Official package | ❌ |
| Browser support | ✅ IE9+ | ❌ No IE |
| Bundle size | ~25KB gzipped | 0KB |

**Decision**: Socket.IO provides auto-reconnection, room management, and Redis adapter out of the box. These are critical features we'd need to build ourselves with native WebSockets.

## Server Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Socket.IO Server                       │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │   HTTP       │  │  Socket.IO  │  │  Redis       │     │
│  │   Server     │──│  Instance   │──│  Adapter     │     │
│  └─────────────┘  └──────┬──────┘  └──────┬───────┘      │
│                          │                 │              │
│                    ┌─────┴──────┐    ┌─────┴───────┐      │
│                    │ Middleware  │    │   Redis      │     │
│                    │ - Auth     │    │   Pub/Sub    │     │
│                    │ - Rate     │    └─────────────┘      │
│                    │ - Logger   │                          │
│                    └─────┬──────┘                          │
│                          │                                 │
│                    ┌─────┴──────┐                          │
│                    │  Handlers  │                          │
│                    │ - Events   │                          │
│                    │ - Polls    │                          │
│                    │ - Q&A     │                          │
│                    └────────────┘                          │
└──────────────────────────────────────────────────────────┘
```

I recommend using the **same HTTP server** for both Express API and Socket.IO:

```typescript
import http from 'http';
import express from 'express';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL },
  // Redis adapter for multi-server
  adapter: createAdapter(redisClient)
});

// Express routes
app.use('/api/v1', routes);

// Socket.IO
io.use(authMiddleware);
io.on('connection', handleConnection);

server.listen(4000);
```

## Socket Events

### Client → Server

| Event | Payload | Description | Auth |
|-------|---------|-------------|------|
| `join_event_room` | `{ eventId: string, password?: string }` | Join event room | Required |
| `leave_event_room` | `{ eventId: string }` | Leave event room | Required |
| `cast_vote` | `{ pollId: string, optionIds: string[] }` | Submit vote | Required |
| `ask_question` | `{ eventId: string, content: string, isAnonymous?: boolean }` | Submit question | Required |
| `upvote_question` | `{ questionId: string }` | Upvote a question | Required |
| `remove_upvote` | `{ questionId: string }` | Remove upvote | Required |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `event:participant_joined` | `{ userId, name, count }` | New participant |
| `event:participant_left` | `{ userId, name, count }` | Participant left |
| `event:updated` | `{ event }` | Event details changed |
| `event:ended` | `{ eventId }` | Event has ended |
| `poll:created` | `{ poll }` | New poll created |
| `poll:started` | `{ poll }` | Poll is now active |
| `poll:vote_updated` | `{ pollId, results }` | Vote counts changed |
| `poll:closed` | `{ pollId, finalResults }` | Poll timer expired or manually closed |
| `question:created` | `{ question }` | New question submitted |
| `question:approved` | `{ questionId }` | Moderator approved |
| `question:pinned` | `{ questionId, isPinned }` | Question pinned/unpinned |
| `question:upvoted` | `{ questionId, upvoteCount }` | Upvote count changed |
| `question:deleted` | `{ questionId }` | Question removed |
| `error` | `{ code, message }` | Error notification |

## Event Flow: Vote Casting

```
Client A                        Server                         Client B (all in room)
    │                              │                              │
    │  emit("cast_vote",           │                              │
    │    { pollId, optionIds })    │                              │
    │─────────────────────────────►│                              │
    │                              │                              │
    │                          ┌───┴───┐                         │
    │                          │Validate│                         │
    │                          │ - Auth │                         │
    │                          │ - Room │                         │
    │                          │ - Poll │                         │
    │                          │ - Dup  │                         │
    │                          └───┬───┘                         │
    │                              │                              │
    │                          ┌───┴───┐                         │
    │                          │ DB:    │                         │
    │                          │ - Write│                         │
    │                          │ - Update│                        │
    │                          │ - Redis│                         │
    │                          │   cache│                         │
    │                          └───┬───┘                         │
    │                              │                              │
    │                              │  emit("poll:vote_updated",   │
    │                              │    { pollId, results })      │
    │                              │─────────────────────────────►│
    │                              │                              │
    │                              │  emit("poll:vote_updated",   │
    │                              │    { pollId, results })      │
    │◄─────────────────────────────│                              │
    │                              │                              │
    │                              │  (Redis pub/sub syncs        │
    │                              │   across server instances)   │
    │                              │                              │
```

## Room Management

Socket.IO rooms group connections by event:

```typescript
// Joining
socket.join(`event:${eventId}`);

// Leaving
socket.leave(`event:${eventId}`);

// Emitting to room
io.to(`event:${eventId}`).emit('poll:vote_updated', data);
```

**Room naming convention**: `event:{eventId}` — namespaced to avoid collisions.

**Authorization on join**:
1. Socket must be authenticated (JWT valid)
2. User must be a participant or host of the event
3. If event is password-protected, password must be provided and verified

## Redis Pub/Sub for Scaling

When running multiple Socket.IO servers, Redis pub/sub ensures all servers receive events:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Server 1    │    │ Server 2    │    │ Server 3    │
│ Clients: A,B│    │ Clients: C,D│    │ Clients: E,F│
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       └──────────────────┼──────────────────┘
                          │
                   ┌──────▼──────┐
                   │    Redis    │
                   │  Pub/Sub    │
                   │ channel:    │
                   │ socket.io   │
                   └─────────────┘
```

When Server 1 emits to `event:abc`, it publishes to Redis. Redis broadcasts to Server 2 and 3, which then emit to their local clients in room `event:abc`.

## Socket Lifecycle

### Connection
1. Client creates Socket.IO connection with `auth: { token }`
2. Server middleware verifies JWT
3. On success: socket enters authenticated state
4. On failure: socket is disconnected with error

### Reconnection
1. Connection drops → client enters exponential backoff
2. Client retries: 1s → 2s → 4s → 8s → max 30s
3. On reconnect: client re-authenticates, rejoins rooms
4. Server sends current state for each room (catch-up)

### Disconnection
1. Client navigates away / closes tab
2. Server detects disconnect (heartbeat timeout)
3. Server emits `event:participant_left` to room
4. Server cleans up room membership

## Prevention Measures

### Duplicate Voting
- Database constraint: `UNIQUE(pollId, userId)` on Votes table
- Server-side check before writing vote
- Optimistic lock on vote count update

### Rate Limiting
- Socket middleware limits events per user per minute
- Configurable thresholds per event type
- Abuse detected → temporary ban (stored in Redis with TTL)

### Flood Protection
- Question content length limits (10-500 chars)
- Minimum time between questions (5 seconds)
- Maximum questions per event per user (configurable)

### Race Conditions
- Database transactions ensure vote consistency
- Lock option row during vote count update: `SELECT ... FOR UPDATE`

## Implementation Plan

1. Configure Socket.IO server with Redis adapter
2. Create socket middleware (auth, rate limit, logging)
3. Implement connection handler with room management
4. Implement poll event handlers (vote casting, results)
5. Implement Q&A event handlers (questions, upvotes)
6. Integrate with Express controllers (HTTP fallbacks)
7. Add Redis pub/sub for multi-server deployment
8. Write frontend socket hooks (`useSocket`, `useEventRoom`)
