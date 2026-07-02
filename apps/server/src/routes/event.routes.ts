import { Router } from 'express';
import { eventController } from '../controllers/event.controller';
import { auth } from '../middlewares/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(auth);

router.post('/', asyncHandler(eventController.create.bind(eventController)));
router.get('/my', asyncHandler(eventController.getMyEvents.bind(eventController)));
router.get('/code/:code', asyncHandler(eventController.getByCode.bind(eventController)));
router.get('/:id', asyncHandler(eventController.getById.bind(eventController)));
router.patch('/:id', asyncHandler(eventController.update.bind(eventController)));
router.delete('/:id', asyncHandler(eventController.delete.bind(eventController)));
router.post('/join', asyncHandler(eventController.join.bind(eventController)));
router.get('/:id/participants', asyncHandler(eventController.getParticipants.bind(eventController)));
router.post('/:id/invite', asyncHandler(eventController.sendInvite.bind(eventController)));

export const eventRoutes = router;
