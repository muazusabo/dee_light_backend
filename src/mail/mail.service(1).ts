import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { isProd } from '../config/env';

@Injectable()
export class MailService {
  private logger = new Logger('Mail');
  private transport = process.env.SMTP_HOST
    ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587), auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined })
    : null;

  async send(to: string, subject: string, text: string, devLog?: string) {
    if (!this.transport) {
      if (isProd()) this.logger.warn(`SMTP is not configured; email "${subject}" was not sent.`);
      else this.logger.log(`[dev email to ${to}] ${subject}${devLog ? ` -> ${devLog}` : ''}`);
      return;
    }
    try { await this.transport.sendMail({ from: process.env.MAIL_FROM || 'DEE-LIGHT <no-reply@localhost>', to, subject, text }); }
    catch (e) { this.logger.error(`Failed to send email: ${(e as Error).message}`); }
  }
}
