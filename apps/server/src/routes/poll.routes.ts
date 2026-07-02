import { Router } from 'express';
import { pollController } from '../controllers/poll.controller';
import { auth } from '../middlewares/auth';

const router = Router();

router.use(auth);

router.post('/', pollController.create.bind(pollController));
router.post('/:id/start', pollController.start.bind(pollController));
router.post('/:id/close', pollController.close.bind(pollController));
router.post('/vote', pollController.vote.bind(pollController));
router.get('/:id/results', pollController.results.bind(pollController));
router.get('/event/:eventId', pollController.getEventPolls.bind(pollController));

export const pollRoutes = router;
