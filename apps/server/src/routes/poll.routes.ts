import { Router } from 'express';
import { pollController } from '../controllers/poll.controller';
import { auth } from '../middlewares/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(auth);

router.post('/', asyncHandler(pollController.create.bind(pollController)));
router.post('/vote', asyncHandler(pollController.vote.bind(pollController)));
router.post('/:id/start', asyncHandler(pollController.start.bind(pollController)));
router.post('/:id/close', asyncHandler(pollController.close.bind(pollController)));
router.get('/event/:eventId', asyncHandler(pollController.getEventPolls.bind(pollController)));
router.get('/:id/results', asyncHandler(pollController.results.bind(pollController)));

export const pollRoutes = router;
