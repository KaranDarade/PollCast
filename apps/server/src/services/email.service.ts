import nodemailer from 'nodemailer';
import { config } from '../config';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;

  if (config.smtp.host && config.smtp.user && config.smtp.pass) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  }

  return transporter;
}

export class EmailService {
  async sendInvite(email: string, inviterName: string, eventTitle: string, eventCode: string, frontendUrl: string) {
    const t = getTransporter();
    const eventLink = `${frontendUrl}/event/${eventCode}`;
    const signupLink = `${frontendUrl}/signup?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(eventLink)}`;

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2>You're invited to PollCast!</h2>
        <p><strong>${inviterName}</strong> has invited you to join <strong>${eventTitle}</strong>.</p>
        <p>Click below to join the event:</p>
        <a href="${eventLink}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;margin:16px 0;">Join Event</a>
        <p style="color:#888;font-size:14px;">Event code: <strong>${eventCode}</strong></p>
        <hr style="border:none;border-top:1px solid #eee;" />
        <p style="color:#888;font-size:12px;">If you don't have an account yet, <a href="${signupLink}">create one here</a> with this email address.</p>
      </div>
    `;

    if (!t) {
      console.log(`[EmailService] SMTP not configured. Would send invite to ${email}:`, { inviterName, eventTitle, eventCode, eventLink, signupLink });
      return { sent: false, reason: 'SMTP not configured' };
    }

    try {
      await t.sendMail({
        from: config.smtp.from,
        to: email,
        subject: `${inviterName} invited you to "${eventTitle}" on PollCast`,
        html,
      });
      console.log(`[EmailService] Invite sent to ${email}`);
      return { sent: true };
    } catch (err: any) {
      console.error(`[EmailService] Failed to send invite to ${email}:`, err.message);
      return { sent: false, reason: err.message };
    }
  }
}

export const emailService = new EmailService();
