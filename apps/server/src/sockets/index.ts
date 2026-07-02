import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import { prisma } from '../db';
import { pollService } from '../services/poll.service';
import { questionService } from '../services/question.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

export function configureSocket(io: Server) {
  // Auth middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      next(new Error('Authentication required'));
      return;
    }

    try {
      const decoded = verifyAccessToken(token);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`User connected: ${socket.userId}`);

    // Join event room
    socket.on('join_event_room', async (data: { eventId: string }, callback) => {
      try {
        const access = await prisma.eventAccess.findUnique({
          where: {
            userId_eventId: {
              userId: socket.userId!,
              eventId: data.eventId,
            },
          },
        });

        if (!access) {
          callback?.({ error: 'Not a participant of this event' });
          return;
        }

        const room = `event:${data.eventId}`;
        await socket.join(room);

        // Notify others
        socket.to(room).emit('event:participant_joined', {
          userId: socket.userId,
          timestamp: new Date(),
        });

        callback?.({ success: true });
      } catch (err) {
        callback?.({ error: 'Failed to join room' });
      }
    });

    // Leave event room
    socket.on('leave_event_room', (data: { eventId: string }) => {
      const room = `event:${data.eventId}`;
      socket.leave(room);

      socket.to(room).emit('event:participant_left', {
        userId: socket.userId,
        timestamp: new Date(),
      });
    });

    // Cast vote
    socket.on('cast_vote', async (data: { pollId: string; optionIds: string[] }, callback) => {
      try {
        const poll = await pollService.castVote(socket.userId!, {
          pollId: data.pollId,
          optionIds: data.optionIds,
        });

        // Broadcast results to all in room
        const eventId = poll?.eventId;
        if (eventId) {
          io.to(`event:${eventId}`).emit('poll:vote_updated', {
            pollId: data.pollId,
            results: poll,
          });
        }

        callback?.({ success: true });
      } catch (err: any) {
        callback?.({ error: err.message || 'Failed to cast vote' });
      }
    });

    // Ask question
    socket.on('ask_question', async (data: { eventId: string; content: string; isAnonymous?: boolean }, callback) => {
      try {
        const question = await questionService.createQuestion(socket.userId!, {
          eventId: data.eventId,
          content: data.content,
          isAnonymous: data.isAnonymous || false,
        });

        // Notify room
        io.to(`event:${data.eventId}`).emit('question:created', question);
        callback?.({ success: true, question });
      } catch (err: any) {
        callback?.({ error: err.message || 'Failed to submit question' });
      }
    });

    // Upvote question
    socket.on('upvote_question', async (data: { questionId: string }, callback) => {
      try {
        const result = await questionService.upvoteQuestion(data.questionId, socket.userId!);

        // Get question to find event
        const question = await prisma.question.findUnique({
          where: { id: data.questionId },
          select: { eventId: true, upvoteCount: true },
        });

        if (question) {
          io.to(`event:${question.eventId}`).emit('question:upvoted', {
            questionId: data.questionId,
            upvoteCount: question.upvoteCount,
          });
        }

        callback?.({ success: true, upvoted: result.upvoted });
      } catch (err: any) {
        callback?.({ error: err.message || 'Failed to upvote' });
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });
}
