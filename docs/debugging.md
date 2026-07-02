# PollCast Debugging Guide

## Common Issues & Solutions

### Database Connection Issues

**Symptom**: Server fails to start with `Can't reach database server`

**Causes**:
1. PostgreSQL not running
2. Wrong connection string in `.env`
3. Database doesn't exist

**Solutions**:
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Verify connection
psql -U pollcast -h localhost -d pollcast

# Run migrations
npx prisma migrate dev

# Reset database (if schema changed)
npx prisma migrate reset
```

### Redis Connection Issues

**Symptom**: Socket.IO rooms not working, rate limiting not functioning

**Solutions**:
```bash
# Check Redis is running
docker ps | grep redis

# Verify connectivity
redis-cli ping
# Should return: PONG

# Check Redis logs
docker logs pollcast-redis
```

### Socket.IO Connection Issues

**Symptom**: Client can't connect to Socket.IO server

**Checklist**:
1. JWT token is valid and passed in `auth.token`
2. CORS configuration allows frontend origin
3. Client URL matches server URL
4. No firewall blocking WebSocket upgrade

**Debug**:
```typescript
// Server-side debug logging
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  console.log('Auth:', socket.handshake.auth);
});

// Client-side debug
socket.on('connect_error', (err) => {
  console.error('Connection error:', err.message);
});
```

### Authentication Issues

**Symptom**: 401 Unauthorized on every request

**Checklist**:
1. Token is being sent in `Authorization: Bearer <token>` header
2. Token hasn't expired (15 min for access token)
3. JWT_SECRET matches between server instances
4. Token was issued by this server (same secret)

**Solutions**:
```bash
# Test token validation
jwt-decode <token>  # Decode without verification
jwt-cli verify <token> --key $JWT_SECRET  # Verify
```

### Prisma/Migration Issues

**Symptom**: `PrismaClientInitializationError` or migration conflicts

**Solutions**:
```bash
# Regenerate Prisma client
npx prisma generate

# Reset migrations (development only!)
npx prisma migrate reset

# Create new migration
npx prisma migrate dev --name migration_name

# Apply in production
npx prisma migrate deploy
```

### CORS Issues

**Symptom**: Browser console shows CORS errors

**Solutions**:
1. Verify `FRONTEND_URL` in server env matches actual frontend URL
2. Check that `credentials: true` is set on both client and server
3. Ensure no protocol mismatch (http vs https)

```typescript
// Test CORS from browser
fetch('http://localhost:4000/api/health', {
  credentials: 'include',
}).then(r => r.json()).then(console.log);
```

### Rate Limiting Issues

**Symptom**: Random 429 errors

**Solutions**:
1. Check Redis is connected correctly
2. Verify rate limit configuration
3. Clear rate limit keys: `redis-cli KEYS "ratelimit:*" | xargs redis-cli DEL`

## Debugging Tools

### Server-Side

```bash
# Watch server logs
npm run dev --workspace=apps/server

# Run with debug mode
DEBUG=* node dist/index.js

# Check health
curl http://localhost:4000/api/health

# Test auth
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"host@pollcast.app","password":"admin123"}'
```

### Client-Side

```typescript
// Enable debug logging
localStorage.setItem('debug', 'socket.io*');

// Check auth state
const { user, accessToken } = useAuth();
console.log({ user, token: accessToken?.slice(0, 20) + '...' });
```

### Database

```bash
# Prisma Studio (GUI)
npx prisma studio

# Query directly
psql -U pollcast -d pollcast -c "SELECT * FROM users;"

# Check table sizes
psql -U pollcast -d pollcast -c "
SELECT relname, n_live_tup, n_dead_tup
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
"
```

### Socket.IO Debugging

```bash
# Enable socket.io debug logging on server
DEBUG=socket.io* node dist/index.js

# Test with curl/pie
# Use wscat to test WebSocket
wscat -c ws://localhost:4000/socket.io/?EIO=4&transport=websocket
```

## Performance Debugging

### Slow Queries

Enable Prisma query logging:

```typescript
const prisma = new PrismaClient({
  log: ['query', 'warn', 'error'],
});
```

Check PostgreSQL slow query log:

```sql
SELECT query, calls, total_time / calls AS avg_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
```

### Memory Issues

```bash
# Check Node.js memory usage
node -e "console.log(process.memoryUsage())"

# Monitor with --inspect
node --inspect dist/index.js
# Open chrome://inspect in Chrome
```

## Production Debugging

### Sentry

Search for errors in Sentry dashboard by:
- Environment (`production`, `staging`)
- Error type (`AppError`, `ZodError`)
- User ID
- Event ID (via breadcrumbs/context)

### Logs

```bash
# View recent logs
railway logs --service pollcast-api --tail

# Search logs
railway logs --service pollcast-api --search "error"

# Download logs
railway logs --service pollcast-api > server.log
```

## Common Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| `VALIDATION_ERROR` | Input failed Zod validation | Check request body against schema |
| `UNAUTHORIZED` | Missing/invalid token | Login again or provide valid token |
| `FORBIDDEN` | Insufficient permissions | Check user role |
| `NOT_FOUND` | Resource doesn't exist | Verify ID/code |
| `CONFLICT` | Duplicate resource | Check for existing record |
| `DUPLICATE_VOTE` | Already voted | Disable vote button client-side |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Slow down, check rate limit config |
| `EVENT_FULL` | Max participants reached | Increase limit or wait for spot |
