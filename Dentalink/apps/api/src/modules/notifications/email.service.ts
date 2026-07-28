import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { ReadStream } from 'node:fs';

export interface AppointmentEmailData {
  patientName: string;
  professionalName: string;
  dateStr: string;
  timeStr: string;
  address: string;
  clinicPhone: string;
  brandName?: string;
  logoUrl?: string;
  primaryColor?: string;
  replyToEmail?: string;
  confirmUrl?: string; // Solo para el de confirmación
  completeProfileUrl?: string; // Enlace público para completar datos
}

export type PatientEmailAttachment = {
  filename: string;
  content: ReadStream | Buffer;
  contentType?: string;
};

export type SendPatientEmailInput = {
  to: string;
  cc?: string;
  replyTo?: string;
  fromAddress?: string;
  fromName?: string;
  subject: string;
  html: string;
  text: string;
  attachments?: PatientEmailAttachment[];
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter!: nodemailer.Transporter;
  private readonly isEnabled: boolean;
  private readonly fromAddress: string;
  private readonly fromName: string;

  constructor(private readonly configService: ConfigService) {
    this.isEnabled = this.configService.get<string>('MAIL_ENABLED') === 'true';
    this.fromAddress = this.configService.get<string>('MAIL_FROM_ADDRESS') || 'no-reply@dentalsuite.com';
    this.fromName = this.configService.get<string>('MAIL_FROM_NAME') || 'DentalSuite';

    if (this.isEnabled) {
      this.transporter = nodemailer.createTransport({
        host: this.configService.get<string>('MAIL_HOST'),
        port: parseInt(this.configService.get<string>('MAIL_PORT') || '587', 10),
        secure: this.configService.get<string>('MAIL_SECURE') === 'true',
        auth: {
          user: this.configService.get<string>('MAIL_USER'),
          pass: this.configService.get<string>('MAIL_PASSWORD'),
        },
      });
    }
  }

  getDefaultSender() {
    return {
      fromAddress: this.fromAddress,
      fromName: this.fromName,
      provider: this.configService.get<string>('MAIL_PROVIDER')?.trim() || 'smtp'
    };
  }

  async sendPatientEmail(input: SendPatientEmailInput): Promise<{ providerMessageId?: string }> {
    if (!this.isEnabled) {
      throw new ServiceUnavailableException('El servicio de correo no esta configurado para esta organizacion');
    }

    try {
      const fromAddress = input.fromAddress?.trim().toLowerCase() || this.fromAddress;
      const fromName = input.fromName?.trim() || this.fromName;
      if (/[^\x20-\x7E]/.test(fromAddress) || /[\r\n]/.test(fromName) || !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(fromAddress)) {
        throw new BadRequestException('El remitente configurado no es valido');
      }
      const result = await this.transporter.sendMail({
        from: `"${fromName.replace(/["<>]/g, "")}" <${fromAddress}>`,
        to: input.to,
        cc: input.cc,
        replyTo: input.replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text,
        attachments: input.attachments
      });

      this.logger.log(`Patient email sent to ${input.to}`);
      return { providerMessageId: result.messageId };
    } catch (error) {
      this.logger.error(`Failed to send patient email to ${input.to}`, error);
      throw new ServiceUnavailableException('No fue posible enviar el correo. Intenta nuevamente.');
    }
  }

  private getBaseTemplate(title: string, content: string, clinicPhone: string, data?: AppointmentEmailData): string {
    const brandName = this.escapeHtml(data?.brandName || 'Dental+');
    const primaryColor = /^#[0-9a-f]{6}$/i.test(data?.primaryColor || '') ? data?.primaryColor : '#2563eb';
    const safeClinicPhone = this.escapeHtml(clinicPhone);
    const safeLogoUrl = data?.logoUrl && /^https:\/\//i.test(data.logoUrl) ? this.escapeHtmlAttribute(data.logoUrl) : undefined;
    const logo =
      safeLogoUrl
        ? `<img src="${safeLogoUrl}" alt="${brandName}" style="display:block;max-width:160px;max-height:72px;height:auto;border:0;">`
        : `<div class="logo">${brandName}</div>`;
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 20px; color: #1f2937; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
    .header { padding: 30px 40px 10px; }
    .logo { color: ${primaryColor}; font-size: 24px; font-weight: 800; text-decoration: none; display: flex; align-items: center; }
    .logo span { color: #1f2937; }
    .content { padding: 20px 40px 40px; }
    .title { font-size: 24px; font-weight: 700; margin: 0 0 24px; color: #111827; }
    .datetime-card { background-color: #f0f9ff; border-radius: 12px; padding: 20px; display: flex; justify-content: space-between; margin-bottom: 30px; }
    .datetime-item { display: flex; align-items: center; gap: 12px; }
    .icon { width: 32px; height: 32px; background-color: #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #3b82f6; font-weight: bold; border: 1px solid #bfdbfe; }
    .datetime-label { font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600; margin: 0; }
    .datetime-val { font-size: 16px; font-weight: 600; color: #1f2937; margin: 0; }
    .details-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    .details-table td { padding: 16px 0; border-bottom: 1px solid #e5e7eb; }
    .details-table td:first-child { width: 30%; color: #6b7280; font-size: 14px; }
    .details-table td:last-child { width: 70%; font-weight: 500; font-size: 14px; }
    .footer { text-align: center; margin-top: 30px; font-size: 13px; color: #6b7280; }
    .footer a { color: #3b82f6; text-decoration: none; }
    .btn { display: inline-block; background-color: ${primaryColor}; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px; margin-top: 20px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${logo}
    </div>
    <div class="content">
      ${content}
      
      <div class="footer">
        Si no puedes asistir o necesitas reagendar tu cita, ponte en contacto con ${brandName} llamando al <a href="tel:${safeClinicPhone}">${safeClinicPhone}</a>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  }

  private generateAppointmentContent(title: string, data: AppointmentEmailData, withConfirmBtn: boolean = false): string {
    const btnHtml = withConfirmBtn && data.confirmUrl 
      ? `<a href="${data.confirmUrl}" class="btn">Confirma o anula tu cita aquí</a>` 
      : data.completeProfileUrl
      ? `<a href="${data.completeProfileUrl}" class="btn" style="background-color: #3b82f6;">Completa tus datos</a>`
      : ``;

    return `
      <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600; margin-bottom: 8px;">${data.patientName}</div>
      <h1 class="title">${title}</h1>
      
      <div class="datetime-card">
        <div class="datetime-item">
          <div class="icon">📅</div>
          <div>
            <p class="datetime-label">Fecha</p>
            <p class="datetime-val">${data.dateStr}</p>
          </div>
        </div>
        <div class="datetime-item">
          <div class="icon">🕒</div>
          <div>
            <p class="datetime-label">Hora</p>
            <p class="datetime-val">${data.timeStr}</p>
          </div>
        </div>
      </div>

      <table class="details-table">
        <tr>
          <td>Paciente</td>
          <td>${data.patientName}</td>
        </tr>
        <tr>
          <td>Profesional</td>
          <td>${data.professionalName}</td>
        </tr>
        <tr>
          <td>Dirección</td>
          <td>${data.address}</td>
        </tr>
      </table>

      ${btnHtml}
    `;
  }

  async sendAppointmentScheduled(to: string, data: AppointmentEmailData): Promise<void> {
    if (!this.isEnabled) {
      this.logger.log(`[Email Disabled] Would send 'Scheduled' email to ${to}`);
      return;
    }

    const content = this.generateAppointmentContent('Cita agendada', data, false);
    const html = this.getBaseTemplate('Cita agendada', content, data.clinicPhone, data);

    try {
      await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromAddress}>`,
        to,
        replyTo: data.replyToEmail,
        subject: 'Tu cita ha sido agendada',
        html,
      });
      this.logger.log(`Email 'Scheduled' sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send 'Scheduled' email to ${to}`, error);
    }
  }

  async sendAppointmentConfirmationRequired(to: string, data: AppointmentEmailData): Promise<void> {
    if (!this.isEnabled) {
      this.logger.warn(`[Email Disabled] Confirmation email was not sent to ${to}. Link: ${data.confirmUrl}`);
      return;
    }

    if (!data.confirmUrl) {
      throw new BadRequestException('No se genero el enlace de confirmacion de la cita');
    }

    const content = this.generateAppointmentContent('Confirma tu cita', data, true);
    const html = this.getBaseTemplate('Confirma tu cita', content, data.clinicPhone, data);

    try {
      await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromAddress}>`,
        to,
        replyTo: data.replyToEmail,
        subject: 'Acción requerida: Confirma tu cita',
        html,
      });
      this.logger.log(`Email 'Confirmation Required' sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send 'Confirmation Required' email to ${to}`, error);
      throw new ServiceUnavailableException('No se pudo enviar el correo de confirmacion');
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private escapeHtmlAttribute(value: string): string {
    return this.escapeHtml(value).replace(/`/g, '&#096;');
  }
}
