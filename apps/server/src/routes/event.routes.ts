import { Router } from 'express';
import { eventController } from '../controllers/event.controller';
import { auth } from '../middlewares/auth';

const router = Router();

router.use(auth);

router.post('/', eventController.create.bind(eventController));
router.get('/my', eventController.getMyEvents.bind(eventController));
router.get('/code/:code', eventController.getByCode.bind(eventController));
router.get('/:id', eventController.getById.bind(eventController));
router.patch('/:id', eventController.update.bind(eventController));
router.delete('/:id', eventController.delete.bind(eventController));
router.post('/join', eventController.join.bind(eventController));
router.get('/:id/participants', eventController.getParticipants.bind(eventController));

export const eventRoutes = router;
