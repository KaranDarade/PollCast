# PollCast Security Architecture

## Security Layers

A defense-in-depth approach with 6 security layers.

### Layer 1: Transport Security

```
Production only:
├── HTTPS enforced (TLS 1.3)
├── HSTS header (max-age=31536000, includeSubDomains)
├── WSS for WebSocket connections
└── HTTP → HTTPS redirect
```

**Implementation**: TLS termination at load balancer / reverse proxy (Nginx, Cloudflare).

### Layer 2: Network Security

#### CORS
```typescript
const corsConfig = {
  origin: process.env.FRONTEND_URL, // Only frontend origin
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
```

#### Rate Limiting
- Global: 100 requests/min per IP
- Auth endpoints: 10 requests/min per IP
- Socket events: 30 events/min per socket
- Poll creation: 20/hour per user

**Implementation**: Sliding window counter in Redis.

#### Request Size Limits
```typescript
app.use(express.json({ limit: '10kb' })); // Body limit
app.use(express.urlencoded({ extended: true, limit: '5kb' }));
```

### Layer 3: Authentication Security

#### Password Hashing
```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12; // ~250ms to hash — strong against brute force

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

**Why bcrypt over argon2**: Wider ecosystem support, simpler setup, proven track record.

#### JWT Security

```typescript
// Access token (short-lived)
const accessToken = jwt.sign(
  { userId: user.id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '15m', algorithm: 'HS256' }
);

// Refresh token (long-lived)
const refreshToken = jwt.sign(
  { userId: user.id, tokenId: uuid() },
  process.env.JWT_REFRESH_SECRET,
  { expiresIn: '7d', algorithm: 'HS256' }
);
```

**Security measures**:
- Access tokens expire in 15 minutes (minimize exposure window)
- Refresh tokens are rotated (new one issued on each refresh, old one revoked)
- Tokens stored in HTTP-only, Secure, SameSite=Strict cookies
- Token revocation tracked in database (Sessions table)

#### Cookie Configuration
```typescript
res.cookie('refreshToken', refreshToken, {
  httpOnly: true,     // Not accessible via JS
  secure: true,       // HTTPS only
  sameSite: 'strict', // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/v1/auth' // Only sent to auth endpoints
});
```

### Layer 4: Authorization Security

#### Role-Based Access Control (RBAC)

| Role | Permissions |
|------|------------|
| Admin | Full access — manage users, events, polls |
| Host | Create/manage own events, polls, moderate Q&A |
| Participant | Join events, vote, ask questions |

#### Middleware Chain
```typescript
// 1. Authenticate
function auth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new AppError(401, 'UNAUTHORIZED', 'No token provided');
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  req.user = decoded;
  next();
}

// 2. Authorize
function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions');
    }
    next();
  };
}

// Usage
router.post('/events', auth, requireRole('admin', 'host'), eventController.create);
```

#### Resource Ownership
- Hosts can only edit/delete their own events
- Event passwords stored as bcrypt hash
- Invite links are signed (HMAC) to prevent tampering

### Layer 5: Input Security

#### Validation (Zod)
```typescript
const createEventSchema = z.object({
  title: z.string().min(3).max(200).trim(),
  description: z.string().max(2000).trim().optional(),
  password: z.string().min(4).max(100).optional(),
  startDate: z.string().datetime().optional(),
});

// Trim + sanitize all string inputs
// Reject unexpected fields (zod strips unknown by default)
```

#### SQL Injection Prevention
- Prisma uses parameterized queries exclusively
- Never use raw SQL with string interpolation
- Prisma's type-safe queries prevent injection by design

#### XSS Prevention
- Content-Type headers prevent MIME sniffing
- Output encoding with React (auto-escapes by default)
- DOMPurify for any HTML rendering (if needed)
- CSP headers restrict inline scripts

#### CSRF Protection
- SameSite=Strict cookies prevent cross-site requests
- State-changing endpoints require `Content-Type: application/json`
- Socket.IO connections validated with JWT (not cookie-based)

### Layer 6: Abuse Prevention

#### Vote Manipulation Prevention
- Server-enforced: one vote per poll per user (DB unique constraint)
- Poll timer enforced server-side (not just client-side)
- Vote count increments in database transaction
- Option locked during update: `SELECT ... FOR UPDATE`

#### Spam Prevention
- Rate limit question submissions per user per event
- Minimum content length (10 chars)
- Maximum question frequency (5-second cooldown)
- Auto-flag suspicious content (repeated characters, links)

#### Brute Force Prevention
- Rate limiting on auth endpoints
- Account lockout after 5 failed attempts (15-minute cooldown)
- Graduated delays on password reset requests
- Suspicious IP logging and alerting

### Event Security

#### Password-Protected Events
- Event password hashed with bcrypt before storage
- Join flow: client sends password → server verifies → if correct, user joins room
- Password never returned in API responses

#### Signed Invite Links
```typescript
const crypto = require('crypto');

function generateInviteCode(eventId: string): string {
  const payload = `${eventId}:${Date.now() + 7 * 24 * 60 * 60 * 1000}`;
  const signature = crypto
    .createHmac('sha256', process.env.INVITE_SECRET)
    .update(payload)
    .digest('hex')
    .slice(0, 16);
  return `${Buffer.from(payload).toString('base64url')}.${signature}`;
}

function verifyInviteCode(code: string): { eventId: string } | null {
  // Decode, verify signature, check expiry
}
```

#### Expiring Events
- Events auto-end at `endDate`
- Invite links expire after configured duration
- Polls auto-close after timer expires
- Sessions auto-revoke after 7 days

### Security Headers

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", process.env.FRONTEND_URL],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'"],
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
```

### Monitoring & Incident Response

1. **Sentry**: Real-time error tracking for frontend + backend
2. **Logging**: All auth failures, rate limit hits, and suspicious activity logged
3. **Alerts**: PagerDuty/Slack webhook on anomaly detection
4. **Audit Trail**: Event log for all state-changing actions (who did what, when)
5. **Incident Plan**: Documented process for security incidents

### Security Checklist

- [ ] All passwords hashed with bcrypt (12 rounds)
- [ ] JWT secrets are strong (64+ chars, randomly generated)
- [ ] HTTPS enforced in production
- [ ] HSTS headers set
- [ ] CORS restricted to frontend origin
- [ ] Rate limiting on all endpoints
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (Prisma)
- [ ] XSS prevention (React + CSP)
- [ ] CSRF protection (SameSite cookies)
- [ ] No secrets in code (all in environment variables)
- [ ] Dependencies regularly audited (`npm audit`)
