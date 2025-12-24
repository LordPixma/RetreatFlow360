// Client
export {
  createEmailClient,
  createResendClient,
  createMockClient,
  type EmailClient,
  type EmailOptions,
  type SendEmailResult,
} from './client';

// Service
export {
  EmailService,
  createEmailService,
  type EmailServiceConfig,
} from './service';

// Templates
export * from './templates';
