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

export function useEventRoom(eventId: string | undefined) {
  const { isConnected, joinEventRoom, leaveEventRoom, on } = useSocket();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [lastPollResult, setLastPollResult] = useState<PollResult | null>(null);
  const [lastQuestionUpdate, setLastQuestionUpdate] = useState<QuestionUpdate | null>(null);

  useEffect(() => {
    if (!eventId || !isConnected) return;

    joinEventRoom(eventId).catch(console.error);

    return () => {
      leaveEventRoom(eventId);
    };
  }, [eventId, isConnected, joinEventRoom, leaveEventRoom]);

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
  };
}
