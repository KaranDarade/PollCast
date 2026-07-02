'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/store/auth-context';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

export function useSocket() {
  const { accessToken } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!accessToken) return;

    const socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [accessToken]);

  const joinEventRoom = useCallback((eventId: string) => {
    return new Promise<void>((resolve, reject) => {
      socketRef.current?.emit('join_event_room', { eventId }, (response: any) => {
        if (response?.error) reject(new Error(response.error));
        else resolve();
      });
    });
  }, []);

  const leaveEventRoom = useCallback((eventId: string) => {
    socketRef.current?.emit('leave_event_room', { eventId });
  }, []);

  const castVote = useCallback((pollId: string, optionIds: string[]) => {
    return new Promise<void>((resolve, reject) => {
      socketRef.current?.emit('cast_vote', { pollId, optionIds }, (response: any) => {
        if (response?.error) reject(new Error(response.error));
        else resolve();
      });
    });
  }, []);

  const askQuestion = useCallback((eventId: string, content: string, isAnonymous = false) => {
    return new Promise<void>((resolve, reject) => {
      socketRef.current?.emit('ask_question', { eventId, content, isAnonymous }, (response: any) => {
        if (response?.error) reject(new Error(response.error));
        else resolve();
      });
    });
  }, []);

  const upvoteQuestion = useCallback((questionId: string) => {
    return new Promise<void>((resolve, reject) => {
      socketRef.current?.emit('upvote_question', { questionId }, (response: any) => {
        if (response?.error) reject(new Error(response.error));
        else resolve();
      });
    });
  }, []);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    socketRef.current?.on(event, handler);
    return () => {
      socketRef.current?.off(event, handler);
    };
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    joinEventRoom,
    leaveEventRoom,
    castVote,
    askQuestion,
    upvoteQuestion,
    on,
  };
}
