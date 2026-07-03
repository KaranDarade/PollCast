import { Request, Response } from 'express';
import { eventService } from '../services/event.service';
import { createEventSchema, updateEventSchema, joinEventSchema } from '../validators/event';
import { sendInviteSchema } from '../validators/invite';

export class EventController {
  async create(req: Request, res: Response) {
    const input = createEventSchema.parse(req.body);
    const event = await eventService.createEvent(req.user!.userId, input);
    res.status(201).json({ success: true, message: 'Event created', data: event });
  }

  async getById(req: Request, res: Response) {
    const event = await eventService.getEventById(req.params.id!);
    res.json({ success: true, data: event });
  }

  async getByCode(req: Request, res: Response) {
    const event = await eventService.getEventByCode(req.params.code!);
    res.json({ success: true, data: event });
  }

  async getMyEvents(req: Request, res: Response) {
    const events = await eventService.getHostEvents(req.user!.userId);
    res.json({ success: true, data: events });
  }

  async getJoinedEvents(req: Request, res: Response) {
    const events = await eventService.getJoinedEvents(req.user!.userId);
    res.json({ success: true, data: events });
  }

  async update(req: Request, res: Response) {
    const input = updateEventSchema.parse(req.body);
    const event = await eventService.updateEvent(req.params.id!, req.user!.userId, input);
    res.json({ success: true, message: 'Event updated', data: event });
  }

  async delete(req: Request, res: Response) {
    await eventService.deleteEvent(req.params.id!, req.user!.userId);
    res.json({ success: true, message: 'Event deleted' });
  }

  async join(req: Request, res: Response) {
    const input = joinEventSchema.parse(req.body);
    const event = await eventService.joinEvent(req.user!.userId, input.code, input.password);
    res.json({ success: true, message: 'Joined event', data: event });
  }

  async getParticipants(req: Request, res: Response) {
    const participants = await eventService.getParticipants(req.params.id!);
    res.json({ success: true, data: participants });
  }

  async sendInvite(req: Request, res: Response) {
    const input = sendInviteSchema.parse(req.body);
    const result = await eventService.sendInvite(req.params.id!, req.user!, input.email);
    res.json({ success: true, message: 'Invite sent', data: result });
  }
}

export const eventController = new EventController();
