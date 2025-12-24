import {
  Button,
  Heading,
  Section,
  Text,
  Row,
  Column,
} from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from './base-layout';

export interface PaymentFailedProps {
  tenantName: string;
  tenantLogo?: string;
  attendeeName: string;
  eventTitle: string;
  bookingId: string;
  amount: string;
  currency: string;
  failureReason?: string;
  retryPaymentUrl: string;
  supportEmail: string;
}

export function PaymentFailed({
  tenantName,
  tenantLogo,
  attendeeName,
  eventTitle,
  bookingId,
  amount,
  currency,
  failureReason,
  retryPaymentUrl,
  supportEmail,
}: PaymentFailedProps) {
  return (
    <BaseLayout
      preview={`Payment failed for ${eventTitle}`}
      tenantName={tenantName}
      tenantLogo={tenantLogo}
    >
      <Heading style={heading}>Payment Failed</Heading>

      <Text style={paragraph}>Hi {attendeeName},</Text>

      <Text style={paragraph}>
        Unfortunately, we were unable to process your payment for{' '}
        <strong>{eventTitle}</strong>. Don't worry - your booking is still
        reserved, but we'll need you to complete the payment to confirm your
        spot.
      </Text>

      <Section style={alertBox}>
        <Text style={alertText}>
          {failureReason ||
            'Your payment could not be processed. This may be due to insufficient funds, an expired card, or a temporary issue with your payment provider.'}
        </Text>
      </Section>

      <Section style={detailsBox}>
        <Row style={detailRow}>
          <Column style={detailLabel}>Event</Column>
          <Column style={detailValue}>{eventTitle}</Column>
        </Row>

        <Row style={detailRow}>
          <Column style={detailLabel}>Booking ID</Column>
          <Column style={detailValue}>{bookingId}</Column>
        </Row>

        <Row style={detailRow}>
          <Column style={detailLabel}>Amount Due</Column>
          <Column style={detailValue}>
            {currency} {amount}
          </Column>
        </Row>
      </Section>

      <Section style={buttonContainer}>
        <Button style={button} href={retryPaymentUrl}>
          Retry Payment
        </Button>
      </Section>

      <Text style={paragraph}>
        <strong>What you can try:</strong>
      </Text>
      <ul style={list}>
        <li style={listItem}>Check that your card details are correct</li>
        <li style={listItem}>
          Ensure you have sufficient funds in your account
        </li>
        <li style={listItem}>Try a different payment method</li>
        <li style={listItem}>
          Contact your bank if the issue persists
        </li>
      </ul>

      <Text style={paragraph}>
        If you continue to experience issues or need assistance, please contact
        us at{' '}
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
  color: '#dc2626',
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

const alertBox = {
  backgroundColor: '#fef2f2',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '24px 0',
  border: '1px solid #fecaca',
};

const alertText = {
  color: '#991b1b',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
};

const detailsBox = {
  backgroundColor: '#f6f9fc',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
};

const detailRow = {
  margin: '8px 0',
};

const detailLabel = {
  color: '#8898aa',
  fontSize: '14px',
  width: '120px',
  verticalAlign: 'top' as const,
};

const detailValue = {
  color: '#1a1a1a',
  fontSize: '14px',
  fontWeight: '500',
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

export default PaymentFailed;
