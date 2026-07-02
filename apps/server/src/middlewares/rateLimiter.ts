import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import { config } from '../config';
import { RateLimitError } from '../utils/errors';

const redis = new Redis(config.redis.url);

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

    try {
      const multi = redis.multi();
      multi.zremrangebyscore(key, 0, windowStart);
      multi.zadd(key, now, `${now}:${Math.random()}`);
      multi.zcard(key);
      multi.expire(key, Math.ceil(windowMs / 1000));

      const results = await multi.exec();

      if (!results) {
        next();
        return;
      }

      const count = results[2]?.[1] as number;

      if (count > maxRequests) {
        throw new RateLimitError();
      }

      next();
    } catch (err) {
      if (err instanceof RateLimitError) {
        throw err;
      }
      next();
    }
  };
}
