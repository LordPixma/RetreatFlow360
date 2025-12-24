import {
  Button,
  Heading,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from './base-layout';

export interface WelcomeEmailProps {
  tenantName: string;
  tenantLogo?: string;
  userName: string;
  verificationUrl?: string;
  loginUrl: string;
  features?: string[];
}

export function WelcomeEmail({
  tenantName,
  tenantLogo,
  userName,
  verificationUrl,
  loginUrl,
  features,
}: WelcomeEmailProps) {
  const defaultFeatures = [
    'Browse and register for upcoming events',
    'Manage your bookings and payments',
    'Set your dietary requirements and accessibility needs',
    'Receive event reminders and updates',
  ];

  const displayFeatures = features || defaultFeatures;

  return (
    <BaseLayout
      preview={`Welcome to ${tenantName}!`}
      tenantName={tenantName}
      tenantLogo={tenantLogo}
    >
      <Heading style={heading}>Welcome to {tenantName}!</Heading>

      <Text style={paragraph}>Hi {userName},</Text>

      <Text style={paragraph}>
        Thank you for joining {tenantName}! We're thrilled to have you as part
        of our community. Your account has been created and you're all set to
        start exploring our events.
      </Text>

      {verificationUrl && (
        <Section style={verifySection}>
          <Text style={verifyText}>
            Please verify your email address to unlock all features:
          </Text>
          <Button style={verifyButton} href={verificationUrl}>
            Verify Email Address
          </Button>
        </Section>
      )}

      <Section style={featuresSection}>
        <Heading as="h3" style={featuresHeading}>
          What You Can Do
        </Heading>
        <ul style={featuresList}>
          {displayFeatures.map((feature, index) => (
            <li key={index} style={featureItem}>
              {feature}
            </li>
          ))}
        </ul>
      </Section>

      <Section style={buttonContainer}>
        <Button style={button} href={loginUrl}>
          Get Started
        </Button>
      </Section>

      <Text style={paragraph}>
        If you have any questions or need help getting started, don't hesitate
        to reach out to our support team.
      </Text>

      <Text style={paragraph}>
        Welcome aboard!
        <br />
        <br />
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

const verifySection = {
  backgroundColor: '#fefce8',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
  textAlign: 'center' as const,
  border: '1px solid #fef08a',
};

const verifyText = {
  color: '#854d0e',
  fontSize: '14px',
  margin: '0 0 16px 0',
};

const verifyButton = {
  backgroundColor: '#ca8a04',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '10px 20px',
};

const featuresSection = {
  backgroundColor: '#f0fdf4',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
  border: '1px solid #bbf7d0',
};

const featuresHeading = {
  color: '#166534',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 12px 0',
};

const featuresList = {
  margin: '0',
  paddingLeft: '20px',
};

const featureItem = {
  color: '#15803d',
  fontSize: '14px',
  lineHeight: '24px',
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

export default WelcomeEmail;
