import {
  Button,
  Heading,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from './base-layout';

export interface PasswordResetProps {
  tenantName: string;
  tenantLogo?: string;
  userName: string;
  resetUrl: string;
  expirationMinutes: number;
  supportEmail: string;
}

export function PasswordReset({
  tenantName,
  tenantLogo,
  userName,
  resetUrl,
  expirationMinutes,
  supportEmail,
}: PasswordResetProps) {
  return (
    <BaseLayout
      preview={`Reset your ${tenantName} password`}
      tenantName={tenantName}
      tenantLogo={tenantLogo}
    >
      <Heading style={heading}>Reset Your Password</Heading>

      <Text style={paragraph}>Hi {userName},</Text>

      <Text style={paragraph}>
        We received a request to reset your password for your {tenantName}{' '}
        account. Click the button below to create a new password.
      </Text>

      <Section style={buttonContainer}>
        <Button style={button} href={resetUrl}>
          Reset Password
        </Button>
      </Section>

      <Section style={warningBox}>
        <Text style={warningText}>
          This link will expire in <strong>{expirationMinutes} minutes</strong>.
          If you didn't request a password reset, you can safely ignore this
          email.
        </Text>
      </Section>

      <Text style={paragraph}>
        <strong>Security Tips:</strong>
      </Text>
      <ul style={list}>
        <li style={listItem}>Use a strong, unique password</li>
        <li style={listItem}>
          Don't share your password with anyone
        </li>
        <li style={listItem}>
          Enable two-factor authentication for extra security
        </li>
      </ul>

      <Text style={paragraph}>
        If you didn't request this password reset or need assistance, please
        contact us at{' '}
        <a href={`mailto:${supportEmail}`} style={link}>
          {supportEmail}
        </a>
        .
      </Text>

      <Text style={paragraph}>
        Best regards,
        <br />
        The {tenantName} Team
      </Text>
    </BaseLayout>
  );
}

const heading = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: '600',
  textAlign: 'center' as const,
  margin: '30px 0',
};

const paragraph = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#556cd6',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
};

const warningBox = {
  backgroundColor: '#fef3c7',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '24px 0',
  border: '1px solid #fcd34d',
};

const warningText = {
  color: '#92400e',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
};

const list = {
  margin: '0 0 16px 0',
  paddingLeft: '20px',
};

const listItem = {
  color: '#525f7f',
  fontSize: '14px',
  lineHeight: '24px',
};

const link = {
  color: '#556cd6',
  textDecoration: 'none',
};

export default PasswordReset;
