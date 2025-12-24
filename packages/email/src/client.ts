import { render } from '@react-email/components';
import type { ReactElement } from 'react';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  tags?: Array<{ name: string; value: string }>;
}

export interface SendEmailResult {
  id: string;
  success: boolean;
}

export interface EmailClient {
  send(options: EmailOptions, template: ReactElement): Promise<SendEmailResult>;
  sendHtml(options: EmailOptions, html: string): Promise<SendEmailResult>;
}

/**
 * Create a Resend email client
 */
export function createResendClient(apiKey: string): EmailClient {
  const baseUrl = 'https://api.resend.com';

  async function sendRequest(body: Record<string, unknown>): Promise<SendEmailResult> {
    const response = await fetch(`${baseUrl}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Resend API error:', error);
      throw new Error(`Failed to send email: ${error}`);
    }

    const result = await response.json() as { id: string };
    return {
      id: result.id,
      success: true,
    };
  }

  return {
    async send(options: EmailOptions, template: ReactElement): Promise<SendEmailResult> {
      const html = await render(template);
      return this.sendHtml(options, html);
    },

    async sendHtml(options: EmailOptions, html: string): Promise<SendEmailResult> {
      const body: Record<string, unknown> = {
        from: options.from || 'RetreatFlow360 <noreply@retreatflow360.com>',
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html,
      };

      if (options.replyTo) {
        body.reply_to = options.replyTo;
      }

      if (options.cc) {
        body.cc = Array.isArray(options.cc) ? options.cc : [options.cc];
      }

      if (options.bcc) {
        body.bcc = Array.isArray(options.bcc) ? options.bcc : [options.bcc];
      }

      if (options.tags && options.tags.length > 0) {
        body.tags = options.tags;
      }

      return sendRequest(body);
    },
  };
}

/**
 * Create a mock email client for development/testing
 */
export function createMockClient(): EmailClient {
  return {
    async send(options: EmailOptions, template: ReactElement): Promise<SendEmailResult> {
      const html = await render(template);
      console.log('Mock email sent:', {
        ...options,
        htmlLength: html.length,
      });
      return {
        id: `mock-${Date.now()}`,
        success: true,
      };
    },

    async sendHtml(options: EmailOptions, html: string): Promise<SendEmailResult> {
      console.log('Mock email sent:', {
        ...options,
        htmlLength: html.length,
      });
      return {
        id: `mock-${Date.now()}`,
        success: true,
      };
    },
  };
}

/**
 * Create an email client based on environment
 */
export function createEmailClient(apiKey?: string): EmailClient {
  if (apiKey) {
    return createResendClient(apiKey);
  }
  return createMockClient();
}
