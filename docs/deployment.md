# PollCast Deployment Guide

## Overview

PollCast uses Docker for local development and production deployment. The frontend (Next.js) deploys to Vercel, and the backend (Express + Socket.IO) deploys to Railway or Render.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Vercel                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Next.js Frontend                                        │  │
│  │  - Static generation (landing, docs)                     │  │
│  │  - Server-side rendering (dashboard, events)             │  │
│  │  - API routes for auth callbacks (NextAuth tier)         │  │
│  └──────────────────────┬───────────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────────────┘
                          │ HTTPS
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Railway / Render                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Express API + Socket.IO Server                          │  │
│  │  - Docker container                                     │  │
│  │  - Health checks                                         │  │
│  │  - Auto-scaling                                          │  │
│  └──────────────────────┬───────────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
│  PostgreSQL      │ │   Redis     │ │   Redis          │
│  (Railway DB)    │ │  (Upstash)  │ │  (Cache + Pub/Sub)│
└─────────────────┘ └─────────────┘ └──────────────────┘
```

## Docker Configuration

### Dockerfile (Backend)

```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/ ./packages/
RUN npm ci --workspace=apps/server

# Build
COPY tsconfig.json .
COPY apps/server/ ./apps/server/
RUN npm run build --workspace=apps/server

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 express

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/package.json .
COPY --from=builder /app/packages ./packages

USER express

EXPOSE 4000

CMD ["node", "dist/index.js"]
```

### Docker Compose (Development)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: pollcast
      POSTGRES_USER: pollcast
      POSTGRES_PASSWORD: pollcast_dev
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U pollcast']
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

## Environment Variables

### Backend (`apps/server/.env`)
```bash
# Server
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://pollcast:pollcast_dev@localhost:5432/pollcast

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key-at-least-64-characters-long
JWT_REFRESH_SECRET=your-refresh-secret-at-least-64-characters-long

# Rate Limiting
REDIS_RATE_LIMIT_URL=redis://localhost:6379

# Sentry
SENTRY_DSN=
SENTRY_ENVIRONMENT=development

# SMTP (for email features)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@pollcast.app
```

### Frontend (`apps/web/.env.local`)
```bash
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## CI/CD Pipeline

### GitHub Actions

```yaml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run typecheck

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: pollcast_test
          POSTGRES_USER: pollcast
          POSTGRES_PASSWORD: pollcast_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx prisma generate
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://pollcast:pollcast_test@localhost:5432/pollcast_test
      - run: npm run test
        env:
          DATABASE_URL: postgresql://pollcast:pollcast_test@localhost:5432/pollcast_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-secret
          JWT_REFRESH_SECRET: test-refresh-secret

  build:
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build

  deploy:
    if: github.ref == 'refs/heads/main'
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Railway
        uses: railway-org/railway-action@v2
        with:
          service: pollcast-api
          token: ${{ secrets.RAILWAY_TOKEN }}
```

## Production Checklist

### Pre-Deployment

- [ ] All environment variables configured
- [ ] Secrets generated (JWT_SECRET, JWT_REFRESH_SECRET)
- [ ] Database migrations applied
- [ ] Redis instance provisioned
- [ ] Sentry DSN configured
- [ ] CORS origin set to production frontend URL
- [ ] Rate limiting configured for production
- [ ] SSL/TLS certificates in place
- [ ] Health check endpoints verified
- [ ] Logging configured (structured JSON)

### Database

- [ ] Connection pool limits configured
- [ ] Automated backups enabled
- [ ] Point-in-time recovery configured
- [ ] Read replica provisioned (for analytics)

### Monitoring

- [ ] Sentry error tracking active
- [ ] Server metrics collection active
- [ ] Uptime monitoring (Better Uptime / Pingdom)
- [ ] Slack/Discord alert channel configured
- [ ] Log aggregation (Logtail / Grafana Loki)

### Performance

- [ ] CDN configured for static assets
- [ ] Database indexes verified with EXPLAIN ANALYZE
- [ ] Response compression enabled
- [ ] Asset optimization (images, bundles)
- [ ] Lighthouse score >90

## Deployment Commands

### Development
```bash
# Start database + redis
docker compose up -d postgres redis

# Run migrations
npx prisma migrate dev

# Start backend (http://localhost:4000)
npm run dev --workspace=apps/server

# Start frontend (http://localhost:3000)
npm run dev --workspace=apps/web
```

### Production
```bash
# Build
npm run build

# Docker build backend
docker build -t pollcast-api ./apps/server

# Run migrations
npx prisma migrate deploy

# Start backend
docker run -p 4000:4000 --env-file .env pollcast-api

# Deploy frontend
cd apps/web && npx vercel --prod
```

## Backup Strategy

- **PostgreSQL**: Daily automated backups via pg_dump, 30-day retention
- **Redis**: RDB snapshots every 5 minutes, AOF enabled
- **Testing**: Monthly backup restoration drill
- **Disaster recovery**: Estimated RTO: 1 hour, RPO: 5 minutes

## Rollback Strategy

1. **Frontend**: Vercel instant rollback to previous deployment
2. **Backend**: Revert Docker image tag, redeploy
3. **Database**: Revert to previous migration (`prisma migrate resolve`)
4. **Emergency**: Restore from backup, point DNS to previous deployment

## Monitoring & Alerting

| Alert | Condition | Action |
|-------|-----------|--------|
| High error rate | >5% 5xx responses | Slack + email |
| High latency | p95 > 1s for 5 min | Slack |
| Low disk space | <10% free | Email |
| Service down | Health check fails 3x | PagerDuty |
| Rate limit threshold | >80% of limit | Slack notification |
