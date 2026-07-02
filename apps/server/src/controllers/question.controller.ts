import { Request, Response } from 'express';
import { questionService } from '../services/question.service';
import { createQuestionSchema, moderateQuestionSchema } from '../validators/question';

export class QuestionController {
  async create(req: Request, res: Response) {
    const input = createQuestionSchema.parse(req.body);
    const question = await questionService.createQuestion(req.user!.userId, input);
    res.status(201).json({ success: true, message: 'Question submitted', data: question });
  }

  async getEventQuestions(req: Request, res: Response) {
    const questions = await questionService.getEventQuestions(req.params.eventId);
    res.json({ success: true, data: questions });
  }

  async getPending(req: Request, res: Response) {
    const questions = await questionService.getPendingQuestions(
      req.params.eventId,
      req.user!.userId
    );
    res.json({ success: true, data: questions });
  }

  async moderate(req: Request, res: Response) {
    const input = moderateQuestionSchema.parse(req.body);
    const result = await questionService.moderateQuestion(
      input.questionId,
      req.user!.userId,
      input.action
    );
    res.json({ success: true, message: 'Question moderated', data: result });
  }

  async upvote(req: Request, res: Response) {
    const result = await questionService.upvoteQuestion(req.params.id, req.user!.userId);
    res.json({ success: true, message: result.upvoted ? 'Upvoted' : 'Upvote removed', data: result });
  }

  async delete(req: Request, res: Response) {
    await questionService.deleteQuestion(req.params.id, req.user!.userId);
    res.json({ success: true, message: 'Question deleted' });
  }
}

export const questionController = new QuestionController();
