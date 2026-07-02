// API Response envelope
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    details?: Record<string, unknown>;
  };
}

// Event types
export type EventStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'ENDED';
export type PollStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';
export type PollType = 'POLL' | 'QUIZ';
export type RoleName = 'ADMIN' | 'HOST' | 'PARTICIPANT';

// User
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string | null;
  emailVerified?: string | null;
  createdAt: string;
}

// Event
export interface EventSummary {
  id: string;
  title: string;
  code: string;
  status: EventStatus;
  createdAt: string;
  _count: { polls: number; accessList: number; questions: number };
}

export interface EventDetail extends EventSummary {
  description?: string;
  host: { id: string; name: string; email: string };
  settings: Record<string, unknown>;
}

// Poll
export interface PollOption {
  id: string;
  text: string;
  voteCount: number;
  sortOrder: number;
}

export interface Poll {
  id: string;
  eventId: string;
  title: string;
  type: PollType;
  status: PollStatus;
  isMultipleChoice: boolean;
  timerSeconds?: number | null;
  endsAt?: string | null;
  createdAt: string;
  options: PollOption[];
}

// Question
export interface Question {
  id: string;
  content: string;
  isAnonymous: boolean;
  isApproved: boolean;
  isPinned: boolean;
  upvoteCount: number;
  createdAt: string;
  author: { id: string; name: string };
}

// Socket Events
export interface SocketEvents {
  // Client → Server
  join_event_room: { eventId: string };
  leave_event_room: { eventId: string };
  cast_vote: { pollId: string; optionIds: string[] };
  ask_question: { eventId: string; content: string; isAnonymous?: boolean };
  upvote_question: { questionId: string };

  // Server → Client
  'event:participant_joined': { userId: string; timestamp: string };
  'event:participant_left': { userId: string; timestamp: string };
  'event:updated': { event: EventDetail };
  'event:ended': { eventId: string };
  'poll:created': { poll: Poll };
  'poll:started': { poll: Poll };
  'poll:vote_updated': { pollId: string; results: Poll };
  'poll:closed': { pollId: string; finalResults: Poll };
  'question:created': Question;
  'question:approved': { questionId: string };
  'question:pinned': { questionId: string; isPinned: boolean };
  'question:upvoted': { questionId: string; upvoteCount: number };
  'question:deleted': { questionId: string };
  error: { code: string; message: string };
}
