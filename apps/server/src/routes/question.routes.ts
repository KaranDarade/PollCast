import { Router } from 'express';
import { questionController } from '../controllers/question.controller';
import { auth } from '../middlewares/auth';

const router = Router();

router.use(auth);

router.post('/', questionController.create.bind(questionController));
router.get('/event/:eventId', questionController.getEventQuestions.bind(questionController));
router.get('/event/:eventId/pending', questionController.getPending.bind(questionController));
router.post('/moderate', questionController.moderate.bind(questionController));
router.post('/:id/upvote', questionController.upvote.bind(questionController));
router.delete('/:id', questionController.delete.bind(questionController));

export const questionRoutes = router;
