import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { RateLimitError } from '../utils/errors';

// In-memory fallback store
const memoryStore = new Map<string, { timestamps: number[] }>();

function memoryRateLimiter(key: string, windowMs: number, maxRequests: number): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;
  let entry = memoryStore.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    memoryStore.set(key, entry);
  }
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);
  if (entry.timestamps.length >= maxRequests) return false;
  entry.timestamps.push(now);
  return true;
}

// Attempt Redis connection (non-blocking)
let redis: import('ioredis').Redis | null = null;
try {
  const Redis = require('ioredis');
  const client = new Redis(config.redis.url, {
    maxRetriesPerRequest: null,
    retryStrategy: () => null,
    enableOfflineQueue: false,
    connectTimeout: 5000,
  });
  client.on('error', () => { redis = null; });
  redis = client;
} catch {
  redis = null;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

const defaults: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 100,
};

export function createRateLimiter(overrides: Partial<RateLimitConfig> = {}) {
  const { windowMs, maxRequests } = { ...defaults, ...overrides };

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const key = `ratelimit:${req.ip}:${req.path}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Use in-memory store if Redis unavailable
    if (!redis) {
      if (!memoryRateLimiter(key, windowMs, maxRequests)) {
        return next(new RateLimitError());
      }
      return next();
    }

    try {
      const multi = redis.multi();
      multi.zremrangebyscore(key, 0, windowStart);
      multi.zadd(key, now, `${now}:${Math.random()}`);
      multi.zcard(key);
      multi.expire(key, Math.ceil(windowMs / 1000));

      const results = await multi.exec();

      if (!results) {
        return next();
      }

      const count = results[2]?.[1] as number;

      if (count > maxRequests) {
        return next(new RateLimitError());
      }

      next();
    } catch (err) {
      if (err instanceof RateLimitError) {
        return next(err);
      }
      next();
    }
  };
}
