# PollCast Database Architecture

## Overview

PostgreSQL with Prisma ORM. The schema is normalized with strategic denormalization for realtime analytics.

## Entity Relationship Diagram

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│     User      │     │     Role      │     │    Event      │
│───────────────│     │───────────────│     │───────────────│
│ id (PK)       │────→│ id (PK)       │     │ id (PK)       │
│ email         │     │ name          │←────│ title         │
│ passwordHash  │     │ permissions   │     │ description   │
│ name          │     └───────────────┘     │ code (unique) │
│ avatar        │                           │ hostId (FK)   │
│ roleId (FK)   │                           │ startDate     │
│ createdAt     │                           │ endDate       │
│ updatedAt     │                           │ password      │
│ emailVerified │                           │ status        │
└───────────────┘                           │ settings (JSON)│
      │                                     │ maxParticipants│
      │                                     │ createdAt      │
      │                                     │ updatedAt      │
      │                                     └───────┬───────┘
      │                                             │
      │     ┌───────────────┐             ┌──────────┴──────────┐
      │     │  EventAccess  │             │                     │
      │     │───────────────│             │                     │
      │────→│ userId (FK)   │    ┌────────▼──────┐    ┌────────▼──────┐
      │     │ eventId (FK)  │    │     Poll      │    │   Question    │
      │     │ role          │    │───────────────│    │───────────────│
      │     │ joinedAt      │    │ id (PK)       │    │ id (PK)       │
      │     └───────────────┘    │ eventId (FK)  │    │ eventId (FK)  │
      │                         │ title          │    │ authorId (FK) │
      │                         │ type           │    │ content       │
      │                         │ status         │    │ isAnonymous   │
      │                         │ timerSeconds   │    │ isApproved    │
      │                         │ isMultiple     │    │ isPinned      │
      │                         │ endsAt         │    │ upvoteCount   │
      │                         │ createdAt      │    │ createdAt     │
      │                         └───────┬───────┘    └───────────────┘
      │                                 │                    │
      │                         ┌───────▼───────┐    ┌───────▼───────┐
      │                         │  PollOption   │    │ QuestionVote  │
      │                         │───────────────│    │───────────────│
      │                         │ id (PK)       │    │ userId (FK)   │
      │                         │ pollId (FK)   │    │ questionId(FK)│
      │                         │ text          │    │ createdAt     │
      │                         │ voteCount     │    └───────────────┘
      │                         │ createdAt     │
      │                         └───────┬───────┘
      │                                 │
      │                         ┌───────▼───────┐
      │                         │     Vote      │
      │                         │───────────────│
      │                         │ id (PK)       │
      │                         │ pollId (FK)   │
      │                         │ optionId (FK) │
      │                         │ userId (FK)   │
      │                         │ createdAt     │
      │                         └───────────────┘
```

## Tables

### Users

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, default uuid() | Unique identifier |
| email | VARCHAR(255) | UNIQUE, NOT NULL | User email |
| passwordHash | VARCHAR(255) | NOT NULL | bcrypt hash |
| name | VARCHAR(100) | NOT NULL | Display name |
| avatar | TEXT | NULLABLE | Avatar URL |
| roleId | UUID | FK → Roles.id | User role |
| emailVerified | TIMESTAMP | NULLABLE | When email was verified |
| verificationToken | VARCHAR(255) | NULLABLE | Email verification token |
| resetToken | VARCHAR(255) | NULLABLE | Password reset token |
| resetTokenExpiry | TIMESTAMP | NULLABLE | Reset token expiration |
| refreshTokens | JSONB | DEFAULT '[]' | Active refresh tokens (hashed) |
| createdAt | TIMESTAMP | DEFAULT now() | |
| updatedAt | TIMESTAMP | auto-updated | |

**Indexes**: `email` (unique), `roleId`, `verificationToken`, `resetToken`

### Roles

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| name | VARCHAR(50) | UNIQUE, NOT NULL | admin, host, participant |
| permissions | JSONB | NOT NULL | Array of permission strings |
| createdAt | TIMESTAMP | DEFAULT now() | |

**Seed data**: admin, host, participant roles with appropriate permissions

### Events

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| title | VARCHAR(200) | NOT NULL | Event title |
| description | TEXT | NULLABLE | Event description |
| code | VARCHAR(8) | UNIQUE, NOT NULL | Join code (generated) |
| hostId | UUID | FK → Users.id, NOT NULL | Event creator |
| startDate | TIMESTAMP | NULLABLE | Scheduled start |
| endDate | TIMESTAMP | NULLABLE | Scheduled end |
| password | VARCHAR(255) | NULLABLE | bcrypt hash of event password |
| status | VARCHAR(20) | DEFAULT 'draft' | draft, scheduled, active, ended |
| settings | JSONB | DEFAULT '{}' | Configuration object |
| maxParticipants | INTEGER | NULLABLE | Max participant limit |
| inviteCode | VARCHAR(20) | UNIQUE, NULLABLE | Invite link code |
| inviteCodeExpiry | TIMESTAMP | NULLABLE | Invite link expiration |
| createdAt | TIMESTAMP | DEFAULT now() | |
| updatedAt | TIMESTAMP | auto-updated | |

**Indexes**: `code` (unique), `hostId`, `status`, `inviteCode` (unique)

**Settings JSON**: `{ "allowAnonymousQuestions": boolean, "requireModeration": boolean, "allowMultipleVotes": boolean }`

### EventAccess

Tracks which users have joined/accessed which events.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| userId | UUID | FK → Users.id | |
| eventId | UUID | FK → Events.id | |
| role | VARCHAR(20) | DEFAULT 'participant' | host, participant |
| joinedAt | TIMESTAMP | DEFAULT now() | |

**Indexes**: `(userId, eventId)` unique, `eventId`

### Polls

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| eventId | UUID | FK → Events.id, NOT NULL | |
| title | VARCHAR(300) | NOT NULL | Poll question |
| type | VARCHAR(20) | DEFAULT 'poll' | poll, quiz |
| status | VARCHAR(20) | DEFAULT 'draft' | draft, active, closed |
| timerSeconds | INTEGER | NULLABLE | Countdown timer duration |
| isMultipleChoice | BOOLEAN | DEFAULT false | Allow multiple selections |
| endsAt | TIMESTAMP | NULLABLE | Auto-close time |
| createdAt | TIMESTAMP | DEFAULT now() | |
| updatedAt | TIMESTAMP | auto-updated | |

**Indexes**: `eventId`, `status`, `(eventId, status)` for active polls

### PollOptions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| pollId | UUID | FK → Polls.id, ON DELETE CASCADE | |
| text | VARCHAR(500) | NOT NULL | Option text |
| voteCount | INTEGER | DEFAULT 0 | Denormalized count |
| sortOrder | INTEGER | DEFAULT 0 | Display order |
| createdAt | TIMESTAMP | DEFAULT now() | |

**Indexes**: `pollId`, `(pollId, sortOrder)`

### Votes

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| pollId | UUID | FK → Polls.id, ON DELETE CASCADE | |
| optionId | UUID | FK → PollOptions.id | |
| userId | UUID | FK → Users.id | |
| createdAt | TIMESTAMP | DEFAULT now() | |

**Indexes**: `(pollId, userId)` unique (prevents duplicate votes), `pollId`, `optionId`

### Questions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| eventId | UUID | FK → Events.id, ON DELETE CASCADE | |
| authorId | UUID | FK → Users.id | Question author |
| content | TEXT | NOT NULL | Question text |
| isAnonymous | BOOLEAN | DEFAULT false | Hide author name |
| isApproved | BOOLEAN | DEFAULT false | Moderator approval |
| isPinned | BOOLEAN | DEFAULT false | Starred/marked important |
| upvoteCount | INTEGER | DEFAULT 0 | Denormalized count |
| createdAt | TIMESTAMP | DEFAULT now() | |
| updatedAt | TIMESTAMP | auto-updated | |

**Indexes**: `eventId`, `(eventId, isApproved)`, `(eventId, upvoteCount)`, `authorId`

### QuestionVotes

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| questionId | UUID | FK → Questions.id, ON DELETE CASCADE | |
| userId | UUID | FK → Users.id | |
| createdAt | TIMESTAMP | DEFAULT now() | |

**Indexes**: `(questionId, userId)` unique, `questionId`

### Sessions (for refresh token tracking)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| userId | UUID | FK → Users.id | |
| refreshToken | VARCHAR(500) | NOT NULL | Hashed refresh token |
| userAgent | TEXT | NULLABLE | Browser info |
| ipAddress | VARCHAR(45) | NULLABLE | Client IP |
| expiresAt | TIMESTAMP | NOT NULL | Token expiry |
| revokedAt | TIMESTAMP | NULLABLE | When revoked |
| createdAt | TIMESTAMP | DEFAULT now() | |

**Indexes**: `userId`, `refreshToken` (unique)

## Design Decisions

### Why UUID over Auto-increment IDs

- **Security**: No sequential IDs (can't guess next user/resource)
- **Distribution**: UUID v4 can be generated client-side, enabling offline-capable apps
- **Sharding**: If we shard the database later, UUIDs won't conflict

### Denormalized Counts

Both `PollOptions.voteCount` and `Questions.upvoteCount` are denormalized counters.

**Why**: Reading a count from a single row is O(1), while `COUNT(*)` on a large table is expensive.

**Trade-off**: Writes are slightly slower (must update both vote and count). We accept this because reads happen far more frequently than writes (especially for live results).

**Synchronization**: A periodic background job recalculates counts from source tables to fix any drift.

### JSONB Fields

- **Events.settings**: Flexible configuration without schema migration for new features
- **Users.refreshTokens**: Array of hashed refresh tokens for multi-device support

### Composite Indexes

- `(pollId, userId)` on Votes: Ensures one vote per user per poll
- `(questionId, userId)` on QuestionVotes: Ensures one upvote per user per question
- `(eventId, status)` on Polls: Fast query for "get active polls for this event"

## Performance Optimizations

1. **Connection pooling**: Prisma handles pool size via `connectionLimit`
2. **Prepared statements**: Prisma uses parameterized queries (no SQL injection)
3. **Selective fetching**: Always use Prisma `select` instead of fetching all columns
4. **Batch operations**: Use `createMany` for bulk inserts
5. **Separate read replicas**: Analytics queries can hit read replicas
6. **Materialized views** (future): For complex analytics aggregations

## Migration Strategy

1. All schema changes via Prisma migrations (`prisma migrate dev`)
2. Backward-compatible changes only (add columns as nullable, then backfill)
3. Zero-downtime migrations in production via `prisma migrate deploy`
4. Rollback via reverting to previous migration

## Backup Strategy

- Daily automated backups via `pg_dump`
- Point-in-time recovery enabled
- Backups stored in S3-compatible storage (30-day retention)
- Tested restore procedure monthly
