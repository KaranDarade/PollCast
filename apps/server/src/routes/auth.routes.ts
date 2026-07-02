import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { auth, optionalAuth } from '../middlewares/auth';
import { createRateLimiter } from '../middlewares/rateLimiter';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

const authLimiter = createRateLimiter({ windowMs: 60 * 1000, maxRequests: 10 });

router.post('/signup', authLimiter, asyncHandler(authController.signup.bind(authController)));
router.post('/login', authLimiter, asyncHandler(authController.login.bind(authController)));
router.post('/refresh', asyncHandler(authController.refresh.bind(authController)));
router.post('/logout', optionalAuth, asyncHandler(authController.logout.bind(authController)));
router.get('/me', auth, asyncHandler(authController.me.bind(authController)));
router.patch('/me', auth, asyncHandler(authController.updateMe.bind(authController)));

export const authRoutes = router;
