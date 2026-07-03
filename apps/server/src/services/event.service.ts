import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../db';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { emailService } from './email.service';
import { config } from '../config';
import type { CreateEventInput, UpdateEventInput } from '../validators/event';

export class EventService {
  private generateCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private generateInviteCode(eventId: string): { code: string; expiry: Date } {
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const payload = `${eventId}:${expiry.getTime()}`;
    const signature = crypto
      .createHmac('sha256', process.env.INVITE_SECRET || 'dev-secret')
      .update(payload)
      .digest('hex')
      .slice(0, 16);
    const code = `${Buffer.from(payload).toString('base64url')}.${signature}`;
    return { code, expiry };
  }

  async createEvent(hostId: string, input: CreateEventInput) {
    let code: string;
    let attempts = 0;

    do {
      code = this.generateCode();
      attempts++;
      const existing = await prisma.event.findUnique({ where: { code } });
      if (!existing) break;
    } while (attempts < 5);

    let passwordHash: string | undefined;
    if (input.password) {
      passwordHash = await bcrypt.hash(input.password, 12);
    }

    const { code: inviteCode, expiry } = this.generateInviteCode('temp');

    const event = await prisma.event.create({
      data: {
        title: input.title,
        description: input.description,
        code,
        hostId,
        password: passwordHash,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        maxParticipants: input.maxParticipants,
        settings: input.settings || {},
        status: input.startDate ? 'SCHEDULED' : 'DRAFT',
      },
      include: {
        host: { select: { id: true, name: true, email: true } },
      },
    });

    // Create host access
    await prisma.eventAccess.create({
      data: { userId: hostId, eventId: event.id, role: 'host' },
    });

    // Update invite code with actual eventId
    const { code: finalInviteCode, expiry: finalExpiry } = this.generateInviteCode(event.id);
    await prisma.event.update({
      where: { id: event.id },
      data: { inviteCode: finalInviteCode, inviteCodeExpiry: finalExpiry },
    });

    return prisma.event.findUnique({
      where: { id: event.id },
      include: {
        host: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async getEventById(eventId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        host: { select: { id: true, name: true, email: true } },
        _count: { select: { polls: true, questions: true, accessList: true } },
      },
    });

    if (!event) {
      throw new NotFoundError('Event');
    }

    return event;
  }

  async getEventByCode(code: string) {
    const event = await prisma.event.findUnique({
      where: { code },
      include: {
        host: { select: { id: true, name: true } },
        _count: { select: { polls: true, accessList: true } },
      },
    });

    if (!event) {
      throw new NotFoundError('Event');
    }

    return event;
  }

  async getHostEvents(hostId: string) {
    return prisma.event.findMany({
      where: { hostId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { polls: true, accessList: true } },
      },
    });
  }

  async getJoinedEvents(userId: string) {
    const accessRecords = await prisma.eventAccess.findMany({
      where: { userId, role: 'participant' },
      include: {
        event: {
          include: {
            host: { select: { id: true, name: true, email: true } },
            _count: { select: { polls: true, questions: true, accessList: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return accessRecords.map((record) => ({
      ...record.event,
      joinedAt: record.joinedAt,
    }));
  }

  async updateEvent(eventId: string, userId: string, input: UpdateEventInput) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError('Event');
    if (event.hostId !== userId) throw new ForbiddenError('Not your event');

    let passwordHash: string | undefined;
    if (input.password) {
      passwordHash = await bcrypt.hash(input.password, 12);
    }

    return prisma.event.update({
      where: { id: eventId },
      data: {
        title: input.title,
        description: input.description,
        password: passwordHash,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        maxParticipants: input.maxParticipants,
        settings: input.settings,
        status: input.startDate ? 'SCHEDULED' : undefined,
      },
    });
  }

  async deleteEvent(eventId: string, userId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError('Event');
    if (event.hostId !== userId) throw new ForbiddenError('Not your event');

    await prisma.event.delete({ where: { id: eventId } });
  }

  async joinEvent(userId: string, code: string, password?: string) {
    const event = await prisma.event.findUnique({ where: { code } });
    if (!event) throw new NotFoundError('Event');

    if (event.status === 'ENDED') {
      throw new ForbiddenError('This event has ended');
    }

    if (event.password && password) {
      const valid = await bcrypt.compare(password, event.password);
      if (!valid) throw new ForbiddenError('Invalid event password');
    } else if (event.password) {
      throw new ForbiddenError('This event requires a password');
    }

    if (event.maxParticipants) {
      const count = await prisma.eventAccess.count({ where: { eventId: event.id } });
      if (count >= event.maxParticipants) {
        throw new ForbiddenError('Event is full');
      }
    }

    const existing = await prisma.eventAccess.findUnique({
      where: { userId_eventId: { userId, eventId: event.id } },
    });

    if (existing) {
      return event;
    }

    await prisma.eventAccess.create({
      data: { userId, eventId: event.id, role: 'participant' },
    });

    return event;
  }

  async getParticipants(eventId: string) {
    return prisma.eventAccess.findMany({
      where: { eventId },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { joinedAt: 'desc' },
    });
  }

  async sendInvite(eventId: string, inviter: { userId: string; name?: string }, email: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError('Event');

    const inviterUser = await prisma.user.findUnique({ where: { id: inviter.userId } });
    const inviterName = inviter.name || inviterUser?.name || 'Someone';

    const result = await emailService.sendInvite(email, inviterName, event.title, event.code, config.frontendUrl);

    return result;
  }
}

export const eventService = new EventService();
