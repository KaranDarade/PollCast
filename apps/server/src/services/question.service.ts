import { prisma } from '../db';
import { NotFoundError, ForbiddenError, ConflictError } from '../utils/errors';
import type { CreateQuestionInput } from '../validators/question';

export class QuestionService {
  async createQuestion(userId: string, input: CreateQuestionInput) {
    const event = await prisma.event.findUnique({ where: { id: input.eventId } });
    if (!event) throw new NotFoundError('Event');
    if (event.status === 'ENDED') throw new ForbiddenError('Event has ended');

    const settings = event.settings as { requireModeration?: boolean };

    const question = await prisma.question.create({
      data: {
        eventId: input.eventId,
        authorId: userId,
        content: input.content,
        isAnonymous: input.isAnonymous,
        isApproved: !settings.requireModeration,
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    return question;
  }

  async getEventQuestions(eventId: string) {
    return prisma.question.findMany({
      where: { eventId, isApproved: true },
      include: {
        author: { select: { id: true, name: true } },
      },
      orderBy: [{ isPinned: 'desc' }, { upvoteCount: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getPendingQuestions(eventId: string, hostId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError('Event');
    if (event.hostId !== hostId) throw new ForbiddenError('Not your event');

    return prisma.question.findMany({
      where: { eventId, isApproved: false },
      include: {
        author: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async moderateQuestion(questionId: string, hostId: string, action: string) {
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { event: true },
    });

    if (!question) throw new NotFoundError('Question');
    if (question.event.hostId !== hostId) throw new ForbiddenError('Not your event');

    switch (action) {
      case 'approve':
        return prisma.question.update({
          where: { id: questionId },
          data: { isApproved: true },
        });
      case 'reject':
        await prisma.question.delete({ where: { id: questionId } });
        return { deleted: true };
      case 'pin':
        return prisma.question.update({
          where: { id: questionId },
          data: { isPinned: true },
        });
      case 'unpin':
        return prisma.question.update({
          where: { id: questionId },
          data: { isPinned: false },
        });
      default:
        throw new ForbiddenError('Invalid moderation action');
    }
  }

  async upvoteQuestion(questionId: string, userId: string) {
    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) throw new NotFoundError('Question');

    const existing = await prisma.questionVote.findUnique({
      where: { questionId_userId: { questionId, userId } },
    });

    if (existing) {
      // Remove upvote (toggle)
      await prisma.$transaction([
        prisma.questionVote.delete({
          where: { questionId_userId: { questionId, userId } },
        }),
        prisma.question.update({
          where: { id: questionId },
          data: { upvoteCount: { decrement: 1 } },
        }),
      ]);

      return { upvoted: false };
    }

    await prisma.$transaction([
      prisma.questionVote.create({
        data: { questionId, userId },
      }),
      prisma.question.update({
        where: { id: questionId },
        data: { upvoteCount: { increment: 1 } },
      }),
    ]);

    return { upvoted: true };
  }

  async deleteQuestion(questionId: string, userId: string) {
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { event: true },
    });

    if (!question) throw new NotFoundError('Question');
    if (question.authorId !== userId && question.event.hostId !== userId) {
      throw new ForbiddenError('Not authorized to delete this question');
    }

    await prisma.question.delete({ where: { id: questionId } });
  }
}

export const questionService = new QuestionService();
