import * as React from 'react';
import { createEmailClient, type EmailClient, type SendEmailResult } from './client';
import {
  BookingConfirmation,
  type BookingConfirmationProps,
  PaymentReceipt,
  type PaymentReceiptProps,
  EventReminder,
  type EventReminderProps,
  PaymentFailed,
  type PaymentFailedProps,
  RefundConfirmation,
  type RefundConfirmationProps,
  WelcomeEmail,
  type WelcomeEmailProps,
  PasswordReset,
  type PasswordResetProps,
} from './templates';

export interface EmailServiceConfig {
  apiKey?: string;
  defaultFrom?: string;
  defaultReplyTo?: string;
}

/**
 * Email service for sending templated emails
 */
export class EmailService {
  private client: EmailClient;
  private defaultFrom: string;
  private defaultReplyTo?: string;

  constructor(config: EmailServiceConfig = {}) {
    this.client = createEmailClient(config.apiKey);
    this.defaultFrom = config.defaultFrom || 'RetreatFlow360 <noreply@retreatflow360.com>';
    this.defaultReplyTo = config.defaultReplyTo;
  }

  /**
   * Send booking confirmation email
   */
  async sendBookingConfirmation(
    to: string,
    props: BookingConfirmationProps
  ): Promise<SendEmailResult> {
    return this.client.send(
      {
        to,
        subject: `Booking Confirmed - ${props.eventTitle}`,
        from: this.getFrom(props.tenantName),
        replyTo: this.defaultReplyTo,
        tags: [
          { name: 'type', value: 'booking_confirmation' },
          { name: 'event', value: props.eventTitle },
        ],
      },
      React.createElement(BookingConfirmation, props)
    );
  }

  /**
   * Send payment receipt email
   */
  async sendPaymentReceipt(
    to: string,
    props: PaymentReceiptProps
  ): Promise<SendEmailResult> {
    return this.client.send(
      {
        to,
        subject: `Payment Receipt - ${props.eventTitle}`,
        from: this.getFrom(props.tenantName),
        replyTo: this.defaultReplyTo,
        tags: [
          { name: 'type', value: 'payment_receipt' },
          { name: 'event', value: props.eventTitle },
        ],
      },
      React.createElement(PaymentReceipt, props)
    );
  }

  /**
   * Send event reminder email
   */
  async sendEventReminder(
    to: string,
    props: EventReminderProps
  ): Promise<SendEmailResult> {
    const subject =
      props.daysUntilEvent === 0
        ? `Today: ${props.eventTitle}`
        : props.daysUntilEvent === 1
          ? `Tomorrow: ${props.eventTitle}`
          : `Reminder: ${props.eventTitle} in ${props.daysUntilEvent} days`;

    return this.client.send(
      {
        to,
        subject,
        from: this.getFrom(props.tenantName),
        replyTo: this.defaultReplyTo,
        tags: [
          { name: 'type', value: 'event_reminder' },
          { name: 'event', value: props.eventTitle },
        ],
      },
      React.createElement(EventReminder, props)
    );
  }

  /**
   * Send payment failed email
   */
  async sendPaymentFailed(
    to: string,
    props: PaymentFailedProps
  ): Promise<SendEmailResult> {
    return this.client.send(
      {
        to,
        subject: `Payment Failed - ${props.eventTitle}`,
        from: this.getFrom(props.tenantName),
        replyTo: this.defaultReplyTo,
        tags: [
          { name: 'type', value: 'payment_failed' },
          { name: 'event', value: props.eventTitle },
        ],
      },
      React.createElement(PaymentFailed, props)
    );
  }

  /**
   * Send refund confirmation email
   */
  async sendRefundConfirmation(
    to: string,
    props: RefundConfirmationProps
  ): Promise<SendEmailResult> {
    return this.client.send(
      {
        to,
        subject: `Refund Processed - ${props.eventTitle}`,
        from: this.getFrom(props.tenantName),
        replyTo: this.defaultReplyTo,
        tags: [
          { name: 'type', value: 'refund_confirmation' },
          { name: 'event', value: props.eventTitle },
        ],
      },
      React.createElement(RefundConfirmation, props)
    );
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(
    to: string,
    props: WelcomeEmailProps
  ): Promise<SendEmailResult> {
    return this.client.send(
      {
        to,
        subject: `Welcome to ${props.tenantName}!`,
        from: this.getFrom(props.tenantName),
        replyTo: this.defaultReplyTo,
        tags: [{ name: 'type', value: 'welcome' }],
      },
      React.createElement(WelcomeEmail, props)
    );
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(
    to: string,
    props: PasswordResetProps
  ): Promise<SendEmailResult> {
    return this.client.send(
      {
        to,
        subject: `Reset Your Password - ${props.tenantName}`,
        from: this.getFrom(props.tenantName),
        replyTo: this.defaultReplyTo,
        tags: [{ name: 'type', value: 'password_reset' }],
      },
      React.createElement(PasswordReset, props)
    );
  }

  /**
   * Get the from address for a tenant
   */
  private getFrom(tenantName: string): string {
    // Extract the email domain from the default from
    const match = this.defaultFrom.match(/<(.+)>/);
    const email = match ? match[1] : 'noreply@retreatflow360.com';
    return `${tenantName} <${email}>`;
  }
}

/**
 * Create an email service instance
 */
export function createEmailService(config: EmailServiceConfig = {}): EmailService {
  return new EmailService(config);
}
