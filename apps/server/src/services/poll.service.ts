import { prisma } from '../db';
import { NotFoundError, ForbiddenError, ConflictError } from '../utils/errors';
import type { CreatePollInput, CastVoteInput } from '../validators/poll';

export class PollService {
  async createPoll(hostId: string, input: CreatePollInput) {
    const event = await prisma.event.findUnique({ where: { id: input.eventId } });
    if (!event) throw new NotFoundError('Event');
    if (event.hostId !== hostId) throw new ForbiddenError('Not your event');

    const poll = await prisma.poll.create({
      data: {
        eventId: input.eventId,
        title: input.title,
        type: input.type,
        isMultipleChoice: input.isMultipleChoice,
        timerSeconds: input.timerSeconds,
        options: {
          create: input.options.map((text, index) => ({
            text,
            sortOrder: index,
          })),
        },
      },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
      },
    });

    return poll;
  }

  async startPoll(pollId: string, hostId: string) {
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: { event: true },
    });

    if (!poll) throw new NotFoundError('Poll');
    if (poll.event.hostId !== hostId) throw new ForbiddenError('Not your event');
    if (poll.status !== 'DRAFT') throw new ForbiddenError('Poll is not in draft status');

    return prisma.poll.update({
      where: { id: pollId },
      data: {
        status: 'ACTIVE',
        endsAt: poll.timerSeconds
          ? new Date(Date.now() + poll.timerSeconds * 1000)
          : undefined,
      },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async closePoll(pollId: string, hostId: string) {
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: { event: true },
    });

    if (!poll) throw new NotFoundError('Poll');
    if (poll.event.hostId !== hostId) throw new ForbiddenError('Not your event');

    return prisma.poll.update({
      where: { id: pollId },
      data: { status: 'CLOSED' },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async castVote(userId: string, input: CastVoteInput) {
    const poll = await prisma.poll.findUnique({
      where: { id: input.pollId },
      include: {
        event: true,
        options: true,
      },
    });

    if (!poll) throw new NotFoundError('Poll');
    if (poll.status !== 'ACTIVE') throw new ForbiddenError('Poll is not active');

    // Check poll expiry
    if (poll.endsAt && new Date() > poll.endsAt) {
      await prisma.poll.update({
        where: { id: poll.id },
        data: { status: 'CLOSED' },
      });
      throw new ForbiddenError('Poll has ended');
    }

    // Check duplicate vote
    const existingVote = await prisma.vote.findUnique({
      where: { pollId_userId: { pollId: poll.id, userId } },
    });

    if (existingVote) {
      throw new ConflictError('Already voted on this poll', 'DUPLICATE_VOTE');
    }

    // Validate option IDs
    const validOptionIds = new Set(poll.options.map((o) => o.id));
    for (const optionId of input.optionIds) {
      if (!validOptionIds.has(optionId)) {
        throw new NotFoundError('Poll option');
      }
    }

    // Validate multi-choice
    if (!poll.isMultipleChoice && input.optionIds.length > 1) {
      throw new ForbiddenError('This poll only allows one choice');
    }

    // Execute vote transaction
    const votes = await prisma.$transaction(async (tx) => {
      const createdVotes = [];

      for (const optionId of input.optionIds) {
        await tx.pollOption.update({
          where: { id: optionId },
          data: { voteCount: { increment: 1 } },
        });

        const vote = await tx.vote.create({
          data: {
            pollId: poll.id,
            optionId,
            userId,
          },
        });

        createdVotes.push(vote);
      }

      return createdVotes;
    });

    // Get updated results
    const updatedPoll = await prisma.poll.findUnique({
      where: { id: poll.id },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { votes: true } },
      },
    });

    return updatedPoll;
  }

  async getPollResults(pollId: string) {
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { votes: true } },
      },
    });

    if (!poll) throw new NotFoundError('Poll');
    return poll;
  }

  async getEventPolls(eventId: string) {
    return prisma.poll.findMany({
      where: { eventId },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { votes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async autoCloseExpiredPolls() {
    const expired = await prisma.poll.findMany({
      where: {
        status: 'ACTIVE',
        endsAt: { lte: new Date() },
      },
    });

    for (const poll of expired) {
      await prisma.poll.update({
        where: { id: poll.id },
        data: { status: 'CLOSED' },
      });
    }

    return expired.length;
  }
}

export const pollService = new PollService();
