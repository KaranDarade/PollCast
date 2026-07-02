import { Request, Response } from 'express';
import { pollService } from '../services/poll.service';
import { createPollSchema, castVoteSchema } from '../validators/poll';

export class PollController {
  async create(req: Request, res: Response) {
    const input = createPollSchema.parse(req.body);
    const poll = await pollService.createPoll(req.user!.userId, input);
    res.status(201).json({ success: true, message: 'Poll created', data: poll });
  }

  async start(req: Request, res: Response) {
    const poll = await pollService.startPoll(req.params.id, req.user!.userId);
    res.json({ success: true, message: 'Poll started', data: poll });
  }

  async close(req: Request, res: Response) {
    const poll = await pollService.closePoll(req.params.id, req.user!.userId);
    res.json({ success: true, message: 'Poll closed', data: poll });
  }

  async vote(req: Request, res: Response) {
    const input = castVoteSchema.parse(req.body);
    const poll = await pollService.castVote(req.user!.userId, input);
    res.json({ success: true, message: 'Vote recorded', data: poll });
  }

  async results(req: Request, res: Response) {
    const poll = await pollService.getPollResults(req.params.id);
    res.json({ success: true, data: poll });
  }

  async getEventPolls(req: Request, res: Response) {
    const polls = await pollService.getEventPolls(req.params.eventId);
    res.json({ success: true, data: polls });
  }
}

export const pollController = new PollController();
