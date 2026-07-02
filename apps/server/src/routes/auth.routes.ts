import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { auth } from '../middlewares/auth';
import { createRateLimiter } from '../middlewares/rateLimiter';

const router = Router();

const authLimiter = createRateLimiter({ windowMs: 60 * 1000, maxRequests: 10 });

router.post('/signup', authLimiter, authController.signup.bind(authController));
router.post('/login', authLimiter, authController.login.bind(authController));
router.post('/refresh', authController.refresh.bind(authController));
router.post('/logout', auth, authController.logout.bind(authController));
router.get('/me', auth, authController.me.bind(authController));

export const authRoutes = router;
