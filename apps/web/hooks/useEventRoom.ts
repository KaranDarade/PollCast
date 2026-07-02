'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSocket } from './useSocket';

interface Participant {
  userId: string;
  name?: string;
}

interface PollResult {
  pollId: string;
  results: any;
}

interface QuestionUpdate {
  questionId: string;
  upvoteCount: number;
}

interface UseEventRoomReturn {
  participants: Participant[];
  lastPollResult: PollResult | null;
  lastQuestionUpdate: QuestionUpdate | null;
  isConnected: boolean;
  joinError: string | null;
  join: () => Promise<void>;
  leave: () => void;
}

export function useEventRoom(eventId: string | undefined): UseEventRoomReturn {
  const { isConnected, joinEventRoom, leaveEventRoom, on } = useSocket();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [lastPollResult, setLastPollResult] = useState<PollResult | null>(null);
  const [lastQuestionUpdate, setLastQuestionUpdate] = useState<QuestionUpdate | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const join = useCallback(async () => {
    if (!eventId || !isConnected) return;
    setJoinError(null);
    try {
      await joinEventRoom(eventId);
    } catch (err: any) {
      setJoinError(err.message);
    }
  }, [eventId, isConnected, joinEventRoom]);

  const leave = useCallback(() => {
    if (eventId) leaveEventRoom(eventId);
  }, [eventId, leaveEventRoom]);

  useEffect(() => {
    if (!eventId) return;

    const unsub1 = on('event:participant_joined', (data: any) => {
      setParticipants((prev) => [...prev, data]);
    });
    const unsub2 = on('event:participant_left', (data: any) => {
      setParticipants((prev) => prev.filter((p) => p.userId !== data.userId));
    });
    const unsub3 = on('poll:vote_updated', (data: PollResult) => {
      setLastPollResult(data);
    });
    const unsub4 = on('question:upvoted', (data: QuestionUpdate) => {
      setLastQuestionUpdate(data);
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, [eventId, on]);

  return {
    participants,
    lastPollResult,
    lastQuestionUpdate,
    isConnected,
    joinError,
    join,
    leave,
  };
}
