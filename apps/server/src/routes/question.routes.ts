import { Router } from 'express';
import { questionController } from '../controllers/question.controller';
import { auth } from '../middlewares/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(auth);

router.post('/', asyncHandler(questionController.create.bind(questionController)));
router.get('/event/:eventId', asyncHandler(questionController.getEventQuestions.bind(questionController)));
router.get('/event/:eventId/pending', asyncHandler(questionController.getPending.bind(questionController)));
router.post('/moderate', asyncHandler(questionController.moderate.bind(questionController)));
router.post('/:id/upvote', asyncHandler(questionController.upvote.bind(questionController)));
router.delete('/:id', asyncHandler(questionController.delete.bind(questionController)));

export const questionRoutes = router;
