import bcrypt from 'bcryptjs';
import { prisma } from '../db';

jest.mock('../db', () => ({
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    role: { findUnique: jest.fn() },
    event: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    eventAccess: { findUnique: jest.fn(), create: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    poll: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    pollOption: { update: jest.fn() },
    vote: { findUnique: jest.fn(), create: jest.fn() },
    question: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    questionVote: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
    session: { create: jest.fn(), updateMany: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
    $transaction: jest.fn((arg: any) => {
      if (typeof arg === 'function') return arg(prisma);
      if (Array.isArray(arg)) return Promise.all(arg);
      return undefined;
    }),
    $queryRaw: jest.fn(),
  },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
  compare: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid'),
}));

jest.mock('../utils/jwt', () => ({
  generateAccessToken: jest.fn().mockReturnValue('mock-access-token'),
  generateRefreshToken: jest.fn().mockReturnValue('mock-refresh-token'),
  verifyRefreshToken: jest.fn().mockReturnValue({ userId: 'user-1', tokenId: 'token-1' }),
  verifyAccessToken: jest.fn().mockReturnValue({ userId: 'user-1', role: 'HOST', email: 'host@test.com' }),
}));

// ---------------------------------------------------------------------------
// Auth Service
// ---------------------------------------------------------------------------
describe('AuthService', () => {
  let authService: any;

  beforeAll(async () => {
    authService = (await import('../services/auth.service')).authService;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signup', () => {
    it('creates a new user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.role.findUnique as jest.Mock).mockResolvedValue({ id: 'role-1', name: 'PARTICIPANT' });
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'user-1', email: 'test@test.com', name: 'Test', role: { name: 'PARTICIPANT' }, createdAt: new Date(),
      });

      const result = await authService.signup({ email: 'test@test.com', password: 'password123', name: 'Test' });
      expect(result.email).toBe('test@test.com');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'test@test.com' } });
    });

    it('throws ConflictError for duplicate email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });
      await expect(authService.signup({ email: 'existing@test.com', password: 'password123', name: 'Test' })).rejects.toThrow('Email already registered');
    });
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1', email: 'test@test.com', name: 'Test',
        passwordHash: 'hashed', role: { name: 'HOST' },
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prisma.session.create as jest.Mock).mockResolvedValue({});

      const result = await authService.login({ email: 'test@test.com', password: 'password123' });
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.user.email).toBe('test@test.com');
    });

    it('throws UnauthorizedError for wrong password', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1', passwordHash: 'hashed' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(authService.login({ email: 'test@test.com', password: 'wrong' })).rejects.toThrow('Invalid email or password');
    });

    it('throws UnauthorizedError for non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(authService.login({ email: 'noone@test.com', password: 'password123' })).rejects.toThrow('Invalid email or password');
    });
  });

  describe('getMe', () => {
    it('returns user profile', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1', email: 'test@test.com', name: 'Test', avatar: null,
        role: { name: 'HOST' }, emailVerified: null, createdAt: new Date(),
      });
      const result = await authService.getMe('user-1');
      expect(result.email).toBe('test@test.com');
    });

    it('throws for non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(authService.getMe('invalid')).rejects.toThrow('User not found');
    });
  });

  describe('updateMe', () => {
    it('updates user name', async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 'user-1', email: 'test@test.com', name: 'Updated', avatar: null, phone: null,
        role: { name: 'HOST' }, emailVerified: null, createdAt: new Date(),
      });
      const result = await authService.updateMe('user-1', { name: 'Updated' });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' }, data: { name: 'Updated' } })
      );
      expect(result.name).toBe('Updated');
    });

    it('updates user phone', async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 'user-1', email: 'test@test.com', name: 'Test', avatar: null, phone: '+1234567890',
        role: { name: 'HOST' }, emailVerified: null, createdAt: new Date(),
      });
      const result = await authService.updateMe('user-1', { phone: '+1234567890' });
      expect(result.phone).toBe('+1234567890');
    });

    it('updates user avatar', async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 'user-1', email: 'test@test.com', name: 'Test', avatar: 'data:image/png;base64,abc',
        phone: null, role: { name: 'HOST' }, emailVerified: null, createdAt: new Date(),
      });
      const result = await authService.updateMe('user-1', { avatar: 'data:image/png;base64,abc' });
      expect(result.avatar).toBe('data:image/png;base64,abc');
    });
  });
});

// ---------------------------------------------------------------------------
// Event Service
// ---------------------------------------------------------------------------
describe('EventService', () => {
  let eventService: any;

  beforeAll(async () => {
    eventService = (await import('../services/event.service')).eventService;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createEvent', () => {
    it('creates event with host access', async () => {
      (prisma.event.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.event.create as jest.Mock).mockResolvedValue({
        id: 'event-1', title: 'Test Event', code: 'ABC12345', hostId: 'user-1',
      });
      (prisma.eventAccess.create as jest.Mock).mockResolvedValue({});
      (prisma.event.update as jest.Mock).mockResolvedValue({});
      (prisma.event.findUnique as jest.Mock).mockResolvedValue({
        id: 'event-1', title: 'Test Event', code: 'ABC12345', hostId: 'user-1',
        host: { id: 'user-1', name: 'Host', email: 'host@test.com' },
      });

      const result = await eventService.createEvent('user-1', { title: 'Test Event' });
      expect(result.title).toBe('Test Event');
      expect(prisma.eventAccess.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1', role: 'host' }) })
      );
    });
  });

  describe('getEventById', () => {
    it('returns event when found', async () => {
      (prisma.event.findUnique as jest.Mock).mockResolvedValue({
        id: 'event-1', title: 'Test', host: { id: 'user-1', name: 'Host', email: 'host@test.com' },
        _count: { polls: 5, questions: 3, accessList: 10 },
      });
      const result = await eventService.getEventById('event-1');
      expect(result.title).toBe('Test');
    });

    it('throws NotFoundError when missing', async () => {
      (prisma.event.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(eventService.getEventById('invalid')).rejects.toThrow('Event');
    });
  });

  describe('joinEvent', () => {
    it('joins an event', async () => {
      (prisma.event.findUnique as jest.Mock).mockResolvedValue({
        id: 'event-1', code: 'CODE123', status: 'ACTIVE', password: null, maxParticipants: null, hostId: 'other',
      });
      (prisma.eventAccess.count as jest.Mock).mockResolvedValue(5);
      (prisma.eventAccess.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.eventAccess.create as jest.Mock).mockResolvedValue({});

      const result = await eventService.joinEvent('user-2', 'CODE123');
      expect(result.id).toBe('event-1');
    });

    it('throws ForbiddenError for ended event', async () => {
      (prisma.event.findUnique as jest.Mock).mockResolvedValue({ id: 'event-1', status: 'ENDED' });
      await expect(eventService.joinEvent('user-2', 'CODE123')).rejects.toThrow('This event has ended');
    });
  });
});

// ---------------------------------------------------------------------------
// Poll Service
// ---------------------------------------------------------------------------
describe('PollService', () => {
  let pollService: any;

  beforeAll(async () => {
    pollService = (await import('../services/poll.service')).pollService;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPoll', () => {
    it('creates poll with options', async () => {
      (prisma.event.findUnique as jest.Mock).mockResolvedValue({ id: 'event-1', hostId: 'host-1' });
      (prisma.poll.create as jest.Mock).mockResolvedValue({
        id: 'poll-1', title: 'Test Poll', eventId: 'event-1',
        options: [{ id: 'opt-1', text: 'A', voteCount: 0, sortOrder: 0 }],
      });

      const result = await pollService.createPoll('host-1', {
        eventId: 'event-1', title: 'Test Poll', options: ['A', 'B'],
      });
      expect(result.title).toBe('Test Poll');
    });

    it('throws ForbiddenError for non-host', async () => {
      (prisma.event.findUnique as jest.Mock).mockResolvedValue({ id: 'event-1', hostId: 'other-host' });
      await expect(pollService.createPoll('user-1', { eventId: 'event-1', title: 'Test', options: ['A', 'B'] })).rejects.toThrow('Not your event');
    });
  });

  describe('startPoll', () => {
    it('starts a draft poll', async () => {
      (prisma.poll.findUnique as jest.Mock).mockResolvedValue({
        id: 'poll-1', status: 'DRAFT', timerSeconds: 60,
        event: { hostId: 'host-1' },
      });
      (prisma.poll.update as jest.Mock).mockResolvedValue({
        id: 'poll-1', status: 'ACTIVE', endsAt: new Date(),
        options: [{ id: 'opt-1', text: 'A', voteCount: 0 }],
      });

      const result = await pollService.startPoll('poll-1', 'host-1');
      expect(result.status).toBe('ACTIVE');
    });

    it('throws ForbiddenError for already active poll', async () => {
      (prisma.poll.findUnique as jest.Mock).mockResolvedValue({
        id: 'poll-1', status: 'ACTIVE', event: { hostId: 'host-1' },
      });
      await expect(pollService.startPoll('poll-1', 'host-1')).rejects.toThrow('not in draft');
    });
  });

  describe('castVote', () => {
    it('casts a vote successfully', async () => {
      const mockPoll = {
        id: 'poll-1', status: 'ACTIVE', eventId: 'event-1', isMultipleChoice: false,
        endsAt: new Date(Date.now() + 3600000),
        event: { id: 'event-1' },
        options: [{ id: 'opt-1', text: 'A', voteCount: 0, sortOrder: 0 }],
        _count: { votes: 0 },
      };
      (prisma.poll.findUnique as jest.Mock).mockResolvedValue(mockPoll);
      (prisma.vote.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.pollOption.update as jest.Mock).mockResolvedValue({});
      (prisma.vote.create as jest.Mock).mockResolvedValue({});

      // After transaction, findUnique should return updated poll
      (prisma.poll.findUnique as jest.Mock).mockResolvedValue({
        ...mockPoll,
        _count: { votes: 1 },
        options: [{ id: 'opt-1', text: 'A', voteCount: 1, sortOrder: 0 }],
      });

      const result = await pollService.castVote('user-1', { pollId: 'poll-1', optionIds: ['opt-1'] });
      expect(result).toBeDefined();
    });

    it('throws ForbiddenError for expired poll', async () => {
      (prisma.poll.findUnique as jest.Mock).mockResolvedValue({
        id: 'poll-1', status: 'ACTIVE', endsAt: new Date(Date.now() - 1000),
        event: {}, options: [],
      });
      await expect(pollService.castVote('user-1', { pollId: 'poll-1', optionIds: ['opt-1'] })).rejects.toThrow('Poll has ended');
    });
  });
});

// ---------------------------------------------------------------------------
// Question Service
// ---------------------------------------------------------------------------
describe('QuestionService', () => {
  let questionService: any;

  beforeAll(async () => {
    questionService = (await import('../services/question.service')).questionService;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createQuestion', () => {
    it('creates a question', async () => {
      (prisma.event.findUnique as jest.Mock).mockResolvedValue({ id: 'event-1', settings: {} });
      (prisma.question.create as jest.Mock).mockResolvedValue({
        id: 'q-1', content: 'Test question?', eventId: 'event-1', authorId: 'user-1',
        isAnonymous: false, isApproved: false, upvoteCount: 0,
        createdAt: new Date(), author: { id: 'user-1', name: 'User' },
      });

      const result = await questionService.createQuestion('user-1', {
        eventId: 'event-1', content: 'Test question with enough chars?', isAnonymous: false,
      });
      expect(result.content).toBe('Test question?');
    });
  });

  describe('upvoteQuestion', () => {
    it('upvotes a question', async () => {
      (prisma.question.findUnique as jest.Mock).mockResolvedValue({ id: 'q-1', upvoteCount: 5 });
      (prisma.questionVote.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.questionVote.create as jest.Mock).mockResolvedValue({});
      (prisma.question.update as jest.Mock).mockResolvedValue({});

      const result = await questionService.upvoteQuestion('q-1', 'user-1');
      expect(result.upvoted).toBe(true);
    });

    it('removes upvote on second click', async () => {
      (prisma.question.findUnique as jest.Mock).mockResolvedValue({ id: 'q-1', upvoteCount: 5 });
      (prisma.questionVote.findUnique as jest.Mock).mockResolvedValue({ id: 'vote-1', userId: 'user-1' });
      (prisma.questionVote.delete as jest.Mock).mockResolvedValue({});
      (prisma.question.update as jest.Mock).mockResolvedValue({});

      const result = await questionService.upvoteQuestion('q-1', 'user-1');
      expect(result.upvoted).toBe(false);
    });
  });

  describe('moderateQuestion', () => {
    it('approves a question', async () => {
      (prisma.question.findUnique as jest.Mock).mockResolvedValue({ id: 'q-1', eventId: 'event-1', event: { hostId: 'host-1' } });
      (prisma.question.update as jest.Mock).mockResolvedValue({ id: 'q-1', isApproved: true });

      const result = await questionService.moderateQuestion('q-1', 'host-1', 'approve');
      expect(result.isApproved).toBe(true);
    });
  });
});
