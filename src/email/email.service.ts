import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { AuthChallengePurpose } from '../auth/auth-challenge.entity';

@Injectable()
export class EmailService {
  constructor(private readonly configService: ConfigService) {}

  async sendAuthChallenge(params: { to: string; code: string; purpose: AuthChallengePurpose }) {
    const host = this.configService.get('EMAIL_HOST');
    const port = Number(this.configService.get('EMAIL_PORT') ?? 587);
    const user = this.configService.get('EMAIL_USER');
    const pass = this.configService.get('EMAIL_PASSWORD');
    const secure = String(this.configService.get('SECURE') ?? 'false').toLowerCase() === 'true';

    if (!host || !user || !pass) {
      throw new Error('Email not configured');
    }

    const transport = nodemailer.createTransport({
      host: String(host),
      port,
      secure,
      auth: {
        user: String(user),
        pass: String(pass),
      },
    });

    const subject =
      params.purpose === 'email_verify'
        ? 'Your NOPE email verification code'
        : 'Your NOPE login verification code';

    await transport.sendMail({
      from: String(user),
      to: params.to,
      subject,
      text: `Your verification code is: ${params.code}`,
    });

    return { ok: true };
  }

  async sendOtp(params: { to: string; code: string; on: boolean }) {
    const host = this.configService.get('EMAIL_HOST');
    const port = Number(this.configService.get('EMAIL_PORT') ?? 587);
    const user = this.configService.get('EMAIL_USER');
    const pass = this.configService.get('EMAIL_PASSWORD');
    const secure = String(this.configService.get('SECURE') ?? 'false').toLowerCase() === 'true';

    if (!host || !user || !pass) {
      throw new Error('Email not configured');
    }

    const transport = nodemailer.createTransport({
      host: String(host),
      port,
      secure,
      auth: {
        user: String(user),
        pass: String(pass),
      },
    });

    const subject = params.on ? 'Your NOPE 2FA enable code' : 'Your NOPE 2FA disable code';

    await transport.sendMail({
      from: String(user),
      to: params.to,
      subject,
      text: `Your verification code is: ${params.code}`,
    });

    return { ok: true };
  }
}
