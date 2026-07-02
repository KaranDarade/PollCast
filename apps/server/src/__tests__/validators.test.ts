import { signupSchema, loginSchema, updateProfileSchema } from '../validators/auth';
import { createEventSchema, updateEventSchema, joinEventSchema } from '../validators/event';
import { createPollSchema, castVoteSchema } from '../validators/poll';
import { createQuestionSchema, moderateQuestionSchema } from '../validators/question';
import { sendInviteSchema } from '../validators/invite';

// ---------------------------------------------------------------------------
// Auth Validators
// ---------------------------------------------------------------------------
describe('Auth Validators', () => {
  describe('signupSchema', () => {
    it('accepts valid signup data', () => {
      expect(() => signupSchema.parse({ email: 'test@example.com', password: 'password123', name: 'Test User' })).not.toThrow();
    });
    it('rejects invalid email', () => {
      expect(() => signupSchema.parse({ email: 'invalid', password: 'password123', name: 'Test' })).toThrow();
    });
    it('rejects short password', () => {
      expect(() => signupSchema.parse({ email: 'test@example.com', password: '123', name: 'Test' })).toThrow();
    });
    it('rejects short name', () => {
      expect(() => signupSchema.parse({ email: 'test@example.com', password: 'password123', name: 'A' })).toThrow();
    });
    it('rejects empty email', () => {
      expect(() => signupSchema.parse({ email: '', password: 'password123', name: 'Test' })).toThrow();
    });
    it('rejects password exceeding max length', () => {
      expect(() => signupSchema.parse({ email: 'test@example.com', password: 'x'.repeat(101), name: 'Test' })).toThrow();
    });
    it('trims name', () => {
      const result = signupSchema.parse({ email: 'test@example.com', password: 'password123', name: '  Test User  ' });
      expect(result.name).toBe('Test User');
    });
  });

  describe('loginSchema', () => {
    it('accepts valid login data', () => {
      expect(() => loginSchema.parse({ email: 'test@example.com', password: 'password123' })).not.toThrow();
    });
    it('rejects missing password', () => {
      expect(() => loginSchema.parse({ email: 'test@example.com', password: '' })).toThrow();
    });
    it('rejects invalid email', () => {
      expect(() => loginSchema.parse({ email: 'not-email', password: 'password' })).toThrow();
    });
  });

  describe('updateProfileSchema', () => {
    it('accepts valid full profile update', () => {
      expect(() => updateProfileSchema.parse({ name: 'New Name', phone: '+1234567890', avatar: 'data:image/png;base64,abc' })).not.toThrow();
    });
    it('accepts partial update (name only)', () => {
      expect(() => updateProfileSchema.parse({ name: 'New Name' })).not.toThrow();
    });
    it('accepts partial update (phone only)', () => {
      expect(() => updateProfileSchema.parse({ phone: '+1234567890' })).not.toThrow();
    });
    it('accepts empty object (no changes)', () => {
      expect(() => updateProfileSchema.parse({})).not.toThrow();
    });
    it('rejects short name', () => {
      expect(() => updateProfileSchema.parse({ name: 'A' })).toThrow();
    });
    it('rejects oversized avatar', () => {
      expect(() => updateProfileSchema.parse({ avatar: 'x'.repeat(5001) })).toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// Event Validators
// ---------------------------------------------------------------------------
describe('Event Validators', () => {
  describe('createEventSchema', () => {
    it('accepts valid event data (minimal)', () => {
      expect(() => createEventSchema.parse({ title: 'My Event' })).not.toThrow();
    });
    it('accepts valid event data (full)', () => {
      expect(() => createEventSchema.parse({ title: 'My Event', description: 'A great event', maxParticipants: 100, password: 'secret1234' })).not.toThrow();
    });
    it('rejects short title', () => {
      expect(() => createEventSchema.parse({ title: 'AB' })).toThrow();
    });
    it('rejects empty title', () => {
      expect(() => createEventSchema.parse({ title: '' })).toThrow();
    });
    it('rejects title over 200 chars', () => {
      expect(() => createEventSchema.parse({ title: 'x'.repeat(201) })).toThrow();
    });
    it('rejects description over 2000 chars', () => {
      expect(() => createEventSchema.parse({ title: 'Valid Title', description: 'x'.repeat(2001) })).toThrow();
    });
    it('rejects password shorter than 4 chars', () => {
      expect(() => createEventSchema.parse({ title: 'Title', password: 'ab' })).toThrow();
    });
    it('rejects zero max participants', () => {
      expect(() => createEventSchema.parse({ title: 'Title', maxParticipants: 0 })).toThrow();
    });
  });

  describe('updateEventSchema', () => {
    it('accepts partial update', () => {
      expect(() => updateEventSchema.parse({ title: 'Updated Title' })).not.toThrow();
    });
    it('accepts empty update', () => {
      expect(() => updateEventSchema.parse({})).not.toThrow();
    });
  });

  describe('joinEventSchema', () => {
    it('accepts valid join data', () => {
      expect(() => joinEventSchema.parse({ code: 'ABC123' })).not.toThrow();
    });
    it('accepts join with password', () => {
      expect(() => joinEventSchema.parse({ code: 'ABC123', password: 'pass' })).not.toThrow();
    });
    it('rejects empty code', () => {
      expect(() => joinEventSchema.parse({ code: '' })).toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// Poll Validators
// ---------------------------------------------------------------------------
describe('Poll Validators', () => {
  describe('createPollSchema', () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    it('accepts valid poll data (minimum options)', () => {
      expect(() => createPollSchema.parse({ eventId: uuid, title: 'Test Poll', options: ['A', 'B'] })).not.toThrow();
    });
    it('accepts poll with timer and multi-choice', () => {
      expect(() => createPollSchema.parse({ eventId: uuid, title: 'Test', options: ['A', 'B'], isMultipleChoice: true, timerSeconds: 60 })).not.toThrow();
    });
    it('rejects single option', () => {
      expect(() => createPollSchema.parse({ eventId: uuid, title: 'Test Poll', options: ['Only'] })).toThrow();
    });
    it('rejects more than 10 options', () => {
      expect(() => createPollSchema.parse({ eventId: uuid, title: 'Test Poll', options: Array.from({ length: 11 }, (_, i) => `Option ${i}`) })).toThrow();
    });
    it('rejects empty title', () => {
      expect(() => createPollSchema.parse({ eventId: uuid, title: '', options: ['A', 'B'] })).toThrow();
    });
    it('rejects invalid eventId', () => {
      expect(() => createPollSchema.parse({ eventId: 'not-uuid', title: 'Test', options: ['A', 'B'] })).toThrow();
    });
    it('rejects negative timer', () => {
      expect(() => createPollSchema.parse({ eventId: uuid, title: 'Test', options: ['A', 'B'], timerSeconds: -5 })).toThrow();
    });
    it('rejects excessive timer', () => {
      expect(() => createPollSchema.parse({ eventId: uuid, title: 'Test', options: ['A', 'B'], timerSeconds: 3601 })).toThrow();
    });
  });

  describe('castVoteSchema', () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    it('accepts valid single vote', () => {
      expect(() => castVoteSchema.parse({ pollId: uuid, optionIds: [uuid] })).not.toThrow();
    });
    it('accepts valid multi vote', () => {
      expect(() => castVoteSchema.parse({ pollId: uuid, optionIds: [uuid, uuid] })).not.toThrow();
    });
    it('rejects empty optionIds', () => {
      expect(() => castVoteSchema.parse({ pollId: uuid, optionIds: [] })).toThrow();
    });
    it('rejects invalid pollId', () => {
      expect(() => castVoteSchema.parse({ pollId: 'bad', optionIds: [uuid] })).toThrow();
    });
    it('rejects invalid optionId', () => {
      expect(() => castVoteSchema.parse({ pollId: uuid, optionIds: ['bad'] })).toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// Question Validators
// ---------------------------------------------------------------------------
describe('Question Validators', () => {
  const uuid = '123e4567-e89b-12d3-a456-426614174000';

  describe('createQuestionSchema', () => {
    it('accepts valid question data', () => {
      expect(() => createQuestionSchema.parse({ eventId: uuid, content: 'This is a valid question with enough characters?' })).not.toThrow();
    });
    it('accepts anonymous question', () => {
      expect(() => createQuestionSchema.parse({ eventId: uuid, content: 'This is a valid question with enough characters?', isAnonymous: true })).not.toThrow();
    });
    it('rejects short content', () => {
      expect(() => createQuestionSchema.parse({ eventId: uuid, content: 'Short' })).toThrow();
    });
    it('rejects empty content', () => {
      expect(() => createQuestionSchema.parse({ eventId: uuid, content: '' })).toThrow();
    });
    it('rejects content over 500 chars', () => {
      expect(() => createQuestionSchema.parse({ eventId: uuid, content: 'x'.repeat(501) })).toThrow();
    });
    it('rejects invalid eventId', () => {
      expect(() => createQuestionSchema.parse({ eventId: 'bad', content: 'Question with enough chars here?' })).toThrow();
    });
  });

  describe('moderateQuestionSchema', () => {
    it('accepts approve action', () => {
      expect(() => moderateQuestionSchema.parse({ questionId: uuid, action: 'approve' })).not.toThrow();
    });
    it('accepts reject action', () => {
      expect(() => moderateQuestionSchema.parse({ questionId: uuid, action: 'reject' })).not.toThrow();
    });
    it('accepts pin action', () => {
      expect(() => moderateQuestionSchema.parse({ questionId: uuid, action: 'pin' })).not.toThrow();
    });
    it('accepts unpin action', () => {
      expect(() => moderateQuestionSchema.parse({ questionId: uuid, action: 'unpin' })).not.toThrow();
    });
    it('rejects invalid action', () => {
      expect(() => moderateQuestionSchema.parse({ questionId: uuid, action: 'delete' })).toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// Invite Validators
// ---------------------------------------------------------------------------
describe('Invite Validators', () => {
  describe('sendInviteSchema', () => {
    it('accepts valid email', () => {
      expect(() => sendInviteSchema.parse({ email: 'friend@example.com' })).not.toThrow();
    });
    it('rejects invalid email', () => {
      expect(() => sendInviteSchema.parse({ email: 'not-email' })).toThrow();
    });
    it('rejects empty email', () => {
      expect(() => sendInviteSchema.parse({ email: '' })).toThrow();
    });
  });
});
